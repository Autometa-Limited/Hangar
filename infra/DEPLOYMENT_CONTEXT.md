# Hangar Deployment Context

Everything you need to redeploy this project from scratch.

## What this is

Hangar is a fork of [Plane](https://plane.so) (open-source project management tool), deployed at `plane.autometa.dev` for internal use at Autometa.

## Architecture overview

```
User → Cloudflare Worker (hanger-router) → routes by path:
  /api/*        → AWS ALB → ECS Django API (port 8000)
  /live/*       → AWS ALB → ECS Live Server (port 3100, WebSocket)
  /god-mode/*   → AWS Amplify (hangar-admin app)
  /spaces/*     → AWS Amplify (hangar-space app)
  /*            → AWS Amplify (hangar-web app)
```

Backend runs on ECS Fargate Spot (ARM64) in a private VPC. Frontend is 3 separate Amplify apps built from the same monorepo.

## AWS Account

- Account ID: `713881813437`
- Region: `us-east-1`
- CDK stacks: 7 (Network, Secrets, Storage, Database, Redis, Backend, Frontend)

## Key resource IDs (current deployment)

| Resource | ID / Value |
|---|---|
| VPC | vpc-07934e0384183fd2d |
| ALB DNS | hangar-api-908192520.us-east-1.elb.amazonaws.com |
| ECS Cluster | hangar |
| Amplify web app | d2g0cpv2wwyyir |
| Amplify admin app | d2pv0y1bu1k63d |
| Amplify space app | dhbwabb475o9t |
| NAT Instance | i-0b4a87ea2cd2663f3 (t4g.nano) |
| ECR API repo | 713881813437.dkr.ecr.us-east-1.amazonaws.com/hangar-api |
| ECR Live repo | 713881813437.dkr.ecr.us-east-1.amazonaws.com/hangar-live |
| S3 bucket | hangar-files-713881813437 |
| SQS queue | hangar-celery |
| Aurora cluster | hangar-hangaraurora-* |
| Redis cluster | hangar-redis (cache.t4g.micro) |
| Secret: app | hangar/app |
| Secret: db | hangar/db-credentials |
| Secret: github PAT | hangar/github-pat |

## Cloudflare setup

- Domain: `plane.autometa.dev` → CNAME to Amplify (orange cloud proxy ON)
- Worker: `hanger-router` (note: typo in name — "hanger" not "hangar")
- Worker route: `plane.autometa.dev/*` → hanger-router

### Cloudflare Worker code

```javascript
export default {
  async fetch(request) {
    const url = new URL(request.url);

    if (url.pathname === '/god-mode') {
      return Response.redirect(url.origin + '/god-mode/', 301);
    }

    const forward = (targetUrl) => fetch(targetUrl.toString(), {
      method: request.method,
      headers: request.headers,
      body: ['GET', 'HEAD'].includes(request.method) ? undefined : request.body,
      redirect: 'manual',
    });

    if (url.pathname.startsWith('/api/api/')) {
      const u = new URL(request.url);
      u.hostname = 'hangar-api-908192520.us-east-1.elb.amazonaws.com';
      u.protocol = 'http:';
      u.pathname = u.pathname.replace('/api/api/', '/api/');
      return forward(u);
    }

    if (url.pathname.startsWith('/api/auth/')) {
      const u = new URL(request.url);
      u.hostname = 'hangar-api-908192520.us-east-1.elb.amazonaws.com';
      u.protocol = 'http:';
      u.pathname = u.pathname.replace('/api/auth/', '/auth/');
      return forward(u);
    }

    if (url.pathname.startsWith('/api/') || url.pathname === '/api' ||
        url.pathname.startsWith('/live/') || url.pathname === '/live') {
      const u = new URL(request.url);
      u.hostname = 'hangar-api-908192520.us-east-1.elb.amazonaws.com';
      u.protocol = 'http:';
      return forward(u);
    }

    if (url.pathname.startsWith('/god-mode')) {
      const u = new URL(request.url);
      u.hostname = 'preview.d2pv0y1bu1k63d.amplifyapp.com';
      const stripped = url.pathname.replace(/^\/god-mode/, '') || '/';
      u.pathname = stripped === '' ? '/' : stripped;
      return forward(u);
    }

    if (url.pathname.startsWith('/spaces')) {
      const u = new URL(request.url);
      u.hostname = 'preview.dhbwabb475o9t.amplifyapp.com';
      return forward(u);
    }

    const u = new URL(request.url);
    u.hostname = 'preview.d2g0cpv2wwyyir.amplifyapp.com';
    return forward(u);
  }
}
```

## Monthly cost (as of July 2026)

| Service | Cost |
|---|---|
| Aurora Serverless v2 + RDS Proxy | ~$50/mo |
| VPC Interface Endpoints (3 × 2 AZs) | ~$44/mo |
| ECS Fargate Spot (4 tasks) | ~$26/mo |
| ElastiCache cache.t4g.micro | ~$12/mo |
| Application Load Balancer | ~$7/mo |
| NAT Instance t4g.nano | ~$3/mo |
| Amplify (3 apps) | ~$2/mo |
| S3, SQS, SES, ECR, Secrets, CloudWatch | ~$3/mo |
| **Total** | **~$147/mo** |

### Cost reduction options
- Replace Aurora Serverless v2 + RDS Proxy → RDS t4g.micro: saves ~$38/mo (brings total to ~$109/mo)
- Accept: VPC endpoints for Secrets Manager + ECR are mandatory for Fargate. SQS and CloudWatch Logs can go through NAT (already done — saved $29/mo).

## How to redeploy from scratch

### Prerequisites
- AWS CLI configured with account 713881813437
- Node.js 18+, CDK v2 installed (`npm install -g aws-cdk`)
- Docker (for building backend images)
- Cloudflare account access for autometa.dev

### 1. Bootstrap CDK (if fresh account)
```bash
cd infra
npx cdk bootstrap aws://713881813437/us-east-1
```

### 2. Create ECR repos (not managed by CDK)
```bash
aws ecr create-repository --repository-name hangar-api --region us-east-1
aws ecr create-repository --repository-name hangar-live --region us-east-1
```

### 3. Build and push Docker images
```bash
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin 713881813437.dkr.ecr.us-east-1.amazonaws.com

# API image (build from repo root)
docker build --platform linux/arm64 -t hangar-api -f apps/api/Dockerfile.api .
docker tag hangar-api:latest 713881813437.dkr.ecr.us-east-1.amazonaws.com/hangar-api:latest
docker push 713881813437.dkr.ecr.us-east-1.amazonaws.com/hangar-api:latest

# Live image
docker build --platform linux/arm64 -t hangar-live -f apps/live/Dockerfile .
docker tag hangar-live:latest 713881813437.dkr.ecr.us-east-1.amazonaws.com/hangar-live:latest
docker push 713881813437.dkr.ecr.us-east-1.amazonaws.com/hangar-live:latest
```

### 4. Store GitHub PAT in Secrets Manager
```bash
aws secretsmanager create-secret \
  --name hangar/github-pat \
  --secret-string '{"token":"YOUR_GITHUB_PAT"}' \
  --region us-east-1
```

### 5. Deploy CDK stacks (in order)
```bash
cd infra
npx cdk deploy HangarNetwork
npx cdk deploy HangarSecrets
npx cdk deploy HangarStorage
npx cdk deploy HangarDatabase
npx cdk deploy HangarRedis
npx cdk deploy HangarBackend
npx cdk deploy HangarFrontend
```

### 6. Update secrets with real values
After deploy, update `hangar/app` in Secrets Manager with real values:
```bash
aws secretsmanager put-secret-value \
  --secret-id hangar/app \
  --secret-string '{
    "SECRET_KEY": "your-django-secret-key",
    "GOOGLE_CLIENT_ID": "your-google-client-id",
    "GOOGLE_CLIENT_SECRET": "your-google-client-secret",
    "LIVE_SERVER_SECRET_KEY": "your-live-secret",
    "OPEN_ROUTER_KEY": "your-openrouter-key"
  }' \
  --region us-east-1
```

### 7. Run Django migrations
```bash
# After ECS is up, exec into API container:
aws ecs execute-command \
  --cluster hangar \
  --task <task-id> \
  --container ApiContainer \
  --interactive \
  --command "python manage.py migrate" \
  --region us-east-1
```
Note: requires `session-manager-plugin` installed and SSM VPC endpoint (or public subnet task).

### 8. Set up Cloudflare
1. Add `plane` CNAME → Amplify domain for the web app (orange cloud ON)
2. Create worker `hanger-router` with the code above
3. Add route `plane.autometa.dev/*` → hanger-router
4. Add SES DKIM records from AWS SES console (3 CNAMEs for autometa.dev)
5. Turn off Cloudflare orange cloud temporarily for Amplify domain verification, then re-enable

### 9. Complete Plane setup
Visit `https://plane.autometa.dev/god-mode/` → create first admin account.

## Known gotchas

1. **Amplify build OOM** — `.npmrc` sets `node-linker=isolated` which causes OOM on 15-package monorepo. The buildSpec in `frontend-stack.ts` overrides it to `hoisted` via `echo 'node-linker=hoisted' >> .npmrc`. Do not remove this.

2. **VPC Interface Endpoints are mandatory for Fargate** — Secrets Manager and ECR endpoints must exist. Without Secrets Manager endpoint, new tasks fail to start (timeout during secret injection). Without ECR endpoints, image pulls through NAT t4g.nano time out on large layers.

3. **Cloudflare Worker path routing** — Django mounts `/auth/` without the `/api` prefix, but `VITE_API_BASE_URL` is `.../api`. Worker rewrites `/api/auth/` → `/auth/` to fix this. Also rewrites `/api/api/` → `/api/` for the double-prefix bug.

4. **God-mode trailing slash** — React Router requires `/god-mode/` (with trailing slash). Worker redirects `/god-mode` → `/god-mode/`.

5. **god-mode asset path stripping** — Admin app HTML references assets at `/god-mode/assets/...` but Amplify stores them at `/assets/...`. Worker strips the `/god-mode` prefix when proxying to the admin Amplify app.

6. **CSRF** — Django CSRF is driven by `CORS_ALLOWED_ORIGINS` env var (set to `https://plane.autometa.dev`). The Cloudflare Worker uses `redirect: 'manual'` to prevent redirect loops when Django redirects back after form submission.

7. **Amplify branch** — All 3 apps track the `preview` branch with `enableAutoBuild: true`. Push to `preview` → auto-deploy.

8. **Fargate architecture** — All tasks use ARM64 (`CpuArchitecture.ARM64`). Docker images must be built with `--platform linux/arm64`.
