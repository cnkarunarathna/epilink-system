# EpiLink - Dengue Risk Monitoring & Cleanup Management System

## Overview

EpiLink is a comprehensive, full-stack, role-based platform designed for Sri Lankan health authorities to predict short-term dengue risk, coordinate cleanup operations, and monitor field-level progress. The system automates epidemiological data ingestion, generates explainable ML-driven risk levels, and supports operational workflows for Public Health Inspectors (PHIs) and supervisors.

**Target Users:** Epidemiology Unit, Ministry of Health Sri Lanka, District Health Officers, PHIs

---

## Core Objectives

- Automate ingestion and processing of weekly dengue case PDFs and live weather data
- Predict next-week dengue risk (Low / Medium / High) for each district/MOH area
- Provide interactive dashboards for national, district, and field-level decision-making
- Enable task assignment, field reporting, and evidence tracking for cleanup and fogging operations
- Deliver weekly reports and alerts to support rapid response in high-risk regions
- Provide mobile access for field officers (PHIs) to manage tasks on the go
- Offer AI-powered chatbot for public dengue-related inquiries
- Optimize field visit routes for PHIs to improve operational efficiency
- Deliver explainable AI insights grounded in MoH documents for health decision-makers

---

## Technology Stack

| Layer                 | Technology                                                                   |
| --------------------- | ---------------------------------------------------------------------------- |
| **Frontend (Web)**    | Next.js 16, React 19, TypeScript, Tailwind CSS, Shadcn UI, Recharts, Leaflet |
| **Frontend (Mobile)** | React Native / Expo (for PHI mobile app)                                     |
| **Backend API**       | NestJS, TypeORM, PostgreSQL, JWT Authentication, Socket.io, BullMQ           |
| **ML Service**        | Python, FastAPI, XGBoost/Prophet, SHAP for explainability                    |
| **Explain-Analytics** | Python, FastAPI, Agno, Gemini 2.0 Flash, Qdrant, APScheduler                |
| **Public Chatbot**    | Python, FastAPI, Gemini 2.5 Flash, Qdrant (hybrid BM25 + dense retrieval)   |
| **Database**          | PostgreSQL 16                                                                |
| **Caching**           | Redis (BullMQ email queue, Socket.io adapter, session persistence)           |
| **Storage**           | AWS S3 (evidence uploads, PDF reports)                       |
| **CI/CD**             | GitHub Actions, Husky for local pre-commit/pre-push hooks                    |
| **Deployment**        | Docker, Vercel (frontend), Railway/Render (backend)                          |

---

## User Roles & Permissions

### Admin

- Full system access and configuration
- Manage districts/MOH boundaries and system settings
- Create and manage users with role-based access
- View national analytics, task analytics, and approve weekly reports
- Generate and export comprehensive reports
- Manage alert thresholds and notification settings
- Access explainable AI analytics and national situation reports

### Supervisor (District-Level)

- Access district-specific dashboards and risk summaries
- Create, assign, and monitor tasks for PHIs
- Verify evidence submissions and close tasks via evidence review queue
- Export district-level reports
- Receive email alerts for high-risk areas and task lifecycle events
- View PHI performance metrics and workload distribution
- Task-centric messaging with assigned PHIs

### PHI (Public Health Inspector / Field Officer)

- View assigned tasks via web and **mobile application**
- Update task status with progress notes
- Upload geo-tagged evidence (photos, notes, GPS coordinates)
- View local area risk information
- Receive push notifications and email alerts for new assignments
- **Route optimization** for efficient task completion
- Task-centric messaging with supervisors

### Viewer (Read-Only)

- Access to non-sensitive public dashboards
- View national and district-level statistics
- No access to task management or user data

### Public Users (Unauthenticated)

- Access AI chatbot (EpiBot) for dengue-related questions
- View public risk information with plain-language explanations and prevention tips
- **View interactive public risk forecast map** with national status indicator
- **Check district-level risk status** with actionable health guidance
- Access onboarding guide and district lookup

---

## System Modules & Features

### 1. Data Ingestion & Processing Pipeline

- **Historical Case Data:** Dengue case data from the Epidemiology Unit (available up to March, 2025)
- **Weather Data Integration:** Real-time weather data from Open-Meteo API
- **Data Validation:** Cleaning, validation, and deduplication
- **Merge Engine:** Correlate dengue cases with weather patterns (temperature, precipitation, humidity)
- **Centralized Storage:** PostgreSQL with comprehensive logging

> **Note:** Due to data availability constraints from the Epidemiology Unit, automatic PDF ingestion is supplemented by an iterative prediction approach for periods beyond the available data.

### 2. ML Risk Prediction Service

- **Model:** XGBoost ensemble model for next-week case prediction
- **Features:** Lagged case counts (1-4 weeks), weather variables, seasonal patterns
- **Risk Classification:** Low (< 25 cases), Medium (25-50), High (50-100), Critical (100+)
- **Explainability:** SHAP values showing feature contributions forwarded to the explain-analytics service
- **Scheduled Predictions:** GitHub Actions cron job runs every Monday (00:00 UTC)
- **Iterative Forecasting:** When real case data is unavailable, uses previous predictions as lagged features
- **DS-Level Predictions:** Spatial disaggregation for Colombo district produces case estimates for all 13 Divisional Secretariat (DS) divisions using population, density, and historical burden weights
- **Data Storage:** Predictions stored directly in PostgreSQL

### 3. Web Dashboard (Admin & Supervisor)

#### 3.1 National Overview

- Interactive Sri Lanka map with district-level risk heatmap
- Real-time case statistics and week-over-week trends
- Key metrics: Total cases, high-risk districts, weather conditions
- Alert notifications for outbreak conditions

#### 3.2 Analytics & Insights — Redesigned UX

- **Single-Level Navigation Rail:** Replaced two-level nested tabs with a fixed left nav rail — every analytical panel is one click away (Risk Map, Trends, Alerts, Hotspots, AI Insights, Historical, National)
- **Sticky Metrics Bar:** Total cases, high-risk districts, coverage, and temperature always visible
- **Persistent District Context Strip:** Selected district context persists across all panel switches; AI Insights, Historical, and Advanced panels auto-scope to it
- **Inline Chat Drawer:** Slide-in right drawer replaces floating chat bubble; opens pre-loaded with selected district context
- **Trend Analysis:** 12-week historical case trends
- **Weather Correlation:** Temperature/precipitation impact visualization
- **Hotspot Detection:** Identifying emerging outbreak areas
- **Growth Rate Analysis:** Districts with increasing/decreasing trends
- **Outbreak Alerts:** Automated alerts for abnormal case spikes
- **District Comparison:** Multi-district comparative analysis

#### 3.3 Historical Analytics

- Year-over-year comparison
- Seasonal pattern identification
- Peak season analysis
- District-wise yearly summaries

#### 3.4 Task Management (Supervisor View)

- Create cleanup/fogging/inspection tasks
- Assign tasks to specific PHIs with inline reassignment
- Track task progress and status with real-time WebSocket updates
- Task rejection with mandatory reason dialog
- Evidence review and verification with rejection reason capture
- Task completion analytics
- **Weather-based scheduling recommendations**

#### 3.5 Evidence Review Queue (Supervisor)

- Centralized dashboard showing all pending evidence across tasks
- Image thumbnails with GPS and timestamp verification
- Per-item approve/reject actions with predefined rejection templates
- Batch approval/rejection for multiple evidence submissions

#### 3.6 PHI Workload Dashboard (Supervisor)

- Per-PHI task counts by status as colored progress bars
- Average completion time and rejection rate badges
- Sort by overdue count or workload to identify overloaded PHIs
- One-click "Assign Task" pre-filled with selected PHI

#### 3.7 Task Analytics Dashboard (Admin)

Full multi-level analytics at `/admin/tasks/analytics`:

- **National Overview:** 5 KPI cards (total tasks, completion rate, overdue, avg completion time, active PHIs), district completion bar chart, status donut chart, task type/priority distribution, dual-line trend chart
- **District Drill-Down:** Click any district to see supervisor table, PHI leaderboard, district KPIs, and status trend scoped to that district
- **PHI Performance Profile:** Deep-dive per-PHI — profile header, KPI cards, task status donut, monthly trend chart, paginated task history with filters, evidence approval rate gauge
- **Real-time Monitoring:** Live activity feed via Socket.io showing last 20 task status changes; overdue alerts panel with warning/critical severity badges grouped by district
- **10 API Endpoints:** `/tasks/analytics/national-summary`, `/by-district`, `/by-status`, `/by-type`, `/by-priority`, `/trend`, `/supervisors`, `/phis`, `/overdue`, `/evidence-review`

#### 3.8 User Management (Admin)

- Create, edit, delete users
- Role assignment and district allocation
- Account activation/deactivation
- User activity logs

#### 3.9 Reports Module

- Auto-generated weekly PDF reports with AI narrative summaries
- District-specific reports for supervisors
- Custom date range report generation
- Export to PDF/Excel formats
- Reports stored in S3 and accessible via signed URLs

### 4. Explainable AI (XAI) Analytics Service

A production-grade RAG-based analytics microservice (`explain-analytics`) that translates complex ML predictions into plain-language, actionable insights grounded in Ministry of Health documents.

#### Architecture

```
[PostgreSQL] ──┐
               ├──> [FastAPI ETL Layer (APScheduler)]
[Weather API] ─┘          │
                           ▼
              [Text + Insight Generation]
                           │
                    [Embedding Model]
             (Google text-embedding-004, 768-dim)
                           │
                      [Qdrant Vector DB]
              (HNSW index, BM25 + dense hybrid)
                           │
              [Hybrid Retriever + Recency Decay]
                           │
           [Gemini 2.0 Flash — Grounded Insights]
                           │
            [Admin Dashboard Insights / Chat]
```

#### Capabilities

- **SHAP-Grounded Key Drivers:** Insights cite actual model feature importances (rainfall, temperature, case trend), not heuristic rules
- **RAG Retrieval:** Hybrid BM25 + dense vector search (Qdrant) with RRF fusion and time-decay scoring — prioritises recent MoH guidelines
- **National Summary:** Single-request executive situation report covering all 26 districts; `URGENT:` prefix when risk score ≥ 0.85
- **Batch Explain:** Process all districts in one call for automated weekly situation reports
- **Agentic Chat:** 12-tool agent answers free-form analytical questions with live data fetching; Redis session persistence with 2-hour TTL and auto-compression at 10 turns
- **Persistent Chat History:** ChatGPT-style conversation history sidebar — PostgreSQL-backed session index (`analytic_chat_sessions`) with full message fallback (`analytic_chat_messages`) when Redis TTL expires; named sessions survive page reload indefinitely
- **Geographic Spillover Detection:** Flags `spillover_risk` when 3+ neighbouring districts rise simultaneously
- **Confidence Splitting:** Separate `data_completeness_score` and `prediction_confidence` fields based on ML uncertainty bounds
- **Automated ETL Pipeline:** APScheduler weekly job fetches all district data, generates dense + sparse embeddings, and upserts into Qdrant — corpus stays current with surveillance data automatically
- **New Agent Tools:** `get_national_briefing`, `get_seasonal_pattern`, `get_cross_district_spillover`, `get_intervention_history`, `get_model_performance_metrics`, `get_demographic_hotspots`

#### AI Chat History Feature

The admin agentic chat has been extended with a full ChatGPT-style conversation management system:

| Capability | Detail |
|---|---|
| **Named sessions** | Auto-titled from first message via Gemini (max 6 words) |
| **History sidebar** | Grouped by Today / Yesterday / This Week / Older; collapsible |
| **Persistent storage** | Session metadata in Postgres; messages stored as Postgres fallback when Redis expires |
| **Resume** | Click any past session to reload its full message history |
| **Rename / Delete** | Inline rename with Enter/Escape; hard-delete removes from both Redis and Postgres |
| **Export** | Download any conversation as JSON or Markdown |
| **Search** | Live search across conversation titles |
| **District sync** | Resuming a session auto-restores the parent page's district context |

### 5. AI Chatbot — EpiBot (Public Access)

A production-grade RAG-based chatbot for public dengue inquiries, rebuilt on Qdrant with hybrid retrieval.

- **Vector Database:** Qdrant (migrated from ChromaDB) — HNSW index, payload filtering, native snapshots, built-in web UI dashboard
- **Hybrid Retrieval:** Dense (`text-embedding-004`) + sparse (BM25 via fastembed) vectors with RRF fusion — combines semantic and keyword precision for medical terminology
- **Knowledge Sources:** 6 dengue PDFs (Epidemiology Unit reports, WHO guidelines, prevention tips) with rich metadata
- **LLM:** Gemini 2.5 Flash for natural language responses
- **Session Tracking:** `session_id` for conversation continuity
- **No Authentication Required:** Accessible to all public users
- **Supported Queries:** Dengue symptoms, current risk by district, treatment guidelines, prevention tips

### 6. Public Risk Dashboard — Enhanced

A fully redesigned public-facing risk experience at `/risk-map` optimised for non-technical Sri Lankan users.

#### Phase 1 — Plain Language & Messaging
- All technical labels replaced with everyday language (e.g. "Expected dengue cases this week" vs "Predicted Cases")
- Contextual subtitles on all metric cards explaining what each number means
- Risk level badges with action-oriented phrasing ("High Risk — Stay alert")
- Dynamic `PublicSummaryBanner` generating a plain-English paragraph from live API data

#### Phase 2 — Visual Simplification
- `TrendStoryChart` — annotated area chart with calendar week labels and "Highest point this period" callouts
- `DistrictWatchList` — plain-English ranked list replacing jargon-heavy hotspot/growth panels
- `PublicHealthWarnings` — simplified to two states: ⚠️ Watch / 🔴 Warning with "What to do" expandable sections
- `DistrictRiskTable` — searchable list with traffic-light risk icons replacing raw case numbers
- `PreventionChecklist` — static dengue prevention tips adapting urgency to national risk level
- `DistrictSearchBar` — "Find your district" quick-lookup with map zoom and summary panel
- Simplified map legend removing case-number thresholds; `publicMode` prop on map component

#### Phase 3 — Guided Onboarding
- `OnboardingBanner` — three-step how-to guide shown once per session via `sessionStorage`
- Redesigned tab labels: "Where is dengue now?" / "Is it getting better or worse?" / "How can I protect myself?"
- `InfoTooltip` components with plain-language explanations on any remaining technical terms
- "Last Updated" indicator showing data freshness with update cadence

#### Phase 4 — Actionable Health Guidance
- `ActionGuidance` component mapping each risk level to specific, concrete recommendations
- `NationalStatusBar` — prominent 5-level national dengue status indicator (Calm → Critical) derived from ratio of high-risk districts
- Official health resource links (Epidemiology Unit hotline, Ministry of Health)

#### Phase 5 — Mobile & Accessibility
- Tap-to-select map behaviour replacing hover-only tooltips
- Mobile layout: district details panel stacks below map; legend collapsible
- Responsive single-scroll layout on screens < 768px (tabs removed on mobile)
- WCAG AA contrast compliance on all text elements
- `aria-label` on all interactive map elements; `role="status"` on summary banner

### 7. PHI Mobile Application (React Native / Expo)

#### Authentication
- Secure login with JWT tokens
- Remember me functionality

#### Task Management
- View assigned tasks list with real-time updates
- Task details with location and instructions
- Accept/Start/Complete task workflow
- Priority-based task sorting

#### Evidence Collection
- Camera integration and gallery picker via `expo-image-picker`
- Automatic GPS tagging via `expo-location`
- Multipart file upload to S3/R2 via backend storage service
- Add notes and observations
- Minimum evidence enforcement per task type (Cleanup: 2, Fogging: 1, Inspection: 1, Investigation: 2)

#### Local Risk Information
- View risk level for assigned area
- Simple case trend visualization
- Weather alerts for field work planning

#### Notifications
- Push notifications for new task assignments
- Email alerts for task lifecycle events
- In-app toast/snackbar system (success, error, warning, info variants with auto-dismiss)

#### Route Optimization
- **Optimize Route Button:** One-tap optimization of daily task sequence
- **OR-Tools TSP Solver:** Google OR-Tools solves Traveling Salesman Problem for shortest route
- **OSRM Distance Matrix:** Real road distances from OpenStreetMap for accurate ETAs
- **Map Visualization:** Optimized route on map with ordered waypoints
- **Time Estimates:** Estimated travel time and total distance
- **Route Recalculation:** Triggered on task completion or urgent task addition

#### Weather-Based Task Scheduling
- 24-hour forecast display for task locations
- Fogging window alerts (no rain, low wind conditions)
- Weather warnings for unfavorable outdoor conditions
- Auto-reschedule suggestions based on forecast

#### UI/UX Responsiveness
- `ToastContext` and `Toast` component for non-blocking feedback across all actions
- `React.memo` on all list/map subcomponents eliminating render lag
- Screen-scale utility replacing all hardcoded pixel values
- Responsive grids replacing fixed `width: "48%"` breakpoints
- Bell icon connected to notification feed

### 8. Task-Centric Chat Module

Real-time messaging scoped to individual operational tasks enabling supervisors and PHIs to communicate without leaving the platform.

- **Persistence:** `task_messages` PostgreSQL table with `message_reads` join table for unread counts
- **Real-time:** Extends existing Socket.io `/events` namespace with `chat:*` events
- **Access Control:** Only task creator (supervisor), assigned PHI, and admin can read/write
- **File Attachments:** Reuses existing `/upload/evidence` S3 pipeline
- **Unread Counts:** Redis cache per `{userId, taskId}` with badge display
- **UI:** Slide-over panel inside each task detail page/modal

### 9. Email Notifications & Alerts

Full email notification system via Zoho SMTP with BullMQ queue processing.

- **Infrastructure:** Nodemailer + Zoho SMTP, BullMQ + Redis queue, Handlebars HTML templates, `EmailLog` entity for audit and retry
- **User Notifications:** Account creation, password reset, welcome email
- **Task Lifecycle:** Assignment notification to PHI, status change alerts, overdue reminders, completion confirmation to supervisor
- **Evidence & Reports:** Evidence submission alerts, approval/rejection notifications, weekly report delivery
- **Alert & Digest:** High-risk district alerts, national outbreak notifications, weekly digest emails
- **Admin Panel:** Email log viewer, retry failed emails, notification preference management per user
- **Design:** Fire-and-forget — failures never propagate to callers; per-user opt-out per category

### 10. Evidence Management (Cloud Storage)

- **Backend StorageService:** Wraps `@aws-sdk/client-s3` supporting both AWS S3 and Cloudflare R2
- `POST /api/upload/evidence` — accepts `multipart/form-data`, validates MIME type (JPEG/PNG/WebP) and file size (≤ 10 MB), returns permanent URL
- **Web PHI:** Drag-and-drop / click-to-browse file picker with local preview thumbnail and upload progress
- **Mobile PHI:** Camera capture + gallery selection, GPS auto-population, multipart upload to storage service

### 11. Weekly Reports

- Auto-generated weekly PDF reports with AI narrative from Gemini
- District-specific reports for supervisor distribution
- Custom date range generation
- Reports stored in S3/R2 with signed URL access
- Bug fixes: alert `message` / `recommendation` fields now correctly populated; hotspot and summary data anchored to report week

### 12. Task & Evidence Lifecycle

```
Created → Assigned → In Progress → Submitted → Verified → Completed
                                       ↓
                                   Rejected → Reassigned
```

**Task Types:** Cleanup, Fogging, Inspection, Investigation

**Evidence Requirements:**
- Minimum photo count per task type
- GPS location verification
- Timestamp validation
- Supervisor verification workflow with mandatory rejection reason

### 13. Alerts & Notification System

- **Email Alerts:** Weekly summaries, high-risk notifications via Zoho SMTP
- **Push Notifications:** Mobile alerts for PHIs
- **In-App Alerts:** Dashboard notification center + mobile toast system
- **Threshold-Based Triggers:** Case count thresholds, week-over-week increase > 25%, new hotspot detected, task overdue warnings

### 14. Authentication & Security

- JWT-based authentication with refresh tokens (httpOnly cookies)
- Role-based access control (RBAC)
- Password hashing with bcrypt
- Session management and logout
- Activity audit logs
- HTTPS enforcement
- API rate limiting
- Microservice-to-microservice authentication using forwarded JWT (no shared service keys)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CLIENTS                                         │
├─────────────────┬─────────────────────────┬─────────────────────────────────┤
│   Web Dashboard │    PHI Mobile App       │    GitHub Actions               │
│   (Next.js)     │    (React Native/Expo)  │    (Weekly Cron)                │
└────────┬────────┴───────────┬─────────────┴──────────────┬──────────────────┘
         │                    │                            │
         ▼                    ▼                            ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         API GATEWAY / BACKEND                                │
│                           (NestJS + TypeORM)                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│  Auth Module  │  Users Module  │  Analytics Module  │  Tasks Module         │
│  Reports      │  Notifications │  Evidence Upload   │  Districts            │
│  Email (Bull) │  Chat Module   │  Storage (S3)   │  Task Analytics       │
└────────┬──────┴────────────────┴─────────┬──────────┴───────────────────────┘
         │                                 │
         ▼                                 ▼
┌─────────────────────────────────┐  ┌───────────────────┐
│ PostgreSQL Database             │  │ Object Storage    │
│ - Users, Districts              │  │ (S3)           │
│ - Dengue Cases, Weather Data    │  │ Evidence files    │
│ - Predictions (updated weekly)  │  │ PDF reports       │
│ - Tasks, Evidence, Messages     │  └───────────────────┘
│ - Email Logs, Notifications     │
└────────────────┬────────────────┘
                 │
     ┌───────────┴───────────┐
     ▼                       ▼
┌──────────────────┐  ┌──────────────────────────────────────┐
│ ML Prediction    │  │ Explain-Analytics Service             │
│ (Python FastAPI  │  │ (Python FastAPI + Agno + Gemini)      │
│  + XGBoost)      │  │ - RAG: Qdrant hybrid retrieval        │
│ - Weekly cron    │  │ - Agentic chat (12 tools)             │
│ - DS-level       │  │ - APScheduler ETL pipeline            │
│   disaggregation │  │ - National situation reports          │
└──────────────────┘  └──────────────────────────────────────┘
                       ┌──────────────────────────────────────┐
                       │ Public Chatbot (EpiBot)               │
                       │ (Python FastAPI + Gemini 2.5 Flash)   │
                       │ - Qdrant hybrid retrieval             │
                       │ - 6-PDF knowledge base                │
                       └──────────────────────────────────────┘
```

---

## Database Schema (Core Entities)

| Entity              | Description                                         |
| ------------------- | --------------------------------------------------- |
| `users`                     | System users with roles and district assignments                         |
| `districts`                 | Sri Lankan district boundaries and metadata                             |
| `dengue_cases`              | Weekly case counts per district                                         |
| `weather_data`              | Weather observations (temperature, precipitation)                       |
| `predictions`               | ML-generated risk predictions                                           |
| `tasks`                     | Cleanup/fogging assignments                                             |
| `evidence`                  | Photos and notes from field visits                                      |
| `task_messages`             | Task-scoped chat messages between PHI and supervisor                    |
| `message_reads`             | Read receipt tracking per user per task                                 |
| `notifications`             | System alerts and notifications                                         |
| `weekly_reports`            | Generated report records with S3 PDF links                              |
| `email_logs`                | Sent/failed email audit records                                         |
| `audit_logs`                | User activity tracking                                                  |
| `analytic_chat_sessions`    | AI chat session index — title, district, turn count, archive flag       |
| `analytic_chat_messages`    | Full message log per session — role, content, tool calls (JSONB)        |

---

## API Endpoints Summary

### Authentication

- `POST /api/auth/login` — User login
- `GET /api/auth/me` — Current user info
- `POST /api/auth/logout` — Session logout

### Analytics

- `GET /api/analytics/districts/latest` — Latest data per district
- `GET /api/analytics/predict/bulk` — ML predictions
- `GET /api/analytics/summary` — Dashboard summary
- `GET /api/analytics/trends` — Case trends
- `GET /api/analytics/advanced/hotspots` — Hotspot detection
- `GET /api/analytics/advanced/outbreak-alerts` — Outbreak alerts
- `GET /api/analytics/explain/:district` — SHAP-grounded explainable insight for a district
- `GET /api/analytics/national-summary` — National executive situation report
- `POST /api/analytics/explain/:district/chat` — Agentic chat with 12 analytical tools
- `GET /api/analytics/colombo/ds-breakdown` — Colombo DS-level case estimates

**AI Chat History (Admin only)**

- `GET /api/analytics/chat/sessions` — List admin's named sessions (supports `page`, `limit`, `district`, `search`)
- `GET /api/analytics/chat/:sessionId/history` — Retrieve full message history (Redis-first, Postgres fallback)
- `GET /api/analytics/chat/:sessionId/export` — Download conversation transcript (`format=json` or `format=markdown`)
- `PATCH /api/analytics/chat/:sessionId/title` — Rename a session
- `PATCH /api/analytics/chat/:sessionId/archive` — Soft-archive a session
- `DELETE /api/analytics/chat/:sessionId` — Hard-delete session from Redis and Postgres

### Tasks

- `GET /api/tasks` — List tasks (role-scoped)
- `POST /api/tasks` — Create task
- `PATCH /api/tasks/:id/status` — Update status
- `POST /api/tasks/:id/evidence` — Submit evidence
- `GET /api/tasks/evidence/pending` — All pending evidence for supervisor's district
- `GET /api/tasks/analytics/national-summary` — National task KPIs (admin)
- `GET /api/tasks/analytics/by-district` — Per-district task stats
- `GET /api/tasks/analytics/phis` — Per-PHI performance metrics
- `GET /api/tasks/analytics/overdue` — Overdue tasks with severity
- `GET /api/tasks/analytics/trend` — Daily/weekly creation vs completion trend
- `GET /api/tasks/:id/messages` — Task chat messages
- `POST /api/tasks/:id/messages` — Send chat message

### Users (Admin)

- `GET /api/users` — List all users
- `POST /api/users` — Create user
- `PATCH /api/users/:id` — Update user
- `DELETE /api/users/:id` — Delete user
- `GET /api/users/phis/workload` — Per-PHI workload aggregates for supervisor

### Upload

- `POST /api/upload/evidence` — Upload image to S3/R2, returns URL

### Reports

- `GET /api/reports` — List weekly reports
- `POST /api/reports/generate` — Generate report for a given year/week
- `GET /api/reports/:id` — Report detail and PDF download link

### DS-Level Predictions (Colombo)

- `GET /api/analytics/ds-predictions/colombo` — Per-DS-division case estimates for Colombo

---

## Implementation Roadmap

### Phase 1: Core Platform ✅ Complete

- [x] User authentication and RBAC
- [x] Admin dashboard with user management
- [x] District risk visualization with interactive map
- [x] Analytics dashboard with trends and predictions
- [x] Weather correlation analysis
- [x] Hotspot and outbreak detection
- [x] Dark mode support
- [x] CI/CD pipeline with GitHub Actions

### Phase 2: Task Management ✅ Complete

- [x] Task entity and CRUD operations
- [x] Evidence upload with cloud storage (S3/R2)
- [x] Supervisor task assignment workflow with rejection reason dialogs
- [x] Task verification and approval
- [x] Real-time WebSocket updates for task status changes
- [x] Evidence Review Queue page for supervisors
- [x] PHI Workload Dashboard
- [x] Task-centric chat module (supervisor ↔ PHI messaging)

### Phase 3: PHI Mobile App & AI Features ✅ Complete

- [x] React Native project setup with Expo
- [x] Authentication flow
- [x] Task list and details view
- [x] Camera integration for evidence (`expo-image-picker`)
- [x] GPS location capture (`expo-location`)
- [x] Real file upload to cloud storage
- [x] Minimum evidence enforcement per task type
- [x] In-app toast notification system
- [x] Mobile responsiveness (screen-scale, responsive grids, `React.memo`)
- [x] **Route optimization** (OR-Tools TSP + OSRM distance matrix)
- [x] **Weather-based task scheduling** (Open-Meteo forecast integration)
- [x] **Public risk forecast map** (unauthenticated access, all 5 enhancement phases)
- [x] **District lookup and actionable health guidance** for public users
- [x] **EpiBot public chatbot** (Qdrant hybrid RAG, Gemini 2.5 Flash)
- [x] **Explainable AI analytics** (SHAP, Qdrant RAG, Gemini 2.0 Flash, agentic chat)
- [x] **DS-level dengue predictions** for Colombo district (13 DS divisions)
- [x] **Analytics Dashboard UX redesign** (nav rail, sticky bar, district context strip)
- [x] **Task Analytics Dashboard** (national, district drill-down, PHI profile, real-time feed)

### Phase 4: Reporting & Alerts ✅ Complete

- [x] Weekly PDF report generation with AI narrative
- [x] Email notification system (Zoho SMTP, BullMQ, Handlebars templates)
- [x] Custom report builder (date range, district selection)
- [x] Alert threshold configuration
- [x] Chatbot UI integration on public landing page

### Phase 5: Enhancements ✅ Complete

- [x] SHAP explainability integrated into explain-analytics service
- [x] Qdrant production RAG pipeline (HNSW, hybrid BM25 + dense, RRF fusion, recency decay)
- [x] Automated ETL pipeline (APScheduler weekly corpus updates)
- [x] Spatial cluster / geographic spillover detection
- [x] Redis session persistence for agentic chat
- [x] **Persistent AI chat history** — PostgreSQL-backed session index (`analytic_chat_sessions`) and full message store (`analytic_chat_messages`)
- [x] **ChatGPT-style history sidebar** — grouped sessions, inline rename/delete, collapsible panel
- [x] **Auto-title generation** — Gemini names each conversation from the first user message
- [x] **Redis → Postgres message fallback** — sessions resume even after Redis TTL expiry
- [x] **Conversation export** — download any chat as JSON or Markdown
- [x] **Conversation search** — live filter across session titles in the sidebar
- [ ] Response caching for insight stability
- [ ] Lightweight follow-up question endpoint (cache-backed)

---

## Out of Scope

- Long-term epidemic forecasting beyond weekly predictions
- Integration with hospital EMR/EHR systems
- Citizen reporting or public emergency messaging
- Real-time case notification (system uses weekly batch updates)
- International disease surveillance integration

---

## Key Non-Functional Requirements

| Requirement             | Target                            |
| ----------------------- | --------------------------------- |
| Dashboard Load Time     | ≤ 3 seconds for national overview |
| Concurrent Users        | Support 500+ concurrent users     |
| ML Service Availability | ≥ 99% uptime                      |
| Mobile Offline Support  | 7-day data retention              |
| Evidence Upload         | Max 10MB per image, compressed    |
| API Response Time       | ≤ 500ms for 95th percentile       |
| Data Retention          | 5 years historical data           |

---

## Development Setup

### Prerequisites

- Node.js 24.x
- PostgreSQL 16
- Python 3.11+ (for ML service and explain-analytics)
- Docker (for Qdrant)
- Redis

### Quick Start

```bash
# Clone repository
git clone https://github.com/your-repo/epilink-system.git
cd epilink-system

# Install dependencies
npm run install:all

# Start Qdrant (required for explain-analytics and chatbot)
docker compose up qdrant -d

# Start development servers
npm start
```

### Running Tests

```bash
# Backend tests
cd backend && npm run test

# With coverage
npm run test:cov
```

---

## Project Structure

```
epilink-system/
├── frontend/                   # Next.js web dashboard
│   ├── app/                    # App router pages
│   │   ├── (dashboard)/admin/  # Admin pages (analytics, reports, task-analytics)
│   │   ├── (dashboard)/supervisor/ # Supervisor pages (tasks, evidence, PHIs)
│   │   ├── (dashboard)/phi/    # PHI pages (tasks, evidence upload)
│   │   └── risk-map/           # Public risk dashboard
│   ├── components/
│   │   ├── dashboard/          # Authenticated dashboard components
│   │   ├── public/             # Public-facing components (ActionGuidance, NationalStatusBar, etc.)
│   │   └── ui/                 # Shadcn UI primitives
│   └── services/               # API service layer
├── backend/                    # NestJS API server
│   ├── src/
│   │   ├── auth/               # Authentication module
│   │   ├── users/              # User management
│   │   ├── analytics/          # Analytics, predictions, explain endpoints
│   │   ├── tasks/              # Task CRUD, analytics, chat, evidence
│   │   ├── reports/            # Weekly report generation + PDF
│   │   ├── email/              # Email module (BullMQ + Nodemailer)
│   │   ├── storage/            # S3/R2 storage service
│   │   └── entities/           # TypeORM entities
│   └── test/                   # E2E tests
├── mobile/                     # React Native PHI app (Expo)
│   └── src/
│       ├── screens/            # TaskList, TaskDetail, EvidenceUpload, RouteMap
│       ├── components/         # Toast, shimmer skeletons, map markers
│       ├── api/                # taskService, evidenceService, routeService
│       └── context/            # ToastContext, AuthContext
├── ml-model/                   # Python ML microservice
│   └── src/
│       ├── forecasting/        # XGBoost model, DS disaggregation
│       └── config/             # Colombo DS weights
├── explain-analytics/          # Python Explainable AI microservice
│   └── src/explain_analytics/
│       ├── services/           # RAGService, InsightService, AgenticInsightService, ETLService
│       └── config.py
├── chatbot/                    # Public EpiBot RAG chatbot
│   └── src/
│       └── services/           # rag_service.py (Qdrant), chat_service.py
└── docs/                       # Feature implementation plans
```

---

## License

This project is developed as a final year academic project.

---

## Authors

- **Charuka Karunarathna** - Final Year Project, [NSBM Green University (in affiliation with University of Plymouth)]

---

## Acknowledgments

- Ministry of Health, Sri Lanka - Epidemiology Unit
- Open-Meteo for weather data API
- Project Supervisor: Mr. Diluka Wijesinghe
