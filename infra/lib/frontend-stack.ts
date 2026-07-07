import * as cdk from "aws-cdk-lib";
import * as amplify from "aws-cdk-lib/aws-amplify";
import * as iam from "aws-cdk-lib/aws-iam";
import * as secretsmanager from "aws-cdk-lib/aws-secretsmanager";
import { Construct } from "constructs";

interface FrontendStackProps extends cdk.StackProps {
  apiGatewayUrl: string;
  albDnsName: string;
}

export class FrontendStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: FrontendStackProps) {
    super(scope, id, props);

    // GitHub PAT from Secrets Manager — stored as hangar/github-pat
    const githubPat = secretsmanager.Secret.fromSecretNameV2(this, "GithubPat", "hangar/github-pat");

    // IAM role for Amplify to access the repo
    const amplifyRole = new iam.Role(this, "AmplifyRole", {
      assumedBy: new iam.ServicePrincipal("amplify.amazonaws.com"),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName("AdministratorAccess-Amplify"),
      ],
    });

    // Shared build environment variables for all frontend apps
    const sharedEnv: amplify.CfnApp.EnvironmentVariableProperty[] = [
      { name: "VITE_API_BASE_URL", value: "https://plane.autometa.dev/api" },
      { name: "VITE_WEB_BASE_URL", value: "https://plane.autometa.dev" },
      { name: "VITE_ADMIN_BASE_URL", value: "https://plane.autometa.dev" },
      { name: "VITE_ADMIN_BASE_PATH", value: "/god-mode" },
      { name: "VITE_SPACE_BASE_URL", value: "https://plane.autometa.dev" },
      { name: "VITE_SPACE_BASE_PATH", value: "/spaces" },
      { name: "VITE_LIVE_BASE_URL", value: "https://plane.autometa.dev" },
      { name: "VITE_LIVE_BASE_PATH", value: "/live" },
      { name: "_CUSTOM_IMAGE", value: "amplify:al2023" },
      // Limit turbo concurrency during build to avoid OOM
      { name: "TURBO_CONCURRENCY", value: "1" },
      // Cap Node heap for build steps — unset before pnpm install (see buildSpec)
      { name: "NODE_OPTIONS", value: "--max-old-space-size=6144" },
    ];

    const makeAmplifyApp = (
      id: string,
      name: string,
      appFilter: string,   // pnpm --filter value e.g. "./apps/web"
      artifactDir: string  // path from repo root e.g. "apps/web/build/client"
    ) => {
      const app = new amplify.CfnApp(this, id, {
        name,
        iamServiceRole: amplifyRole.roleArn,
        repository: "https://github.com/Autometa-Limited/Hangar",
        oauthToken: githubPat.secretValue.unsafeUnwrap(),
        environmentVariables: sharedEnv,
        buildSpec: JSON.stringify({
          version: 1,
          frontend: {
            phases: {
              preBuild: {
                commands: [
                  "npm install -g pnpm",
                  // .npmrc sets node-linker=isolated which creates a full virtual store
                  // per package — very memory intensive on 15-pkg monorepo. Override to
                  // hoisted (flat node_modules) which uses far less memory.
                  "echo 'node-linker=hoisted' >> .npmrc",
                  // Unset NODE_OPTIONS so pnpm itself has full 16GB during install
                  "unset NODE_OPTIONS",
                  "pnpm install --frozen-lockfile --ignore-scripts",
                  // Restore cap for build steps
                  "export NODE_OPTIONS=--max-old-space-size=6144",
                ],
              },
              build: {
                commands: [`pnpm run build --filter='${appFilter}...'`],
              },
            },
            artifacts: {
              baseDirectory: artifactDir,
              files: ["**/*"],
            },
            cache: {
              // Don't cache node_modules — restoring a broken partial install
              // from a previous OOM'd build makes things worse
              paths: [],
            },
          },
        }),
        customRules: [
          // SPA fallback — serve index.html only when file is not found (404)
          // This lets Amplify serve actual JS/CSS/image files normally
          {
            source: "/<*>",
            target: "/index.html",
            status: "404",
          },
        ],
      });

      new amplify.CfnBranch(this, `${id}Branch`, {
        appId: app.attrAppId,
        branchName: "preview",
        enableAutoBuild: true,
        stage: "PRODUCTION",
      });

      return app;
    };

    makeAmplifyApp("WebApp",   "hangar-web",   "./apps/web",   "apps/web/build/client");
    makeAmplifyApp("AdminApp", "hangar-admin", "./apps/admin", "apps/admin/build/client");
    makeAmplifyApp("SpaceApp", "hangar-space", "./apps/space", "apps/space/build/client");

    new cdk.CfnOutput(this, "AmplifyNote", {
      value: "Amplify apps created. Trigger first build from the AWS Amplify console or by pushing to the preview branch.",
    });
  }
}
