# EpiLink Deployment Plan

> Goal: deploy the existing Dockerized EpiLink stack to Google Cloud with GitHub Actions CI/CD, while keeping the demonstration inside the $300 GCP free-trial envelope. PostgreSQL stays on Heroku (already running).

## 1. Deployment Strategy

The codebase is already split into deployable units:

| Service           | Runtime               | Port | Primary role                        | GCP target                                  |
| ----------------- | --------------------- | ---: | ----------------------------------- | ------------------------------------------- |
| Frontend          | Next.js / Node 24     | 3000 | Public web UI                       | Cloud Run                                   |
| Backend           | NestJS / Node 24      | 3001 | API gateway, auth, tasks, analytics | Cloud Run                                   |
| ML model          | FastAPI / Python 3.12 | 8000 | Weekly dengue prediction            | GitHub Actions scheduled job (already done) |
| Explain-analytics | FastAPI / Python 3.12 | 8010 | XAI / RAG insights                  | Cloud Run                                   |
| Chatbot-service   | FastAPI / Python 3.12 | 8000 | EpiBot chatbot (RAG)                | Cloud Run                                   |
| Route-optimizer   | FastAPI / Python 3.12 | 8001 | PHI route optimization              | Cloud Run                                   |
| PostgreSQL        | Managed DB            | 5432 | Core persistence                    | **Heroku Postgres (keep as-is)**            |
| Redis             | Cache / pub-sub       | 6379 | Socket.IO adapter, BullMQ, sessions | Compute Engine VM                           |
| Qdrant            | Vector database       | 6333 | RAG retrieval (chatbot + explain)   | Compute Engine VM with persistent disk      |
| OSRM              | Routing engine        | 5000 | Road network distance matrix        | Same VM as Qdrant/Redis                     |

Lowest-risk, lowest-cost split:

- Cloud Run for every stateless service (scale-to-zero = no idle cost).
- Heroku Postgres stays — do not migrate it.
- One Compute Engine VM (`e2-standard-2`) for Redis + Qdrant + OSRM running as Docker Compose services.
- Artifact Registry for all container images.
- Secret Manager for every runtime secret and API key.
- GitHub Actions as the only CI/CD orchestrator.

## 2. What the Code Actually Requires

The plan must account for real runtime constraints already encoded in the repo:

- **Backend** requires `JWT_SECRET`, `CHATBOT_SERVICE_URL`, `ML_SERVICE_URL`, `ROUTE_OPTIMIZER_URL`, `EXPLAIN_ANALYTICS_URL`, `NEXT_FRONTEND_URL`, `OSRM_BASE_URL`, `ZOHO_SMTP_*` before it boots. It connects to Heroku Postgres via `PGHOST/PGPORT/PGUSER/PGPASSWORD/PGDATABASE` with `PGSSL=true`.
- **Backend** uses Redis with a password (`requirepass`) for Socket.IO pub/sub and BullMQ queues.
- **Backend** uses TypeORM with `synchronize = false` — migrations must run explicitly before traffic shifts.
- **Backend** storage is S3-shaped: `AWS_ACCESS_KEY_ID`, `AWS_SECRET`, `AWS_S3_BUCKET`, `AWS_S3_URL`. Keep using the existing S3/compatible bucket for evidence uploads and report PDFs.
- **Chatbot-service** mounts `./chatbot-service/data` as a read-only PDF directory. For Cloud Run, bake the PDFs into the container image at build time — it is the simplest path for a demo.
- **Chatbot-service** and **explain-analytics** both depend on Qdrant at startup. They must not be deployed until the Qdrant VM is running.
- **Explain-analytics** depends on Qdrant, Redis, and Gemini.
- **OSRM** uses `platform: linux/amd64` and requires the pre-processed file `/data/sri-lanka-latest.osrm`. The `osrm-data/` directory (containing that file) must be on a persistent disk on the VM — not inside the container image.
- **Weekly ML forecast** is already automated in `.github/workflows/weekly-forecast.yml`. Nothing to build there.

## 3. GCP Architecture

### 3.1 High-level layout

```
Internet
  └─> Cloud Run: frontend (HTTPS)
        └─> Cloud Run: backend (HTTPS)
              ├─> Heroku Postgres (SSL, external)
              ├─> VM: Redis (password-protected, internal)
              ├─> Cloud Run: explain-analytics
              │     ├─> VM: Qdrant
              │     └─> VM: Redis
              ├─> Cloud Run: chatbot-service
              │     └─> VM: Qdrant
              ├─> Cloud Run: route-optimizer
              └─> VM: OSRM
```

### 3.2 GCP resources to provision

| Resource                           | Notes                                                            |
| ---------------------------------- | ---------------------------------------------------------------- |
| One GCP project                    | Everything goes in here                                          |
| Region: `asia-south1`              | Closest to Sri Lanka, lower latency                              |
| Artifact Registry repo             | One repo, all images                                             |
| Compute Engine VM: `e2-standard-2` | 2 vCPU, 8 GB RAM — runs Redis + Qdrant + OSRM via Docker Compose |
| Persistent disk (50 GB SSD)        | Attached to VM, holds Qdrant data + OSRM data files              |
| Cloud Storage bucket               | For future evidence uploads if you add a GCS adapter             |
| Secret Manager secret set          | All env vars injected at Cloud Run deploy time                   |
| VPC connector (optional but cheap) | Allows Cloud Run → VM private IP without public internet         |

**Why `e2-standard-2` and not `e2-medium`**: OSRM for Sri Lanka after preprocessing holds the graph in RAM. A full country file typically needs 1–3 GB. Qdrant needs additional RAM for vector indices. 8 GB gives safe headroom for both.

## 4. Phase-by-Phase Rollout

### Phase 0: Local container hardening

Purpose: prove every service container starts cleanly before spending anything.

Checklist:

- [ ] `docker compose up` works for the full stack.
- [ ] Every service health endpoint returns 200: `/health` on backend, all Python services.
- [ ] Backend connects to Heroku Postgres, runs migrations, and responds to `GET /health`.
- [ ] Backend can reach Redis with the password (`REDIS_PASSWORD=ZytgpWDhcFeosIzeheccQsRj4Sq1BOqx`).
- [ ] Chatbot and explain-analytics can reach Qdrant.
- [ ] Create `.env.example` files for every service (copy actual `.env` files, redact secret values).
- [ ] Verify `chatbot-service/data/` contains the PDF documents that must be baked into the image.

Exit criteria: `docker compose up && curl -sf http://localhost:3001/health` returns healthy.

### Phase 1: Harden the existing CI workflow

Purpose: extend `.github/workflows/ci.yml` to cover all services before any deploy work starts.

Current state: `ci.yml` has `backend-unit`, `backend-integration`, `backend-build`, and `frontend`. The following jobs are missing:

Add to `ci.yml`:

```
python-services:
  runs-on: ubuntu-latest
  strategy:
    matrix:
      service: [chatbot-service, explain-analytics, route-optimizer]
  steps:
    - uses: actions/checkout@v4
    - uses: astral-sh/setup-uv@v4
      with: { python-version: "3.12" }
    - run: uv sync --no-dev
      working-directory: ${{ matrix.service }}
    - run: uv run python -c "import src" || uv run python -c "import app"
      working-directory: ${{ matrix.service }}

docker-build:
  runs-on: ubuntu-latest
  needs: [backend-build, frontend, python-services]
  strategy:
    matrix:
      service:
        - { name: frontend,          context: frontend }
        - { name: backend,           context: backend }
        - { name: chatbot-service,   context: chatbot-service }
        - { name: explain-analytics, context: explain-analytics }
        - { name: route-optimizer,   context: route-optimizer }
  steps:
    - uses: actions/checkout@v4
    - uses: docker/setup-buildx-action@v3
    - uses: docker/build-push-action@v6
      with:
        context: ${{ matrix.service.context }}
        push: false
        cache-from: type=gha
        cache-to: type=gha,mode=max
```

Also enable the PR trigger (uncomment the `pull_request` block).

Exit criteria: CI fails fast on any test, build, or import regression across all services.

### Phase 2: Artifact Registry and image publishing

Purpose: publish versioned images to GCP so deploys are immutable and traceable.

Prerequisites:

- GCP project created, billing enabled.
- `asia-south1` Artifact Registry repository created: `asia-south1-docker.pkg.dev/PROJECT_ID/epilink`.
- GitHub repository secret `GCP_PROJECT_ID` added.
- Workload Identity Federation configured (see Section 5.3) — no long-lived JSON keys.

Add a `publish` job to `ci.yml` (runs only on pushes to `main`, after `docker-build` passes):

```
publish:
  runs-on: ubuntu-latest
  needs: docker-build
  if: github.ref == 'refs/heads/main'
  permissions:
    contents: read
    id-token: write
  steps:
    - uses: actions/checkout@v4
    - uses: google-github-actions/auth@v2
      with:
        workload_identity_provider: ${{ secrets.WIF_PROVIDER }}
        service_account: ${{ secrets.WIF_SERVICE_ACCOUNT }}
    - uses: google-github-actions/setup-gcloud@v2
    - run: gcloud auth configure-docker asia-south1-docker.pkg.dev
    - uses: docker/build-push-action@v6
      with:
        context: <service>
        push: true
        tags: |
          asia-south1-docker.pkg.dev/${{ secrets.GCP_PROJECT_ID }}/epilink/<service>:sha-${{ github.sha }}
          asia-south1-docker.pkg.dev/${{ secrets.GCP_PROJECT_ID }}/epilink/<service>:latest
```

Repeat the build-push step for each of the five deployable services. Use a matrix to avoid duplication.

Exit criteria: `sha-<gitsha>` tags exist in Artifact Registry for every service after each main push.

### Phase 3: Provision the VM for stateful services ✅ COMPLETE

Purpose: get Redis, Qdrant, and OSRM running on a persistent VM before the Cloud Run services try to connect.

**Status: ✅ Completed**

- VM: `e2-standard-2` in `asia-south1-a` with 50 GB SSD persistent disk
- Redis: running on port 6379 (password-protected)
- Qdrant: running on ports 6333/6334, healthz check passing
- OSRM: running on port 5000, data loaded (705 MB)
- **VM internal IP: `10.160.0.2`** ← use this for all Cloud Run service configurations

Exit criteria: ✅ All services healthy and responding to requests

### Phase 4: Deploy stateless services to Cloud Run

Purpose: get the visible product running in the cloud.

**VM connectivity info for all Cloud Run services:**

```
REDIS_HOST=10.160.0.2
REDIS_PORT=6379
REDIS_PASSWORD=ZytgpWDhcFeosIzeheccQsRj4Sq1BOqx
QDRANT_URL=http://10.160.0.2:6333
OSRM_BASE_URL=http://10.160.0.2:5000
```

Deployment order (each depends on the previous being healthy):

1. **route-optimizer** — no external dependencies beyond its own container.
2. **explain-analytics** — depends on Qdrant and Redis (VM must be up first). ✅
3. **chatbot-service** — depends on Qdrant (VM must be up first). ✅
4. **backend** — depends on Heroku Postgres, Redis, and all three services above.
5. **frontend** — depends on backend.

Cloud Run settings for all services:

```
--region asia-south1
--min-instances 0
--max-instances 3
--cpu 1
--memory 512Mi          # increase to 1Gi for explain-analytics / chatbot if needed
--set-secrets ...       # inject from Secret Manager
--allow-unauthenticated # public demo
```

Service-specific notes:

- **chatbot-service**: The `chatbot-service/data/` PDF directory must be included in the Docker image at build time (`COPY data/ /app/data/` in the Dockerfile). Verify this before deploying.
- **explain-analytics**: Set `--memory 1Gi` — the Agno agent framework and embedding models need more RAM.
- **backend**: Pass `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD` pointing to VM internal IP. Pass all Heroku Postgres vars with `PGSSL=true`.
- **frontend**: `NEXT_PUBLIC_API_URL` and `NEXT_PUBLIC_SOCKET_URL` must point to the deployed backend Cloud Run URL. These are build-time vars — the image must be rebuilt with the correct URLs, or use runtime environment injection via `/api` rewrites.

Exit criteria:

- `curl https://FRONTEND_URL` renders the dashboard.
- `curl https://BACKEND_URL/health` returns all services healthy.
- EpiBot chatbot responds to a question.
- Route optimizer returns a route.

### Phase 5: Wire up the deploy workflow (CI/CD)

Purpose: make every push to `main` automatically deploy updated services.

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    needs: [] # run after ci.yml passes — use workflow_run trigger or combine
    permissions:
      contents: read
      id-token: write
    steps:
      - uses: actions/checkout@v4

      - uses: google-github-actions/auth@v2
        with:
          workload_identity_provider: ${{ secrets.WIF_PROVIDER }}
          service_account: ${{ secrets.WIF_SERVICE_ACCOUNT }}

      - uses: google-github-actions/setup-gcloud@v2

      - name: Build and push images
        # matrix or sequential build-push for each service
        # tag: sha-${{ github.sha }}

      - name: Deploy Cloud Run services
        run: |
          for SERVICE in route-optimizer explain-analytics chatbot-service backend frontend; do
            gcloud run deploy epilink-$SERVICE \
              --image asia-south1-docker.pkg.dev/$PROJECT_ID/epilink/$SERVICE:sha-${{ github.sha }} \
              --region asia-south1 \
              --min-instances 0 \
              --allow-unauthenticated
          done

      - name: Smoke tests
        run: |
          curl -sf ${{ secrets.BACKEND_URL }}/health
          curl -sf ${{ secrets.EXPLAIN_URL }}/health
          curl -sf ${{ secrets.CHATBOT_URL }}/health
          curl -sf ${{ secrets.ROUTE_URL }}/health
          curl -sf ${{ secrets.FRONTEND_URL }}
```

Rollback is always: redeploy the previous `sha-<gitsha>` tag from Artifact Registry.

### Phase 6: Secrets and hardening

Purpose: remove all plaintext secrets from environment and lock down access.

Deliverables:

- Every secret listed in Section 7 is stored in Secret Manager.
- Cloud Run services use `--set-secrets ENV_VAR=secret-name:latest` — no secrets in workflow files.
- `.env` files removed from version control (add to `.gitignore` if not already).
- `.env.example` files committed for every service.
- HTTPS enforced everywhere (Cloud Run does this by default).
- Cloud Logging dashboards for each Cloud Run service.
- Alert on 5xx error rate > 5% for backend.
- Backup schedule enabled for Heroku Postgres (check Heroku plan).
- Qdrant persistent disk snapshots scheduled via GCP snapshot policy.

## 5. GitHub Actions CI/CD Flow

### 5.1 Workflow files

| File                                    | Trigger               | Purpose                                    |
| --------------------------------------- | --------------------- | ------------------------------------------ |
| `.github/workflows/ci.yml`              | push to `main`        | Test, build, verify all services           |
| `.github/workflows/deploy.yml`          | push to `deploy-gcp`  | Build images, push to AR, deploy Cloud Run |
| `.github/workflows/weekly-forecast.yml` | cron Monday 02:00 UTC | Already done — ML predictions to Heroku DB |

### 5.2 Workflow strategy

**Two-branch deployment for clarity and control:**

- **`main` branch**: All code commits trigger `ci.yml` to test, build, and verify every service. Images are published to Artifact Registry with the commit SHA.
- **`deploy-gcp` branch**: Push to this branch to trigger `deploy.yml`, which deploys the latest images from Artifact Registry to Cloud Run. This gives you manual control over when deployments happen.
- **Rollback**: To rollback, create a branch from an older commit SHA, push to `deploy-gcp`, and the workflow will redeploy that version.

### 5.3 CI workflow job graph

```
backend-unit ─┐
               ├─> backend-build ─┐
backend-integration               ├─> docker-build (matrix) ─> publish (main only)
                                  │
frontend ─────────────────────────┘
python-services (matrix) ─────────┘
```

### 5.4 Workload Identity Federation setup (no JSON keys)

```bash
# Run once in your GCP project
PROJECT_ID=your-project-id
PROJECT_NUMBER=$(gcloud projects describe $PROJECT_ID --format='value(projectNumber)')
REPO=your-github-org/epilink-system

gcloud iam workload-identity-pools create github-pool \
  --location=global --display-name="GitHub Actions pool"

gcloud iam workload-identity-pools providers create-oidc github-provider \
  --location=global \
  --workload-identity-pool=github-pool \
  --display-name="GitHub provider" \
  --attribute-mapping="google.subject=assertion.sub,attribute.repository=assertion.repository" \
  --issuer-uri="https://token.actions.githubusercontent.com"

gcloud iam service-accounts create github-deployer \
  --display-name="GitHub Actions deployer"

# Grant permissions: Artifact Registry writer, Cloud Run deployer, Secret Manager accessor
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:github-deployer@$PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/artifactregistry.writer"

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:github-deployer@$PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/run.developer"

gcloud iam service-accounts add-iam-policy-binding \
  github-deployer@$PROJECT_ID.iam.gserviceaccount.com \
  --member="principalSet://iam.googleapis.com/projects/$PROJECT_NUMBER/locations/global/workloadIdentityPools/github-pool/attribute.repository/$REPO" \
  --role="roles/iam.workloadIdentityUser"
```

Add to GitHub repository secrets:

- `WIF_PROVIDER`: `projects/PROJECT_NUMBER/locations/global/workloadIdentityPools/github-pool/providers/github-provider`
- `WIF_SERVICE_ACCOUNT`: `github-deployer@PROJECT_ID.iam.gserviceaccount.com`
- `GCP_PROJECT_ID`: your project ID

## 6. Budget Plan for the $300 Trial

Since Heroku Postgres is already paid for outside GCP, the full $300 stays within GCP.

| Resource                     | Estimated monthly cost | Notes                                    |
| ---------------------------- | ---------------------- | ---------------------------------------- |
| Compute Engine e2-standard-2 | $50–60                 | Run 24/7 during demo period              |
| 50 GB SSD persistent disk    | ~$9                    | Qdrant storage + OSRM data               |
| Cloud Run (5 services)       | $20–40                 | Scale-to-zero; cost only during requests |
| Artifact Registry            | ~$2–5                  | Delete old tags regularly                |
| Cloud Logging + Monitoring   | ~$5                    | First 50 GB logs free                    |
| Cloud Storage                | ~$5                    | If using GCS for evidence uploads        |
| Egress                       | ~$5–10                 | Keep demo traffic light                  |
| **Total estimate**           | **~$96–134/month**     | ~2 months of demo in the free trial      |

Budget guardrails:

- Keep `min-instances = 0` on all Cloud Run services.
- **Stop or delete the VM when not demoing** — it costs ~$1.70/day.
- Use small Cloud Run allocations (1 CPU / 512 Mi) until proven insufficient.
- Set a billing alert at $150 and $250 in GCP Billing.
- Delete unused Artifact Registry image tags (keep last 3 per service).
- Use one region only.

## 7. Environment Variables Reference

### Backend

| Variable                | Source         | Notes                                      |
| ----------------------- | -------------- | ------------------------------------------ |
| `JWT_SECRET`            | Secret Manager |                                            |
| `PGHOST`                | Secret Manager | Heroku Postgres host                       |
| `PGPORT`                | Secret Manager | Usually 5432                               |
| `PGUSER`                | Secret Manager | Heroku Postgres user                       |
| `PGPASSWORD`            | Secret Manager | Heroku Postgres password                   |
| `PGDATABASE`            | Secret Manager | Heroku Postgres DB name                    |
| `PGSSL`                 | Secret Manager | Must be `true` for Heroku Postgres         |
| `REDIS_HOST`            | Secret Manager | VM internal IP                             |
| `REDIS_PORT`            | Secret Manager | `6379`                                     |
| `REDIS_USERNAME`        | Secret Manager | `default`                                  |
| `REDIS_PASSWORD`        | Secret Manager | Set in VM Redis config                     |
| `ML_SERVICE_URL`        | Secret Manager | Unused at runtime; keep for parity         |
| `EXPLAIN_ANALYTICS_URL` | Secret Manager | Cloud Run URL for explain-analytics        |
| `CHATBOT_SERVICE_URL`   | Secret Manager | Cloud Run URL for chatbot-service          |
| `ROUTE_OPTIMIZER_URL`   | Secret Manager | Cloud Run URL for route-optimizer          |
| `OSRM_BASE_URL`         | Secret Manager | `http://VM_IP:5000`                        |
| `NEXT_FRONTEND_URL`     | Secret Manager | Cloud Run URL for frontend                 |
| `FRONTEND_URL`          | Secret Manager | Same as above                              |
| `AWS_ACCESS_KEY_ID`     | Secret Manager | S3-compatible storage for evidence uploads |
| `AWS_SECRET`            | Secret Manager |                                            |
| `AWS_REGION`            | Secret Manager |                                            |
| `AWS_S3_BUCKET`         | Secret Manager |                                            |
| `AWS_S3_URL`            | Secret Manager |                                            |
| `ZOHO_SMTP_HOST`        | Secret Manager | Email service                              |
| `ZOHO_SMTP_PORT`        | Secret Manager |                                            |
| `ZOHO_SMTP_USER`        | Secret Manager |                                            |
| `ZOHO_SMTP_PASS`        | Secret Manager |                                            |
| `EMAIL_ENABLED`         | Secret Manager | Set `false` to disable email in demo       |

### Chatbot-service

| Variable                 | Source         | Notes                                   |
| ------------------------ | -------------- | --------------------------------------- |
| `GEMINI_API_KEY`         | Secret Manager |                                         |
| `QDRANT_URL`             | Secret Manager | `http://VM_IP:6333`                     |
| `QDRANT_COLLECTION_NAME` | Secret Manager | `dengue_knowledge`                      |
| `DATA_DIR`               | Baked in image | `/app/data` — PDFs copied at build time |
| `ADMIN_API_KEY`          | Secret Manager | For document ingest endpoints           |

### Explain-analytics

| Variable                    | Source         | Notes                          |
| --------------------------- | -------------- | ------------------------------ |
| `EXPLAIN_GEMINI_API_KEY`    | Secret Manager |                                |
| `EXPLAIN_QDRANT_URL`        | Secret Manager | `http://VM_IP:6333`            |
| `EXPLAIN_QDRANT_COLLECTION` | Secret Manager | `epilink_rag`                  |
| `EXPLAIN_REDIS_URL`         | Secret Manager | `redis://:PASSWORD@VM_IP:6379` |
| `EXPLAIN_BACKEND_API_URL`   | Secret Manager | Cloud Run URL for backend/api  |
| `EXPLAIN_ENVIRONMENT`       | Cloud Run env  | `production`                   |
| `EXPLAIN_RAG_ENABLED`       | Cloud Run env  | `true`                         |
| `EXPLAIN_ENABLE_AGENT_MODE` | Cloud Run env  | `true`                         |

### Frontend

| Variable                 | Source         | Notes                                      |
| ------------------------ | -------------- | ------------------------------------------ |
| `NEXT_PUBLIC_API_URL`    | Build arg      | Must be set at `docker build` time         |
| `NEXT_PUBLIC_SOCKET_URL` | Build arg      | Must be set at `docker build` time         |
| `CHATBOT_SERVICE_URL`    | Secret Manager | Server-side proxy to chatbot Cloud Run URL |

### ML model (weekly forecast — GitHub Actions)

Stored as GitHub Actions secrets (not GCP Secret Manager):

- `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`
- `PGSSLMODE=require`

These are already set in the weekly forecast workflow. No changes needed.

## 8. Demo Milestones

| Milestone | Done when                                                                         |
| --------- | --------------------------------------------------------------------------------- |
| **A**     | `docker compose up` boots the full local stack cleanly                            |
| **B**     | All CI jobs pass on `main` — tests, builds, and import checks for every service   |
| **C**     | Images push to Artifact Registry on every `main` push                             |
| **D**     | VM is running Redis + Qdrant + OSRM; health checks pass from a test Cloud Run job |
| **E**     | All 5 Cloud Run services are deployed and `GET /health` returns 200 on each       |
| **F**     | Frontend renders, chatbot responds, route optimizer returns a route               |
| **G**     | A deploy workflow automatically ships a code change in under 10 minutes           |

## 9. Known Risks and Mitigations

| Risk                                              | Mitigation                                                          |
| ------------------------------------------------- | ------------------------------------------------------------------- |
| OSRM data too large for VM RAM                    | Use `e2-standard-2` (8 GB); Sri Lanka MLD graph fits comfortably    |
| Chatbot PDF data not available in Cloud Run image | Copy `chatbot-service/data/` into image at build time via `COPY`    |
| Frontend Next.js bakes API URL at build time      | Pass `NEXT_PUBLIC_*` as Docker build args in the publish/deploy job |
| Heroku Postgres SSL cert rotation                 | Use `PGSSL=true` with `sslmode=require` — no hardcoded cert pinning |
| VM cost if left running                           | Set a calendar reminder to stop VM after each demo session          |
| Cloud Run cold start on scale-from-zero           | Accept for demo; set `--min-instances 1` on backend only if needed  |
| Redis/Qdrant on same VM as OSRM — memory pressure | Monitor VM memory; move OSRM to its own command if needed           |

## 10. Recommended Execution Order

1. Phase 0 — fix local docker-compose, create `.env.example` files.
2. Phase 1 — extend `ci.yml` with Python jobs and docker-build job.
3. Phase 2 — create GCP project, Artifact Registry, Workload Identity; add publish job.
4. Phase 3 — provision VM, copy OSRM data, start Redis/Qdrant/OSRM on VM.
5. Phase 4 — deploy Cloud Run services in dependency order.
6. Phase 5 — create `deploy.yml` for automated deploys.
7. Phase 6 — move all secrets to Secret Manager, add monitoring alerts.
