# EpiLink — Database Diagram 

```mermaid
erDiagram
    %% ─────────────────────────────────────────────
    %% CORE ENTITIES
    %% ─────────────────────────────────────────────

    districts {
        UUID id PK
        VARCHAR name
        JSONB boundaries
        INTEGER population
        FLOAT area
    }

    users {
        UUID id PK
        VARCHAR email UK
        VARCHAR passwordHash
        VARCHAR role "ADMIN | SUPERVISOR | PHI | VIEWER"
        UUID districtId FK
        BOOLEAN isActive
        JSONB notificationPreferences
        TIMESTAMP createdAt
        TIMESTAMP updatedAt
    }

    %% ─────────────────────────────────────────────
    %% EPIDEMIOLOGICAL DATA
    %% ─────────────────────────────────────────────

    dengue_cases {
        UUID id PK
        UUID districtId FK
        INTEGER week
        INTEGER year
        INTEGER caseCount
        TIMESTAMP createdAt
    }

    weather_data {
        UUID id PK
        UUID districtId FK
        DATE date
        FLOAT temperature
        FLOAT precipitation
        FLOAT humidity
        TIMESTAMP createdAt
    }

    predictions {
        UUID id PK
        UUID districtId FK
        INTEGER week
        INTEGER year
        FLOAT predictedCases
        VARCHAR riskLevel "low | medium | high | critical"
        JSONB confidenceInterval
        JSONB shapValues
        VARCHAR modelVersion
        TIMESTAMP createdAt
    }

    %% ─────────────────────────────────────────────
    %% TASK MANAGEMENT
    %% ─────────────────────────────────────────────

    tasks {
        UUID id PK
        VARCHAR type "Cleanup | Fogging | Inspection | Investigation"
        VARCHAR status "PENDING | ASSIGNED | IN_PROGRESS | SUBMITTED | VERIFIED | COMPLETED | REJECTED"
        VARCHAR priority "LOW | MEDIUM | HIGH | URGENT"
        UUID districtId FK
        UUID assignedPhiId FK
        UUID createdBy FK
        DATE dueDate
        TEXT rejectionReason
        TIMESTAMP createdAt
        TIMESTAMP assignedAt
        TIMESTAMP completedAt
    }

    evidence {
        UUID id PK
        UUID taskId FK
        VARCHAR imageUrl
        TEXT notes
        FLOAT latitude
        FLOAT longitude
        VARCHAR status "PENDING | APPROVED | REJECTED"
        UUID submittedBy FK
        UUID verifiedBy FK
        TEXT rejectionReason
        TIMESTAMP createdAt
    }

    task_messages {
        UUID id PK
        UUID taskId FK
        UUID senderId FK
        TEXT content
        VARCHAR attachmentUrl
        TIMESTAMP createdAt
    }

    message_reads {
        UUID id PK
        UUID messageId FK
        UUID userId FK
        TIMESTAMP readAt
    }

    %% ─────────────────────────────────────────────
    %% NOTIFICATIONS & LOGS
    %% ─────────────────────────────────────────────

    notifications {
        UUID id PK
        UUID userId FK
        VARCHAR type
        VARCHAR title
        TEXT body
        BOOLEAN isRead
        TIMESTAMP createdAt
    }

    email_logs {
        UUID id PK
        VARCHAR to
        VARCHAR subject
        VARCHAR type
        VARCHAR status "SENT | FAILED"
        INTEGER attempts
        TIMESTAMP createdAt
        TIMESTAMP updatedAt
    }

    audit_logs {
        UUID id PK
        UUID userId FK
        VARCHAR action
        VARCHAR entity
        VARCHAR entityId
        JSONB metadata
        TIMESTAMP createdAt
    }

    %% ─────────────────────────────────────────────
    %% REPORTS
    %% ─────────────────────────────────────────────

    weekly_reports {
        UUID id PK
        INTEGER week
        INTEGER year
        UUID districtId FK
        VARCHAR pdfUrl
        TEXT narrativeSummary
        VARCHAR status
        TIMESTAMP generatedAt
    }

    %% ─────────────────────────────────────────────
    %% AI CHAT HISTORY
    %% ─────────────────────────────────────────────

    analytic_chat_sessions {
        UUID id PK
        VARCHAR session_id UK "Redis key suffix"
        UUID user_id FK
        VARCHAR district
        VARCHAR title "Default: New Chat"
        INTEGER turn_count
        BOOLEAN is_archived
        TIMESTAMP created_at
        TIMESTAMP updated_at
    }

    analytic_chat_messages {
        UUID id PK
        UUID chat_session_id FK
        VARCHAR role "user | model"
        TEXT content
        JSONB tool_calls
        TIMESTAMP created_at
    }

    %% ─────────────────────────────────────────────
    %% RELATIONSHIPS
    %% ─────────────────────────────────────────────

    %% District relationships
    districts ||--o{ users : "has"
    districts ||--o{ dengue_cases : "records"
    districts ||--o{ weather_data : "observes"
    districts ||--o{ predictions : "predicts"
    districts ||--o{ tasks : "scopes"
    districts ||--o{ weekly_reports : "covers"

    %% User relationships
    users ||--o{ tasks : "creates (createdBy)"
    users ||--o{ tasks : "assigned to (assignedPhiId)"
    users ||--o{ evidence : "submits"
    users ||--o{ evidence : "verifies"
    users ||--o{ task_messages : "sends"
    users ||--o{ message_reads : "reads"
    users ||--o{ notifications : "receives"
    users ||--o{ audit_logs : "generates"
    users ||--o{ analytic_chat_sessions : "owns"

    %% Task relationships
    tasks ||--o{ evidence : "has"
    tasks ||--o{ task_messages : "contains"

    %% Message relationships
    task_messages ||--o{ message_reads : "tracked by"

    %% AI Chat relationships
    analytic_chat_sessions ||--o{ analytic_chat_messages : "stores"
```

## Entity Summary

| Entity | Description | Key Relations |
|---|---|---|
| `districts` | Sri Lanka district boundaries and metadata | Parent of cases, weather, predictions, tasks, reports |
| `users` | System users with roles and district assignments | Belongs to district; creates/assigned tasks; owns chat sessions |
| `dengue_cases` | Weekly case counts per district | Belongs to district |
| `weather_data` | Weather observations (temp, precipitation, humidity) | Belongs to district |
| `predictions` | ML ensemble predictions with 80% CI, risk level, SHAP values | Belongs to district |
| `tasks` | Cleanup/fogging/inspection/investigation assignments | Belongs to district; links creator and assigned PHI |
| `evidence` | Geo-tagged photos and notes from field visits | Belongs to task; links submitter and verifier |
| `task_messages` | Task-scoped real-time chat between PHI and supervisor | Belongs to task; linked to sender |
| `message_reads` | Per-user read receipts for unread badge counts | Junction: message × user |
| `notifications` | In-app alerts and system notifications | Belongs to user |
| `email_logs` | Sent/failed email audit records for retry and reporting | Standalone audit |
| `audit_logs` | User activity tracking (action, entity, metadata) | Belongs to user |
| `weekly_reports` | Generated PDF reports with AI narrative summaries | Belongs to district |
| `analytic_chat_sessions` | AI chat session index — title, district, Redis key, archive flag | Belongs to user |
| `analytic_chat_messages` | Full message log with tool call traces (Postgres fallback) | Belongs to session |
