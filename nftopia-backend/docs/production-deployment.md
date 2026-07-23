# Production Deployment Guide

This document covers the complete end-to-end procedure for deploying the
NFTopia Backend stack using `docker-compose.prod.yml`.

---

## Prerequisites

| Requirement | Minimum Version | Notes |
|---|---|---|
| Docker Engine | 24.x | Swarm mode required for secrets & replicas |
| Docker Compose | v2.20+ | Included with Docker Desktop |
| Linux host | Ubuntu 22.04 LTS | Recommended production OS |
| Available RAM | 8 GB | Covers all service reservations + OS overhead |
| Available CPU | 4 cores | Covers all service limits |

---

## Architecture Overview

```
Internet
    │
    ▼
[Reverse Proxy: nginx / Traefik / Caddy]   (port 80/443 exposed)
    │
    ▼  port 3000
[NestJS Backend × 2 replicas]
    │            │               │
    ▼            ▼               ▼
[PostgreSQL] [Redis]     [Meilisearch]
              (all on isolated nftopia_internal bridge network)
```

- **Only port 3000 (REST API)** is exposed to the host.
- PostgreSQL (5432), Redis (6379), and Meilisearch (7700) are **never** bound
  to the host interface; they communicate over the internal network only.
- The GraphQL gateway (port 3001) is internal; route through the reverse proxy
  if needed.

---

## Step 1 — Initialise Docker Swarm (One-Time)

Docker secrets require Swarm mode, even on a single node:

```bash
docker swarm init
```

If your host has multiple network interfaces, specify one explicitly:

```bash
docker swarm init --advertise-addr <your-server-ip>
```

---

## Step 2 — Provision Docker Secrets (One-Time per Host)

> [!CAUTION]
> Use `printf` instead of `echo` to avoid trailing newlines being included in
> the secret value. Never paste secrets into shell history — use a password
> manager or pipe from a secure source.

```bash
# JWT signing key (min 32 random bytes, base64url-encoded recommended)
printf 'your-strong-jwt-secret-here' | docker secret create nftopia_jwt_secret -

# PostgreSQL password for the nftopia_prod user
printf 'your-postgres-password' | docker secret create nftopia_db_password -

# Stellar operator secret key (S... format)
printf 'SXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX' \
  | docker secret create nftopia_stellar_operator_secret -

# Pinata JWT for IPFS uploads
printf 'eyJhbGciOi...' | docker secret create nftopia_pinata_jwt -

# Meilisearch master key (min 16 bytes)
printf 'your-meilisearch-master-key' | docker secret create nftopia_meilisearch_master_key -

# Redis password
printf 'your-redis-password' | docker secret create nftopia_redis_password -
```

Verify secrets are registered (values are never shown):

```bash
docker secret ls
```

---

## Step 3 — Configure Non-Secret Environment Variables

```bash
cd nftopia-backend/

# Copy the template (never contains secrets)
cp .env.production.template .env.production

# Edit the file and fill in all CHANGE_ME values
nano .env.production
```

Key variables to update:

| Variable | Description |
|---|---|
| `DB_USER` | PostgreSQL username (e.g. `nftopia_prod`) |
| `DB_NAME` | PostgreSQL database name (e.g. `nftopia_production`) |
| `CORS_ALLOWED_ORIGINS` | Comma-separated allowed frontend origins |
| `SOROBAN_RPC_URL` | Mainnet Soroban RPC endpoint |
| `COLLECTION_FACTORY_CONTRACT_ID` | Deployed mainnet contract ID |
| `MARKETPLACE_SETTLEMENT_CONTRACT_ID` | Deployed mainnet contract ID |
| `STELLAR_OPERATOR_PUBLIC_KEY` | Corresponding public key for the operator secret |

---

## Step 4 — Build the Production Image

```bash
cd nftopia-backend/
docker build -t nftopia-backend:production .
```

Or let compose build it:

```bash
docker-compose -f docker-compose.prod.yml build
```

---

## Step 5 — Deploy the Stack

### Option A — Docker Compose (single node, no Swarm scaling)

```bash
cd nftopia-backend/

docker-compose \
  -f docker-compose.prod.yml \
  --env-file .env.production \
  up -d
```

Scale backend manually if needed:

```bash
docker-compose -f docker-compose.prod.yml --env-file .env.production \
  up -d --scale backend=2
```

### Option B — Docker Stack (Swarm mode, rolling updates, replicas)

```bash
cd nftopia-backend/

docker stack deploy \
  -c docker-compose.prod.yml \
  --with-registry-auth \
  nftopia
```

> [!NOTE]
> `docker stack deploy` does **not** read `--env-file`. Export the variables
> from `.env.production` into the shell first:
> ```bash
> set -a; source .env.production; set +a
> docker stack deploy -c docker-compose.prod.yml nftopia
> ```

---

## Step 6 — Verify Deployment

### Check service health

```bash
# Compose mode
docker-compose -f docker-compose.prod.yml ps

# Swarm mode
docker stack ps nftopia
docker service ls
```

### Confirm health endpoints

```bash
# Backend REST health
curl http://localhost:3000/health

# Meilisearch health (internal — exec into the backend container)
docker exec $(docker ps -qf "name=backend") \
  wget --no-verbose --tries=1 --spider http://meilisearch:7700/health && echo OK
```

### Check logs

```bash
# Compose mode
docker-compose -f docker-compose.prod.yml logs -f backend

# Swarm mode
docker service logs nftopia_backend -f
```

Expected startup log lines:

```
[Bootstrap] [SecretsLoader] Resolved 6 Docker secret(s): [JWT_SECRET, DB_PASSWORD, ...]
[Bootstrap] Application is running on: http://localhost:3000/api/v1
[GraphqlGateway] GraphQL gateway is running on: http://localhost:3001/graphql
```

---

## Rolling Updates

When deploying a new image version in Swarm mode:

```bash
# Build new image
docker build -t nftopia-backend:production .

# Re-deploy — Swarm will update one replica at a time
docker stack deploy -c docker-compose.prod.yml nftopia
```

The `update_config` in the compose file ensures:
- One replica updated at a time (`parallelism: 1`)
- 30 second delay between replicas
- Auto-rollback on failure

---

## Stopping and Removing the Stack

```bash
# Compose mode
docker-compose -f docker-compose.prod.yml down

# Swarm mode
docker stack rm nftopia
```

> [!WARNING]
> `docker-compose down` does NOT remove named volumes by default.
> To remove data volumes (destructive!):
> ```bash
> docker-compose -f docker-compose.prod.yml down -v
> ```

---

## Database Backups

Volumes are not backed up automatically. Set up a cron job on the host:

```bash
# Dump PostgreSQL to a timestamped file
docker exec $(docker ps -qf "name=nftopia-postgres-prod") \
  pg_dump -U ${DB_USER} ${DB_NAME} \
  | gzip > /backups/nftopia_$(date +%Y%m%d_%H%M%S).sql.gz
```

For automated snapshots, consider:
- **AWS RDS** instead of containerised PostgreSQL for managed backups
- **pg_dump** + S3 via a sidecar container
- Docker volume plugins with snapshot support (e.g. `rclone`, `Restic`)

---

## Log Rotation

All services are configured with `json-file` driver capped at **100 MB × 3 files**
per service. For centralised log aggregation, replace the logging driver in
`docker-compose.prod.yml`:

### Datadog

```yaml
logging:
  driver: "datadog"
  options:
    dd-api-key: "${DD_API_KEY}"
    dd-source: "nftopia-backend"
    dd-service: "backend"
    dd-env: "production"
```

### AWS CloudWatch

```yaml
logging:
  driver: "awslogs"
  options:
    awslogs-region: "us-east-1"
    awslogs-group: "/nftopia/production"
    awslogs-stream: "backend"
```

---

## External Secret Managers

For teams requiring a higher security posture than Docker secrets, the
`loadDockerSecrets()` function in `src/config/secrets.loader.ts` can be
extended to fetch secrets from external vaults at startup.

### HashiCorp Vault

```typescript
// Example — fetch from Vault Agent sidecar injected file
// (configure Vault Agent to write secrets to /run/secrets/ at the same paths)
// No code change required: Vault Agent writes files, SecretsLoader reads them.
```

### AWS Secrets Manager

```typescript
// In secrets.loader.ts — add a call to AWS SDK before the file-read loop:
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';

const client = new SecretsManagerClient({ region: process.env.AWS_REGION });
const response = await client.send(new GetSecretValueCommand({
  SecretId: 'nftopia/production/backend',
}));
const secrets = JSON.parse(response.SecretString ?? '{}');
process.env.JWT_SECRET = secrets.JWT_SECRET;
// ... etc.
```

---

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `secret not found` at startup | Docker secret not provisioned | Run `docker secret ls` and re-provision missing secrets |
| Backend health check failing | App not started yet | Increase `start_period` in healthcheck; check logs |
| `pg_isready` failing | Wrong `DB_USER`/`DB_NAME` | Verify `.env.production` values match the secret password |
| Redis `NOAUTH` error | Password mismatch | Ensure the `nftopia_redis_password` secret matches what was used to initialise the volume |
| Out of memory (OOM) | Insufficient host RAM | Increase host resources or reduce `deploy.resources.limits` |
| `CORS origin not allowed` | `CORS_ALLOWED_ORIGINS` not set | Add frontend domain to the env var |
