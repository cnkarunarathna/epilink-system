# Email Notifications & Alerts — Implementation Plan

**System**: Epilink Epidemiological Field Management System  
**Backend**: NestJS 11 · TypeORM · PostgreSQL · Redis  
**Mail Provider**: Zoho Mail SMTP via Nodemailer  
**Last Updated**: 2026-04-17  

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Phase 1 — Core Email Infrastructure](#phase-1--core-email-infrastructure)
3. [Phase 2 — Transactional User Notifications](#phase-2--transactional-user-notifications)
4. [Phase 3 — Task Lifecycle Notifications](#phase-3--task-lifecycle-notifications)
5. [Phase 4 — Evidence & Report Notifications](#phase-4--evidence--report-notifications)
6. [Phase 5 — Alert & Digest System](#phase-5--alert--digest-system)
7. [Phase 6 — Admin Panel & Audit Log](#phase-6--admin-panel--audit-log)
8. [Environment Variables Reference](#environment-variables-reference)
9. [Database Schema Reference](#database-schema-reference)
10. [Template Catalogue](#template-catalogue)

---

## Architecture Overview

```
Request / Event
      │
      ▼
NestJS Service (Users / Tasks / Reports / Evidence)
      │
      ├─► EventsGateway  ──► WebSocket (existing real-time)
      │
      └─► EmailService
              │
              ▼
        Email Queue (Bull + Redis)
              │
              ▼
        Email Processor (Worker)
              │
              ├─► Template Engine (Handlebars)
              │
              └─► Nodemailer Transport ──► Zoho SMTP ──► Recipient
                                                │
                                                └─► EmailLog (PostgreSQL)
```

**Key design decisions**:
- Nodemailer with Zoho SMTP (no third-party SaaS dependency)
- BullMQ queue backed by existing Redis instance — prevents blocking request handlers
- Handlebars HTML templates compiled once and cached in Redis
- `EmailLog` entity records every sent/failed email for audit and retry
- `NotificationPreference` entity allows per-user opt-out per category
- All email operations are **fire-and-forget** — failures never propagate to callers
- Module is self-contained; other modules inject `EmailService` and call one method

---

## Phase 1 — Core Email Infrastructure ✅ COMPLETE

> **Goal**: Working Nodemailer → Zoho SMTP transport with a queue processor, base HTML template layout, and a database email log. No business notifications yet — just a reliable plumbing layer.
>
> **Status**: Implemented 2026-04-17. All deliverables shipped and build verified.

### 1.1 Install Dependencies

```bash
npm install nodemailer handlebars bullmq
npm install --save-dev @types/nodemailer
```

### 1.2 Environment Variables

Add to `/backend/.env`:

```env
# Zoho Mail SMTP
ZOHO_SMTP_HOST=smtp.zoho.com
ZOHO_SMTP_PORT=465
ZOHO_SMTP_SECURE=true
ZOHO_SMTP_USER=noreply@yourdomain.com
ZOHO_SMTP_PASS=your_zoho_app_password
ZOHO_FROM_NAME=Epilink System
ZOHO_FROM_EMAIL=noreply@yourdomain.com

# Email feature flags
EMAIL_ENABLED=true
EMAIL_QUEUE_NAME=email
```

> **Note**: Use a Zoho-specific App Password (not your account password) if 2FA is enabled.

### 1.3 Module Structure

```
/backend/src/email/
  ├── email.module.ts
  ├── email.service.ts           ← public API — other modules call this
  ├── email.processor.ts         ← Bull worker — sends the actual mail
  ├── email.types.ts             ← DTOs / job payload types
  ├── entities/
  │   └── email-log.entity.ts
  └── templates/
      ├── base.hbs               ← shared HTML wrapper
      ├── partials/
      │   ├── header.hbs
      │   └── footer.hbs
      └── (per-phase templates added later)
```

### 1.4 Database Entity — `EmailLog`

```typescript
@Entity('email_logs')
export class EmailLog {
  @PrimaryGeneratedColumn('uuid') id: string;

  @Column() recipientEmail: string;
  @Column({ nullable: true }) recipientName: string;
  @Column() subject: string;
  @Column() templateName: string;
  @Column({ type: 'jsonb', nullable: true }) templateData: Record<string, any>;
  @Column({ default: 'pending' }) status: 'pending' | 'sent' | 'failed';
  @Column({ nullable: true }) errorMessage: string;
  @Column({ nullable: true }) messageId: string;   // SMTP message-id header
  @Column({ nullable: true }) relatedEntityType: string; // 'task', 'user', 'report'
  @Column({ nullable: true }) relatedEntityId: string;
  @Column({ nullable: true }) triggeredByUserId: string;
  @CreateDateColumn() createdAt: Date;
  @Column({ nullable: true }) sentAt: Date;
}
```

### 1.5 `EmailService` — Public Interface

```typescript
// email.service.ts
interface SendEmailOptions {
  to: string | string[];
  subject: string;
  template: string;           // name of .hbs file (without extension)
  context: Record<string, any>;
  relatedEntityType?: string;
  relatedEntityId?: string;
  triggeredByUserId?: string;
}

class EmailService {
  async send(options: SendEmailOptions): Promise<void>
  // Enqueues job to Bull queue; never throws
}
```

### 1.6 `EmailProcessor` — Worker

- Dequeues jobs from Bull
- Compiles Handlebars template (uses Redis cache — TTL 1 hour)
- Sends via Nodemailer
- Writes result to `EmailLog`
- Retries failed jobs up to 3× with exponential backoff
- Graceful: if `EMAIL_ENABLED=false`, logs skip and exits

### 1.7 Base HTML Template

Responsive single-column layout:
- Header: Epilink logo + system name
- Content area: injected by child template
- Footer: "You received this because…" + system name + support email

### 1.8 Test Endpoint (Dev Only)

```
POST /email/test   (admin-only, guarded behind env === development)
Body: { "to": "dev@example.com" }
```

Sends a test email to verify SMTP credentials and queue flow.

### Deliverables
- [x] `EmailModule` registered in `AppModule` — `src/email/email.module.ts` (`@Global`)
- [x] Zoho SMTP transport — Nodemailer provider in `email.module.ts` (null-safe when creds absent)
- [x] BullMQ queue connected to existing Redis — `EMAIL_BULL_QUEUE` provider
- [x] `email_logs` table — migration `1780500000000-CreateEmailLogs.ts`
- [x] Dev test endpoint — `POST /email/test` (admin-only, blocked in production)
- [x] Base layout template — `base.hbs` + `partials/header.hbs` + `partials/footer.hbs`
- [x] `nest-cli.json` assets configured — `.hbs` files copied to `dist/` on build

---

## Phase 2 — Transactional User Notifications

> **Goal**: Send emails on every user lifecycle event — account creation (with credentials), status changes, and role/district assignments.

### 2.1 Trigger Points

| Event | Where in code | Recipients |
|---|---|---|
| User created | `UsersService.create()` | New user |
| User activated | `UsersService.toggleStatus()` → `isActive: true` | Affected user |
| User deactivated | `UsersService.toggleStatus()` → `isActive: false` | Affected user |
| Password reset (future) | Auth flow | Affected user |

### 2.2 Templates

#### `welcome.hbs`
- **To**: New user
- **Subject**: `Welcome to Epilink — Your Account Details`
- **Content**:
  - Greeting with full name
  - Role and district assignment
  - Temporary password (plaintext — passed in at creation time before hashing)
  - Login URL (from `NEXT_FRONTEND_URL` env var)
  - Security notice to change password on first login
  - Support contact

#### `account-activated.hbs`
- **To**: User
- **Subject**: `Your Epilink account has been activated`
- **Content**: Account is active, login link, role summary

#### `account-deactivated.hbs`
- **To**: User
- **Subject**: `Your Epilink account has been deactivated`
- **Content**: Account suspended, contact supervisor/admin for reinstatement

### 2.3 Integration

```typescript
// UsersService.create()
const user = await this.usersRepository.save(newUser);
await this.emailService.send({
  to: user.email,
  subject: 'Welcome to Epilink — Your Account Details',
  template: 'welcome',
  context: { name: user.name, role: user.role, district: user.district,
              tempPassword: dto.password, loginUrl: this.configService.get('NEXT_FRONTEND_URL') },
  relatedEntityType: 'user',
  relatedEntityId: user.id,
  triggeredByUserId: createdBy.id,
});
```

### Deliverables
- [ ] `welcome.hbs` template
- [ ] `account-activated.hbs` template
- [ ] `account-deactivated.hbs` template
- [ ] `UsersService` integrated with `EmailService`
- [ ] End-to-end test: create user → email received

---

## Phase 3 — Task Lifecycle Notifications

> **Goal**: Email notifications for every meaningful task state transition. PHIs are notified of assignments. Supervisors are notified of submissions, completions, and overdue tasks.

### 3.1 Task Status Machine

```
pending → assigned → in_progress → submitted → verified → completed
                                             ↘ rejected  (→ back to assigned)
```

### 3.2 Trigger Points

| Event | Trigger location | To (PHI) | To (Supervisor / Admin) |
|---|---|---|---|
| Task created & assigned | `TasksService.create()` | Assignment details | — |
| Task reassigned | `TasksService.assign()` | New assignment | — |
| Task submitted | `TasksService.updateStatus(submitted)` | Confirmation | Review request |
| Task verified/completed | `TasksService.updateStatus(verified/completed)` | Completion notice | — |
| Task rejected | `TasksService.updateStatus(rejected)` | Rejection + reason | — |
| Task due in 24 hours | Scheduled job (Cron) | Reminder | — |
| Task overdue | Scheduled job (Cron) | Overdue warning | Supervisor alert |

### 3.3 Templates

#### `task-assigned.hbs`
- **To**: Assigned PHI
- **Subject**: `New Task Assigned: [Task Title] — [Priority]`
- **Content**: Task title, type, priority badge, description, address, due date, task URL

#### `task-submitted.hbs`
- **To**: Supervisor/Admin (district)
- **Subject**: `Task Submitted for Review: [Task Title]`
- **Content**: Task details, submitted by (PHI name), submission time, review action link

#### `task-verified.hbs`
- **To**: PHI
- **Subject**: `Task Verified: [Task Title]`
- **Content**: Task title, verified by (supervisor), completion summary

#### `task-rejected.hbs`
- **To**: PHI
- **Subject**: `Task Returned — Action Required: [Task Title]`
- **Content**: Task title, rejection reason, what to fix, resubmit link

#### `task-reminder.hbs`
- **To**: PHI
- **Subject**: `Reminder: Task Due Tomorrow — [Task Title]`
- **Content**: Task summary, time remaining, action link

#### `task-overdue.hbs`
- **To**: PHI
- **Subject**: `Overdue Task: [Task Title]`
- **Content**: Days overdue, task details, urgency notice
- **CC**: Supervisor (district supervisor email)

### 3.4 Scheduled Jobs (Cron)

```typescript
// TaskReminderScheduler (new service in tasks module)
@Cron('0 8 * * *')  // 8:00 AM daily
async sendDueTomorrowReminders() {
  // Find tasks where dueDate is tomorrow, status ≠ completed/verified
  // Email assigned PHI for each
}

@Cron('0 9 * * *')  // 9:00 AM daily
async sendOverdueAlerts() {
  // Find tasks where dueDate < now, status not in [completed, verified, rejected]
  // Email PHI + CC supervisor
}
```

### 3.5 Helper: Find Supervisor for District

```typescript
// UsersService.findSupervisorByDistrict(district: string): Promise<User | null>
```

Used to resolve the supervisor CC address when emailing PHIs about overdue/rejected tasks.

### Deliverables
- [ ] All 6 task templates
- [ ] `TasksService` status-change hooks integrated
- [ ] `TaskReminderScheduler` with 2 cron jobs
- [ ] `UsersService.findSupervisorByDistrict()` helper
- [ ] End-to-end test: assign → submit → reject → verify

---

## Phase 4 — Evidence & Report Notifications

> **Goal**: Email notifications for evidence submission/review outcomes and weekly report generation/approval.

### 4.1 Evidence Workflow

| Event | Trigger | To |
|---|---|---|
| Evidence submitted | `TasksService.submitEvidence()` | Supervisor (review request) |
| Evidence approved | `TasksService.verifyEvidence()` → `approved` | PHI (confirmation) |
| Evidence rejected | `TasksService.verifyEvidence()` → `rejected` | PHI (reason + resubmit) |

### 4.2 Evidence Templates

#### `evidence-submitted.hbs`
- **To**: Supervisor
- **Subject**: `Evidence Ready for Review — [Task Title]`
- **Content**: Submitted by, task context, evidence notes, thumbnail (S3 pre-signed URL), review link

#### `evidence-approved.hbs`
- **To**: PHI
- **Subject**: `Evidence Approved — [Task Title]`
- **Content**: Approval confirmation, verified by, next steps

#### `evidence-rejected.hbs`
- **To**: PHI
- **Subject**: `Evidence Returned — [Task Title]`
- **Content**: Rejection reason, what's needed, resubmit instructions

### 4.3 Report Workflow

| Event | Trigger | To |
|---|---|---|
| Report generated | `ReportsService.generate()` | Admin + supervisors |
| Report approved | `ReportsService.approve()` | Report creator + supervisors |

### 4.4 Report Templates

#### `report-generated.hbs`
- **To**: Admin + all supervisors
- **Subject**: `Weekly Epidemiological Report Ready — Week [N], [Year]`
- **Content**: Summary stats (total cases, high-risk districts, predictions), view/download link

#### `report-approved.hbs`
- **To**: Report creator + supervisors
- **Subject**: `Weekly Report Approved — Week [N], [Year]`
- **Content**: Approval confirmation, approved by, PDF download link (S3 pre-signed URL, 7-day expiry)

### 4.5 Helper: Broadcast to Role

```typescript
// EmailService.sendToRole(role: UserRole, options): Promise<void>
// Fetches all active users with given role, sends individual emails
```

Used for report notifications that go to all admins or all supervisors.

### Deliverables
- [ ] Evidence templates (submitted, approved, rejected)
- [ ] Report templates (generated, approved)
- [ ] Evidence hooks in `TasksService`
- [ ] Report hooks in `ReportsService`
- [ ] `EmailService.sendToRole()` helper
- [ ] End-to-end test: submit evidence → approve → PDF report email

---

## Phase 5 — Alert & Digest System

> **Goal**: Proactive system-level alerts for dengue risk spikes and a configurable weekly digest email for supervisors and admins summarising activity in their district/system.

### 5.1 Risk Spike Alert

**Trigger**: Analytics service returns a high-risk prediction for a district (`AnalyticsService.getPrediction()` result exceeds threshold).

**Template**: `risk-alert.hbs`
- **To**: Supervisor of that district + all admins
- **Subject**: `ALERT: High Dengue Risk Detected — [District]`
- **Content**: District name, predicted case count, risk level, week, recommended actions, analytics dashboard link

**Threshold configuration** (env var): `DENGUE_RISK_ALERT_THRESHOLD=50` (cases)

### 5.2 Weekly Activity Digest

**Cron**: Every Monday 7:00 AM

**Template**: `weekly-digest.hbs`

#### For Supervisors:
- **To**: Each supervisor
- **Subject**: `Weekly Summary — [District], Week [N]`
- **Content**:
  - Total tasks (by status) in district
  - PHI activity overview (tasks completed/pending per PHI)
  - Overdue task count with links
  - Evidence items pending review
  - Any reported dengue cases in district this week

#### For Admins:
- **To**: All admins
- **Subject**: `System Weekly Summary — Week [N]`
- **Content**:
  - System-wide task stats by status
  - Active users count
  - Reports generated/approved
  - Top 3 high-activity districts
  - Any active dengue risk alerts

### 5.3 Digest Scheduler

```typescript
@Cron('0 7 * * 1')  // Every Monday at 7:00 AM
async sendWeeklyDigests() {
  const supervisors = await this.usersService.findByRole(UserRole.SUPERVISOR);
  for (const supervisor of supervisors) {
    const stats = await this.tasksService.getDistrictWeeklyStats(supervisor.district);
    await this.emailService.send({ template: 'weekly-digest', context: { ...stats } });
  }
  // Similar for admins with system-wide stats
}
```

### 5.4 Notification Preferences (Optional Opt-Out)

New entity `NotificationPreference`:

```typescript
@Entity('notification_preferences')
export class NotificationPreference {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column() userId: string;
  @Column({ default: true }) taskAssigned: boolean;
  @Column({ default: true }) taskStatusChanged: boolean;
  @Column({ default: true }) taskReminder: boolean;
  @Column({ default: true }) taskOverdue: boolean;
  @Column({ default: true }) evidenceReview: boolean;
  @Column({ default: true }) reportReady: boolean;
  @Column({ default: true }) weeklyDigest: boolean;
  @Column({ default: true }) riskAlerts: boolean;
}
```

`EmailService.send()` checks preference before enqueuing — if user opted out of that category, the job is silently dropped (and noted in `EmailLog` with status `skipped`).

### Deliverables
- [ ] `risk-alert.hbs` template
- [ ] `weekly-digest.hbs` template (supervisor variant)
- [ ] `weekly-digest.hbs` admin variant (or separate template)
- [ ] `DigestScheduler` service with two cron jobs
- [ ] Risk alert hook in `AnalyticsService`
- [ ] `NotificationPreference` entity + migration
- [ ] Preference check in `EmailService.send()`
- [ ] Preference CRUD endpoints (`GET/PUT /users/:id/notification-preferences`)

---

## Phase 6 — Admin Panel & Audit Log

> **Goal**: Admin visibility into email activity — searchable log, manual resend capability, and a stats dashboard endpoint.

### 6.1 Email Log API Endpoints

```
GET  /email/logs                    Admin — paginated email log with filters
GET  /email/logs/:id                Admin — single log entry detail
POST /email/logs/:id/resend         Admin — requeue a failed email
GET  /email/stats                   Admin — aggregate stats (sent/failed/skipped counts by template)
```

### 6.2 Filtering & Pagination

`GET /email/logs` query params:
- `status` — `sent | failed | pending | skipped`
- `template` — filter by template name
- `recipientEmail` — search by recipient
- `relatedEntityType` — `task | user | report | evidence`
- `from` / `to` — date range
- `page` / `limit` — pagination (default limit: 20)

### 6.3 Manual Resend

`POST /email/logs/:id/resend`:
- Looks up original `EmailLog` entry
- Re-enqueues job with same `templateData`
- Creates new `EmailLog` entry with `relatedEntityId` pointing to original

### 6.4 Stats Endpoint Response Shape

```json
{
  "period": "last_7_days",
  "totalSent": 142,
  "totalFailed": 3,
  "totalSkipped": 8,
  "byTemplate": [
    { "template": "task-assigned", "sent": 48, "failed": 0 },
    { "template": "welcome", "sent": 5, "failed": 1 }
  ],
  "failureRate": "2.1%"
}
```

### 6.5 Error Alerting

If the email failure rate exceeds 10% in a 1-hour window (checked via Redis counter):
- Log a structured error at `ERROR` level
- (Future) Send an admin alert via an alternative channel

### Deliverables
- [ ] `EmailController` with log + stats endpoints
- [ ] Pagination + filtering in `EmailLogService`
- [ ] Resend logic
- [ ] Role guard (admin only) on all email endpoints
- [ ] Failure rate monitoring in `EmailProcessor`
- [ ] API documentation (Swagger tags)

---

## Environment Variables Reference

| Variable | Required | Example | Notes |
|---|---|---|---|
| `ZOHO_SMTP_HOST` | Yes | `smtp.zoho.com` | |
| `ZOHO_SMTP_PORT` | Yes | `465` | 465 (SSL) or 587 (TLS) |
| `ZOHO_SMTP_SECURE` | Yes | `true` | `true` for port 465 |
| `ZOHO_SMTP_USER` | Yes | `noreply@yourdomain.com` | Zoho email address |
| `ZOHO_SMTP_PASS` | Yes | `xxxx` | Zoho App Password |
| `ZOHO_FROM_NAME` | Yes | `Epilink System` | Display name in From |
| `ZOHO_FROM_EMAIL` | Yes | `noreply@yourdomain.com` | Must match SMTP user |
| `EMAIL_ENABLED` | No | `true` | Set `false` to disable all email sending |
| `EMAIL_QUEUE_NAME` | No | `email` | Bull queue name |
| `DENGUE_RISK_ALERT_THRESHOLD` | No | `50` | Cases/week to trigger risk alert |

---

## Database Schema Reference

### New Tables (all phases)

| Table | Phase | Purpose |
|---|---|---|
| `email_logs` | 1 | Audit log of every email job |
| `notification_preferences` | 5 | Per-user opt-out settings |

### Migration Files (planned names)

```
YYYYMMDD-create-email-logs.ts
YYYYMMDD-create-notification-preferences.ts
```

---

## Template Catalogue

| Template file | Phase | Trigger | Recipients |
|---|---|---|---|
| `base.hbs` + partials | 1 | — | Layout wrapper |
| `test.hbs` | 1 | Dev test endpoint | Developer |
| `welcome.hbs` | 2 | User created | New user |
| `account-activated.hbs` | 2 | Status toggled → active | User |
| `account-deactivated.hbs` | 2 | Status toggled → inactive | User |
| `task-assigned.hbs` | 3 | Task assigned to PHI | PHI |
| `task-submitted.hbs` | 3 | Task submitted | Supervisor/Admin |
| `task-verified.hbs` | 3 | Task verified/completed | PHI |
| `task-rejected.hbs` | 3 | Task rejected | PHI |
| `task-reminder.hbs` | 3 | Due date T-24h (cron) | PHI |
| `task-overdue.hbs` | 3 | Past due date (cron) | PHI + CC Supervisor |
| `evidence-submitted.hbs` | 4 | Evidence submitted | Supervisor |
| `evidence-approved.hbs` | 4 | Evidence approved | PHI |
| `evidence-rejected.hbs` | 4 | Evidence rejected | PHI |
| `report-generated.hbs` | 4 | Report generated | Admin + Supervisors |
| `report-approved.hbs` | 4 | Report approved | Creator + Supervisors |
| `risk-alert.hbs` | 5 | Dengue risk spike | District Supervisor + Admins |
| `weekly-digest.hbs` | 5 | Monday 7 AM (cron) | Supervisors + Admins |

---

## Implementation Order Summary

```
Phase 1  ──  Email infrastructure, SMTP, queue, DB log, base template
Phase 2  ──  User lifecycle emails (welcome, activate, deactivate)
Phase 3  ──  Task lifecycle emails + overdue/reminder cron jobs
Phase 4  ──  Evidence and report approval emails
Phase 5  ──  Risk spike alerts + weekly digest + notification preferences
Phase 6  ──  Admin audit log API + resend + stats dashboard
```

Each phase is independently deployable and tested before moving to the next.
