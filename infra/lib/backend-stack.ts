import * as cdk from "aws-cdk-lib";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as ecs from "aws-cdk-lib/aws-ecs";
import * as ecr from "aws-cdk-lib/aws-ecr";
import * as iam from "aws-cdk-lib/aws-iam";
import * as logs from "aws-cdk-lib/aws-logs";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as sqs from "aws-cdk-lib/aws-sqs";
import * as secretsmanager from "aws-cdk-lib/aws-secretsmanager";
import * as elbv2 from "aws-cdk-lib/aws-elasticloadbalancingv2";
import { Construct } from "constructs";

interface BackendStackProps extends cdk.StackProps {
  vpc: ec2.Vpc;
  filesBucket: s3.Bucket;
  celeryQueue: sqs.Queue;
  dbProxyEndpoint: string;
  dbSecret: secretsmanager.Secret;
  appSecret: secretsmanager.Secret;
  redisEndpoint: string;
  redisPort: string;
}

export class BackendStack extends cdk.Stack {
  public readonly apiUrl: string;
  public readonly albDnsName: string;

  constructor(scope: Construct, id: string, props: BackendStackProps) {
    super(scope, id, props);

    // ── Security Groups ──────────────────────────────────────────────
    const albSg = new ec2.SecurityGroup(this, "AlbSg", {
      vpc: props.vpc,
      description: "API ALB",
      allowAllOutbound: true,
    });
    albSg.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(80), "HTTP from internet");

    const ecsSg = new ec2.SecurityGroup(this, "EcsSg", {
      vpc: props.vpc,
      description: "ECS Fargate tasks",
      allowAllOutbound: true,
    });
    // Allow ALB to reach API containers on port 8000
    ecsSg.addIngressRule(albSg, ec2.Port.tcp(8000), "ALB to API");
    // Allow ALB to reach live server on port 3100 (WebSocket via ALB)
    ecsSg.addIngressRule(albSg, ec2.Port.tcp(3100), "ALB to live server");

    // ── ECR Repositories (import existing) ───────────────────────────
    const apiRepo = ecr.Repository.fromRepositoryName(this, "ApiRepo", "hangar-api");
    const liveRepo = ecr.Repository.fromRepositoryName(this, "LiveRepo", "hangar-live");

    // ── Shared env vars for all backend services ─────────────────────
    const commonEnv: Record<string, string> = {
      DEBUG: "0",
      DJANGO_SETTINGS_MODULE: "plane.settings.production",
      // No DATABASE_URL — Django uses individual POSTGRES_* vars so the password secret is picked up correctly
      POSTGRES_HOST: props.dbProxyEndpoint,
      POSTGRES_PORT: "5432",
      POSTGRES_DB: "plane",
      POSTGRES_USER: "plane",
      APP_AWS_REGION: this.region,
      AWS_REGION: this.region,
      AWS_DEFAULT_REGION: this.region,
      AWS_S3_BUCKET_NAME: props.filesBucket.bucketName,
      USE_MINIO: "0",
      AMQP_URL: "sqs://",
      CELERY_TASK_DEFAULT_QUEUE: props.celeryQueue.queueName,

      REDIS_HOST: props.redisEndpoint,
      REDIS_PORT: props.redisPort,
      REDIS_URL: `redis://${props.redisEndpoint}:${props.redisPort}/`,
      CORS_ALLOWED_ORIGINS: "https://plane.autometa.dev",
      CSRF_TRUSTED_ORIGINS: "https://plane.autometa.dev",
      WEB_URL: "https://plane.autometa.dev",
      APP_BASE_URL: "https://plane.autometa.dev",
      ADMIN_BASE_URL: "https://plane.autometa.dev",
      ADMIN_BASE_PATH: "/god-mode",
      SPACE_BASE_URL: "https://plane.autometa.dev",
      SPACE_BASE_PATH: "/spaces",
      LIVE_BASE_URL: "https://plane.autometa.dev",
      LIVE_BASE_PATH: "/live",
      EMAIL_BACKEND: "django.core.mail.backends.smtp.EmailBackend",
      EMAIL_HOST: "email-smtp.us-east-1.amazonaws.com",
      EMAIL_PORT: "587",
      EMAIL_USE_TLS: "1",
      EMAIL_USE_SSL: "0",
      EMAIL_FROM: "Hangar <noreply@autometa.dev>",
      GUNICORN_WORKERS: "2",
    };

    // ── IAM Role for ECS tasks ────────────────────────────────────────
    const taskRole = new iam.Role(this, "HangarTaskRole", {
      assumedBy: new iam.ServicePrincipal("ecs-tasks.amazonaws.com"),
    });

    props.filesBucket.grantReadWrite(taskRole);
    props.celeryQueue.grantSendMessages(taskRole);
    props.celeryQueue.grantConsumeMessages(taskRole);
    props.dbSecret.grantRead(taskRole);
    props.appSecret.grantRead(taskRole);
    taskRole.addToPolicy(new iam.PolicyStatement({
      actions: ["ses:SendEmail", "ses:SendRawEmail"],
      resources: ["*"],
    }));
    taskRole.addToPolicy(new iam.PolicyStatement({
      actions: ["rds-db:connect"],
      resources: [`arn:aws:rds-db:${this.region}:${this.account}:dbuser:*/plane`],
    }));
    taskRole.addToPolicy(new iam.PolicyStatement({
      actions: ["secretsmanager:GetSecretValue"],
      resources: [props.dbSecret.secretArn, props.appSecret.secretArn],
    }));
    // Kombu SQS transport needs these to discover and use queues
    taskRole.addToPolicy(new iam.PolicyStatement({
      actions: ["sqs:ListQueues", "sqs:GetQueueUrl", "sqs:GetQueueAttributes"],
      resources: ["*"],
    }));

    // ── ECS Cluster ───────────────────────────────────────────────────
    const cluster = new ecs.Cluster(this, "HangarCluster", {
      clusterName: "hangar",
      vpc: props.vpc,
    });

    // Execution role for ECS (pull images, write logs)
    const executionRole = new iam.Role(this, "EcsExecutionRole", {
      assumedBy: new iam.ServicePrincipal("ecs-tasks.amazonaws.com"),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName("service-role/AmazonECSTaskExecutionRolePolicy"),
      ],
    });
    props.appSecret.grantRead(executionRole);
    props.dbSecret.grantRead(executionRole);

    // ── Helper: create a Fargate service ─────────────────────────────
    const makeFargateService = (
      id: string,
      name: string,
      repo: ecr.IRepository,
      command: string[],
      cpu: number,
      memoryMiB: number,
      desiredCount: number,
      portMappings?: ecs.PortMapping[],
      extraEnv?: Record<string, string>
    ) => {
      const logGroup = new logs.LogGroup(this, `${id}LogGroup`, {
        logGroupName: `/hangar/${name}`,
        retention: logs.RetentionDays.ONE_MONTH,
        removalPolicy: cdk.RemovalPolicy.DESTROY,
      });

      const taskDef = new ecs.FargateTaskDefinition(this, `${id}TaskDef`, {
        cpu,
        memoryLimitMiB: memoryMiB,
        taskRole,
        executionRole,
        runtimePlatform: {
          cpuArchitecture: ecs.CpuArchitecture.ARM64,
          operatingSystemFamily: ecs.OperatingSystemFamily.LINUX,
        },
      });

      taskDef.addContainer(`${id}Container`, {
        image: ecs.ContainerImage.fromEcrRepository(repo, "latest"),
        command,
        environment: { ...commonEnv, ...extraEnv },
        secrets: {
          SECRET_KEY: ecs.Secret.fromSecretsManager(props.appSecret, "SECRET_KEY"),
          GOOGLE_CLIENT_ID: ecs.Secret.fromSecretsManager(props.appSecret, "GOOGLE_CLIENT_ID"),
          GOOGLE_CLIENT_SECRET: ecs.Secret.fromSecretsManager(props.appSecret, "GOOGLE_CLIENT_SECRET"),
          LIVE_SERVER_SECRET_KEY: ecs.Secret.fromSecretsManager(props.appSecret, "LIVE_SERVER_SECRET_KEY"),
          OPEN_ROUTER_KEY: ecs.Secret.fromSecretsManager(props.appSecret, "OPEN_ROUTER_KEY"),
          POSTGRES_PASSWORD: ecs.Secret.fromSecretsManager(props.dbSecret, "password"),
        },
        portMappings,
        logging: ecs.LogDrivers.awsLogs({
          logGroup,
          streamPrefix: name,
        }),
      });

      return new ecs.FargateService(this, `${id}Service`, {
        cluster,
        taskDefinition: taskDef,
        desiredCount,
        capacityProviderStrategies: [
          { capacityProvider: "FARGATE_SPOT", weight: 1 },
          { capacityProvider: "FARGATE", weight: 0 },
        ],
        vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
        securityGroups: [ecsSg],
        enableExecuteCommand: true,
      });
    };

    // ── Django API (Gunicorn on port 8000) ────────────────────────────
    const apiService = makeFargateService(
      "Api",
      "api",
      apiRepo,
      ["./bin/docker-entrypoint-api.sh"],
      1024,
      2048,
      1,
      [{ containerPort: 8000, protocol: ecs.Protocol.TCP }],
      { PORT: "8000" }
    );

    // Application Load Balancer for the API
    const alb = new elbv2.ApplicationLoadBalancer(this, "ApiAlb", {
      vpc: props.vpc,
      internetFacing: true,
      loadBalancerName: "hangar-api",
      securityGroup: albSg,
    });

    const apiListener = alb.addListener("ApiListener", {
      port: 80,
      // No default action — ApiTargets below acts as the catch-all
    });

    // API (Django) — catch-all default, no path conditions
    apiListener.addTargets("ApiTargets", {
      port: 8000,
      protocol: elbv2.ApplicationProtocol.HTTP,
      targets: [apiService],
      healthCheck: {
        path: "/",
        healthyHttpCodes: "200-499",
        interval: cdk.Duration.seconds(30),
        timeout: cdk.Duration.seconds(10),
        healthyThresholdCount: 2,
        unhealthyThresholdCount: 3,
      },
      deregistrationDelay: cdk.Duration.seconds(30),
    });

    this.apiUrl = `http://${alb.loadBalancerDnsName}`;
    this.albDnsName = alb.loadBalancerDnsName;

    // ── Celery Worker ─────────────────────────────────────────────────
    makeFargateService(
      "Worker",
      "worker",
      apiRepo,
      ["./bin/docker-entrypoint-worker.sh"],
      512,
      1024,
      1
    );

    // ── Celery Beat ───────────────────────────────────────────────────
    makeFargateService(
      "Beat",
      "beat",
      apiRepo,
      ["./bin/docker-entrypoint-beat.sh"],
      256,
      512,
      1
    );

    // ── Live Server (HocusPocus WebSocket) ────────────────────────────
    const liveService = makeFargateService(
      "Live",
      "live",
      liveRepo,
      ["node", "apps/live/dist/start.mjs"],
      512,
      1024,
      1,
      [{ containerPort: 3100, protocol: ecs.Protocol.TCP }],
      {
        PORT: "3100",
        API_BASE_URL: "https://plane.autometa.dev/api",
        WEB_BASE_URL: "https://plane.autometa.dev",
        LIVE_BASE_URL: "https://plane.autometa.dev",
        LIVE_BASE_PATH: "/live",
      }
    );

    // Live server — path-based rule on the same ALB (priority 10, evaluated before API catch-all)
    // ALB natively supports WebSocket upgrades, no NLB needed.
    apiListener.addTargets("LiveTargets", {
      port: 3100,
      protocol: elbv2.ApplicationProtocol.HTTP,
      targets: [liveService],
      conditions: [elbv2.ListenerCondition.pathPatterns(["/live", "/live/*"])],
      priority: 10,
      healthCheck: {
        path: "/live/health",
        healthyHttpCodes: "200",
        interval: cdk.Duration.seconds(30),
        timeout: cdk.Duration.seconds(10),
        healthyThresholdCount: 2,
        unhealthyThresholdCount: 3,
      },
      deregistrationDelay: cdk.Duration.seconds(30),
    });

    // ── Outputs ───────────────────────────────────────────────────────
    new cdk.CfnOutput(this, "AlbDns", {
      value: alb.loadBalancerDnsName,
      exportName: "HangarAlbDns",
      description: "Point plane.autometa.dev CNAME here in Cloudflare (orange cloud proxy ON)",
    });
    new cdk.CfnOutput(this, "ApiEcrRepo", {
      value: apiRepo.repositoryUri,
      exportName: "HangarApiEcrRepo",
    });
    new cdk.CfnOutput(this, "LiveEcrRepo", {
      value: liveRepo.repositoryUri,
      exportName: "HangarLiveEcrRepo",
    });
  }
}
