import * as cdk from "aws-cdk-lib";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as rds from "aws-cdk-lib/aws-rds";
import * as secretsmanager from "aws-cdk-lib/aws-secretsmanager";
import { Construct } from "constructs";

interface DatabaseStackProps extends cdk.StackProps {
  vpc: ec2.Vpc;
}

export class DatabaseStack extends cdk.Stack {
  public readonly dbSecret: secretsmanager.Secret;
  public readonly proxyEndpoint: string;
  public readonly proxy: rds.DatabaseProxy;
  public readonly dbSg: ec2.SecurityGroup;
  public readonly rdsproxySg: ec2.SecurityGroup;

  constructor(scope: Construct, id: string, props: DatabaseStackProps) {
    super(scope, id, props);

    // Security groups defined here to avoid cross-stack reference cycles
    this.dbSg = new ec2.SecurityGroup(this, "DbSg", {
      vpc: props.vpc,
      description: "Aurora Serverless v2",
      allowAllOutbound: false,
    });

    this.rdsproxySg = new ec2.SecurityGroup(this, "RdsProxySg", {
      vpc: props.vpc,
      description: "RDS Proxy",
      allowAllOutbound: true,
    });

    // Allow anything in the VPC private range to connect to RDS Proxy and Aurora
    // (secure because these are private subnets — no public access)
    this.rdsproxySg.addIngressRule(ec2.Peer.ipv4(props.vpc.vpcCidrBlock), ec2.Port.tcp(5432), "VPC to RDS Proxy");
    this.dbSg.addIngressRule(ec2.Peer.ipv4(props.vpc.vpcCidrBlock), ec2.Port.tcp(5432), "VPC to Aurora");

    // DB credentials stored in Secrets Manager
    this.dbSecret = new secretsmanager.Secret(this, "HangarDbSecret", {
      secretName: "hangar/db-credentials",
      generateSecretString: {
        secretStringTemplate: JSON.stringify({ username: "plane" }),
        generateStringKey: "password",
        excludePunctuation: true,
        includeSpace: false,
      },
    });

    // Aurora Serverless v2 cluster
    const cluster = new rds.DatabaseCluster(this, "HangarAurora", {
      engine: rds.DatabaseClusterEngine.auroraPostgres({
        version: rds.AuroraPostgresEngineVersion.VER_15_8,
      }),
      credentials: rds.Credentials.fromSecret(this.dbSecret),
      defaultDatabaseName: "plane",
      serverlessV2MinCapacity: 0,    // Scale to zero when idle
      serverlessV2MaxCapacity: 4,    // Max 4 ACUs for burst
      writer: rds.ClusterInstance.serverlessV2("Writer"),
      vpc: props.vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      securityGroups: [this.dbSg],
      storageEncrypted: true,
      deletionProtection: false,     // Set true in production after first deploy
      removalPolicy: cdk.RemovalPolicy.SNAPSHOT,
    });

    // RDS Proxy — pools Lambda connections to avoid exhausting Aurora
    this.proxy = new rds.DatabaseProxy(this, "HangarRdsProxy", {
      proxyTarget: rds.ProxyTarget.fromCluster(cluster),
      secrets: [this.dbSecret],
      vpc: props.vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      securityGroups: [this.rdsproxySg],
      requireTLS: true,
      idleClientTimeout: cdk.Duration.minutes(30),
      maxConnectionsPercent: 90,
      debugLogging: false,
    });

    // Allow Lambda and ECS to use the proxy IAM auth
    this.proxy.grantConnect(
      new cdk.aws_iam.ArnPrincipal(`arn:aws:iam::${this.account}:root`),
      "plane"
    );

    this.proxyEndpoint = this.proxy.endpoint;

    // Outputs
    new cdk.CfnOutput(this, "DbProxyEndpoint", {
      value: this.proxy.endpoint,
      exportName: "HangarDbProxyEndpoint",
    });
    new cdk.CfnOutput(this, "DbSecretArn", {
      value: this.dbSecret.secretArn,
      exportName: "HangarDbSecretArn",
    });
  }
}
