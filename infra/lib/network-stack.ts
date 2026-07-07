import * as cdk from "aws-cdk-lib";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import { Construct } from "constructs";

export class NetworkStack extends cdk.Stack {
  public readonly vpc: ec2.Vpc;
  public readonly natInstance: ec2.Instance;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // VPC — 2 AZs, public + private subnets, NO managed NAT Gateway (too expensive)
    this.vpc = new ec2.Vpc(this, "HangarVpc", {
      maxAzs: 2,
      natGateways: 0, // We use a NAT instance instead
      subnetConfiguration: [
        {
          name: "Public",
          subnetType: ec2.SubnetType.PUBLIC,
          cidrMask: 24,
        },
        {
          name: "Private",
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
          cidrMask: 24,
        },
      ],
    });

    // NAT instance (t4g.nano ~$3/mo) — replaces NAT Gateway (~$33/mo)
    const natSg = new ec2.SecurityGroup(this, "NatInstanceSg", {
      vpc: this.vpc,
      description: "NAT instance security group",
      allowAllOutbound: true,
    });
    natSg.addIngressRule(
      ec2.Peer.ipv4(this.vpc.vpcCidrBlock),
      ec2.Port.allTraffic(),
      "Allow all traffic from VPC"
    );

    const natAmi = ec2.MachineImage.latestAmazonLinux2023({
      cpuType: ec2.AmazonLinuxCpuType.ARM_64,
    });

    this.natInstance = new ec2.Instance(this, "NatInstance", {
      vpc: this.vpc,
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T4G, ec2.InstanceSize.NANO),
      machineImage: natAmi,
      vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },
      securityGroup: natSg,
      sourceDestCheck: false,
      userData: ec2.UserData.forLinux(),
    });

    this.natInstance.userData.addCommands(
      "echo 'net.ipv4.ip_forward=1' >> /etc/sysctl.conf",
      "sysctl -p",
      "yum install -y iptables-services",
      "iptables -t nat -A POSTROUTING -o eth0 -j MASQUERADE",
      "service iptables save",
      "systemctl enable iptables"
    );

    // Route private subnets through NAT instance
    this.vpc.privateSubnets.forEach((subnet, i) => {
      new ec2.CfnRoute(this, `NatRoute${i}`, {
        routeTableId: subnet.routeTable.routeTableId,
        destinationCidrBlock: "0.0.0.0/0",
        instanceId: this.natInstance.instanceId,
      });
    });

    // S3 Gateway endpoint — free, avoids NAT for S3 traffic
    this.vpc.addGatewayEndpoint("S3Endpoint", {
      service: ec2.GatewayVpcEndpointAwsService.S3,
    });

    // Secrets Manager endpoint — required for Fargate task startup (secrets injection
    // happens before container launch; without this, new tasks time out and fail to start)
    // Cost: $0.01/hr × 2 AZs = ~$15/mo
    this.vpc.addInterfaceEndpoint("SecretsManagerEndpoint", {
      service: ec2.InterfaceVpcEndpointAwsService.SECRETS_MANAGER,
    });

    // ECR endpoints — required for Fargate to pull images from private subnets.
    // NAT instance cannot reliably serve ECR image pulls (large layer downloads time out).
    // Cost: $0.01/hr × 2 endpoints × 2 AZs = ~$29/mo
    this.vpc.addInterfaceEndpoint("EcrApiEndpoint", {
      service: ec2.InterfaceVpcEndpointAwsService.ECR,
    });
    this.vpc.addInterfaceEndpoint("EcrDkrEndpoint", {
      service: ec2.InterfaceVpcEndpointAwsService.ECR_DOCKER,
    });

    // SQS and CloudWatch Logs go through NAT instance — saves ~$29/mo vs having all 5 endpoints

    new cdk.CfnOutput(this, "VpcId", { value: this.vpc.vpcId });
    new cdk.CfnOutput(this, "NatInstanceId", { value: this.natInstance.instanceId });
  }
}
