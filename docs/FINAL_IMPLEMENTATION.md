# EpiLink — Final Implementation Documentation

> **Project:** EpiLink Dengue Risk Monitoring & Cleanup Management System
> **Author:** Charuka Karunarathna — Final Year Project, NSBM Green University (University of Plymouth affiliation)
> **Date:** April 2026
> **Status:** Production-ready (Phases 1–4 complete, Phase 5 enhancements in progress)

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Architecture](#2-architecture)
3. [Technology Stack](#3-technology-stack)
4. [ML Prediction Service — Ensemble Architecture](#4-ml-prediction-service--ensemble-architecture)
5. [Explain-Analytics (XAI) Microservice](#5-explain-analytics-xai-microservice)
6. [Public Chatbot — EpiBot](#6-public-chatbot--epibot)
7. [Backend API (NestJS)](#7-backend-api-nestjs)
8. [Web Dashboard](#8-web-dashboard)
9. [PHI Mobile Application](#9-phi-mobile-application)
10. [Public Risk Dashboard](#10-public-risk-dashboard)
11. [Task Analytics Dashboard](#11-task-analytics-dashboard)
12. [Email Notifications & Alerts](#12-email-notifications--alerts)
13. [Database Schema](#13-database-schema)
14. [API Reference](#14-api-reference)
15. [Implementation Roadmap & Status](#15-implementation-roadmap--status)
16. [Non-Functional Requirements](#16-non-functional-requirements)
17. [Testing Strategy & CI](#17-testing-strategy--ci)

---

## 1. System Overview

EpiLink is a full-stack, role-based dengue risk monitoring and field coordination platform built for the Sri Lankan Ministry of Health. It automates epidemiological data ingestion, generates ML-driven weekly risk predictions, and coordinates PHI (Public Health Inspector) field operations through task assignment, evidence tracking, and real-time communication.

### Core Objectives

| Objective | Status |
|---|---|
| Automate weekly dengue case ingestion and weather correlation | ✅ |
| Predict next-week dengue risk per district with uncertainty bounds | ✅ |
| Interactive dashboards for national, district, and field-level decisions | ✅ |
| Task assignment, evidence collection, and field reporting for PHIs | ✅ |
| AI-powered explainable insights grounded in MoH documents | ✅ |
| Public AI chatbot for dengue inquiries | ✅ |
| PHI mobile app with route optimization and evidence upload | ✅ |
| Real-time alerts and weekly report delivery | ✅ |
| DS-level (Divisional Secretariat) spatial disaggregation for Colombo | ✅ |

### User Roles

| Role | Key Capabilities |
|---|---|
| **Admin** | National analytics, task analytics dashboard, user management, reports, alert configuration, XAI insights |
| **Supervisor** | District dashboard, task creation/assignment, evidence review queue, PHI workload view, task-centric chat |
| **PHI** | Mobile task management, evidence upload (camera + GPS), route optimization, task-centric chat |
| **Public** | Risk forecast map, district lookup, health guidance, EpiBot chatbot |

---

## 2. Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CLIENTS                                         │
├─────────────────┬─────────────────────────┬─────────────────────────────────┤
│   Web Dashboard │    PHI Mobile App       │    GitHub Actions (Cron)         │
│   (Next.js 16)  │  (React Native / Expo)  │    Weekly prediction + ETL       │
└────────┬────────┴───────────┬─────────────┴──────────────┬──────────────────┘
         │                    │                            │
         ▼                    ▼                            ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                       NestJS Backend API (Port 3001)                         │
├────────────────────────────────────────────────────────────────────────────-┤
│  Auth  │  Users  │  Analytics  │  Tasks  │  Evidence  │  Reports  │  Email  │
│  Chat  │  Storage│  Notifications│ Districts│ Task-Analytics │  WebSocket   │
└────────┬─────────┴──────┬──────┴─────────────────────────────────────────-─┘
         │                │
         ▼                ▼
┌─────────────────┐   ┌────────────────────┐   ┌──────────────────────────┐
│   PostgreSQL 16  │   │   Object Storage   │   │         Redis             │
│  13 core entities│   │    AWS S3 / R2     │   │  BullMQ email queue       │
│  Prediction data │   │  Evidence photos   │   │  Socket.io adapter        │
│  Task messages   │   │  PDF reports       │   │  XAI session cache        │
└────────┬─────────┘   └────────────────────┘   └──────────────────────────┘
         │
    ┌────┴─────────────────────────────────────────┐
    ▼                                               ▼
┌──────────────────────────┐      ┌────────────────────────────────────────┐
│  ML Prediction Service   │      │  Explain-Analytics (XAI) Microservice  │
│  (Python FastAPI)         │      │  (Python FastAPI + Agno + Gemini)      │
│                           │      │                                        │
│  ┌─────────────────────┐  │      │  PostgreSQL ──> APScheduler ETL ──>   │
│  │ Feature Engineering │  │      │  text-embedding-004 ──> Qdrant        │
│  │   (60 features)     │  │      │  (HNSW, BM25+dense hybrid, RRF)       │
│  └─────────────────────┘  │      │  ──> Gemini 2.0 Flash Insights        │
│  ┌─────────────────────┐  │      │  ──> 12-tool Agentic Chat             │
│  │  XGBoost (60% wt)   │  │      └────────────────────────────────────────┘
│  │  LightGBM (40% wt)  │  │
│  └─────────────────────┘  │      ┌────────────────────────────────────────┐
│  ┌─────────────────────┐  │      │  Public Chatbot — EpiBot               │
│  │ Uncertainty (Q10/90)│  │      │  Gemini 2.5 Flash + Qdrant             │
│  └─────────────────────┘  │      │  Hybrid BM25 + dense RAG               │
│  ┌─────────────────────┐  │      └────────────────────────────────────────┘
│  │ DS Disaggregation   │  │
│  │ (Colombo 13 zones)  │  │      ┌────────────────────────────────────────┐
│  └─────────────────────┘  │      │  Route Optimization Microservice        │
└──────────────────────────┘      │  OR-Tools TSP + OSRM distance matrix   │
                                   └────────────────────────────────────────┘
```

### Microservice Communication

- **ML Service → NestJS:** Weekly cron pushes predictions directly to PostgreSQL via TypeORM
- **NestJS → Explain-Analytics:** Forwards user JWT (no shared service keys); service validates token against NestJS auth
- **NestJS → Route Service:** Internal REST call with task coordinates; returns optimized waypoint order + ETAs
- **Explain-Analytics ↔ Qdrant:** Docker network; Qdrant runs in container on port 6333
- **Real-time:** Socket.io on NestJS `/events` namespace handles task updates, chat (`chat:*` events), and task analytics feed (`task-analytics:update`)

---

## 3. Technology Stack

| Layer | Technology | Version / Notes |
|---|---|---|
| **Frontend (Web)** | Next.js, React, TypeScript, Tailwind CSS | Next.js 16, React 19 |
| **UI Components** | Shadcn UI, Radix Primitives | Sheet, Dialog, Toast, Table |
| **Charts** | Recharts | BarChart, LineChart, PieChart, RadialBarChart |
| **Maps** | Leaflet / React-Leaflet | District heatmap, task location, route visualization |
| **Frontend (Mobile)** | React Native / Expo | SDK 51+ |
| **Mobile Capabilities** | expo-image-picker, expo-location, expo-file-system | Camera, GPS, multipart upload |
| **Backend API** | NestJS, TypeORM | Node.js 24 |
| **Database** | PostgreSQL | v16 |
| **Caching / Queue** | Redis + BullMQ | Email queue, session cache, Socket.io adapter |
| **Real-time** | Socket.io | Tasks, chat, analytics feed |
| **Object Storage** | AWS S3 / Cloudflare R2 | `@aws-sdk/client-s3` |
| **Email** | Nodemailer + Zoho SMTP | Handlebars HTML templates |
| **ML Service** | Python, FastAPI, XGBoost, LightGBM, Optuna | v2.0 ensemble |
| **Explain-Analytics** | Python, FastAPI, Agno, APScheduler | Gemini 2.0 Flash |
| **Vector Database** | Qdrant | HNSW index, BM25 + dense hybrid |
| **Embeddings** | Google text-embedding-004 | 768-dim |
| **Chatbot LLM** | Gemini 2.5 Flash | Public EpiBot |
| **Insights LLM** | Gemini 2.0 Flash | Admin XAI service |
| **CI/CD** | GitHub Actions, Husky | Weekly cron, pre-commit hooks |
| **Deployment** | Docker, Vercel, Railway/Render | Frontend + backend split |

---

## 4. ML Prediction Service — Ensemble Architecture

### 4.1 Overview

The ML service (`ml-model/`) has been upgraded from a single-model approach to a **production-grade ensemble pipeline** (v2.0). The core improvement is replacing a basic XGBoost model with a dual-ensemble backed by 60 engineered features, Optuna hyperparameter tuning, quantile regression uncertainty bounds, and 4-level risk classification.

### 4.2 Performance Results

| Metric | v1.0 (Baseline) | v2.0 (Ensemble) | Improvement |
|---|---|---|---|
| **Test MAE** | 2.95 cases | 2.22 cases | **25% reduction** |
| **Test R²** | 0.982 | 0.991 | **Near-perfect fit** |
| **Training R²** | 0.929 | 0.946 | **Better generalization** |
| **Feature Count** | ~10 | 60 | **6× more signals** |
| **Confidence Intervals** | None | 80% CI (Q10/Q90) | **New capability** |
| **Risk Classification** | None | 4 levels | **New capability** |
| **Actual CI Coverage** | — | 79% | Target: 80% ✅ |

### 4.3 Pipeline Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                    EpiLink ML Pipeline v2.0                       │
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌──────────────┐    ┌──────────────────┐    ┌───────────────┐   │
│  │  Raw Data    │───>│ Feature Engineer │───>│   Ensemble    │   │
│  │ (PostgreSQL) │    │   (60 features)  │    │    Model      │   │
│  └──────────────┘    └──────────────────┘    └───────┬───────┘   │
│                                                       │           │
│                                          ┌────────────┴───────┐  │
│                                          │    XGBoost (60%)   │  │
│                                          ├────────────────────┤  │
│                                          │    LightGBM (40%)  │  │
│                                          └────────────┬───────┘  │
│                                                       │           │
│                                          ┌────────────▼───────┐  │
│                                          │ Uncertainty (Q10/90│  │
│                                          └────────────┬───────┘  │
│                                                       │           │
│                                   ┌───────────────────▼────────┐ │
│                                   │  Prediction + 80% CI +     │ │
│                                   │  Risk Level + SHAP Values  │ │
│                                   └────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────┘
```

### 4.4 Feature Engineering (60 Features)

**Module:** `ml-model/src/enhanced/feature_engineering.py`

#### Lag Features (10 features)

Captures temporal auto-correlation — dengue outbreaks have memory due to mosquito breeding cycles (10–14 days).

```
cases_lag1, cases_lag2, cases_lag3, cases_lag4          (1–4 weeks prior)
temp_lag1, precip_lag1, precip_lag2, humidity_lag1      (weather delay effects)
```

#### Rolling Statistics (6 features)

Distinguishes random fluctuation from genuine trend change.

```
cases_mean_4w, cases_std_4w, cases_max_4w               (short window)
cases_mean_8w, cases_std_8w, cases_max_8w               (longer window)
```

#### Cyclical / Seasonal Features (6 features)

Sin/cos encoding preserves cyclical relationships (week 52 is close to week 1). Monsoon flags are Sri Lanka-specific.

```
week_sin, week_cos                                       (week-of-year)
month_sin, month_cos                                     (month)
is_southwest_monsoon                                     (May–September / Yala)
is_northeast_monsoon                                     (December–February / Maha)
```

#### Trend & Momentum Features (5 features)

Critical for early outbreak detection — rate of change matters more than absolute level.

```
cases_wow_change                                         (week-over-week absolute)
cases_wow_pct_change                                     (week-over-week percent)
cases_trend_3w                                           (3-week direction)
is_accelerating                                          (boolean: growth accelerating?)
outbreak_momentum                                        (composite momentum score)
```

#### Weather Interaction Features (3 features)

Mosquito breeding is optimal under combined conditions, not individual factors alone.

```
temp_humidity_interaction                                (Temp × Humidity)
is_optimal_breeding                                      (boolean: 25–30°C AND >70% humidity)
hot_wet_index                                            (combined heat-moisture index)
```

#### Population Features (3 features)

Normalizes transmission rate for district size (handles Colombo outlier via log transform).

```
population_density, log_population_density, population_density_norm
```

#### District One-Hot Encoding (25 features)

One binary feature per Sri Lankan district.

```
district_Colombo, district_Gampaha, district_Kandy, ... (all 25 districts)
```

### 4.5 Model Training & Hyperparameter Optimization

**Module:** `ml-model/src/enhanced/model_tuning.py`

#### TimeSeriesSplit Cross-Validation

Prevents temporal data leakage — random K-Fold would allow the model to "peek" into the future.

```
Fold 1: Train [====]      | Val [=]
Fold 2: Train [======]    | Val [=]
Fold 3: Train [========]  | Val [=]
```

#### Optuna Hyperparameter Tuning

Bayesian optimization (TPE sampler), 50 trials per model, 3-fold TimeSeriesSplit, MAE objective, early pruning of unpromising trials.

**Optimized XGBoost Parameters:**

| Parameter | Search Space | Best Value |
|---|---|---|
| `n_estimators` | 100–1000 | 477 |
| `max_depth` | 3–12 | 4 |
| `learning_rate` | 0.01–0.3 | 0.09 |
| `subsample` | 0.6–1.0 | 0.77 |
| `colsample_bytree` | 0.6–1.0 | 0.83 |
| `min_child_weight` | 1–10 | 2 |
| `reg_alpha` | 1e-8–10 | 1.74 |
| `reg_lambda` | 1e-8–10 | 0.017 |
| `gamma` | 0–5 | 0.33 |

### 4.6 Ensemble Architecture

**Module:** `ml-model/src/enhanced/ensemble_model.py`

Weighted averaging of two gradient boosting models chosen for complementary strengths:

| Model | Weight | Strengths |
|---|---|---|
| **XGBoost** | 60% | Robust to outliers, handles missing values natively |
| **LightGBM** | 40% | Faster training, better generalization on small datasets |

```python
final_prediction = 0.6 × XGBoost_pred + 0.4 × LightGBM_pred
```

Model disagreement between the two members directly informs the uncertainty score — higher divergence → wider confidence interval.

### 4.7 Uncertainty Quantification

**Module:** `ml-model/src/enhanced/uncertainty_estimation.py`

#### Quantile Regression

Three separate gradient boosting models trained with different quantile loss objectives:

```
Q10_model  →  10th percentile  (lower bound)
Q50_model  →  50th percentile  (median / point estimate)
Q90_model  →  90th percentile  (upper bound)
```

**80% Confidence Interval** = [Q10, Q90]
**Actual coverage achieved:** 79% (target: 80%) ✅

#### Risk Level Classification

| Risk Level | Threshold | Colour | Recommended Action |
|---|---|---|---|
| **Low** | < 10 cases | 🟢 Green | Routine surveillance |
| **Medium** | 10–30 cases | 🟡 Orange | Enhanced monitoring |
| **High** | 30–50 cases | 🔴 Red | Activate outbreak response |
| **Critical** | > 50 cases | 🟣 Purple | Emergency intervention |

### 4.8 Training Output Summary

```
Training Performance:
   MAE:  2.234
   R²:   0.946

Test Performance:
   MAE:  2.221
   R²:   0.991

Top 10 Features by Importance:
   cases_mean_4w         328.66
   outbreak_momentum     323.00
   cases_trend_3w        238.01
   cases_lag3            188.01
   cases_lag2            169.51
   cases_lag1            161.20
   cases_std_4w           98.34
   precipitation_sum      87.41
   temp_humidity_interaction  74.22
   is_optimal_breeding    62.90
```

### 4.9 API Prediction Response (v2.0)

```json
{
  "district": "Colombo",
  "predicted_cases": 42,
  "confidence_interval": {
    "lower": 35,
    "upper": 49,
    "confidence_level": 0.8
  },
  "risk_level": "high",
  "model_version": "2.0.0",
  "shap_values": {
    "cases_mean_4w": 0.38,
    "outbreak_momentum": 0.29,
    "precipitation_sum": 0.12
  }
}
```

### 4.10 DS-Level Spatial Disaggregation (Colombo)

**Module:** `ml-model/src/forecasting/ds_disaggregation.py`

For Colombo district (highest burden), the district-level prediction is disaggregated into estimates for all **13 Divisional Secretariat (DS) divisions** using a composite spatial weight:

```
DS_cases_i = district_total × weight_i

weight_i = 0.50 × population_proportion_i
         + 0.30 × density_score_i
         + 0.20 × historical_burden_score_i
```

This computation runs at serve-time in NestJS — no additional DB table required. The DS-level estimates power the sub-district map view and targeted task recommendations within Colombo.

### 4.11 ML Source File Structure

```
ml-model/
├── app.py                          # FastAPI application entry point
├── src/
│   ├── enhanced/                   # v2.0 ensemble pipeline
│   │   ├── feature_engineering.py  # 60-feature creation pipeline
│   │   ├── model_tuning.py         # Optuna + TimeSeriesSplit CV
│   │   ├── ensemble_model.py       # XGBoost + LightGBM ensemble
│   │   ├── uncertainty_estimation.py  # Quantile regression + risk levels
│   │   ├── evaluation.py           # Comprehensive metrics suite
│   │   └── train.py                # Unified training entry point
│   ├── forecasting/                # Production inference
│   │   ├── weekly.py               # Weekly cron prediction job
│   │   ├── ds_disaggregation.py    # Colombo DS-level spatial disaggregation
│   │   ├── features.py             # Feature pipeline for inference
│   │   └── backfill.py             # Historical weather data backfill
│   ├── api/                        # FastAPI route handlers
│   └── legacy/                     # v1.0 single-model (reference)
├── models/                         # Serialized model artefacts
│   ├── dengue_ensemble_model.pkl
│   ├── uncertainty_estimator.pkl
│   ├── feature_engineer.pkl
│   └── model_metadata.pkl
└── tests/
    ├── test_ensemble.py            # 25 unit tests: ensemble, risk classifier, quantile regressor, uncertainty estimator
    └── test_feature_engineering.py # Feature pipeline tests
```

### 4.12 Model Endpoints

| Method | Path | Description |
|---|---|---|
| `POST` | `/predict` | Single district prediction with CI and risk level |
| `POST` | `/predict/bulk` | All 26 districts, same feature set |
| `POST` | `/predict/bulk/districts` | Multiple districts, different features per district |
| `GET` | `/model/info` | Model metadata and performance metrics |
| `GET` | `/districts` | List of supported districts |
| `GET` | `/risk/thresholds` | Current risk classification thresholds |

---

## 5. Explain-Analytics (XAI) Microservice

**Directory:** `explain-analytics/`

A production-grade RAG (Retrieval-Augmented Generation) microservice translating complex ML predictions into plain-language, actionable insights grounded in Ministry of Health documents.

### 5.1 RAG Pipeline

```
[PostgreSQL] ──┐
               ├──> [APScheduler ETL — Weekly]
[Weather API] ─┘          │
                           ▼
              [Text + Insight Generation]
                           │
              [text-embedding-004 (768-dim)]
                           │
                    [Qdrant Vector DB]
              (HNSW index — ef_construction=200,
               m=16; BM25 fastembed sparse vectors)
                           │
              [Hybrid Retriever: α·dense + β·sparse]
              [RRF Fusion + Recency Decay Scoring]
                           │
              [Gemini 2.0 Flash — Grounded Response]
                           │
              [Admin Dashboard / Agentic Chat]
```

### 5.2 Key Capabilities

| Feature | Implementation |
|---|---|
| **SHAP-Grounded Drivers** | Insights cite actual model feature importances (rainfall, temperature, case trend) — not heuristic rules |
| **Hybrid Retrieval** | BM25 + dense vectors with RRF fusion; time-decay score boosts recent MoH guidelines |
| **National Briefing** | Single-call executive situation report for all 26 districts; `URGENT:` prefix when risk score ≥ 0.85 |
| **Batch Explain** | All districts in one API call for automated weekly situation reports |
| **Geographic Spillover** | Flags `spillover_risk` when 3+ neighbouring districts rise simultaneously |
| **Confidence Splitting** | Separate `data_completeness_score` and `prediction_confidence` from ML uncertainty bounds |
| **Automated ETL** | APScheduler weekly job fetches all district data → generates dense + sparse embeddings → upserts Qdrant corpus |
| **Agentic Chat** | 12-tool Agno agent with Redis session persistence (2-hour TTL, auto-compress at 10 turns) |

### 5.3 Agentic Chat Tools (12)

| Tool | Purpose |
|---|---|
| `get_district_prediction` | Fetch current week prediction + CI for a district |
| `get_district_trend` | Case trend over configurable week window |
| `get_weather_correlation` | Temperature/precipitation correlation for district |
| `get_outbreak_alerts` | Active outbreak alert list |
| `get_hotspot_analysis` | Top hotspot districts |
| `get_national_summary` | Aggregate national metrics |
| `get_national_briefing` | Full executive situation report |
| `get_seasonal_pattern` | Historical seasonal pattern for district |
| `get_cross_district_spillover` | Spillover risk analysis across district neighbours |
| `get_intervention_history` | Past intervention actions and outcomes |
| `get_model_performance_metrics` | Current model MAE, R², feature importance |
| `get_demographic_hotspots` | Population-density-adjusted risk hotspots |

---

## 6. Public Chatbot — EpiBot

**Directory:** `chatbot/`

A public-facing dengue Q&A service migrated from ChromaDB to a production Qdrant deployment.

| Component | Detail |
|---|---|
| **Vector DB** | Qdrant — HNSW index, payload filtering, built-in web UI |
| **Retrieval** | Dense (text-embedding-004) + sparse (BM25 fastembed) with RRF fusion |
| **Knowledge Base** | 6 PDFs: Epidemiology Unit reports, WHO guidelines, prevention tips |
| **LLM** | Gemini 2.5 Flash |
| **Session** | `session_id` for conversation continuity |
| **Access** | No authentication required |

---

## 7. Backend API (NestJS)

**Directory:** `backend/`

### 7.1 Module Inventory

| Module | Key Responsibility |
|---|---|
| `auth` | JWT (httpOnly cookies), refresh tokens, RBAC |
| `users` | CRUD, role assignment, district allocation, workload endpoint |
| `analytics` | District predictions, trends, hotspots, explain proxy, DS-level |
| `tasks` | Full lifecycle CRUD, status transitions, evidence, chat, analytics |
| `evidence` | Evidence entity, approve/reject with mandatory reason |
| `reports` | Weekly PDF generation, S3 storage, Gemini narrative |
| `email` | BullMQ + Nodemailer + Zoho SMTP, Handlebars templates, audit log |
| `storage` | StorageService wrapping `@aws-sdk/client-s3` (S3 + R2) |
| `notifications` | In-app notifications, push notification stubs |
| `districts` | District boundaries, metadata |
| `gateway` | Socket.io events namespace — tasks, chat, analytics feed |

### 7.2 Real-Time Events

| Event | Trigger | Consumer |
|---|---|---|
| `task:created` | New task | Supervisor dashboard |
| `task:updated` | Any field change | Task detail page |
| `task:status-changed` | Status transition | PHI app + supervisor |
| `chat:message` | New chat message | Task chat panel |
| `chat:read` | Message read receipt | Unread badge |
| `task-analytics:update` | Task status change | Admin live feed |

### 7.3 Evidence Lifecycle

```
PHI selects photo (web/mobile)
    │
    ▼
POST /api/upload/evidence  (multipart/form-data, ≤10MB, JPEG/PNG/WebP)
    │
    ▼
StorageService → S3/R2 → returns permanent URL
    │
    ▼
POST /api/tasks/:id/evidence  (imageUrl, notes, latitude, longitude)
    │
    ▼
Supervisor reviews in Evidence Review Queue
    │
    ├─> Approve → evidence.status = APPROVED
    └─> Reject  → evidence.status = REJECTED, rejectionReason required
```

### 7.4 Task Lifecycle

```
PENDING → ASSIGNED → IN_PROGRESS → SUBMITTED → VERIFIED → COMPLETED
                                       │
                                  REJECTED (with mandatory rejectionReason)
                                       │
                                  Back to IN_PROGRESS (resubmit)
```

**Minimum evidence required before PHI can submit:**

| Task Type | Minimum Photos |
|---|---|
| Cleanup | 2 |
| Fogging | 1 |
| Inspection | 1 |
| Investigation | 2 |

---

## 8. Web Dashboard

**Directory:** `frontend/`

### 8.1 Admin Pages

| Route | Purpose |
|---|---|
| `/admin` | Quick-links landing page |
| `/admin/analytics` | Analytics dashboard (redesigned UX) |
| `/admin/analytics/historical` | Historical analytics standalone route |
| `/admin/tasks/analytics` | Task Analytics Dashboard (national overview) |
| `/admin/tasks/analytics/district/[id]` | District drill-down |
| `/admin/tasks/analytics/phi/[id]` | PHI performance profile |
| `/admin/users` | User management |
| `/admin/reports` | Weekly report list + generation |

### 8.2 Analytics Dashboard UX Redesign

Replaced a two-level nested tab system with a **single-level navigation rail**:

| Before | After |
|---|---|
| Outer tab → inner tab (2 clicks minimum) | Nav rail: 1 click to any panel |
| Floating chat bubble overlapping charts | Slide-in drawer (380px, right edge) |
| District context lost on tab switch | Persistent district context strip below metrics bar |
| Key metrics require scrolling to top | Sticky metrics bar always visible |
| Historical page dynamically imported | Embedded as horizontal tabs in Historical panel |

**Nav Rail Panels (7):** Risk Map · Trends · Alerts · Hotspots · AI Insights · Historical · National

### 8.3 Supervisor Pages

| Route | Purpose |
|---|---|
| `/supervisor/tasks` | Task list (filter, search, list/map toggle) |
| `/supervisor/tasks/new` | Create task form |
| `/supervisor/tasks/[id]` | Task detail: evidence review, verify, reject (with reason dialog), inline edit |
| `/supervisor/evidence` | Evidence Review Queue — batch approve/reject |
| `/supervisor/phis` | PHI list + workload dashboard |

### 8.4 PHI Pages

| Route | Purpose |
|---|---|
| `/phi/tasks` | Task list with status/type filters |
| `/phi/tasks/[id]` | Task detail with file-upload evidence submission |

### 8.5 Public Pages

| Route | Purpose |
|---|---|
| `/risk-map` | Enhanced public risk dashboard (5 phases) |
| `/` (landing) | EpiBot chat widget |

---

## 9. PHI Mobile Application

**Directory:** `mobile/`

### 9.1 Screen Inventory

| Screen | Key Features |
|---|---|
| `LoginScreen` | JWT auth, remember-me |
| `TaskListScreen` | Real-time task list, status/type filter, unread badges |
| `TaskDetailScreen` | Animated timeline, evidence list, start/submit/restart, minimum-evidence guard, "Add Evidence" CTA |
| `EvidenceUploadScreen` | Camera + gallery picker, GPS auto-tag, notes, multipart upload to S3/R2 |
| `TaskMapScreen` | Task location on map, directions |
| `RouteOptimizationScreen` | Optimized waypoint order from OR-Tools TSP, OSRM ETAs |
| `NotificationsScreen` | Bell feed, unread count badge |

### 9.2 Route Optimization

**Backend service:** Python microservice using Google OR-Tools TSP solver with OSRM real road distance matrix.

```
PHI taps "Optimize Route"
    │
    ▼
routeService.optimizeRoute(taskIds, phiLocation)
    │
    ▼
Backend: fetch task coordinates → OSRM distance matrix → OR-Tools TSP
    │
    ▼
Returns: ordered waypoints + per-leg ETAs + total distance
    │
    ▼
Mobile: renders optimized route on map
```

Route recalculates automatically when a task is completed or an urgent task is added.

### 9.3 Toast Notification System

`ToastContext` wraps the entire app. Four variants (success, error, warning, info) with 3–5 second auto-dismiss and swipe-to-dismiss. Replaces scattered `Alert.alert()` calls.

### 9.4 Performance Optimizations

- `React.memo` on all list and map subcomponents — eliminates re-render lag on large task lists
- Screen-scale utility replaces all hardcoded pixel values for consistent sizing across device sizes
- Responsive grids replace fixed `width: "48%"` breakpoints

---

## 10. Public Risk Dashboard

**Directory:** `frontend/app/risk-map/` and `frontend/components/public/`

Five enhancement phases delivering a non-technical, accessible public experience:

### Phase 1 — Plain Language

- All technical labels replaced with everyday Sri Lankan English
- `PublicSummaryBanner` generates a plain-English paragraph from live API data
- Risk badges use action-oriented phrasing ("High Risk — Stay alert")

### Phase 2 — Visual Simplification

| Component | Purpose |
|---|---|
| `TrendStoryChart` | Annotated area chart with calendar week labels and "Highest point" callout |
| `DistrictWatchList` | Plain-English ranked list replacing jargon hotspot panel |
| `PublicHealthWarnings` | Two states only: ⚠️ Watch / 🔴 Warning with "What to do" expandable |
| `DistrictRiskTable` | Searchable, traffic-light icons, no raw case numbers |
| `PreventionChecklist` | Static tips adapting urgency to national risk level |
| `DistrictSearchBar` | "Find your district" with map zoom and summary panel |

### Phase 3 — Guided Onboarding

- `OnboardingBanner` — 3-step guide shown once per session via `sessionStorage`
- Tab labels redesigned: "Where is dengue now?" / "Is it getting better or worse?" / "How can I protect myself?"
- `InfoTooltip` on remaining technical terms
- "Last Updated" freshness indicator

### Phase 4 — Actionable Health Guidance

- `ActionGuidance` — maps each risk level to concrete recommendations
- `NationalStatusBar` — 5-level national status (Calm → Critical) derived from ratio of high-risk districts
- Official health resource links (Epidemiology Unit hotline, MoH)

### Phase 5 — Mobile & Accessibility

- Tap-to-select replacing hover-only tooltips
- District panel stacks below map on mobile; legend collapsible
- Responsive single-scroll layout on screens < 768px
- WCAG AA contrast compliance; `aria-label` on interactive map elements; `role="status"` on summary banner

---

## 11. Task Analytics Dashboard

**Directory:** `frontend/app/(dashboard)/admin/tasks/analytics/`

Five-phase admin analytics system at `/admin/tasks/analytics`.

### Phase 1 — Backend (10 Endpoints)

All guarded by `@Roles(UserRole.ADMIN)`.

| Endpoint | Description |
|---|---|
| `GET /tasks/analytics/national-summary` | Country-level KPI snapshot |
| `GET /tasks/analytics/by-district` | Per-district task counts and completion rates |
| `GET /tasks/analytics/by-status` | Status distribution (national or per district) |
| `GET /tasks/analytics/by-type` | Type distribution |
| `GET /tasks/analytics/by-priority` | Priority distribution |
| `GET /tasks/analytics/trend` | Daily/weekly creation vs completion counts |
| `GET /tasks/analytics/supervisors` | Per-supervisor assignment and completion metrics |
| `GET /tasks/analytics/phis` | Per-PHI performance: assigned, completed, rejected, avg time |
| `GET /tasks/analytics/overdue` | Overdue tasks grouped by district/PHI with severity field |
| `GET /tasks/analytics/evidence-review` | Evidence submission and approval rates |

**Shared query params:** `districtId?`, `from?` (ISO date), `to?` (ISO date), `period?: day|week|month`

### Phase 2 — National Overview

KPI cards (5) · District completion bar chart · Status donut · Task type bar chart · Priority bar chart · Dual-line trend chart (created vs completed)

### Phase 3 — District Drill-Down

Breadcrumb navigation · District KPI cards · Supervisor performance table · PHI leaderboard (sortable) · District-scoped status trend chart

### Phase 4 — PHI Performance Profile

Profile header (name, district, active status) · KPI cards · Task status donut · Monthly trend bar (last 6 months) · Paginated task history (last 20, filterable) · Evidence approval rate RadialBarChart gauge

### Phase 5 — Real-Time Monitoring

- `LiveActivityFeed` — Socket.io subscription showing last 20 task status changes in real time
- `OverdueTasksAlert` — Collapsible panel grouped by district; severity: `warning` (<24h past due) / `critical` (>48h)

---

## 12. Email Notifications & Alerts

**Directory:** `backend/src/email/`

### Infrastructure

- **Transport:** Nodemailer + Zoho SMTP
- **Queue:** BullMQ + Redis (fire-and-forget; failures never propagate to callers)
- **Templates:** Handlebars HTML templates per notification type
- **Audit:** `EmailLog` entity records every sent/failed email for retry and reporting
- **Design:** Per-user opt-out per category; retries with exponential backoff

### Notification Matrix

| Category | Triggers |
|---|---|
| **User** | Account creation, password reset, welcome |
| **Task Lifecycle** | New assignment (to PHI), status change, overdue reminder, completion (to supervisor) |
| **Evidence** | Submission alert, approval/rejection with reason |
| **Reports** | Weekly report delivery |
| **Alerts** | High-risk district alert, national outbreak notification, weekly digest |
| **Admin** | Email log viewer, retry failed emails, preference management per user |

---

## 13. Database Schema

| Entity | Key Fields |
|---|---|
| `users` | id, email, role (ADMIN/SUPERVISOR/PHI/VIEWER), districtId, isActive |
| `districts` | id, name, boundaries (GeoJSON), population, area |
| `dengue_cases` | id, districtId, week, year, caseCount |
| `weather_data` | id, districtId, date, temperature, precipitation, humidity |
| `predictions` | id, districtId, week, year, predictedCases, riskLevel, confidenceInterval, shapValues |
| `tasks` | id, type, status, priority, districtId, assignedPhiId, createdBy, dueDate, rejectionReason, createdAt, assignedAt, completedAt |
| `evidence` | id, taskId, imageUrl, notes, latitude, longitude, status, submittedBy, verifiedBy, rejectionReason |
| `task_messages` | id, taskId, senderId, content, attachmentUrl, createdAt |
| `message_reads` | id, messageId, userId, readAt |
| `notifications` | id, userId, type, title, body, isRead, createdAt |
| `weekly_reports` | id, week, year, districtId, pdfUrl, narrativeSummary, generatedAt |
| `email_logs` | id, to, subject, type, status (SENT/FAILED), attempts, createdAt |
| `audit_logs` | id, userId, action, entity, entityId, metadata, createdAt |

---

## 14. API Reference

### Authentication

```
POST   /api/auth/login              User login → JWT cookies
GET    /api/auth/me                 Current user
POST   /api/auth/logout             Clear session
```

### Analytics

```
GET    /api/analytics/districts/latest          Latest data per district
GET    /api/analytics/predict/bulk              ML predictions all districts
GET    /api/analytics/summary                   Dashboard summary
GET    /api/analytics/trends                    Case trend over time
GET    /api/analytics/advanced/hotspots         Top hotspot districts
GET    /api/analytics/advanced/outbreak-alerts  Active outbreak alerts
GET    /api/analytics/explain                   SHAP-grounded district insight
GET    /api/analytics/explain/national-summary  Executive situation report
POST   /api/analytics/explain/chat              Agentic chat (12 tools)
GET    /api/analytics/ds-predictions/colombo    Colombo DS-level estimates
```

### Tasks

```
GET    /api/tasks                              List (role-scoped)
POST   /api/tasks                              Create
GET    /api/tasks/:id                          Detail
PATCH  /api/tasks/:id                          Update fields
PATCH  /api/tasks/:id/status                   Status transition
POST   /api/tasks/:id/evidence                 Submit evidence
GET    /api/tasks/evidence/pending             All pending evidence (supervisor district)
GET    /api/tasks/:id/messages                 Chat history
POST   /api/tasks/:id/messages                 Send chat message
GET    /api/tasks/analytics/national-summary   National task KPIs
GET    /api/tasks/analytics/by-district        Per-district stats
GET    /api/tasks/analytics/by-status          Status distribution
GET    /api/tasks/analytics/by-type            Type distribution
GET    /api/tasks/analytics/by-priority        Priority distribution
GET    /api/tasks/analytics/trend              Creation vs completion trend
GET    /api/tasks/analytics/supervisors        Supervisor metrics
GET    /api/tasks/analytics/phis               PHI performance metrics
GET    /api/tasks/analytics/overdue            Overdue with severity
GET    /api/tasks/analytics/evidence-review    Evidence approval rates
```

### Users

```
GET    /api/users                 List all (admin)
POST   /api/users                 Create
PATCH  /api/users/:id             Update
DELETE /api/users/:id             Delete
GET    /api/users/phis/workload   Per-PHI workload aggregates
```

### Upload & Reports

```
POST   /api/upload/evidence        Multipart image → S3/R2 URL
GET    /api/reports                List weekly reports
POST   /api/reports/generate       Generate for year/week
GET    /api/reports/:id            Detail + PDF signed URL
```

---

## 15. Implementation Roadmap & Status

### Phase 1: Core Platform ✅

Authentication, RBAC, admin dashboard, district risk map, analytics with trends/predictions/hotspots, weather correlation, dark mode, CI/CD.

### Phase 2: Task Management ✅

Task entity and CRUD, cloud evidence upload (S3/R2), supervisor workflows with rejection reason dialogs, real-time WebSocket updates, Evidence Review Queue, PHI Workload Dashboard, task-centric chat.

### Phase 3: PHI Mobile App & AI Features ✅

React Native/Expo setup, authentication, task list/detail, camera evidence (`expo-image-picker`), GPS capture, minimum evidence enforcement, toast system, mobile responsiveness, route optimization (OR-Tools + OSRM), weather-based scheduling, public risk dashboard (all 5 phases), EpiBot chatbot (Qdrant hybrid RAG), Explainable AI (SHAP + Qdrant + Gemini), DS-level Colombo predictions, analytics UX redesign, Task Analytics Dashboard (5 phases).

### Phase 4: Reporting & Alerts ✅

Weekly PDF generation with Gemini narrative, email notifications (Zoho SMTP + BullMQ), custom report builder, alert threshold configuration, chatbot UI on public landing page.

### Phase 5: Advanced Enhancements (Partial)

| Item | Status |
|---|---|
| SHAP explainability in explain-analytics | ✅ |
| Qdrant production RAG (HNSW, hybrid BM25+dense, RRF, recency decay) | ✅ |
| Automated ETL pipeline (APScheduler weekly) | ✅ |
| Spatial cluster / geographic spillover detection | ✅ |
| Redis session persistence for agentic chat | ✅ |
| Response caching for insight stability | ⏳ |
| Lightweight follow-up endpoint (cache-backed) | ⏳ |
| Multi-language output (Sinhala / Tamil) | ⏳ |
| Prometheus metrics + structured logging | ⏳ |
| Multi-PHI VRP routing (multi-vehicle TSP) | ⏳ |

---

## 16. Non-Functional Requirements

| Requirement | Target | Notes |
|---|---|---|
| Dashboard Load Time | ≤ 3 seconds | National overview page |
| Concurrent Users | 500+ | Socket.io + Redis adapter |
| ML Service Availability | ≥ 99% uptime | Weekly cron critical path |
| Mobile Offline Support | 7-day data retention | SQLite local cache |
| Evidence Upload | Max 10 MB per image | JPEG/PNG/WebP validated server-side |
| API Response Time | ≤ 500ms (p95) | Excludes ML inference |
| Data Retention | 5 years historical | PostgreSQL with index tuning |
| ML Model CI Coverage | 79–80% | Achieved: 79% |
| XAI Retrieval Latency | < 2 seconds | Qdrant HNSW + GPU embedding |

---

## 17. Testing Strategy & CI

**Stack:** NestJS 11 · TypeORM · PostgreSQL · BullMQ · Redis · Jest 29 · GitHub Actions

### 17.1 Test Suite Summary

| Layer | Count | Runner |
|---|---|---|
| Unit tests | 244 | `npm run test:cov` |
| Integration tests | 33 | `npm run test:integration` |
| **Total** | **277** | — |

All tests run automatically on every push to `main` via GitHub Actions.

### 17.2 Coverage Thresholds

Enforced by Jest `coverageThreshold` — CI fails if any metric drops below these values:

| Metric | Threshold |
|---|---|
| Statements | ≥ 35% |
| Branches | ≥ 24% |
| Functions | ≥ 28% |
| Lines | ≥ 35% |

Thresholds are set just below measured coverage to act as a regression guard without blocking progress. They are raised incrementally as the suite grows.

### 17.3 Test Infrastructure

**Shared factories** (`backend/src/test/factories/`) generate type-safe fixture objects via `@faker-js/faker`:

| Factory | Entities covered |
|---|---|
| `user.factory.ts` | `User` — all roles and field variants |
| `task.factory.ts` | `Task` — all statuses, types, and priority levels |
| `district.factory.ts` | `District` — boundaries, population, area |

**Shared mocks** (`backend/src/test/mocks/`) provide drop-in replacements for external services:

| Mock | Replaces |
|---|---|
| `typeorm.mock.ts` | TypeORM repository + query builder (typed with `ObjectLiteral` constraint) |
| `redis.mock.ts` | Redis client |
| `bullmq.mock.ts` | BullMQ queue and worker |
| `config.mock.ts` | NestJS `ConfigService` |

### 17.4 Unit Tests (Phases 1–3)

Isolated service and controller tests using Jest mocks — no real I/O.

#### Services

| File | Tests | Coverage |
|---|---|---|
| `tasks/tasks.service.spec.ts` | 27 | create, findAll cache + filters, findOne, update, status transitions, assignTask, remove, getStats, addEvidence, getPhisByDistrict |
| `tasks/task-messages.service.spec.ts` | 19 | sendMessage, sendSystemMessage, getMessages, markRead UUID validation, getUnreadCount, toggleReaction, broadcastToDistrict |
| `email/email.service.spec.ts` | 10 | single/array recipients, opt-out check, sendToRole, error resilience |
| `reports/reports.service.spec.ts` | 14 | listReports filters, getReport, generateReport, approveReport, getDownloadUrl, deleteReport |

#### Controllers

| File | Tests | Coverage |
|---|---|---|
| `auth/auth.controller.spec.ts` | 5 | login cookie+token, UnauthorizedException propagation, getCurrentUser, logout |
| `users/users.controller.spec.ts` | 14 | create, createPhi, findAll, getStats, findOne, update, toggleStatus, remove, notification-preferences (self / other / admin) |
| `tasks/tasks.controller.spec.ts` | 15 | create, findAll filter parsing, getStats, getPhisByDistrict, findOne, update, updateStatus force-flag role check, assignTask, remove, addEvidence, getEvidence |

#### Guards & Gateway

| File | Tests | Coverage |
|---|---|---|
| `auth/guards/jwt-auth.guard.spec.ts` | 4 | defined, delegates to parent, propagates UnauthorizedException |
| `auth/guards/roles.guard.spec.ts` | 5 | no metadata → allow, matching role → allow, missing role → deny, handler+class metadata |
| `tasks/guards/task-participant.guard.spec.ts` | 7 | no taskId, admin bypass, creator access, assignedPHI access, non-participant ForbiddenException, missing task NotFoundException |
| `events/events.gateway.spec.ts` | 39 | task emit helpers, chat emit helpers, handleChatJoin/Leave/Typing |

### 17.5 Integration Tests (Phase 4)

Tests module wiring with real TypeORM queries against a Docker PostgreSQL 16 database. No HTTP layer — direct service method calls. Configured via `jest.integration.json` with a 60-second timeout and `--runInBand` to prevent concurrent schema drops.

| File | Tests | Coverage |
|---|---|---|
| `auth/auth.integration.spec.ts` | 6 | login (valid, wrong password, not found, deactivated), getCurrentUser (found, not found) |
| `users/users.integration.spec.ts` | 8 | create + password hash, duplicate email, findAll, findOne, not found, update, remove, notification prefs upsert |
| `tasks/tasks.integration.spec.ts` | 8 | create + event emit, findAll, status/district filters, findOne + relations, not found, updateStatus valid/invalid, remove + event |
| `analytics/analytics.integration.spec.ts` | 4 | getLatestWeekPerDistrict (empty, seeded), getTimeSeries (unknown district, seeded) |
| `reports/reports.integration.spec.ts` | 5 | listReports (empty, ordered, status filter), getReport (not found, found) |

**Design notes:**
- `dropSchema: true` in each suite's `beforeAll` resets the schema once per suite
- `TRUNCATE ... RESTART IDENTITY CASCADE` in `beforeEach` isolates individual tests
- External services (S3, BullMQ, email, ML API) are mocked; only TypeORM/PostgreSQL is real
- All 33 integration tests skip gracefully when `TEST_DATABASE_URL` is not set

**Running integration tests locally:**
```bash
docker run -d --name epilink-test-db \
  -e POSTGRES_USER=test -e POSTGRES_PASSWORD=test -e POSTGRES_DB=epilink_test \
  -p 5432:5432 postgres:16

TEST_DATABASE_URL=postgres://test:test@localhost:5432/epilink_test npm run test:integration
```

### 17.6 CI/CD — GitHub Actions

Workflow file: `.github/workflows/ci.yml` · Trigger: `push` to `main`

```
push to main
     │
     ├── backend-unit ──────┐
     │                      ├──► backend-build
     └── backend-integration┘

     └── frontend (independent)
```

| Job | What it does |
|---|---|
| `backend-unit` | Runs `test:cov --ci --forceExit`; uploads coverage report as artifact; enforces coverage thresholds |
| `backend-integration` | Spins up a `postgres:16` service container, sets `TEST_DATABASE_URL`, runs `test:integration --forceExit` |
| `backend-build` | Gated on both unit and integration passing; confirms the TypeScript build is clean |
| `frontend` | Runs independently — type-check and build |

**Required GitHub Actions secret:**

| Secret | Purpose |
|---|---|
| `JWT_SECRET` | Test-only value — no production secrets are needed; all external services are mocked |

---

*Last updated: April 2026*
*Model version: 2.0.0*
*Platform version: 4.0 (Phases 1–4 complete)*
