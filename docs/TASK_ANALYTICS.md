# Task Analytics Dashboard — Admin Implementation Plan

## Overview

Add a Task Analytics section to the admin dashboard at `/admin/tasks/analytics` that lets admins monitor task management across the country — tracking assignment, completion, and performance metrics for Supervisors and PHIs per district.

**Stack in use:** Next.js (frontend) · NestJS + TypeORM + PostgreSQL (backend) · Recharts (charts) · shadcn/ui (components)

**Existing reference pages:** `/admin/analytics/page.tsx`, `AdvancedAnalyticsPanel.tsx`

---

## Data Available (from existing DB schema)

| Source | Fields relevant to analytics |
|---|---|
| `Task` | `type`, `status`, `priority`, `district`, `assignedPhi`, `createdBy`, `dueDate`, `createdAt`, `assignedAt`, `submittedAt`, `completedAt` |
| `Evidence` | `status` (PENDING/APPROVED/REJECTED), `submittedBy`, `verifiedBy`, `submittedAt`, `verifiedAt` |
| `User` | `role` (SUPERVISOR/PHI), `district`, `isActive` |

**Task statuses:** `PENDING → ASSIGNED → IN_PROGRESS → SUBMITTED → VERIFIED → COMPLETED / REJECTED`

**Task types:** `CLEANUP`, `FOGGING`, `INSPECTION`, `INVESTIGATION`

---

## Phases

---

### Phase 1 — Backend: Task Analytics API ✅ DONE

**Goal:** Expose aggregate endpoints that power every chart and KPI card across all later phases.

**File:** `backend/src/tasks/tasks.controller.ts` + new `backend/src/tasks/tasks-analytics.service.ts`

#### Endpoints to add

| Method | Path | Description |
|---|---|---|
| `GET` | `/tasks/analytics/national-summary` | Country-level KPI snapshot |
| `GET` | `/tasks/analytics/by-district` | Per-district task counts & completion rates |
| `GET` | `/tasks/analytics/by-status` | Status distribution (national or per district) |
| `GET` | `/tasks/analytics/by-type` | Type distribution |
| `GET` | `/tasks/analytics/by-priority` | Priority distribution |
| `GET` | `/tasks/analytics/trend` | Daily/weekly task creation & completion counts (date range param) |
| `GET` | `/tasks/analytics/supervisors` | Per-supervisor task assignment & completion metrics |
| `GET` | `/tasks/analytics/phis` | Per-PHI performance: assigned, completed, rejected, avg completion time |
| `GET` | `/tasks/analytics/overdue` | Tasks past due date, grouped by district/PHI |
| `GET` | `/tasks/analytics/evidence-review` | Evidence submission & approval rates |

**Query params (shared):** `districtId?`, `from?` (ISO date), `to?` (ISO date), `period?: day|week|month`

**Key computed fields (SQL/TypeORM):**
- `completion_rate = completed / (assigned + in_progress + submitted + completed)`
- `avg_completion_hours = AVG(completedAt - assignedAt)` per PHI/district
- `overdue_count = tasks WHERE dueDate < NOW() AND status NOT IN (COMPLETED, VERIFIED)`

**Deliverables:**
- `TasksAnalyticsService` with TypeORM query-builder aggregations → `backend/src/tasks/tasks-analytics.service.ts`
- DTOs for each response shape → `backend/src/tasks/dto/task-analytics.dto.ts`
- Controller with admin-only guard (`@Roles(UserRole.ADMIN)`) → `backend/src/tasks/tasks-analytics.controller.ts`
- Registered in `TasksModule` → `backend/src/tasks/tasks.module.ts`

---

### Phase 2 — Frontend: National Overview Page

**Goal:** Single-glance national picture — top KPI cards + district comparison charts.

**New file:** `frontend/app/(dashboard)/admin/tasks/analytics/page.tsx`

**Add link in:** `frontend/app/(dashboard)/admin/page.tsx` quick-links grid

#### Layout

```
[ KPI Cards Row ]
  Total Tasks  |  Completion Rate  |  Overdue  |  Avg Completion Time  |  Active PHIs

[ District Bar Chart ]                [ Status Donut Chart ]
  Completion rate per district          PENDING / ASSIGNED / IN_PROGRESS / SUBMITTED / COMPLETED / REJECTED

[ Task Type Bar Chart ]               [ Priority Distribution Bar Chart ]
  CLEANUP / FOGGING / INSPECTION        LOW / MEDIUM / HIGH / URGENT
  / INVESTIGATION count

[ Trend Line Chart — full width ]
  Daily task creation vs completion over selected date range
```

**Components to create** (under `frontend/components/dashboard/task-analytics/`):

| File | Purpose |
|---|---|
| `TaskKpiCards.tsx` | 5-card KPI strip using shadcn `Card` |
| `DistrictCompletionChart.tsx` | Recharts `BarChart`, one bar per district |
| `TaskStatusDonut.tsx` | Recharts `PieChart` / `RadialBarChart` |
| `TaskTypeChart.tsx` | Recharts `BarChart` grouped by type |
| `TaskPriorityChart.tsx` | Recharts `BarChart` grouped by priority |
| `TaskTrendChart.tsx` | Recharts `LineChart` with dual lines (created/completed) |
| `DateRangePicker.tsx` | Reuse/adapt from existing analytics pages |

**Data fetching:** Server components + `fetch` against NestJS API (follow pattern in `admin/analytics/page.tsx`).

---

### Phase 3 — Frontend: District Drill-Down

**Goal:** Click a district in Phase 2 charts → see that district's supervisor and PHI breakdown.

**New file:** `frontend/app/(dashboard)/admin/tasks/analytics/district/[districtId]/page.tsx`

#### Layout

```
[ Breadcrumb: National > {District Name} ]

[ District KPI Cards ]
  Tasks this month  |  Completion Rate  |  Overdue  |  Active PHIs  |  Supervisors

[ Supervisor Table ]
  Name | Tasks Assigned | Completed | Pending | Rejected | Completion Rate | Avg Time

[ PHI Leaderboard / Table ]
  Name | Tasks | Completed | Overdue | Rejection Rate | Last Active

[ Status Trend for District ]
  Same LineChart but scoped to districtId
```

**Components to create:**

| File | Purpose |
|---|---|
| `SupervisorTable.tsx` | shadcn `Table` with sortable columns |
| `PhiPerformanceTable.tsx` | shadcn `Table` with color-coded completion rate |
| `DistrictKpiCards.tsx` | District-scoped KPI strip |

**Interaction:** Clicking a PHI row navigates to Phase 4.

---

### Phase 4 — Frontend: PHI Performance Profile

**Goal:** Deep-dive into a single PHI's task history and performance metrics.

**New file:** `frontend/app/(dashboard)/admin/tasks/analytics/phi/[phiId]/page.tsx`

#### Layout

```
[ Profile Header ]
  PHI Name | District | Status (Active/Inactive) | Member since

[ KPI Cards ]
  Total Assigned  |  Completed  |  Overdue  |  Avg Completion Time  |  Evidence Approval Rate

[ Task Status Breakdown — Donut ]

[ Monthly Trend Bar Chart ]
  Tasks completed per month (last 6 months)

[ Task List Table ]
  Recent 20 tasks with status, type, priority, assigned date, completed date
  Filter: status / type / date range

[ Evidence Review Panel ]
  Submitted / Approved / Rejected counts with approval rate gauge
```

**Components to create:**

| File | Purpose |
|---|---|
| `PhiProfileHeader.tsx` | Name, district, role badge |
| `PhiTaskHistoryTable.tsx` | Paginated table with inline status badges |
| `EvidenceReviewPanel.tsx` | Evidence stats with Recharts `RadialBarChart` gauge |

---

### Phase 5 — Real-time Monitoring + Overdue Alerts

**Goal:** Live task activity feed and alerts for overdue/stalled tasks.

#### Backend additions

- WebSocket event `task-analytics:update` emitted whenever a task status changes (hook into existing `TasksGateway` or create `TaskAnalyticsGateway`)
- `GET /tasks/analytics/overdue` already planned in Phase 1 — add `severity` field (`warning` if <24h past due, `critical` if >48h)

#### Frontend additions

**New section on Phase 2 national page:**

| Component | Purpose |
|---|---|
| `OverdueTasksAlert.tsx` | Collapsible alert panel listing overdue tasks, grouped by district, with severity badges |
| `LiveActivityFeed.tsx` | Right-side panel; Socket.io subscription shows last 20 task status changes in real time (PHI name → task type → new status) |

**Socket integration:** Follow pattern from existing `InsightChatPanel.tsx` which already uses Socket.io.

---

## Navigation Integration

Add to `frontend/app/(dashboard)/admin/page.tsx` quick-links:

```tsx
{ label: "Task Analytics", href: "/admin/tasks/analytics", icon: ClipboardList }
```

Add to sidebar nav (wherever existing admin links live).

---

## Implementation Order Summary

| Phase | Scope | Est. Complexity | Status |
|---|---|---|---|
| 1 | Backend analytics service + 10 API endpoints | Medium | ✅ Done |
| 2 | National overview page + 6 chart components | Medium | — |
| 3 | District drill-down page + 3 table components | Low | — |
| 4 | PHI profile page + 3 components | Low | — |
| 5 | Real-time feed + overdue alerts + WebSocket | Medium | — |

Start with Phase 1 — all frontend phases depend on it.
