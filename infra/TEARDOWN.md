# Hangar AWS Teardown Guide

Complete teardown of all AWS resources for the Hangar project (plane.autometa.dev).

## Before you start

- Make sure you have AWS CLI configured: `aws sts get-caller-identity` should return account `713881813437`
- Budget ~30 minutes — Aurora snapshot creation is the slowest step
- The S3 bucket has `RemovalPolicy.RETAIN` — it will NOT be deleted by CDK. You must empty and delete it manually first.

---

## Step 1 — Empty the S3 bucket (manual, do this first)

```bash
aws s3 rm s3://hangar-files-713881813437 --recursive --region us-east-1
```

Then delete the bucket:
```bash
aws s3 rb s3://hangar-files-713881813437 --region us-east-1
```

---

## Step 2 — Destroy CDK stacks (in reverse dependency order)

Run these one at a time. Each must finish before the next.

```bash
cd /path/to/Hangar/infra

# 1. Frontend (Amplify apps)
npx cdk destroy HangarFrontend --force

# 2. Backend (ECS, ALB, task definitions)
npx cdk destroy HangarBackend --force

# 3. Redis (ElastiCache)
npx cdk destroy HangarRedis --force

# 4. Database (Aurora + RDS Proxy)
# NOTE: This creates a final snapshot before deleting Aurora.
# Snapshot will appear in RDS console as "hangar-hangaraurora-final-snapshot" (or similar)
# Delete it manually afterwards if you don't need it.
npx cdk destroy HangarDatabase --force

# 5. Storage (SQS queues, SES identity)
# NOTE: S3 bucket was already deleted in Step 1, CDK will skip it (RETAIN policy)
npx cdk destroy HangarStorage --force

# 6. Secrets (Secrets Manager secrets)
# NOTE: Secrets Manager has a 7-day recovery window by default.
# To force-delete immediately:
aws secretsmanager delete-secret --secret-id hangar/app --force-delete-without-recovery --region us-east-1
aws secretsmanager delete-secret --secret-id hangar/db-credentials --force-delete-without-recovery --region us-east-1
aws secretsmanager delete-secret --secret-id hangar/github-pat --force-delete-without-recovery --region us-east-1
npx cdk destroy HangarSecrets --force

# 7. Network (VPC, NAT instance, VPC endpoints) — last, everything depends on this
npx cdk destroy HangarNetwork --force
```

---

## Step 3 — Delete ECR repositories (not managed by CDK)

These were created manually and won't be touched by `cdk destroy`:

```bash
aws ecr delete-repository --repository-name hangar-api --force --region us-east-1
aws ecr delete-repository --repository-name hangar-live --force --region us-east-1
```

---

## Step 4 — Delete Aurora final snapshot (if you don't need it)

Go to AWS Console → RDS → Snapshots → Manual snapshots → find the one named `hangar*` → Delete.

Or via CLI:
```bash
# List snapshots to find the name
aws rds describe-db-cluster-snapshots --region us-east-1 --query 'DBClusterSnapshots[?contains(DBClusterSnapshotIdentifier,`hangar`)].DBClusterSnapshotIdentifier'

# Delete it
aws rds delete-db-cluster-snapshot --db-cluster-snapshot-identifier <snapshot-id> --region us-east-1
```

---

## Step 5 — Cloudflare cleanup (manual)

1. Go to Cloudflare dashboard → autometa.dev → Workers & Pages
2. Delete the worker named `hanger-router`
3. Go to DNS → delete the `plane` CNAME record pointing to the Amplify domain
4. Delete any SES DKIM CNAME records (3 records for `_domainkey.autometa.dev`)

---

## Step 6 — Verify everything is gone

```bash
# Should return empty
aws ecs list-clusters --region us-east-1
aws rds describe-db-clusters --region us-east-1
aws elasticache describe-cache-clusters --region us-east-1
aws ec2 describe-vpcs --region us-east-1 --filters "Name=tag:Name,Values=HangarNetwork/HangarVpc"
```

---

## What this teardown does NOT touch

- The GitHub repo (Autometa-Limited/Hangar) — code stays
- The `autometa.dev` domain itself in Cloudflare
- Any other AWS resources outside the Hangar stacks
