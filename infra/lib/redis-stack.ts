import * as cdk from "aws-cdk-lib";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as elasticache from "aws-cdk-lib/aws-elasticache";
import { Construct } from "constructs";

interface RedisStackProps extends cdk.StackProps {
  vpc: ec2.Vpc;
}

export class RedisStack extends cdk.Stack {
  public readonly redisEndpoint: string;
  public readonly redisPort: string;

  constructor(scope: Construct, id: string, props: RedisStackProps) {
    super(scope, id, props);

    // Security group — allow anything in the VPC to connect
    const redisSg = new ec2.SecurityGroup(this, "RedisSg", {
      vpc: props.vpc,
      description: "ElastiCache Redis",
      allowAllOutbound: false,
    });
    redisSg.addIngressRule(
      ec2.Peer.ipv4(props.vpc.vpcCidrBlock),
      ec2.Port.tcp(6379),
      "VPC to Redis"
    );

    // Subnet group — private subnets only
    const subnetGroup = new elasticache.CfnSubnetGroup(this, "RedisSubnetGroup", {
      description: "Hangar Redis subnet group",
      subnetIds: props.vpc.privateSubnets.map((s) => s.subnetId),
      cacheSubnetGroupName: "hangar-redis",
    });

    // ElastiCache Redis — single node, t4g.micro (~$12/mo)
    const redis = new elasticache.CfnCacheCluster(this, "HangarRedis", {
      clusterName: "hangar-redis",
      engine: "redis",
      cacheNodeType: "cache.t4g.micro",
      numCacheNodes: 1,
      cacheSubnetGroupName: subnetGroup.cacheSubnetGroupName,
      vpcSecurityGroupIds: [redisSg.securityGroupId],
      autoMinorVersionUpgrade: true,
      snapshotRetentionLimit: 1, // Keep 1 daily snapshot
    });

    redis.addDependency(subnetGroup);

    this.redisEndpoint = redis.attrRedisEndpointAddress;
    this.redisPort = redis.attrRedisEndpointPort;

    new cdk.CfnOutput(this, "RedisEndpoint", {
      value: redis.attrRedisEndpointAddress,
      exportName: "HangarRedisEndpoint",
    });
    new cdk.CfnOutput(this, "RedisUrl", {
      value: `redis://${redis.attrRedisEndpointAddress}:6379/`,
      exportName: "HangarRedisUrl",
    });
  }
}
