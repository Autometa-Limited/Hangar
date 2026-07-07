import * as cdk from "aws-cdk-lib";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as sqs from "aws-cdk-lib/aws-sqs";
import * as ses from "aws-cdk-lib/aws-ses";
import { Construct } from "constructs";

export class StorageStack extends cdk.Stack {
  public readonly filesBucket: s3.Bucket;
  public readonly celeryQueue: sqs.Queue;
  public readonly celeryDlq: sqs.Queue;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // S3 bucket — replaces MinIO
    this.filesBucket = new s3.Bucket(this, "HangarFilesBucket", {
      bucketName: `hangar-files-${this.account}`,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      cors: [
        {
          allowedMethods: [
            s3.HttpMethods.GET,
            s3.HttpMethods.PUT,
            s3.HttpMethods.POST,
            s3.HttpMethods.DELETE,
            s3.HttpMethods.HEAD,
          ],
          allowedOrigins: ["https://plane.autometa.dev"],
          allowedHeaders: ["*"],
          maxAge: 3000,
        },
      ],
      lifecycleRules: [
        {
          // Clean up incomplete multipart uploads after 7 days
          abortIncompleteMultipartUploadAfter: cdk.Duration.days(7),
        },
      ],
      removalPolicy: cdk.RemovalPolicy.RETAIN, // Never auto-delete user files
    });

    // SQS Dead Letter Queue
    this.celeryDlq = new sqs.Queue(this, "CeleryDlq", {
      queueName: "hangar-celery-dlq",
      retentionPeriod: cdk.Duration.days(14),
    });

    // SQS Queue — replaces RabbitMQ as Celery broker
    this.celeryQueue = new sqs.Queue(this, "CeleryQueue", {
      queueName: "hangar-celery",
      visibilityTimeout: cdk.Duration.seconds(300), // Match Celery task timeout
      retentionPeriod: cdk.Duration.days(4),
      deadLetterQueue: {
        queue: this.celeryDlq,
        maxReceiveCount: 3,
      },
    });

    // SES — email sending (replaces Gmail SMTP)
    // Domain identity for autometa.dev
    const sesEmailIdentity = new ses.EmailIdentity(this, "HangarSesIdentity", {
      identity: ses.Identity.domain("autometa.dev"),
    });

    // Outputs
    new cdk.CfnOutput(this, "FilesBucketName", {
      value: this.filesBucket.bucketName,
      exportName: "HangarFilesBucketName",
    });
    new cdk.CfnOutput(this, "CeleryQueueUrl", {
      value: this.celeryQueue.queueUrl,
      exportName: "HangarCeleryQueueUrl",
    });
    new cdk.CfnOutput(this, "CeleryQueueArn", {
      value: this.celeryQueue.queueArn,
      exportName: "HangarCeleryQueueArn",
    });

    // SES DNS records — must be added to your DNS provider
    new cdk.CfnOutput(this, "SesDkimNote", {
      value: "Add the DKIM CNAME records from SES console to your DNS provider for autometa.dev",
    });
  }
}
