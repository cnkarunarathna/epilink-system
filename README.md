# EpiLink - Dengue Risk Monitoring & Cleanup Management System  

## Overview  
A full-stack, role-based platform designed for Sri Lankan health authorities to predict short-term dengue risk, coordinate cleanup operations, and monitor field-level progress. The system automates epidemiological data ingestion, generates explainable ML-driven risk levels, and supports operational workflows for PHIs and supervisors.

---

## Core Objectives  
- Automate ingestion and processing of weekly dengue case PDFs and live weather data.  
- Predict next-week dengue risk (Low / Medium / High) for each district/MOH.  
- Provide interactive dashboards for national, district, and field-level decision-making.  
- Enable task assignment, field reporting, and evidence tracking for cleanup and fogging operations.  
- Deliver weekly reports and alerts to support rapid response in high-risk regions.

---

## User Roles

### Admin  
- Manage districts/MOH boundaries and system configurations.  
- Create and manage users with role-based access.  
- View national analytics and approve weekly reports.

### Supervisor (District-Level)  
- Access district dashboards and risk summaries.  
- Create and assign tasks to PHIs.  
- Verify evidence, close tasks, and export district reports.

### PHI (Field Officer)  
- View assigned tasks on web/mobile.  
- Update status and upload geo-tagged evidence (photos, notes).  
- Work offline and sync when online (optional mobile module).

### Viewer (Read-Only)  
- Public or organization-level access to non-sensitive dashboards.

---

## System Modules & Features  

### 1. Data Ingestion & Processing
- Automatic scraping of weekly epidemiological PDFs.  
- Cleaning, validation, deduplication, and merging with weather data.  
- Centralized storage in a relational database with logs.

### 2. ML Risk Prediction Service
- Lightweight model (XGBoost/Prophet) generating next-week risk levels.  
- Explainability output (e.g., SHAP contributions).  
- Exposed via a microservice API.

### 3. Dashboards
- National heatmap showing real-time and predicted risk.  
- District analytics: case trends, rainfall correlations, hotspots.  
- PHI task view: assigned, pending, completed tasks.

### 4. Task & Evidence Management
- Supervisors assign tasks (cleanup, fogging, inspections).  
- PHIs upload evidence with timestamps and optional geo-tags.  
- Supervisors verify/approve submissions.  
- Full audit trail maintained.

### 5. Alerts & Weekly Reporting
- Auto-generated weekly PDF reports (national and district).  
- Email/SMS alerts for high-risk areas, overdue tasks, and prediction updates.  
- Scheduled jobs run weekly after ingestion and prediction.

### 6. Authentication & Security
- JWT-based authentication.  
- Role-based access control (RBAC).  
- Activity logs, secure API endpoints, and HTTPS enforced.

---

## Architecture Overview  
- **Frontend:** Web dashboard (React / Next.js).  
- **Backend:** Microservices (Node/FastAPI) for ingestion, ML, and core API services.  
- **Database:** PostgreSQL (primary), Redis optional for caching.  
- **Storage:** Cloud object storage for evidence uploads.  
- **Scheduling:** Cron-based automated workflows.

---

## Out of Scope  
- Long-term epidemic forecasting beyond weekly predictions.  
- Integration with hospital EMR/EHR systems.  
- Citizen reporting or public emergency messaging.

---

## Optional Enhancements (Stretch Goals)  
- Offline-first mobile application for PHIs.  
- Route optimization for multi-task field visits.  
- Advanced anomaly detection for abnormal case spikes.

---

## Key Non-Functional Requirements  
- Dashboard loading times target ≤ 3 seconds for national overview.  
- Horizontal scalability for 500+ concurrent users.  
- High availability target for ML microservice (≥ 99%).  
- Secure storage and auditing of evidence uploads and user actions.
