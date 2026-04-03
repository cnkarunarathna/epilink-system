# Route Optimization for PHI Task Management

## Overview

This document describes the design and implementation plan for route optimization in the EpiLink PHI task management system. The feature enables Public Health Inspectors (PHIs) to complete their daily assigned tasks in the most efficient geographic order, reducing travel time and fuel costs.

---

## Problem Statement

PHIs are assigned multiple tasks (CLEANUP, FOGGING, INSPECTION, INVESTIGATION) within their district each day. Currently there is no mechanism to suggest the optimal visiting order. PHIs plan their own routes manually, often resulting in:

- Unnecessary backtracking across the district
- Suboptimal fuel/time expenditure
- No single-tap navigation support from a task list
- Supervisors unable to estimate realistic daily workloads based on geography

---

## Scope

### In Scope
- Backend route optimization endpoint using an open-source routing engine
- PHI mobile app: "Optimized Route" view showing tasks in suggested order with one-tap navigation
- PHI web dashboard: route visualization on the existing map view
- Supervisor web dashboard: route preview when assigning multiple tasks to a PHI in one batch
- Route recalculation when a task is completed or a new urgent task is added mid-day

### Out of Scope (v1)
- Turn-by-turn navigation (handled by device-native apps via deep links)
- Multi-PHI vehicle routing optimization (VRP)
- Traffic-aware routing
- Automated task batching / AI-driven assignment suggestions

---

## Current System Touchpoints

| Layer | File | Relevance |
|---|---|---|
| Task entity | `backend/src/tasks/entities/task.entity.ts` | Has `latitude`, `longitude` (decimal 10,7) per task |
| Task service | `backend/src/tasks/tasks.service.ts` | `getPhisByDistrict()`, `assignTask()`, `findAll()` |
| Task controller | `backend/src/tasks/tasks.controller.ts` | Where the new route endpoint will be added |
| Geocoding service | `backend/src/tasks/geocoding.service.ts` | Nominatim integration; rate-limited |
| Tasks map | `frontend/components/tasks/TasksMap.tsx` | MapLibre GL map; already renders task markers with popups |
| PHI map page | `frontend/app/(dashboard)/phi/map/page.tsx` | Existing PHI map view — primary home for route display |
| PHI tasks list | `frontend/app/(dashboard)/phi/tasks/page.tsx` | Source of the task list fed into route planning |
| WebSocket events | `backend/src/events/events.gateway.ts` | Real-time task updates; route should refresh on events |
| Mobile app | `mobile/` | React Native app; will add route view here |

---

## Architecture

### Routing Engine: OSRM (Open Source Routing Machine)

OSRM is the chosen routing engine because:
- Free, no API key, no rate limits
- Uses OpenStreetMap data (same source as Nominatim already in use)
- Provides a `trip` service that solves the Traveling Salesman Problem (TSP) using the Christofides heuristic
- Docker image available (`osrm/osrm-backend`) — fits existing docker-compose setup
- Returns actual road distances and durations, not crow-fly

**OSRM Services used:**
- `GET /trip/v1/driving/{coordinates}` — optimized waypoint ordering (TSP)
- `GET /route/v1/driving/{coordinates}` — road geometry for a fixed ordered sequence

**Sri Lanka OSM data** (~70 MB extract) will be pre-processed and embedded in the OSRM container.

### High-Level Flow

```
PHI opens "My Route" view
        │
        ▼
Frontend fetches assigned tasks (existing /api/tasks endpoint)
        │
        ▼
Frontend calls POST /api/tasks/route  ──► Backend RouteService
        │                                       │
        │                               Extract lat/lng from tasks
        │                                       │
        │                               Call OSRM /trip endpoint
        │                                       │
        │                               OSRM returns ordered waypoints
        │                                       │
        │                               Call OSRM /route for geometry
        │                               (polyline for map display)
        │                                       │
        ◄───────────────────────────────────────┘
        │
        ▼
Frontend renders:
  - Numbered markers on map in optimized order
  - Ordered task list (reordered)
  - ETA and total distance summary
  - "Navigate" deep-link button per task
```

---

## Implementation Plan

### Phase 1 — Backend: Route Service & Endpoint

#### 1.1 Add OSRM to docker-compose

File: `docker-compose.yml`

Add a new service:
```yaml
osrm:
  image: osrm/osrm-backend
  container_name: epilink-osrm
  volumes:
    - ./osrm-data:/data
  command: osrm-routed --algorithm mld /data/sri-lanka-latest.osrm
  ports:
    - "5000:5000"
  restart: unless-stopped
```

Add a setup script `scripts/prepare-osrm.sh` that:
1. Downloads `sri-lanka-latest.osm.pbf` from Geofabrik
2. Runs `osrm-extract`, `osrm-partition`, `osrm-customize`
3. Outputs processed files to `./osrm-data/`

#### 1.2 Create `RouteService`

File: `backend/src/tasks/route.service.ts`

```typescript
// Responsibilities:
// - Accept an ordered array of task IDs
// - Fetch their lat/lng from DB
// - Call OSRM /trip service to get the optimal visit order
// - Call OSRM /route service to get the road polyline geometry
// - Return ordered task IDs, leg durations (seconds), leg distances (meters),
//   total duration, total distance, and encoded polyline

interface RouteResult {
  orderedTaskIds: string[];
  legs: Array<{ durationSecs: number; distanceMeters: number }>;
  totalDurationSecs: number;
  totalDistanceMeters: number;
  polyline: [number, number][]; // decoded coordinates for MapLibre
}
```

**Error handling:**
- Tasks missing coordinates → exclude from OSRM call, flag in response
- OSRM unavailable → return tasks in original order with a `routingUnavailable: true` flag (graceful degradation)
- Single task → return immediately without calling OSRM

#### 1.3 Add DTO

File: `backend/src/tasks/dto/route-tasks.dto.ts`

```typescript
class RouteTasksDto {
  @IsArray()
  @IsUUID('4', { each: true })
  taskIds: string[];

  @IsOptional()
  @IsNumber()
  originLat?: number;   // PHI's current location (optional)

  @IsOptional()
  @IsNumber()
  originLng?: number;
}
```

#### 1.4 Add Controller Endpoint

File: `backend/src/tasks/tasks.controller.ts`

```
POST /api/tasks/route
Body: RouteTasksDto
Auth: JWT required (PHI or SUPERVISOR)
Returns: RouteResult
```

Guards: `JwtAuthGuard` only — both PHI and SUPERVISOR roles can call this.

#### 1.5 Wire into TasksModule

File: `backend/src/tasks/tasks.module.ts`
- Register `RouteService` as a provider
- Add `HttpModule` (or use Axios directly, consistent with `GeocodingService`)

---

### Phase 2 — Frontend: PHI Web Route View

#### 2.1 Extend Tasks Service

File: `frontend/services/tasks.service.ts`

Add:
```typescript
export async function getOptimizedRoute(
  taskIds: string[],
  origin?: { lat: number; lng: number }
): Promise<RouteResult>
```

#### 2.2 Create `RouteMap` Component

File: `frontend/components/tasks/RouteMap.tsx`

Built on top of the existing `map.tsx` MapLibre wrapper.

Features:
- Render numbered markers (1, 2, 3…) in optimized visit order using the existing `MapMarker` system
- Draw the road polyline as a MapLibre `LineLayer` (blue, 3px)
- Show task popups on marker click (reuse existing popup structure from `TasksMap.tsx`)
- Start-point marker (PHI current location, if provided)
- Summary panel overlay: total distance (km), estimated time (hh:mm)

#### 2.3 Update PHI Map Page

File: `frontend/app/(dashboard)/phi/map/page.tsx`

Add a "Optimize Route" button above the map. On click:
1. Collect IDs of all `ASSIGNED` and `IN_PROGRESS` tasks
2. Optionally request geolocation for the origin point
3. Call `getOptimizedRoute()`
4. Switch map to `RouteMap` view
5. Render an ordered task list sidebar alongside the map with ETAs per stop

State:
```typescript
const [routeMode, setRouteMode] = useState(false);
const [routeResult, setRouteResult] = useState<RouteResult | null>(null);
```

#### 2.4 "Navigate" Deep Link

In the ordered task list sidebar, each task row has a "Navigate" button:
```
https://www.google.com/maps/dir/?api=1&destination={lat},{lng}&travelmode=driving
```
Opens Google Maps (or device default) with the task location pre-filled.

#### 2.5 Auto-Recalculate on WebSocket Events

The existing `useSocketEvent` hook in `SocketContext` already listens for `task:assigned` and `task:status_changed`. When the user is in route mode, subscribe to these events and silently recalculate the route (debounced 2s to avoid flicker).

---

### Phase 3 — Supervisor Route Preview

#### 3.1 Bulk Assign + Route Preview

File: `frontend/app/(dashboard)/supervisor/tasks/page.tsx`

Add a "Bulk Assign" mode:
1. Supervisor selects multiple tasks via checkboxes
2. Chooses a PHI from a dropdown
3. Clicks "Preview Route" → calls `getOptimizedRoute()` for those task IDs
4. A modal opens showing `RouteMap` with the proposed task order and total time/distance
5. Supervisor confirms → calls `assignTask()` for each task ID in the optimized order (preserving order in task notes or a new `routeOrder` field)

---

### Phase 4 — Mobile App Route View

File additions under `mobile/`:

#### 4.1 Route API call
Add `getOptimizedRoute()` to mobile task service (mirrors frontend service).

#### 4.2 Route Screen
New screen: `mobile/screens/RouteScreen.tsx` (or equivalent mobile routing)

Features:
- MapLibre (or Mapbox React Native) map with numbered markers and polyline
- Scrollable ordered list below map
- "Start Navigation" button per task → deep links to Google Maps / Apple Maps
- "Mark Complete" shortcut directly from route view → calls `updateTaskStatus(id, IN_PROGRESS)` inline

#### 4.3 Navigation Entry Point
Add "My Route" tab or button on PHI home screen / task list.

---

### Phase 5 — Route Order Persistence (Optional Enhancement)

If supervisors want to lock in a specific visit order (not always the OSRM-optimal one), add a `routeOrder` integer column to the `tasks` table:

```sql
ALTER TABLE tasks ADD COLUMN route_order INTEGER;
```

This allows a supervisor to save a planned order and have the PHI's route view respect it instead of recalculating from scratch every time.

---

## Database Changes

| Change | Type | Migration needed |
|---|---|---|
| `route_order INTEGER` column on `tasks` | Optional (Phase 5) | Yes — addColumn migration |
| No other schema changes | — | — |

For Phases 1–4, all routing data is computed on-the-fly and returned in API responses. Nothing is persisted.

---

## API Reference

### `POST /api/tasks/route`

**Auth:** JWT (PHI, SUPERVISOR, ADMIN)

**Request body:**
```json
{
  "taskIds": ["uuid-1", "uuid-2", "uuid-3"],
  "originLat": 6.9271,
  "originLng": 79.8612
}
```

**Response 200:**
```json
{
  "orderedTaskIds": ["uuid-2", "uuid-1", "uuid-3"],
  "legs": [
    { "durationSecs": 420, "distanceMeters": 3200 },
    { "durationSecs": 600, "distanceMeters": 5100 }
  ],
  "totalDurationSecs": 1020,
  "totalDistanceMeters": 8300,
  "polyline": [[79.86, 6.93], [79.87, 6.92], ...],
  "routingUnavailable": false,
  "tasksWithoutLocation": []
}
```

**Response 200 (OSRM unavailable — graceful degradation):**
```json
{
  "orderedTaskIds": ["uuid-1", "uuid-2", "uuid-3"],
  "legs": [],
  "totalDurationSecs": null,
  "totalDistanceMeters": null,
  "polyline": [],
  "routingUnavailable": true,
  "tasksWithoutLocation": []
}
```

---

## UI/UX Design Notes

### PHI Route View (Web)

```
┌──────────────────────────────────────────────────────────┐
│  My Route Today          [Optimize Route]  [Refresh]     │
├──────────────────┬───────────────────────────────────────┤
│  Route Summary   │                                       │
│  ──────────────  │           MAP (RouteMap)              │
│  ① Task A  15min │    ①──────②                           │
│  ② Task B  22min │   /        \                          │
│  ③ Task C  10min │  ③──────────                          │
│                  │                                       │
│  Total: 8.3km    │                                       │
│  ~47 min         │                                       │
│                  │                                       │
│  [Navigate ①]    │                                       │
│  [Navigate ②]    │                                       │
│  [Navigate ③]    │                                       │
└──────────────────┴───────────────────────────────────────┘
```

### Marker Style
- Numbered circles (1, 2, 3…) in task-status color, replacing the generic dot
- Active/current task: pulsing ring (reuse existing URGENT animation)
- Completed task: green checkmark overlay

---

## Environment Variables

Add to `backend/.env` and `docker-compose.yml`:

```
OSRM_BASE_URL=http://osrm:5000
```

---

## Testing Plan

| Area | What to test |
|---|---|
| `RouteService` unit tests | Correct OSRM URL construction; graceful degradation when OSRM returns 503; tasks with missing coords excluded correctly |
| `POST /api/tasks/route` e2e | Auth guard (401 without token); valid request returns ordered IDs; empty taskIds returns 400 |
| `RouteMap` component | Renders correct number of markers; polyline source added to map; summary panel shows formatted distance/time |
| PHI map page | "Optimize Route" button triggers API call; WebSocket event triggers recalculation; route mode toggle |
| OSRM container | Sri Lanka OSM data loads; `/trip` endpoint returns valid response for Colombo coordinates |

---

## Rollout Order

1. **Sprint 1** — Backend: OSRM docker service + OSM data prep + `RouteService` + `POST /api/tasks/route`
2. **Sprint 2** — Frontend PHI web: `RouteMap` component + PHI map page integration + Navigate deep links
3. **Sprint 3** — Frontend Supervisor: Bulk assign with route preview modal
4. **Sprint 4** — Mobile: Route screen + navigation deep links
5. **Sprint 5 (optional)** — `route_order` persistence + supervisor route editing

---

## Open Questions

1. **OSRM data freshness**: Sri Lanka OSM extract should be refreshed monthly. Is there an automated pipeline for this, or will it be a manual step?
2. **PHI start location**: Should the route always start from the PHI's current GPS position, or from a fixed "home base" (e.g., the district health office)? The API supports both — UI decision needed.
3. **Round trip vs one-way**: Should the route end back at the start point? OSRM `trip` service supports `roundtrip=false`. Default to one-way for v1.
4. **Task count limit**: OSRM `trip` handles up to ~10 waypoints well. Above that, consider splitting into morning/afternoon batches. PHIs in this system typically have 3–8 tasks/day based on current task data.
5. **Offline mobile support**: Can the mobile app cache the last route for offline access? OSRM responses are small (~5KB) so this is feasible with AsyncStorage.
