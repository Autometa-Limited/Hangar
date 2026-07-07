#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import { NetworkStack } from "../lib/network-stack";
import { DatabaseStack } from "../lib/database-stack";
import { RedisStack } from "../lib/redis-stack";
import { StorageStack } from "../lib/storage-stack";
import { SecretsStack } from "../lib/secrets-stack";
import { BackendStack } from "../lib/backend-stack";
import { FrontendStack } from "../lib/frontend-stack";

const app = new cdk.App();

const env = {
  account: "713881813437",
  region: "us-east-1",
};

// 1. Network — VPC, NAT instance, VPC endpoints
const network = new NetworkStack(app, "HangarNetwork", { env });

// 2. Secrets — all app secrets in Secrets Manager
const secrets = new SecretsStack(app, "HangarSecrets", { env });

// 3. Storage — S3 bucket, SQS queue, SES domain
const storage = new StorageStack(app, "HangarStorage", { env });

// 4. Database — Aurora Serverless v2 + RDS Proxy
const database = new DatabaseStack(app, "HangarDatabase", {
  env,
  vpc: network.vpc,
});

// 5. Redis — ElastiCache t4g.micro (~$12/mo flat)
const redis = new RedisStack(app, "HangarRedis", {
  env,
  vpc: network.vpc,
});

// 6. Backend — ECS (api, live, worker, beat) + ALB
const backend = new BackendStack(app, "HangarBackend", {
  env,
  vpc: network.vpc,
  filesBucket: storage.filesBucket,
  celeryQueue: storage.celeryQueue,
  dbProxyEndpoint: database.proxyEndpoint,
  dbSecret: database.dbSecret,
  appSecret: secrets.appSecret,
  redisEndpoint: redis.redisEndpoint,
  redisPort: redis.redisPort,
});

// 7. Frontend — Amplify apps (web, admin, space)
new FrontendStack(app, "HangarFrontend", {
  env,
  apiGatewayUrl: backend.apiUrl,
  albDnsName: backend.albDnsName,
});
