# Weekly Reports — Enhancement Plan

> Generated: 2026-04-14 | Branch: `weekly-reports`
>
> This document is the canonical reference for planned improvements to the
> weekly-reports feature in the EpiLink admin dashboard. Sections are ordered
> by priority: critical correctness fixes first, then data-accuracy gaps, then
> UI/display enhancements.

---

## 1. System Overview

### Architecture

```
Frontend (Next.js)                    Backend (NestJS)                  PostgreSQL
─────────────────                     ────────────────                  ──────────
admin/reports/page.tsx                reports.controller.ts             weekly_reports
GenerateReportDialog.tsx    ──────►   reports.service.ts     ──────►   dengue_cases
ReportDetailModal.tsx                 analytics.service.ts              districts
reports.service.ts (client)           pdf/report-pdf.generator.ts       weather_data
                                      storage.service.ts      ──────►   AWS S3 (PDFs)
```

### Data Flow

1. Admin selects year + week → `POST /api/reports/generate`
2. Service determines `historical` (past) or `predicted` (current/future) type
3. Six analytics calls run in parallel:
   - `getActualWeekData(year, week)` → district case data + 4-wk avg + trend
   - `getOutbreakAlertsForWeek(year, week)` → alert classifications
   - `getHotspots()` → geographic hotspot data (**not week-anchored**)
   - `getDashboardSummary()` → aggregate metrics (**not week-anchored**)
   - `getNationalSummary(weekLabel, user)` → AI narrative
   - `getActualWeekData(prevYear, prevWeek)` → previous week totals (predicted only)
4. Aggregates computed → DB record created → PDF generated → uploaded to S3
5. Frontend lists from `GET /api/reports`, detail view reads `report.reportData` JSONB

### Key Files

| Layer | File |
|---|---|
| Entity | [backend/src/reports/entities/weekly-report.entity.ts](backend/src/reports/entities/weekly-report.entity.ts) |
| Service | [backend/src/reports/reports.service.ts](backend/src/reports/reports.service.ts) |
| Controller | [backend/src/reports/reports.controller.ts](backend/src/reports/reports.controller.ts) |
| Analytics | [backend/src/analytics/analytics.service.ts](backend/src/analytics/analytics.service.ts) |
| PDF Generator | [backend/src/reports/pdf/report-pdf.generator.ts](backend/src/reports/pdf/report-pdf.generator.ts) |
| Frontend Page | [frontend/app/(dashboard)/admin/reports/page.tsx](frontend/app/(dashboard)/admin/reports/page.tsx) |
| Detail Modal | [frontend/components/dashboard/reports/ReportDetailModal.tsx](frontend/components/dashboard/reports/ReportDetailModal.tsx) |
| API Client | [frontend/services/reports.service.ts](frontend/services/reports.service.ts) |

---

## 2. Critical Bugs (Data Correctness)

These are active defects where data stored in or retrieved from the database is
wrong or silently dropped.

---

### BUG-01 — Alert `message` field never reaches the UI or PDF

**Severity:** High — Alert descriptions are invisible to users

**Root cause:**

`getOutbreakAlertsForWeek` (analytics.service.ts:937-949) returns:
```typescript
{
  district, current_cases, avg_cases, alert_level,
  description,   // ← actual description text
  severity,
}
```

But both the PDF generator (report-pdf.generator.ts:13-19) and the frontend
type (reports.service.ts:43-53) expect:
```typescript
{
  district, severity, current_cases,
  message,         // ← never set — always undefined
  recommendation,  // ← never set — always undefined
}
```

`alert.description` is saved into `reportData.alerts[].description` in the
JSONB column. The UI reads `alert.message` which is always `undefined`, so
alert cards render with no body text. The PDF similarly renders blank alert rows.

**Fix:**

In `analytics.service.ts` at line ~937, rename the return field:
```typescript
// Before
description: row.description,

// After
message: row.description,
recommendation: generateRecommendation(row.alert_level, row.cases),
```

Add a small helper `generateRecommendation(level, cases)` that maps alert
levels to actionable recommendations (e.g., "Deploy rapid response teams",
"Issue public health advisory", "Continue routine surveillance").

Alternatively, update the frontend/PDF types to read `description` — but
renaming at source is cleaner since `message` is the intended contract.

**Files to change:**
- [backend/src/analytics/analytics.service.ts](backend/src/analytics/analytics.service.ts) line ~937
- (optional) add `recommendation` generation

---

### BUG-02 — Outbreak alerts use all-time average, not a 4-week window

**Severity:** High — Alert thresholds are distorted by all historical data

**Root cause:**

The `prev_4weeks` CTE in `getOutbreakAlertsForWeek` (analytics.service.ts:901-908)
is named "4weeks" but queries ALL prior records:
```sql
prev_4weeks AS (
  SELECT dc.district_id,
         AVG(dc.cases) as avg_cases,   -- AVG over ALL history
         MAX(dc.cases) as max_cases
  FROM dengue_cases dc
  WHERE (dc.year < $1) OR (dc.year = $1 AND dc.week < $2)
  -- ↑ No LIMIT or row-number filter — uses every recorded week
  GROUP BY dc.district_id
)
```

In contrast, `getActualWeekData` (line ~968-975) correctly limits to the
last 4 records via `WHERE ranked.rn <= 4`. Using an all-time average for alert
thresholds means:
- For districts with long history, the average is depressed → alerts fire too
  easily
- For new districts, the average is the same as recent data → alerts under-fire

**Fix:**

Apply the same 4-week windowing as `getActualWeekData`:
```sql
prev_4weeks AS (
  SELECT ranked.district_id,
         AVG(ranked.cases) as avg_cases,
         MAX(ranked.cases) as max_cases
  FROM (
    SELECT dc.district_id, dc.cases,
           ROW_NUMBER() OVER (
             PARTITION BY dc.district_id
             ORDER BY dc.year DESC, dc.week DESC
           ) as rn
    FROM dengue_cases dc
    WHERE (dc.year < $1) OR (dc.year = $1 AND dc.week < $2)
  ) ranked
  WHERE ranked.rn <= 4
  GROUP BY ranked.district_id
)
```

**Files to change:**
- [backend/src/analytics/analytics.service.ts](backend/src/analytics/analytics.service.ts) lines ~901-908

---

### BUG-03 — Previous-week lookup drops ISO week 53

**Severity:** Medium — Reports generated for Week 1 silently lose the prev-week comparison

**Root cause:**

In `reports.service.ts` lines 108-113:
```typescript
let prevWeek = dto.weekNumber - 1;
if (prevWeek === 0) {
  prevYear -= 1;
  prevWeek = 52;   // ← always assumes 52 weeks; ISO years can have 53
}
```

Years where ISO week 53 exists (e.g., 2015, 2020, 2026) will have their
week 53 data skipped when generating a Week 1 report for the following year.
`prevWeekData` will be empty, causing `totalCurrentCases = 0` (or undefined)
in the predicted report stats display.

**Fix:**

Calculate the correct last ISO week of `prevYear` rather than hardcoding 52:
```typescript
if (prevWeek === 0) {
  prevYear -= 1;
  prevWeek = this.getLastISOWeek(prevYear);  // returns 52 or 53
}

private getLastISOWeek(year: number): number {
  // Dec 28 is always in the last ISO week of the year
  const dec28 = new Date(year, 11, 28);
  return this.getCurrentISOWeek(dec28);
}
```

**Files to change:**
- [backend/src/reports/reports.service.ts](backend/src/reports/reports.service.ts) lines ~108-113

---

### BUG-04 — `getDashboardSummary()` and `getHotspots()` are not week-anchored

**Severity:** Medium — Historical reports store live data, not the state as of that week

**Root cause:**

Both `getDashboardSummary()` and `getHotspots()` always query the most recent
week in the database (they use `ORDER BY year DESC, week DESC LIMIT 1`
internally). They do not accept a `(year, week)` parameter.

When generating a report for e.g. Week 10, 2025, these two functions return
data from the *current* latest week in the DB. This means:

- `reportData.summary` reflects today's DB state, not the Week 10 state
- `reportData.hotspots` shows current hotspots, not Week 10 hotspots
- Re-generating the same week at a later date would produce different results

**Fix:**

Add `(year: number, weekNumber: number)` parameters to both methods:

```typescript
// getDashboardSummary — add WHERE clause targeting the requested week
async getDashboardSummary(year?: number, weekNumber?: number): Promise<DashboardSummary>

// getHotspots — filter to requested week
async getHotspots(year?: number, weekNumber?: number): Promise<HotspotData[]>
```

When `year`/`weekNumber` are provided, the queries use those as the anchor
instead of `ORDER BY … LIMIT 1`. Existing callers that pass no arguments
keep their current "latest week" behaviour.

Update `reports.service.ts` to pass `dto.year, dto.weekNumber` to both calls:
```typescript
this.analyticsService.getDashboardSummary(dto.year, dto.weekNumber),
this.analyticsService.getHotspots(dto.year, dto.weekNumber),
```

**Files to change:**
- [backend/src/analytics/analytics.service.ts](backend/src/analytics/analytics.service.ts) — `getDashboardSummary`, `getHotspots`
- [backend/src/reports/reports.service.ts](backend/src/reports/reports.service.ts) lines ~115-122

---

### BUG-05 — `highRiskDistricts` uses trend threshold; dashboard uses case count threshold

**Severity:** Low-Medium — The two "high risk" numbers reported don't agree

**Root cause:**

The top-level `weekly_reports.high_risk_districts` column is computed as:
```typescript
// reports.service.ts:147-149
const highRiskDistricts = forecastArr.filter(d => d.trend === 'Rising').length;
```
(Rising = cases > 4-week avg × 1.3)

But `getDashboardSummary()` defines high-risk as `cases >= 50`:
```sql
-- analytics.service.ts:350-353
WHERE ranked.rn = 1 AND ranked.cases >= 50
```

The two numbers appear in different places and can diverge significantly. A
district with 60 cases but a stable trend would be "high risk" per the
dashboard but not per the report's `highRiskDistricts` column.

**Fix:**

Standardise the definition. The trend-based definition (Rising = 1.3×) is
more epidemiologically meaningful for reports. Update `getDashboardSummary` to
use the same 1.3× Rising threshold, or document the difference clearly in both
places and give the metrics different names (`rising_districts` vs
`high_case_districts`).

**Files to change:**
- [backend/src/analytics/analytics.service.ts](backend/src/analytics/analytics.service.ts) lines ~343-353

---

## 3. Data Retrieval Gaps

Issues where data exists in the database but is not retrieved or stored correctly.

---

### GAP-01 — Alert severity "Normal" can pass the filter

**Detail:**

The `getOutbreakAlertsForWeek` filter is:
```sql
WHERE l.rn = 1 AND (l.cases > p.avg_cases * 1.5 OR l.cases >= 50)
```

A district with 50–99 cases that is NOT above 1.5× average will pass the
filter but match the `ELSE 'Normal'` branch of the CASE statement. The
severity mapping falls through to `'moderate'`. This creates a misleading
"moderate" alert for a district that is technically within normal parameters.

**Fix:**

Change the `High Cases` threshold to match the filter minimum (>= 50):
```sql
WHEN l.cases >= 50 THEN 'High Cases'  -- currently >= 100
```
Or adjust the filter to require at least `l.cases >= 100` for inclusion
when not exceeding the ratio threshold.

---

### GAP-02 — `totalCurrentCases` for historical reports is `undefined`

**Detail:**

For historical reports, `totalCurrentCases` is set to `undefined`:
```typescript
// reports.service.ts:140-145
const totalCurrentCases = isHistorical ? undefined : prevWeekArr.reduce(...)
```

This is intentional (historical reports don't need a "current vs predicted"
split), but `reportData.totalCurrentCases` is then stored as `undefined` in
JSONB which serialises to `null`. The frontend correctly checks
`!isHistorical && totalCurrentCases !== undefined` before rendering the stat
card, so this is not a display bug — just worth documenting.

No code change needed, but make this explicit in the type:
```typescript
// reports.service.ts (WeeklyReport) — document clearly
totalCurrentCases?: number;  // undefined/null for historical reports
```

---

### GAP-03 — `confidence` field is hardcoded, never user-facing

**Detail:**

`getActualWeekData` always returns `confidence: 'actual'` and
`getActualWeekData` (used for predicted path) always returns `confidence: 'medium'`.
The `confidence` field is stored in `reportData.forecast[].confidence` but
never displayed in the UI table or PDF.

**Enhancement:**

Display confidence in the Districts table column and in the PDF for predicted
reports. For historical reports, show "Actual" (green badge). For predicted,
show "Medium" or include a model confidence indicator.

---

## 4. UI / Display Enhancements

---

### UI-01 — Chart tooltip always says "Predicted Cases" for historical reports

**File:** [frontend/components/dashboard/reports/ReportDetailModal.tsx](frontend/components/dashboard/reports/ReportDetailModal.tsx) line ~227-231

**Current:**
```tsx
<Tooltip
  formatter={(value) => [(value ?? 0).toLocaleString(), "Predicted Cases"]}
/>
```

**Fix:**
```tsx
<Tooltip
  formatter={(value) => [
    (value ?? 0).toLocaleString(),
    isHistorical ? "Reported Cases" : "Predicted Cases",
  ]}
/>
```

---

### UI-02 — Table missing "Report Type" and "Created By" columns

**File:** [frontend/app/(dashboard)/admin/reports/page.tsx](frontend/app/(dashboard)/admin/reports/page.tsx) lines ~302-311

The table currently shows: Period | Date Range | Predicted Cases | High-Risk | Status | Approved By | Actions

Missing:
1. **Report Type** — badge showing "Historical" or "Predicted" so admins know at a glance what they're reviewing
2. **Created By** — `report.createdBy?.name` is available from the API (relations: `['approvedBy', 'createdBy']` loaded in `listReports`) but not shown

Add a "Type" column with a badge:
```tsx
<TableHead>Type</TableHead>
// ...
<TableCell>
  <Badge variant={isHistorical ? "outline" : "secondary"}>
    {isHistorical ? "Historical" : "Predicted"}
  </Badge>
</TableCell>
```

---

### UI-03 — Detail modal shows no data from `reportData.summary`

**File:** [frontend/components/dashboard/reports/ReportDetailModal.tsx](frontend/components/dashboard/reports/ReportDetailModal.tsx)

The `summary` object (stored in `reportData.summary`) contains:
```typescript
{
  current_week: { year, week },
  total_cases: number,
  previous_total: number,
  change_percent: number,
  district_count: number,
  high_risk_districts: number,
  avg_temperature: number | null,
}
```

None of this is displayed. Suggested additions to the Summary tab:

- **Week-over-week change**: `change_percent` formatted as +X% / -X% with colour
- **Previous week total**: context for trend
- **Average temperature**: when available, relevant for dengue correlation
- **District coverage**: `district_count` / total districts in DB

---

### UI-04 — Hotspots data stored but never visualised

**Detail:**

`reportData.hotspots` is populated on every report generation with geographic
data (district name, lat/lon, severity, cases). Currently this array is stored
but no UI component reads it.

**Enhancement:**

Add a "Map" tab to `ReportDetailModal` showing hotspot markers. The hotspot
data has `severity` (critical/high/moderate/low) and coordinates — sufficient
for a simple pin map using Leaflet or a similar lightweight library already
available in the project.

Alternatively, if adding a map is out of scope, at minimum show a hotspot
count badge and list in the Alerts tab.

---

### UI-05 — Supervisor reports page is a stub

**File:** [frontend/app/(dashboard)/supervisor/reports/page.tsx](frontend/app/(dashboard)/supervisor/reports/page.tsx)

The supervisor page currently renders a placeholder ("Reports coming soon").
Supervisors have read-only access to reports (can list and view but not
generate/approve/delete per the `RolesGuard` on the controller). The page
should render the same report list and detail modal as the admin page, with
the generate/approve/delete actions hidden.

The simplest approach: extract a shared `<ReportsList>` component from the
admin page and render it on both pages, passing an `isAdmin` prop that
conditionally shows the action buttons.

---

### UI-06 — Search only covers title/week/year

**File:** [frontend/app/(dashboard)/admin/reports/page.tsx](frontend/app/(dashboard)/admin/reports/page.tsx) lines ~84-88

Current filter:
```typescript
const filtered = reports.filter((r) =>
  `${r.title} week ${r.weekNumber} ${r.year}`.toLowerCase().includes(...)
);
```

Could also include status and creator name for more useful search:
```typescript
`${r.title} week ${r.weekNumber} ${r.year} ${r.status} ${r.createdBy?.name ?? ''}`
```

---

## 5. Schema / API Enhancements

---

### SCHEMA-01 — Add `report_type` column to `weekly_reports`

**Detail:**

`reportType` ('historical' | 'predicted') is currently only stored inside the
`report_data` JSONB column. To filter or sort reports by type at the database
level (e.g., "show only predicted reports"), a dedicated column is needed.

**Migration:**
```sql
ALTER TABLE weekly_reports
  ADD COLUMN report_type VARCHAR(20) NOT NULL DEFAULT 'predicted';
```

Update entity:
```typescript
@Column({ name: 'report_type', type: 'varchar', length: 20, default: 'predicted' })
reportType: 'historical' | 'predicted';
```

Populate from `reportData.reportType` in `generateReport` when saving.

---

### SCHEMA-02 — Add `total_current_cases` column

**Detail:**

`totalCurrentCases` (actual cases for the current week in predicted reports)
is stored only inside `reportData.totalCurrentCases` (JSONB). It is a
first-class aggregate metric — having it as a proper column would allow
efficient querying and display in the table without loading the full JSONB.

```sql
ALTER TABLE weekly_reports
  ADD COLUMN total_current_cases INTEGER;  -- NULL for historical reports
```

---

### API-01 — Add filter parameters to `GET /api/reports`

**Current:** Returns all reports, no filtering

**Enhancement:** Support query params:
- `?status=pending|approved|archived`
- `?type=historical|predicted` (requires SCHEMA-01)
- `?year=2025`

This avoids loading all reports into the frontend for client-side filtering
and will matter as the report archive grows.

---

## 6. Implementation Priority

| Priority | Item | Effort | Impact | Status |
|---|---|---|---|---|
| P0 | BUG-01 — Alert `message` field mismatch | XS | Alerts are blank in UI and PDF | ✅ Done |
| P0 | BUG-02 — Alerts use all-time avg not 4-week | S | Alert thresholds incorrect | ✅ Done |
| P1 | BUG-03 — Week 53 boundary bug | XS | Silent data loss on year boundary | ✅ Done |
| P1 | BUG-04 — Dashboard summary/hotspots not week-anchored | M | Historical reports store wrong snapshot | ✅ Done |
| P1 | UI-01 — Chart tooltip text | XS | Misleading label on historical charts | ✅ Done |
| P1 | UI-02 — Report type + created-by columns in table | S | Missing audit/context info | ✅ Done |
| P2 | BUG-05 — highRiskDistricts threshold inconsistency | S | Confusing number mismatch | ✅ Done |
| P2 | GAP-01 — "Normal" alerts slip through filter | XS | Misleading moderate alerts | ✅ Done |
| P2 | UI-03 — Summary data not displayed | M | Rich data stored but hidden | ✅ Done |
| P2 | UI-05 — Supervisor page is a stub | M | Feature unusable for supervisors | ✅ Done |
| P3 | SCHEMA-01 — `report_type` column | S | Enables DB-level filtering | Pending |
| P3 | SCHEMA-02 — `total_current_cases` column | S | Enables efficient list queries | Pending |
| P3 | API-01 — Filter params on list endpoint | S | Performance at scale | Pending |
| P3 | UI-04 — Hotspots map tab | L | Nice-to-have visualisation | Pending |
| P3 | UI-06 — Search includes status/creator | XS | Minor UX improvement | ✅ Done |
| P3 | GAP-03 — Show confidence column | S | Prediction transparency | ✅ Done |

**Effort:** XS < 1h | S = 1-2h | M = 2-4h | L = 4h+

---

## 7. Testing Checklist

After implementing fixes, verify the following end-to-end scenarios:

- [x] Generate a **historical** report for a past week → alerts show description text, no blank cards
- [x] Generate a **predicted** report for current/future week → "Current Week (Actual)" stat visible, previous week comparison correct
- [x] Generate a report for **Week 1** of a year where prior year had 53 weeks (e.g., generate Week 1, 2021) → `totalCurrentCases` populated from Week 53, 2020
- [x] Alert severity: district with 50-99 cases NOT above 1.5× avg → classified as "High Cases" (moderate), not "Normal"
- [ ] Two reports generated for the same week → second attempt returns 409 Conflict
- [ ] Approve a report → `approved_at`, `approved_by_id` persisted and shown in UI
- [ ] Delete a report with an S3 PDF → S3 object removed, row deleted
- [x] Supervisor visits `/supervisor/reports` → list visible, no generate/approve/delete buttons
- [x] Chart tooltip on historical report → shows "Reported Cases" not "Predicted Cases"
- [x] Districts table shows "Actual" (green) badge for historical rows, "medium" (blue) for predicted
- [x] Summary tab shows week-on-week change %, previous total, district count, and avg temperature
- [x] Admin reports table shows Type badge (Historical/Predicted) and Created By column
- [x] Search filter matches on status and creator name in addition to week/year/title
