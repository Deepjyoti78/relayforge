# RelayForge Production Deployment Architecture & Hosting Guide

## 1. Hosting Platform Evaluation for Solo Developers

RelayForge consists of:
1. **API Service:** Stateless HTTP server (NestJS) handling webhooks, tenant management, and workflows.
2. **Worker Service:** Stateful/polling background daemon processing outbox queues, HTTP deliveries, and workflows.
3. **Database:** PostgreSQL 16+ with Row-Level Security (RLS) support.
4. **Cache & Queues:** Redis 7+ for token-bucket rate limiting and BullMQ/pubsub.
5. **Frontend Web Console:** Static React SPA with Vite.

Below is an objective evaluation of hosting options tailored for an independent engineer or small engineering team:

| Criteria | Render.com (Selected for Staging) | Railway.app | AWS ECS Fargate + RDS |
| :--- | :--- | :--- | :--- |
| **Complexity** | Low — Native support for Web Services + Background Workers | Low — Unified project canvas, multi-service deployments | High — Requires VPC, Subnets, IAM, ALB, Task Definitions |
| **Setup Time** | < 1 hour | < 1 hour | 1–2 days (Terraform/CloudFormation) |
| **Zero-Downtime Deploy** | Native rolling deployments with health check gating | Native rolling restarts | Managed rolling deployments via target groups |
| **Background Worker** | Dedicated "Background Worker" service type | Standard service running custom command | Separate ECS Task Definition |
| **Managed DB & Redis** | Native Managed Postgres + Redis with private networking | Native Redis & PostgreSQL plugins | Amazon RDS PostgreSQL + Amazon ElastiCache |
| **Estimated Monthly Cost** | \$31–\$35 / month (Staging tier) | \$25–\$45 / month | \$120–\$250 / month |

### Selection Justification: Render.com
Render is selected for the RelayForge staging environment due to:
- Dedicated, persistent `type: worker` processes that run indefinitely without HTTP ingress timeouts.
- Isolated private network addresses (`*.internal`) ensuring PostgreSQL and Redis are strictly inaccessible to the public internet.
- Automatic SSL/TLS termination on custom and onrender.com subdomains.
- Declarative Infrastructure-as-Code via [`render.yaml`](../render.yaml).

---

## 2. Infrastructure Topology

```mermaid
flowchart TD
    Internet([Public Internet / Webhook Senders]) --> Cloudflare[Cloudflare CDN & DDoS Shield]
    Cloudflare -->|HTTPS / REST| ApiService[RelayForge API Service\nNode.js NestJS]
    Cloudflare -->|HTTPS / Static Assets| StaticWeb[RelayForge Web Console\nVite React SPA]

    subgraph Private VPC [Isolated Private Network]
        ApiService -->|SQL / RLS Enforced| Postgres[(PostgreSQL 16\nPrimary Database)]
        ApiService -->|Publish Telemetry & Limit| RedisCluster[(Redis 7.4\nSliding Window Limits & PubSub)]

        WorkerService[RelayForge Worker Service\nOutbox Leaser & Delivery Pipeline]
        WorkerService -->|SELECT FOR UPDATE SKIP LOCKED| Postgres
        WorkerService -->|Token Bucket Rate Limiting| RedisCluster
    end

    WorkerService -->|SSRF-Validated & Socket Pinned HTTPS| ExternalDestinations[Customer Webhook Destinations]
```

---

## 3. Container Deployment Specifications

### 3.1 RelayForge API Service
- **Command:** `npm run start:api` (or `node dist/api/main.js`)
- **Port:** `3100` (internally mapped)
- **Liveness Probe:** `GET /health/live` (Interval: 10s, Timeout: 2s)
- **Readiness Probe:** `GET /health/ready` (Interval: 10s, Timeout: 3s)
- **Scale:** 1 to N stateless instances behind load balancer.
- **Resources:** Minimum 0.5 CPU, 512 MB RAM (Recommended: 1.0 CPU, 1024 MB RAM).

### 3.2 RelayForge Worker Daemon
- **Command:** `npm run start:worker` (or `node dist/worker/main.js`)
- **Healthcheck Probe:** `npm run healthcheck:worker` (checks DB lease heartbeats)
- **Scale:** 1 to 4 worker instances (Worker concurrency handles parallel deliveries per instance).
- **Resources:** Minimum 0.5 CPU, 512 MB RAM (Recommended: 1.0 CPU, 1024 MB RAM).

### 3.3 Database (PostgreSQL 16+)
- Minimum connection limit: 50.
- Pool settings: `DATABASE_POOL_SIZE=10`.
- Extensions: `uuid-ossp` or native `gen_random_uuid()`.
- Storage: 10 GB SSD with auto-grow enabled.

### 3.4 Redis (Redis 7+)
- Connection mode: `rediss://` or private VPC host.
- Eviction policy: `noeviction` (prevents dropping rate limit or outbox state).
- Memory: 256 MB minimum.

---

## 4. Production & Staging Environment Mapping

| Variable | Description | Example Staging Value |
| :--- | :--- | :--- |
| `NODE_ENV` | Application environment mode | `production` |
| `DATABASE_URL` | API database connection URL (least-privilege `relayforge_api`) | `postgresql://relayforge_api:...@relayforge-staging-db.internal:5432/relayforge_staging` |
| `WORKER_DATABASE_URL` | Worker database connection URL (`relayforge_worker`) | `postgresql://relayforge_worker:...@relayforge-staging-db.internal:5432/relayforge_staging` |
| `REDIS_URL` | Redis cluster URL | `redis://relayforge-staging-redis.internal:6379/0` |
| `ENCRYPTION_KEY` | AES-256 master encryption key (64 hex characters) | High-entropy key generated automatically by Render Blueprint |
| `ALLOW_PRIVATE_DESTINATIONS`| SSRF bypass flag | `false` (Strictly enforced) |
| `WORKER_CONCURRENCY` | Concurrent delivery tasks per worker process | `4` |
| `WORKER_HEARTBEAT_MS` | Outbox lease heartbeat interval | `10000` |
| `GITHUB_CLIENT_ID` | GitHub OAuth application client ID | Staging GitHub OAuth App Client ID |
| `GITHUB_CLIENT_SECRET` | GitHub OAuth application secret | Staging GitHub OAuth App Client Secret |
| `GITHUB_CALLBACK_URL` | Public OAuth redirect target | `https://relayforge-staging-api.onrender.com/auth/github/callback` |
| `FRONTEND_URL` | Management console base origin | `https://relayforge-staging-web.onrender.com` |

---

## 5. Zero-Downtime Deployment & Migration Protocol

1. **Pre-Deployment:**
   - Provision runtime least-privilege roles (`scripts/staging-db-init.cjs`).
   - Execute database migrations via GitHub Actions or deployment hook:
     ```bash
     npx prisma migrate deploy
     ```
2. **Worker Deployment:**
   - Deploy new Worker instances.
   - Older workers finish active delivery leases and terminate gracefully via `SIGTERM`.
3. **API Deployment:**
   - Deploy new API instances behind load balancer.
   - Traffic switches only after `/health/ready` returns HTTP 200.

---

## 6. Staging Deployment Execution Guide (Step-by-Step)

### Step 1: Push Repository to GitHub
Ensure branch `release/staging-deployment` is pushed to GitHub:
```bash
git push -u origin release/staging-deployment
```

### Step 2: Register GitHub OAuth App (Staging)
1. Go to **GitHub Settings → Developer settings → OAuth Apps → New OAuth App**.
2. Fill in:
   - **Application name:** `RelayForge Staging`
   - **Homepage URL:** `https://relayforge-staging-web.onrender.com`
   - **Authorization callback URL:** `https://relayforge-staging-api.onrender.com/auth/github/callback`
3. Click **Register application** and generate a new **Client Secret**.
4. Note your `Client ID` and `Client Secret`.

### Step 3: Deploy via Render Blueprint
1. Log in to [Render.com](https://dashboard.render.com).
2. Click **New + → Blueprint**.
3. Select the `RelayForge` repository and branch `release/staging-deployment`.
4. Render will parse [`render.yaml`](../render.yaml) and prompt for:
   - `GITHUB_CLIENT_ID`: Paste your GitHub App Client ID.
   - `GITHUB_CLIENT_SECRET`: Paste your GitHub App Client Secret.
5. Click **Apply Blueprint**. Render automatically provisions all 5 services.

### Step 4: Run Staging Role Init & Migrations
From the Render dashboard shell on `relayforge-staging-api` (or locally connected to staging DB):
```bash
node scripts/staging-db-init.cjs
npx prisma migrate deploy
```

### Step 5: Execute Automated Verification
```bash
STAGING_API_URL=https://relayforge-staging-api.onrender.com node scripts/staging-e2e-verify.cjs
```
