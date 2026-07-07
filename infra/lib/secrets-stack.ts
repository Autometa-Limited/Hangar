import * as cdk from "aws-cdk-lib";
import * as secretsmanager from "aws-cdk-lib/aws-secretsmanager";
import { Construct } from "constructs";

/**
 * All application secrets stored in AWS Secrets Manager.
 * Values are placeholders — update them in the AWS console after deploy
 * or via: aws secretsmanager update-secret --secret-id <name> --secret-string '{"key":"value"}'
 */
export class SecretsStack extends cdk.Stack {
  public readonly appSecret: secretsmanager.Secret;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    this.appSecret = new secretsmanager.Secret(this, "HangarAppSecrets", {
      secretName: "hangar/app",
      description: "Hangar application secrets",
      secretObjectValue: {
        // Django
        SECRET_KEY: cdk.SecretValue.unsafePlainText("REPLACE_ME"),

        // Google OAuth
        GOOGLE_CLIENT_ID: cdk.SecretValue.unsafePlainText("725296627438-ciond6toq5blhkbr5knuc5n8orbst4aq.apps.googleusercontent.com"),
        GOOGLE_CLIENT_SECRET: cdk.SecretValue.unsafePlainText("REPLACE_ME"),

        // Live server
        LIVE_SERVER_SECRET_KEY: cdk.SecretValue.unsafePlainText("REPLACE_ME"),

        // OpenRouter (AI editor completions)
        OPEN_ROUTER_KEY: cdk.SecretValue.unsafePlainText("REPLACE_ME"),
      },
    });

    new cdk.CfnOutput(this, "AppSecretArn", {
      value: this.appSecret.secretArn,
      exportName: "HangarAppSecretArn",
    });
  }
}
