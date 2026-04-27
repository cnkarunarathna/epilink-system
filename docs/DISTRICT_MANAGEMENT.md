# District Management — Admin Dashboard Implementation Plan

## Overview

The district management page (`/admin/districts`) is the admin's primary interface for monitoring all 25 Sri Lankan districts across 9 provinces. It surfaces dengue risk levels, case trends, task load, and personnel coverage per district in one place.

The page currently has static data for 8 of 25 districts, a non-functional search, and no live API integration. This plan builds it out in five phases, each independently shippable.

---

## Phase 1 — Static Foundation - Done

**Goal:** Fix correctness issues and establish the full 25-district data structure before connecting any APIs.

### What changes

**Create `frontend/lib/constants/districts.ts`**

A typed constant file containing all 25 districts with their province, district code, and population (2012 census). This file is the single source of truth for static district metadata across the app.

```ts
export interface DistrictMeta {
  id: number;
  name: string;
  code: string;
  province: string;
  population: number;
}
```

Districts by province:

| Province      | Districts                                         |
| ------------- | ------------------------------------------------- |
| Western       | Colombo, Gampaha, Kalutara                        |
| Central       | Kandy, Matale, Nuwara Eliya                       |
| Southern      | Galle, Matara, Hambantota                         |
| Northern      | Jaffna, Kilinochchi, Mannar, Mullaitivu, Vavuniya |
| Eastern       | Ampara, Batticaloa, Trincomalee                   |
| North Western | Kurunegala, Puttalam                              |
| North Central | Anuradhapura, Polonnaruwa                         |
| Uva           | Badulla, Monaragala                               |
| Sabaragamuwa  | Kegalle, Ratnapura                                |

**Modify `frontend/app/(dashboard)/admin/districts/page.tsx`**

- Replace the hardcoded 8-district array with the 25-district constant
- Wire `searchQuery` to actually filter the table by district name or province
- Add a **Province** filter `<Select>` dropdown beside the search input (9 provinces + "All")
- Add a **Province** column to the table
- Remove the "Add District" button — Sri Lanka's 25 districts are fixed administrative boundaries; the button implies creation which isn't applicable here
- Remove `TrendingUp` / `TrendingDown` icons and trend column for now (will be data-driven in Phase 2)

**Acceptance criteria**

- All 25 districts appear in the table
- Search filters by district name (case-insensitive)
- Province filter narrows the table correctly
- Stats card "Total Districts" shows 25; "Coverage" shows 100%

---

## Phase 2 — Live Data Integration - Done

**Goal:** Replace all static mock values with real data from existing backend and ML service APIs.

### Available APIs (no new backend work required)

| Data needed                                           | Existing endpoint                  | Service function                                     |
| ----------------------------------------------------- | ---------------------------------- | ---------------------------------------------------- |
| Risk level + predicted cases per district             | `GET /analytics/districts/latest`  | `fetchLatestPerDistrict()` in `analytics.service.ts` |
| Task counts per district (active, completed, pending) | `GET /tasks-analytics/by-district` | `fetchByDistrict()` in `task-analytics.service.ts`   |
| PHI count per district                                | `GET /tasks/phis/:districtName`    | `fetchPhisByDistrict()` in `tasks.service.ts`        |
| All users (to derive supervisor per district)         | `GET /users`                       | `usersService.getAll()` in `users.service.ts`        |

### What changes

**Create `frontend/services/districts.service.ts`**

Assembles the composite district view by calling the four APIs above in parallel and joining on district name. Returns a typed `DistrictRow[]` array consumed by the page. This keeps the page component clean of data-fetching logic.

```ts
export interface DistrictRow extends DistrictMeta {
  riskLevel: RiskLevel | null;
  predictedCases: number | null;
  weeklyTrend: number | null; // % change vs previous week
  activeTasks: number;
  completedTasks: number;
  phiCount: number;
  supervisorName: string | null;
}

export async function fetchDistrictRows(): Promise<DistrictRow[]>;
```

**Modify `frontend/app/(dashboard)/admin/districts/page.tsx`**

- Replace static district array with `useEffect` → `fetchDistrictRows()`
- Add loading state using `<Skeleton>` (already used in the users page pattern)
- Add error state with a retry button
- Update stats cards:
  - **High Risk Districts** — count from live `riskLevel === "High"`
  - **Active Tasks (National)** — sum of `activeTasks` across all districts
  - Replace static **MOH Areas (341)** card with **Active PHIs** count
- Restore the trend column with live `weeklyTrend` values (sourced from comparing latest vs previous week in the timeseries)
- Add **Active Tasks** column to the table

**Acceptance criteria**

- Page loads live data on mount with skeleton placeholders during fetch
- Risk badges reflect actual ML predictions
- Task and PHI counts are real
- Stats cards are accurate

---

## Phase 3 — District Detail Drawer - Done

**Goal:** Let admins drill into a single district without leaving the page.

### What changes

**Create `frontend/components/admin/districts/DistrictDetailSheet.tsx`**

A `<Sheet>` (side drawer) that opens when a table row is clicked. Uses the existing Shadcn `Sheet` component already present in the codebase.

Content sections:

1. **Header** — District name, province badge, risk badge
2. **Key metrics row** — Population, incidence rate (cases per 100k), active tasks, PHI count
3. **Risk trend chart** — 8-week sparkline using `fetchTimeseries(districtName)` from `analytics.service.ts`. Render with Recharts `AreaChart` (already in the stack).
4. **Task breakdown** — Three stat tiles: Active / Completed / Pending (from `DistrictSummary`)
5. **Assigned personnel** — Supervisor name + PHI list (names, active status) from `fetchPhisByDistrict()`

The sheet fetches its own data lazily on open so it does not slow down the initial page load.

**Modify `frontend/app/(dashboard)/admin/districts/page.tsx`**

- Add `selectedDistrict: DistrictRow | null` state
- Make table rows clickable (cursor-pointer, `onClick` sets `selectedDistrict`)
- Render `<DistrictDetailSheet>` at the bottom of the page, controlled by `selectedDistrict`
- Replace the current ghost `<Edit>` icon button with a `<ChevronRight>` icon to signal the row opens a detail view

**Acceptance criteria**

- Clicking any row opens the drawer with that district's data
- Trend chart renders correctly for all 25 districts
- Personnel list shows real assigned users
- Drawer closes via the X button or clicking outside

---

## Phase 4 — Population & Incidence Rate - Done

**Goal:** Add epidemiologically meaningful cross-district comparison.

Raw case counts are misleading for comparison — Colombo (2.4M population) will always look worse than Hambantota (600k). Incidence rate (cases per 100,000 population) normalises this.

### What changes

- Population is already included in `DistrictMeta` from Phase 1 (2012 census data, static)
- Add `incidenceRate` computed field to `DistrictRow`:
  ```ts
  incidenceRate = (predictedCases / population) * 100_000;
  ```
- Add **Incidence Rate** column to the table (formatted as `x.x per 100k`)
- Update the stats card currently showing "High Risk Districts count" to also show the **national incidence rate** (total cases / total population × 100k)
- In the District Detail Sheet (Phase 3), surface incidence rate prominently in the key metrics row

**Acceptance criteria**

- Incidence rate column visible and sortable in the table
- National rate shown in stats cards
- Detail sheet shows district-level incidence rate

---

## Phase 5 — CSV Export - Done

**Goal:** Allow admins to export the current district view for MoH reporting.

### What changes

**Modify `frontend/app/(dashboard)/admin/districts/page.tsx`**

- Add a `<Button variant="outline">` with a `Download` icon in the page header area (beside the search/filter row)
- On click, generate a CSV from the currently filtered `DistrictRow[]` array (respects active search and province filter)
- CSV columns: District, Province, Code, Risk Level, Predicted Cases, Incidence Rate (per 100k), Active Tasks, Completed Tasks, PHI Count, Supervisor, Week

Use browser-native CSV generation (no new dependency needed):

```ts
const csv = [headers, ...rows.map(rowToCsv)].join("\n");
const blob = new Blob([csv], { type: "text/csv" });
const url = URL.createObjectURL(blob);
// trigger download via <a> click
```

Filename format: `districts-report-YYYY-WW.csv` (ISO week number).

**Acceptance criteria**

- Export button only appears after data has loaded (not during skeleton state)
- Exported file reflects current filter state
- File opens correctly in Excel / Google Sheets

---

## Implementation Order Summary

| Phase | Files created                                        | Files modified                                                | Dependencies |
| ----- | ---------------------------------------------------- | ------------------------------------------------------------- | ------------ |
| 1     | `lib/constants/districts.ts`                         | `admin/districts/page.tsx`                                    | None         |
| 2     | `services/districts.service.ts`                      | `admin/districts/page.tsx`                                    | Phase 1      |
| 3     | `components/admin/districts/DistrictDetailSheet.tsx` | `admin/districts/page.tsx`                                    | Phase 2      |
| 4     | —                                                    | `districts.service.ts`, `page.tsx`, `DistrictDetailSheet.tsx` | Phases 1–3   |
| 5     | —                                                    | `admin/districts/page.tsx`                                    | Phase 2      |

Phases 4 and 5 are independent of each other and can be built in parallel after Phase 3.
