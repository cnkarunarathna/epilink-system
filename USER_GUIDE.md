# EpiLink – Local Setup & Developer Guide

This guide walks through cloning the repository, configuring environment variables, and running the EpiLink system locally — either as a full Docker stack or as a hybrid setup (infrastructure in Docker, application services running natively).

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Clone the Repository](#2-clone-the-repository)
3. [Environment Configuration](#3-environment-configuration)
4. [Option A – Full Docker Stack](#4-option-a--full-docker-stack)
5. [Option B – Local Development (Hybrid)](#5-option-b--local-development-hybrid)
6. [One-Time OSRM Data Preparation](#6-one-time-osrm-data-preparation)
7. [Mobile App Setup](#7-mobile-app-setup)
8. [Service URLs Reference](#8-service-urls-reference)
9. [Common Commands](#9-common-commands)

---

## 1. Prerequisites

Install the following tools before proceeding.

| Tool | Version | Purpose |
|---|---|---|
| [Git](https://git-scm.com/) | Latest | Version control |
| [Node.js](https://nodejs.org/) | 20 LTS or later | Frontend (Next.js) and Backend (NestJS) |
| [npm](https://www.npmjs.com/) | Bundled with Node.js | Package management |
| [Docker Desktop](https://www.docker.com/products/docker-desktop/) | Latest | Container runtime for all services |
| [uv](https://docs.astral.sh/uv/) | Latest | Python package manager for ML/AI services |

> **Note for Option B (local dev only):** Node.js and `uv` are required. For Option A (Docker only), only Docker Desktop is needed.

Verify installations:

```bash
node -v
npm -v
docker --version
uv --version
```

---

## 2. Clone the Repository

```bash
git clone https://github.com/cnkarunarathna/epilink-system.git
cd epilink-system
```

---

## 3. Environment Configuration

Each service requires its own `.env` file. Copy the provided examples and fill in the required values.

### 3.1 Backend

```bash
cp backend/.env.example backend/.env
```

Open `backend/.env` and fill in:

| Variable | Description |
|---|---|
| `JWT_SECRET` | Secret key for signing JWT tokens (any long random string) |
| `PGHOST` | PostgreSQL host (e.g. `localhost` for local DB) |
| `PGPORT` | PostgreSQL port (default: `5432`) |
| `PGUSER` | PostgreSQL username |
| `PGPASSWORD` | PostgreSQL password |
| `PGDATABASE` | PostgreSQL database name |
| `PGSSL` | Set to `false` for local dev, `true` for cloud |
| `REDIS_HOST` | Redis host (default: `redis` in Docker, `localhost` for local) |
| `REDIS_PORT` | Redis port (default: `6379`) |
| `REDIS_USERNAME` | Redis username (default: `default`) |
| `REDIS_PASSWORD` | Redis password |
| `AWS_ACCESS_KEY_ID` | AWS access key (for S3 file storage) |
| `AWS_SECRET` | AWS secret key |
| `AWS_S3_BUCKET` | S3 bucket name |
| `AWS_S3_URL` | S3 endpoint URL |
| `ZOHO_SMTP_HOST` | SMTP host for email (optional) |
| `ZOHO_SMTP_PORT` | SMTP port (optional) |
| `ZOHO_SMTP_USER` | SMTP username (optional) |
| `ZOHO_SMTP_PASS` | SMTP password (optional) |
| `EMAIL_ENABLED` | Set to `false` to disable email sending |

### 3.2 Frontend

```bash
cp frontend/.env.example frontend/.env
```

The defaults work for local development:

```
NEXT_PUBLIC_API_URL=http://localhost:3001/api
NEXT_PUBLIC_SOCKET_URL=http://localhost:3001
CHATBOT_SERVICE_URL=http://localhost:8000
```

### 3.3 Chatbot Service

```bash
cp chatbot-service/.env.example chatbot-service/.env
```

Fill in:

| Variable | Description |
|---|---|
| `GEMINI_API_KEY` | Google Gemini API key |
| `ADMIN_API_KEY` | Admin key for protected ingest endpoints |

The `QDRANT_URL` and `QDRANT_COLLECTION_NAME` defaults work as-is for local Docker.

### 3.4 Explain Analytics Service

```bash
cp explain-analytics/.env.example explain-analytics/.env
```

Fill in:

| Variable | Description |
|---|---|
| `EXPLAIN_GEMINI_API_KEY` | Google Gemini API key (can reuse the same key as chatbot) |

The remaining variables use sensible defaults for local Docker.

### 3.5 ML Model Service

```bash
cp ml-model/.env.example ml-model/.env
```

No additional values are required for local development — the defaults are sufficient.

### 3.6 Route Optimizer Service

```bash
cp route-optimizer/.env.example route-optimizer/.env
```

No additional values are required for local development.

---

## 4. Option A – Full Docker Stack

This is the simplest way to run the entire system. All services — frontend, backend, ML models, chatbot, analytics, route optimizer, Redis, Qdrant, and OSRM — start as Docker containers.

### Step 1 – Prepare OSRM map data (one-time)

The route optimizer requires pre-processed Sri Lanka map data. Run this once before starting the stack:

```bash
bash scripts/prepare-osrm.sh
```

This downloads ~70 MB of OpenStreetMap data and processes it. It can take several minutes. Subsequent runs are skipped if the data already exists.

### Step 2 – Build and start the full stack

```bash
./docker.sh up
```

This builds all Docker images and starts every service. The `docker-compose.override.yml` file is automatically applied, enabling hot-reload for code changes without rebuilding.

### Step 3 – Access the application

Once all containers are running, open your browser at:

- **Web Application:** [http://localhost:3000](http://localhost:3000)
- **Backend API:** [http://localhost:3001/api](http://localhost:3001/api)

---

## 5. Option B – Local Development (Hybrid)

This approach runs infrastructure services (Redis, Qdrant, OSRM) in Docker and application services natively on your machine. It offers faster startup and easier debugging.

### Step 1 – Start infrastructure services

```bash
./docker.sh dev
```

This starts Redis, Qdrant, and OSRM as Docker containers in detached mode.

### Step 2 – Update backend `.env` for local connectivity

When running the backend locally (not inside Docker), update `backend/.env` so it connects to the locally-exposed ports:

```
REDIS_HOST=localhost
REDIS_PORT=11801
```

> Redis is mapped to port `11801` on the host. Qdrant is available at `localhost:6333`.

### Step 3 – Install Node.js dependencies

```bash
npm run install:all
```

This installs packages for both the frontend and backend.

### Step 4 – Run database migrations

```bash
cd backend && npm run migration:run
```

### Step 5 – Start the application services

**Frontend + Backend only:**

```bash
npm run start
```

**All services (including Python ML/AI services):**

```bash
npm run all
```

This starts the following concurrently:

| Service | Command | Port |
|---|---|---|
| Frontend | `npm run dev --prefix frontend` | 3000 |
| Backend | `npm run start:dev --prefix backend` | 3001 |
| Chatbot Service | `uv run uvicorn main:app --reload` | 8002 |
| Explain Analytics | `uv run analytics` | 8010 |
| Route Optimizer | `uv run route` | 8001 |

> Python services use [`uv`](https://docs.astral.sh/uv/) for dependency management. Dependencies are installed automatically on first run.

### Step 6 – Access the application

- **Web Application:** [http://localhost:3000](http://localhost:3000)
- **Backend API:** [http://localhost:3001/api](http://localhost:3001/api)

---

## 6. One-Time OSRM Data Preparation

If you skipped Step 1 of Option A or need to re-generate the OSRM routing data, run:

```bash
bash scripts/prepare-osrm.sh
```

This script:
1. Downloads the Sri Lanka OpenStreetMap extract from Geofabrik (~70 MB)
2. Runs `osrm-extract` to build the routing graph
3. Runs `osrm-partition` and `osrm-customize` for the MLD routing algorithm
4. Outputs processed files to `osrm-data/`

The OSRM service will not start correctly without this data.

---

## 7. Mobile App Setup

The mobile app (`epilink-phi-mobile`) is a React Native / Expo project intended for Public Health Inspector (PHI) field access.

### Prerequisites

- Android Studio (for Android emulator) or a physical Android device
- Expo CLI: `npm install -g expo-cli`

### Setup

```bash
cd mobile
npm install
```

### Run on Android

```bash
npm run android
# or from the project root:
npm run mobile
```

Ensure an Android emulator is running or a physical device is connected via USB with developer mode enabled before running.

---

## 8. Service URLs Reference

| Service | URL | Notes |
|---|---|---|
| Frontend (Web) | http://localhost:3000 | Next.js application |
| Backend API | http://localhost:3001/api | NestJS REST API |
| Chatbot Service | http://localhost:8000 | Public chatbot (Docker) / port 8002 (local dev) |
| Explain Analytics | http://localhost:8010 | Explainable AI service |
| Route Optimizer | http://localhost:8001 | Route planning service |
| OSRM (Routing Engine) | http://localhost:5000 | OpenStreetMap routing backend |
| Redis | localhost:11801 | Cache and job queue |
| Qdrant | http://localhost:6333 | Vector database for RAG |

---

## 9. Common Commands

### Docker stack management

```bash
./docker.sh up             # Build and start full stack
./docker.sh stop           # Stop all containers (keep data)
./docker.sh down           # Stop and remove containers
./docker.sh restart        # Full restart (down + up)
./docker.sh logs backend   # Tail logs for a specific service
./docker.sh ps             # Show container status
./docker.sh clean-volumes  # Remove all containers and volumes (resets all data)
```

### Infrastructure only (local dev)

```bash
./docker.sh dev            # Start Redis + Qdrant + OSRM
./docker.sh dev-stop       # Stop infra containers
./docker.sh dev-logs redis # Tail Redis logs
```

### Backend database migrations

```bash
cd backend
npm run migration:run      # Apply pending migrations
npm run migration:revert   # Revert the last migration
npm run migration:show     # List migration status
```

### Running tests

```bash
npm run test               # Run backend unit tests
cd backend && npm run test:integration  # Run integration tests
```

---

## 10. Default Seed Accounts

When the backend starts for the first time it automatically seeds four default user accounts. Use these to log in and explore the system.

| Role | Email | Password | District |
|---|---|---|---|
| Admin | `admin@epilink.lk` | `Admin@123` | — |
| Supervisor | `supervisor@epilink.lk` | `Supervisor@123` | Colombo |
| PHI | `phi@epilink.lk` | `PHI@123` | Colombo |

Navigate to `http://localhost:3000/login` and enter the email and password for the role you want to test.

> These accounts are for development and testing only. Change or remove them before deploying to a production environment.
