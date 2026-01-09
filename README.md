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

---

## Technology Stack

| Layer                 | Technology                                                                   |
| --------------------- | ---------------------------------------------------------------------------- |
| **Frontend (Web)**    | Next.js 16, React 19, TypeScript, Tailwind CSS, Shadcn UI, Recharts, Leaflet |
| **Frontend (Mobile)** | React Native / Expo (for PHI mobile app)                                     |
| **Backend API**       | NestJS, TypeORM, PostgreSQL, JWT Authentication                              |
| **ML Service**        | Python, FastAPI, XGBoost/Prophet, SHAP for explainability                    |
| **Database**          | PostgreSQL 16                                                                |
| **Caching**           | Redis (optional)                                                             |
| **Storage**           | Cloud object storage (AWS S3 / Cloudflare R2) for evidence uploads           |
| **CI/CD**             | GitHub Actions, Husky for local pre-commit/pre-push hooks                    |
| **Deployment**        | Docker, Vercel (frontend), Railway/Render (backend)                          |

---

## User Roles & Permissions

### Admin

- Full system access and configuration
- Manage districts/MOH boundaries and system settings
- Create and manage users with role-based access
- View national analytics and approve weekly reports
- Generate and export comprehensive reports
- Manage alert thresholds and notification settings

### Supervisor (District-Level)

- Access district-specific dashboards and risk summaries
- Create, assign, and monitor tasks for PHIs
- Verify evidence submissions and close tasks
- Export district-level reports
- Receive alerts for high-risk areas in their district
- View PHI performance metrics

### PHI (Public Health Inspector / Field Officer)

- View assigned tasks via web and **mobile application**
- Update task status with progress notes
- Upload geo-tagged evidence (photos, notes, GPS coordinates)
- Work offline and sync when connected (mobile)
- View local area risk information
- Receive push notifications for new assignments
- **Route optimization** for efficient task completion

### Viewer (Read-Only)

- Access to non-sensitive public dashboards
- View national and district-level statistics
- No access to task management or user data

### Public Users (Unauthenticated)

- Access AI chatbot for dengue-related questions
- View public risk information and prevention tips

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
- **Explainability:** SHAP values showing feature contributions
- **Scheduled Predictions:** GitHub Actions cron job runs every Monday (00:00 UTC) to generate predictions for the upcoming week
- **Iterative Forecasting:** When real case data is unavailable, the system uses previous predictions as lagged features combined with real-time weather data
- **Data Storage:** Predictions are stored directly in PostgreSQL database
- **Accuracy Target:** ≥ 80% prediction accuracy (for predictions based on actual data)

### 3. Web Dashboard (Admin & Supervisor)

#### 3.1 National Overview

- Interactive Sri Lanka map with district-level risk heatmap
- Real-time case statistics and week-over-week trends
- Key metrics: Total cases, high-risk districts, weather conditions
- Alert notifications for outbreak conditions

#### 3.2 Analytics & Insights

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
- Assign tasks to specific PHIs
- Track task progress and status
- Review and verify submitted evidence
- Task completion analytics

#### 3.5 User Management (Admin)

- Create, edit, delete users
- Role assignment and district allocation
- Account activation/deactivation
- User activity logs

#### 3.6 Reports Module

- Auto-generated weekly PDF reports
- District-specific reports for supervisors
- Custom date range report generation
- Export to PDF/Excel formats

### 4. PHI Mobile Application (React Native)

#### 4.1 Authentication

- Secure login with JWT tokens
- Remember me functionality

#### 4.2 Task Management

- View assigned tasks list
- Task details with location and instructions
- Accept/Start/Complete task workflow
- Priority-based task sorting

#### 4.3 Evidence Collection

- Camera integration for photo capture
- Automatic GPS tagging
- Add notes and observations
- Multiple photos per task

#### 4.4 Offline Support

- Local SQLite database for offline storage
- Queue system for pending uploads
- Auto-sync when connection restored
- Conflict resolution

#### 4.5 Local Risk Information

- View risk level for assigned area
- Simple case trend visualization
- Weather alerts for field work planning

#### 4.6 Notifications

- Push notifications for new task assignments
- Reminder notifications for pending tasks
- Alert notifications for high-risk conditions

#### 4.7 Route Optimization

- **Optimize Route Button:** One-tap optimization of daily task sequence
- **Distance Matrix:** Calculates optimal path between assigned locations using OpenRouteService API
- **TSP Solver:** Traveling Salesman Problem algorithm for shortest route
- **Map Visualization:** Display optimized route on map with turn-by-turn guidance
- **Time Estimates:** Show estimated travel time and total distance

### 5. AI Chatbot (Public Access)

- **RAG-Based Architecture:** Retrieval-Augmented Generation using epidemiological PDFs as knowledge base
- **LLM Integration:** Gemini 1.5 Flash for natural language responses
- **Vector Database:** ChromaDB for efficient document retrieval
- **Knowledge Sources:** Epidemiology Unit reports, WHO guidelines, prevention tips
- **No Authentication Required:** Accessible to public users
- **Supported Queries:**
  - Dengue symptoms and prevention
  - Current risk levels by district
  - Treatment guidelines
  - Mosquito breeding prevention tips

### 6. Task & Evidence Management

#### 5.1 Task Lifecycle

```
Created → Assigned → In Progress → Submitted → Verified → Completed
                                        ↓
                                    Rejected → Reassigned
```

#### 5.2 Task Types

- **Cleanup Operations:** Clearing potential breeding sites
- **Fogging:** Targeted insecticide spraying
- **Inspection:** Routine surveillance visits
- **Investigation:** Outbreak investigation

#### 5.3 Evidence Requirements

- Minimum photo count per task type
- GPS location verification
- Timestamp validation
- Supervisor verification workflow

### 7. Alerts & Notification System

- **Email Alerts:** Weekly summaries, high-risk notifications
- **Push Notifications:** Mobile alerts for PHIs
- **In-App Alerts:** Dashboard notification center
- **Threshold-Based Triggers:**
  - Case count exceeds threshold
  - Week-over-week increase > 25%
  - New hotspot detected
  - Task overdue warnings

### 8. Reporting & Analytics Export

- **Weekly National Report:** Auto-generated every Sunday
- **District Reports:** For supervisor distribution
- **Custom Reports:** Date range, district selection
- **Export Formats:** PDF, Excel, CSV
- **Scheduled Delivery:** Email distribution lists

### 9. Authentication & Security

- JWT-based authentication with refresh tokens
- Role-based access control (RBAC)
- Password hashing with bcrypt
- Session management and logout
- Activity audit logs
- HTTPS enforcement
- API rate limiting

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CLIENTS                                         │
├─────────────────┬─────────────────────────┬─────────────────────────────────┤
│   Web Dashboard │    PHI Mobile App       │    GitHub Actions               │
│   (Next.js)     │    (React Native)       │    (Weekly Cron)                │
└────────┬────────┴───────────┬─────────────┴──────────────┬──────────────────┘
         │                    │                            │
         ▼                    ▼                            ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         API GATEWAY / BACKEND                                │
│                           (NestJS + TypeORM)                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│  Auth Module  │  Users Module  │  Analytics Module  │  Tasks Module         │
│  Reports      │  Notifications │  Evidence Upload   │  Districts            │
└────────┬──────┴────────────────┴─────────┬──────────┴───────────────────────┘
         │                                 │
         ▼                                 ▼
┌─────────────────────────────────┐  ┌───────────────────┐
│ PostgreSQL Database             │  │ Object Storage    │
│ - Users, Districts              │  │ (S3/R2)           │
│ - Dengue Cases, Weather Data    │  │ Evidence files    │
│ - Predictions (updated weekly)  │  └───────────────────┘
└────────────────┬────────────────┘
                 │
                 ▼
┌─────────────────────────────────┐
│ ML Prediction Service           │
│ (Python FastAPI + XGBoost)      │
│ - Triggered by GitHub Actions   │
│ - Weekly cron job               │
│ - Stores predictions to DB      │
└─────────────────────────────────┘
```

---

## Database Schema (Core Entities)

| Entity          | Description                                       |
| --------------- | ------------------------------------------------- |
| `users`         | System users with roles and district assignments  |
| `districts`     | Sri Lankan district boundaries and metadata       |
| `dengue_cases`  | Weekly case counts per district                   |
| `weather_data`  | Weather observations (temperature, precipitation) |
| `predictions`   | ML-generated risk predictions                     |
| `tasks`         | Cleanup/fogging assignments                       |
| `evidence`      | Photos and notes from field visits                |
| `notifications` | System alerts and notifications                   |
| `audit_logs`    | User activity tracking                            |

---

## API Endpoints Summary

### Authentication

- `POST /api/auth/login` - User login
- `GET /api/auth/me` - Current user info
- `POST /api/auth/logout` - Session logout

### Analytics

- `GET /api/analytics/districts/latest` - Latest data per district
- `GET /api/analytics/predict/bulk` - ML predictions
- `GET /api/analytics/summary` - Dashboard summary
- `GET /api/analytics/trends` - Case trends
- `GET /api/analytics/advanced/hotspots` - Hotspot detection
- `GET /api/analytics/advanced/outbreak-alerts` - Outbreak alerts

### Users (Admin)

- `GET /api/users` - List all users
- `POST /api/users` - Create user
- `PATCH /api/users/:id` - Update user
- `DELETE /api/users/:id` - Delete user

### Tasks (To be implemented)

- `GET /api/tasks` - List tasks
- `POST /api/tasks` - Create task
- `PATCH /api/tasks/:id/status` - Update status
- `POST /api/tasks/:id/evidence` - Upload evidence

---

## Implementation Roadmap

### Phase 1: Core Platform (Completed)

- [x] User authentication and RBAC
- [x] Admin dashboard with user management
- [x] District risk visualization with interactive map
- [x] Analytics dashboard with trends and predictions
- [x] Weather correlation analysis
- [x] Hotspot and outbreak detection
- [x] Dark mode support
- [x] CI/CD pipeline with GitHub Actions

### Phase 2: Task Management (In Progress)

- [ ] Task entity and CRUD operations
- [ ] Evidence upload with file storage
- [ ] Supervisor task assignment workflow
- [ ] Task verification and approval

### Phase 3: PHI Mobile App & AI Features

- [ ] React Native project setup with Expo
- [ ] Authentication flow
- [ ] Task list and details view
- [ ] Camera integration for evidence
- [ ] GPS location capture
- [ ] Offline storage with SQLite
- [ ] Push notifications setup
- [ ] **Route optimization for PHI visits** (OpenRouteService + TSP solver)
- [ ] **RAG-based public chatbot** (Gemini + ChromaDB)

### Phase 4: Reporting & Alerts

- [ ] Weekly PDF report generation
- [ ] Email notification system
- [ ] Custom report builder
- [ ] Alert threshold configuration
- [ ] Chatbot UI integration on public landing page

### Phase 5: Enhancements

- [ ] Advanced ML model with ensemble methods
- [ ] SHAP explainability visualization
- [ ] Performance optimization
- [ ] Load testing and scaling

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
- Python 3.11+ (for ML service)

### Quick Start

```bash
# Clone repository
git clone https://github.com/your-repo/epilink-system.git
cd epilink-system

# Install dependencies
npm run install:all

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
├── frontend/                 # Next.js web dashboard
│   ├── app/                  # App router pages
│   ├── components/           # React components
│   └── services/             # API service layer
├── backend/                  # NestJS API server
│   ├── src/
│   │   ├── auth/             # Authentication module
│   │   ├── users/            # User management
│   │   ├── analytics/        # Analytics & predictions
│   │   └── entities/         # TypeORM entities
│   └── test/                 # E2E tests
├── mobile/                   # React Native PHI app (planned)
├── ml-service/               # Python ML microservice (planned)
└── docs/                     # Documentation
```

---

## License

This project is developed as a final year academic project.

---

## Authors

- **Your Name** - Final Year Project, [Your University]

---

## Acknowledgments

- Ministry of Health, Sri Lanka - Epidemiology Unit
- Open-Meteo for weather data API
- Project Supervisor: [Supervisor Name]
