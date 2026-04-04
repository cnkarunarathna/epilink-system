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
- Python route optimization microservice using Google OR-Tools
- Backend route endpoint that calls the microservice and returns ordered task IDs with ETAs
- PHI mobile app: "Optimized Route" view showing tasks in suggested order with one-tap navigation
- PHI web dashboard: route visualization on the existing map view
- Supervisor web dashboard: route preview when assigning multiple tasks to a PHI in one batch
- Route recalculation when a task is completed or a new urgent task is added mid-day

### Out of Scope (v1)
- Turn-by-turn navigation (handled by device-native apps via deep links)
- Traffic-aware routing
- Road geometry polylines on map (v1 uses straight lines; v2 can add OSRM for road snapping)

### Upgrade path (v2)
- Multi-PHI vehicle routing optimization (VRP) — OR-Tools supports this natively
- Time-window constraints (task must be visited between 9am–12pm)
- Priority-weighted routing (URGENT tasks first)

These are v2 additions that OR-Tools handles naturally, which is the main reason to choose it over OSRM's simpler built-in TSP.

---

## Tool Choice: OR-Tools vs OSRM

These two tools solve different sub-problems and are not direct replacements:

| | OR-Tools | OSRM |
|---|---|---|
| **What it does** | Solves combinatorial optimization (TSP, VRP) | Calculates road distances & solves TSP via `/trip` |
| **Input** | A distance/time matrix you provide | GPS coordinates (builds matrix internally from OSM) |
| **Distance accuracy** | Depends on input matrix | Real road distances from OSM |
| **Language** | Python (primary), C++, Java | C++ service, HTTP API |
| **Node.js support** | No maintained binding — needs a microservice | Direct HTTP call from NestJS |
| **Multi-vehicle VRP** | Yes (built-in) | No |
| **Time windows** | Yes (built-in) | No |
| **Infrastructure** | Python process only | Requires pre-processed OSM map data (~70 MB for Sri Lanka) |

**Decision**: Use OR-Tools with an OSRM-sourced distance matrix (real road times).

OR-Tools does not calculate distances — it only solves the ordering problem. The accuracy of the route depends entirely on what matrix you feed into it:

| Matrix source | Distance accuracy | ETA accuracy | Infrastructure |
|---|---|---|---|
| Haversine (straight-line) | ~15–30% shorter than real roads | Poor | None |
| **OSRM `/table`** (chosen) | **Actual road distances** | **Realistic** | OSRM container + Sri Lanka OSM |
| Google Maps Distance Matrix | Actual road distances | Good | API key + per-request cost |

OSRM is added to docker-compose to provide two things:
1. **`/table`** — N×N real road time/distance matrix fed into OR-Tools for accurate optimization
2. **`/route`** — road-snapped polyline geometry for drawing the route on the map

OR-Tools remains the solver regardless. This separation means the optimization logic can later be upgraded to multi-PHI VRP without changing how distances are calculated.

---

## Architecture

### Components

```
┌──────────────────────────────────────────────────────────────────┐
│                        NestJS Backend                            │
│                                                                  │
│  POST /api/tasks/route                                           │
│       │                                                          │
│  RouteService                                                    │
│    1. Fetch task coords from DB                                  │
│    2. Call OSRM /table  →  N×N real road time matrix  ─────────► OSRM
│    3. POST matrix to route-optimizer:8000/optimize  ───────────► Python
│    4. OR-Tools returns optimal ordered indices              ◄─── OR-Tools
│    5. Call OSRM /route (ordered coords)  →  road polyline  ────► OSRM
│    6. Map indices → task IDs, attach leg durations/distances     │
│    7. Return RouteResult to frontend                             │
└──────────────────────────────────────────────────────────────────┘
```

### New Service: `route-optimizer` (Python + FastAPI + OR-Tools)

A lightweight Python microservice added to docker-compose alongside the existing backend, frontend, postgres, and redis containers.

**Tech stack:**
- Python 3.12
- FastAPI (HTTP server)
- `ortools` (`google-or-tools` PyPI package)
- No database — stateless, purely computational

**Single endpoint:**
```
POST /optimize
```

Accepts a distance matrix and returns the optimal visit order.

---

## High-Level Request Flow

```
PHI opens "My Route" view
        │
        ▼
Frontend fetches assigned tasks  →  GET /api/tasks (existing)
        │
        ▼
Frontend calls POST /api/tasks/route
        │
        ▼
NestJS RouteService:
  ① Load task lat/lng from DB (already stored on each task)
  ② GET osrm:5000/table/v1/driving/{all coords}
     → N×N matrix of real road durations (seconds) and distances (meters)
  ③ POST duration matrix to route-optimizer:8000/optimize
  ④ OR-Tools solves TSP, returns ordered indices
  ⑤ GET osrm:5000/route/v1/driving/{coords in optimized order}
     → road-snapped polyline + per-leg duration/distance
  ⑥ Map indices → task IDs
  ⑦ Return RouteResult (ordered IDs + leg durations/distances + polyline)
        │
        ▼
Frontend renders:
  - Numbered markers on map in optimized order
  - Road-snapped polyline drawn on map (MapLibre LineLayer)
  - Ordered task list with realistic per-leg ETA
  - "Navigate" deep-link per task → Google Maps
```

---

## Implementation Plan

### Phase 1 — Python Route Optimizer Microservice ✅ Complete

#### 1.1 Service directory structure

```
route-optimizer/
├── main.py              # FastAPI app
├── optimizer.py         # OR-Tools TSP solver
├── requirements.txt     # ortools, fastapi, uvicorn
└── Dockerfile
```

#### 1.2 `optimizer.py` — OR-Tools TSP solver

```python
from ortools.constraint_solver import routing_enums_pb2
from ortools.constraint_solver import pywrapcp

def solve_tsp(distance_matrix: list[list[int]]) -> list[int]:
    """
    Given an N×N distance matrix (integers, meters or scaled),
    return the optimal visit order as a list of indices.
    Index 0 is treated as the depot (PHI start location or first task).
    """
    manager = pywrapcp.RoutingIndexManager(len(distance_matrix), 1, 0)
    routing = pywrapcp.RoutingModel(manager)

    def distance_callback(from_idx, to_idx):
        return distance_matrix[manager.IndexToNode(from_idx)][manager.IndexToNode(to_idx)]

    transit_callback_index = routing.RegisterTransitCallback(distance_callback)
    routing.SetArcCostEvaluatorOfAllVehicles(transit_callback_index)

    search_params = pywrapcp.DefaultRoutingSearchParameters()
    search_params.first_solution_strategy = (
        routing_enums_pb2.FirstSolutionStrategy.PATH_CHEAPEST_ARC
    )
    search_params.local_search_metaheuristic = (
        routing_enums_pb2.LocalSearchMetaheuristic.GUIDED_LOCAL_SEARCH
    )
    search_params.time_limit.seconds = 2  # hard cap — responds in <2s always

    solution = routing.SolveWithParameters(search_params)
    if not solution:
        return list(range(len(distance_matrix)))  # fallback: original order

    order = []
    index = routing.Start(0)
    while not routing.IsEnd(index):
        order.append(manager.IndexToNode(index))
        index = solution.Value(routing.NextVar(index))
    return order
```

**Why `PATH_CHEAPEST_ARC` + `GUIDED_LOCAL_SEARCH`**: fast initial solution, then local improvement. For N ≤ 15 (max realistic PHI daily tasks) this converges well within the 2s cap.

#### 1.3 `main.py` — FastAPI endpoint

```python
from fastapi import FastAPI
from pydantic import BaseModel
from optimizer import solve_tsp

app = FastAPI()

class OptimizeRequest(BaseModel):
    distance_matrix: list[list[int]]  # meters, integers

class OptimizeResponse(BaseModel):
    ordered_indices: list[int]

@app.post("/optimize", response_model=OptimizeResponse)
def optimize(req: OptimizeRequest):
    ordered = solve_tsp(req.distance_matrix)
    return OptimizeResponse(ordered_indices=ordered)

@app.get("/health")
def health():
    return {"status": "ok"}
```

#### 1.4 `Dockerfile`

```dockerfile
FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

#### 1.5 `requirements.txt`

```
ortools==9.10.4067
fastapi==0.115.0
uvicorn==0.30.6
pydantic==2.9.2
```

#### 1.6 Add to `docker-compose.yml`

```yaml
route-optimizer:
  build: ./route-optimizer
  container_name: epilink-route-optimizer
  ports:
    - "8000:8000"
  restart: unless-stopped
  healthcheck:
    test: ["CMD", "curl", "-f", "http://localhost:8000/health"]
    interval: 30s
    timeout: 5s
    retries: 3

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

Add a one-time setup script `scripts/prepare-osrm.sh`:
```bash
# Downloads Sri Lanka OSM extract (~70 MB) and pre-processes it for OSRM
wget -O osrm-data/sri-lanka-latest.osm.pbf \
  https://download.geofabrik.de/asia/sri-lanka-latest.osm.pbf

docker run -t -v $(pwd)/osrm-data:/data osrm/osrm-backend \
  osrm-extract -p /opt/car.lua /data/sri-lanka-latest.osm.pbf
docker run -t -v $(pwd)/osrm-data:/data osrm/osrm-backend \
  osrm-partition /data/sri-lanka-latest.osrm
docker run -t -v $(pwd)/osrm-data:/data osrm/osrm-backend \
  osrm-customize /data/sri-lanka-latest.osrm
```
This runs once. The processed files in `./osrm-data/` are reused on every container start.

---

### Phase 2 — NestJS Backend: RouteService & Endpoint ✅ Complete

#### 2.1 `RouteService`

File: `backend/src/tasks/route.service.ts`

```typescript
// Responsibilities:
// 1. Accept task IDs + optional PHI origin
// 2. Load lat/lng for each task from DB
// 3. Call OSRM /table → real road duration matrix (N×N, seconds)
// 4. POST duration matrix to route-optimizer:8000/optimize
// 5. OR-Tools returns optimal ordered indices
// 6. Call OSRM /route (ordered coords) → road polyline + per-leg durations/distances
// 7. Map indices → task IDs
// 8. Return RouteResult — gracefully degrade if either service is unreachable

interface RouteResult {
  orderedTaskIds: string[];
  legs: Array<{ distanceMeters: number; durationSecs: number }>;
  totalDistanceMeters: number;
  totalDurationSecs: number;
  polyline: [number, number][];   // road-snapped coordinates for MapLibre LineLayer
  routingUnavailable: boolean;    // true if OSRM or optimizer unreachable
  tasksWithoutLocation: string[]; // task IDs excluded due to missing coords
}
```

**Graceful degradation**:
- If OSRM `/table` fails → fall back to Haversine matrix, set `routingUnavailable: true`
- If `route-optimizer` fails → return tasks in original order, set `routingUnavailable: true`
- Either failure degrades silently; the PHI still sees their task list unblocked

**OSRM calls made by `RouteService`**:
```
// Step 1: get real road time matrix
GET osrm:5000/table/v1/driving/{lng,lat;lng,lat;...}?annotations=duration,distance

// Step 2: get road polyline for the optimized order
GET osrm:5000/route/v1/driving/{lng,lat;lng,lat;...}?overview=full&geometries=geojson
```

#### 2.2 DTO

File: `backend/src/tasks/dto/route-tasks.dto.ts`

```typescript
class RouteTasksDto {
  @IsArray()
  @IsUUID('4', { each: true })
  taskIds: string[];

  @IsOptional()
  @IsNumber()
  originLat?: number;   // PHI current position — prepended as waypoint index 0

  @IsOptional()
  @IsNumber()
  originLng?: number;
}
```

When `originLat`/`originLng` are provided, the origin is inserted as index 0 in the distance matrix. OR-Tools routes from there and the origin point is stripped from the returned `orderedTaskIds` (it's not a task).

#### 2.4 Controller endpoint

File: `backend/src/tasks/tasks.controller.ts`

```
POST /api/tasks/route
Auth: JwtAuthGuard (PHI, SUPERVISOR, ADMIN)
Body: RouteTasksDto
Returns: RouteResult
```

#### 2.5 Environment variables

Add to `backend/.env`:
```
ROUTE_OPTIMIZER_URL=http://route-optimizer:8000
OSRM_BASE_URL=http://osrm:5000
```

`ROUTE_AVG_SPEED_KMH` is no longer needed — real durations come directly from OSRM.

---

### Phase 3 — Frontend: PHI Web Route View ✅ Complete

#### 3.1 Extend tasks service

File: `frontend/services/tasks.service.ts`

```typescript
export async function getOptimizedRoute(
  taskIds: string[],
  origin?: { lat: number; lng: number },
): Promise<RouteResult>
```

#### 3.2 `RouteMap` component

File: `frontend/components/tasks/RouteMap.tsx`

Built on top of the existing `map.tsx` MapLibre wrapper.

Features:
- Numbered markers (1, 2, 3…) using the existing `MapMarker` system, in optimized visit order
- Road-snapped polyline from OSRM as a MapLibre `LineLayer` (blue, 3px)
- Reuse existing task popup structure from `TasksMap.tsx`
- Optional origin pin (current PHI location)
- Summary overlay: total distance (km), estimated time (hh:mm)

#### 3.3 Update PHI map page

File: `frontend/app/(dashboard)/phi/map/page.tsx`

Add an "Optimize Route" button. On click:
1. Collect IDs of all `ASSIGNED` and `IN_PROGRESS` tasks
2. Optionally request browser geolocation for origin
3. Call `getOptimizedRoute()`
4. Switch map to `RouteMap`
5. Show ordered task list sidebar with per-stop ETAs

```typescript
const [routeMode, setRouteMode] = useState(false);
const [routeResult, setRouteResult] = useState<RouteResult | null>(null);
```

#### 3.4 Navigate deep link

Each task in the route sidebar:
```
https://www.google.com/maps/dir/?api=1&destination={lat},{lng}&travelmode=driving
```

#### 3.5 Auto-recalculate on WebSocket events

Use the existing `useSocketEvent` hook to listen for `task:assigned` and `task:status_changed`. When in route mode, re-call `getOptimizedRoute()` debounced by 2 seconds.

---

### Phase 4 — Supervisor Route Preview ✅ Complete

File: `frontend/app/(dashboard)/supervisor/tasks/page.tsx`

Add a "Bulk Assign" mode:
1. Supervisor selects multiple tasks via checkboxes
2. Chooses a PHI from a dropdown
3. Clicks "Preview Route" → calls `getOptimizedRoute()` for those task IDs
4. A modal shows `RouteMap` with the proposed visit order, total time and distance
5. Supervisor confirms → calls `assignTask()` for each task ID

---

### Phase 5 — Mobile App Route View ✅ Complete

File additions under `mobile/`:

#### 5.1 Route API call
Add `getOptimizedRoute()` to mobile task service (mirrors frontend service).

#### 5.2 Route screen
New screen: `mobile/screens/RouteScreen` (or equivalent)

Features:
- Map with numbered markers and connecting lines
- Scrollable ordered task list below map
- "Start Navigation" → deep links to Google Maps / Apple Maps
- "Mark as Done" shortcut → calls `updateTaskStatus()` inline

#### 5.3 Entry point
Add "My Route" tab or floating action button on PHI task list screen.

---

### Phase 6 — Route Order Persistence (Optional Enhancement) ⏳ Pending

If supervisors want to lock in a custom visit order that overrides the optimizer, add a `route_order` integer column to the `tasks` table:

```sql
ALTER TABLE tasks ADD COLUMN route_order INTEGER;
```

This allows a supervisor to save a planned order. The PHI's route view reads `route_order` instead of re-running optimization on every load.

---

## Database Changes

| Change | Type | Migration needed |
|---|---|---|
| No schema changes for Phases 1–5 | — | No |
| `route_order INTEGER` column (Phase 6, optional) | Enhancement | Yes — addColumn migration |

All routing data is computed on-the-fly. Nothing is persisted.

---

## API Reference

### `POST /api/tasks/route`

**Auth:** JWT (PHI, SUPERVISOR, ADMIN)

**Request:**
```json
{
  "taskIds": ["uuid-1", "uuid-2", "uuid-3"],
  "originLat": 6.9271,
  "originLng": 79.8612
}
```

**Response 200 (success):**
```json
{
  "orderedTaskIds": ["uuid-2", "uuid-1", "uuid-3"],
  "legs": [
    { "distanceMeters": 3200, "durationSecs": 384 },
    { "distanceMeters": 5100, "durationSecs": 612 }
  ],
  "totalDistanceMeters": 8300,
  "totalDurationSecs": 996,
  "polyline": [[79.861, 6.927], [79.864, 6.924], ...],
  "routingUnavailable": false,
  "tasksWithoutLocation": []
}
```

`legs` durations and distances come directly from OSRM `/route` — actual road values, not estimates.

**Response 200 (optimizer down — graceful degradation):**
```json
{
  "orderedTaskIds": ["uuid-1", "uuid-2", "uuid-3"],
  "legs": [],
  "totalDistanceMeters": null,
  "totalDurationSecs": null,
  "routingUnavailable": true,
  "tasksWithoutLocation": []
}
```

### Internal: `POST route-optimizer:8000/optimize`

```json
// Request
{ "distance_matrix": [[0, 3200, 8300], [3200, 0, 5100], [8300, 5100, 0]] }

// Response
{ "ordered_indices": [1, 0, 2] }
```

---

## UI/UX Design Notes

### PHI Route View

```
┌──────────────────────────────────────────────────────────┐
│  My Route Today          [Optimize Route]  [Refresh]     │
├──────────────────┬───────────────────────────────────────┤
│  Route Summary   │                                       │
│  ──────────────  │           MAP (RouteMap)              │
│  ① Task A  15min │    ①~~~~~~②                           │
│  ② Task B  22min │   /        \                          │
│  ③ Task C  10min │  ③~~~~~~~~~~                          │
│                  │                                       │
│  Total: 8.3km    │  (road-snapped polyline from OSRM)   │
│  ~47 min         │                                       │
│  [Navigate ①]    │                                       │
│  [Navigate ②]    │                                       │
│  [Navigate ③]    │                                       │
└──────────────────┴───────────────────────────────────────┘
```

### Marker Style
- Numbered circles (1, 2, 3…) in task-status color, replacing the generic dot
- Active/current task: pulsing ring (reuse existing URGENT animation)
- Completed task: green checkmark overlay on the number

---

## Testing Plan

| Area | What to test |
|---|---|
| `optimizer.py` unit | Correct order for known triangle; N=1 returns `[0]`; 2s time cap respected |
| `solve_tsp` fallback | Returns original order when solution not found |
| `RouteService` unit | OSRM `/table` call correctly formatted; graceful degrade when OSRM down; graceful degrade when optimizer down; origin prepend/strip logic |
| `POST /api/tasks/route` e2e | 401 without JWT; 400 on empty taskIds; correct order returned; polyline present; `tasksWithoutLocation` populated |
| `RouteMap` component | Correct number of markers rendered; polyline LineLayer source added from response; summary panel shows OSRM values |
| PHI map page | Button triggers API call; WebSocket event triggers recalculation |
| Docker health | `route-optimizer` health endpoint returns 200; OSRM `/health` returns 200; both recover after restart |
| OSRM data | `/table` returns valid matrix for known Colombo coords; `/route` returns GeoJSON geometry |

---

## Rollout Order

1. ✅ **Sprint 1** — OSRM docker service + Sri Lanka OSM data prep (`scripts/prepare-osrm.sh`) + `route-optimizer` Python service (OR-Tools)
2. ✅ **Sprint 2** — NestJS `RouteService`: OSRM `/table` → OR-Tools → OSRM `/route` + `POST /api/tasks/route` + graceful degradation
3. ✅ **Sprint 3** — Frontend PHI web: `RouteMap` component + PHI map page integration + navigate deep links
4. ✅ **Sprint 4** — Frontend Supervisor: bulk assign + route preview modal
5. ✅ **Sprint 5** — Mobile: route screen + navigation deep links
6. ⏳ **Sprint 6 (optional)** — `route_order` persistence + supervisor route editing

---

## Open Questions

1. **PHI start location**: Should the route start from the PHI's current GPS position or a fixed home base (district health office)? Both are supported by the API. UI decision needed.
2. **Round trip vs one-way**: Should the route end back at the start? OR-Tools supports both. Default one-way for v1.
3. **Optimizer timeout budget**: 2s is the hard cap in OR-Tools. For N ≤ 15 this is more than enough. Should the NestJS HTTP timeout to the optimizer be 3s (adds 1s network headroom)?
4. **OSRM data freshness**: Sri Lanka OSM extract should be refreshed periodically. Is there an automated pipeline for this, or a manual step?
5. **Offline mobile caching**: Route responses are small (~2KB). Cache last result in AsyncStorage for offline access?
6. **VRP upgrade timeline**: OR-Tools VRP (multiple PHIs) is the main v2 upgrade. When does this become a priority?
