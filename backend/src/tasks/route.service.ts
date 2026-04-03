import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Task } from './entities/task.entity';
import { RouteResult, RouteLeg } from './dto/route-tasks.dto';

interface TaskCoord {
  id: string;
  lat: number;
  lng: number;
}

// OSRM /table response
interface OsrmTableResponse {
  code: string;
  durations: number[][];
  distances: number[][];
}

// OSRM /route response
interface OsrmRouteResponse {
  code: string;
  routes: Array<{
    legs: Array<{
      duration: number;
      distance: number;
    }>;
    geometry: {
      coordinates: [number, number][];
    };
  }>;
}

function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Rough estimate: average driving speed 40 km/h on Sri Lanka roads
const AVG_SPEED_MS = (40 * 1000) / 3600;

function buildHaversineMatrix(coords: TaskCoord[]): number[][] {
  return coords.map((from) =>
    coords.map((to) => {
      const dist = haversineMeters(from.lat, from.lng, to.lat, to.lng);
      // Convert distance to approximate duration (seconds) for the optimizer
      return Math.round(dist / AVG_SPEED_MS);
    }),
  );
}

@Injectable()
export class RouteService {
  private readonly logger = new Logger(RouteService.name);
  private readonly optimizerUrl =
    process.env.ROUTE_OPTIMIZER_URL || 'http://localhost:8001';
  private readonly osrmUrl =
    process.env.OSRM_BASE_URL || 'http://localhost:5000';

  constructor(
    @InjectRepository(Task)
    private taskRepository: Repository<Task>,
  ) {}

  async optimizeRoute(
    taskIds: string[],
    originLat?: number,
    originLng?: number,
  ): Promise<RouteResult> {
    // 1. Load task coordinates from DB
    const tasks = await this.taskRepository
      .createQueryBuilder('task')
      .select(['task.id', 'task.latitude', 'task.longitude'])
      .whereInIds(taskIds)
      .getMany();

    const taskMap = new Map(tasks.map((t) => [t.id, t]));

    const tasksWithoutLocation: string[] = [];
    const coords: TaskCoord[] = [];

    // Prepend origin if provided (will be index 0 in matrix)
    if (originLat !== undefined && originLng !== undefined) {
      coords.push({ id: '__origin__', lat: originLat, lng: originLng });
    }

    for (const id of taskIds) {
      const task = taskMap.get(id);
      if (!task || task.latitude === null || task.longitude === null) {
        tasksWithoutLocation.push(id);
      } else {
        coords.push({ id, lat: Number(task.latitude), lng: Number(task.longitude) });
      }
    }

    // Return original order if nothing is routable
    if (coords.length <= 1) {
      return {
        orderedTaskIds: taskIds.filter((id) => !tasksWithoutLocation.includes(id)),
        legs: [],
        totalDistanceMeters: null,
        totalDurationSecs: null,
        polyline: [],
        routingUnavailable: true,
        tasksWithoutLocation,
      };
    }

    // 2. Build duration matrix (OSRM /table, fallback to Haversine)
    let durationMatrix: number[][];
    let osrmAvailable = false;

    try {
      durationMatrix = await this.fetchOsrmTable(coords);
      osrmAvailable = true;
    } catch (err) {
      this.logger.warn(`OSRM /table unavailable, falling back to Haversine: ${err.message}`);
      durationMatrix = buildHaversineMatrix(coords);
    }

    // 3. POST duration matrix to route-optimizer
    let orderedIndices: number[];
    try {
      orderedIndices = await this.fetchOptimizedOrder(durationMatrix);
    } catch (err) {
      this.logger.warn(`route-optimizer unavailable, returning original order: ${err.message}`);
      // Return tasks in original order (skip origin index if present)
      const startIdx = originLat !== undefined ? 1 : 0;
      return {
        orderedTaskIds: coords.slice(startIdx).map((c) => c.id),
        legs: [],
        totalDistanceMeters: null,
        totalDurationSecs: null,
        polyline: [],
        routingUnavailable: true,
        tasksWithoutLocation,
      };
    }

    // Strip origin (index 0) from the returned order if it was prepended
    const hasOrigin = originLat !== undefined && originLng !== undefined;
    const taskIndices = hasOrigin
      ? orderedIndices.filter((i) => i !== 0).map((i) => i - 1)
      : orderedIndices;

    const orderedCoords = taskIndices.map((i) => coords[hasOrigin ? i + 1 : i]);
    const orderedTaskIds = orderedCoords.map((c) => c.id);

    // 4. Fetch road polyline + per-leg data from OSRM /route (ordered coords)
    //    Fall back gracefully if OSRM unavailable
    if (!osrmAvailable) {
      const legs = this.buildLegsFromMatrix(orderedIndices, durationMatrix, hasOrigin, coords);
      const total = legs.reduce(
        (acc, l) => ({ dist: acc.dist + l.distanceMeters, dur: acc.dur + l.durationSecs }),
        { dist: 0, dur: 0 },
      );
      return {
        orderedTaskIds,
        legs,
        totalDistanceMeters: total.dist,
        totalDurationSecs: total.dur,
        polyline: [],
        routingUnavailable: true,
        tasksWithoutLocation,
      };
    }

    try {
      const routeCoords = hasOrigin
        ? [coords[0], ...orderedCoords]
        : orderedCoords;
      const { legs, polyline } = await this.fetchOsrmRoute(routeCoords);
      const total = legs.reduce(
        (acc, l) => ({ dist: acc.dist + l.distanceMeters, dur: acc.dur + l.durationSecs }),
        { dist: 0, dur: 0 },
      );
      return {
        orderedTaskIds,
        legs,
        totalDistanceMeters: total.dist,
        totalDurationSecs: total.dur,
        polyline,
        routingUnavailable: false,
        tasksWithoutLocation,
      };
    } catch (err) {
      this.logger.warn(`OSRM /route unavailable, returning order without polyline: ${err.message}`);
      const legs = this.buildLegsFromMatrix(orderedIndices, durationMatrix, hasOrigin, coords);
      const total = legs.reduce(
        (acc, l) => ({ dist: acc.dist + l.distanceMeters, dur: acc.dur + l.durationSecs }),
        { dist: 0, dur: 0 },
      );
      return {
        orderedTaskIds,
        legs,
        totalDistanceMeters: total.dist,
        totalDurationSecs: total.dur,
        polyline: [],
        routingUnavailable: true,
        tasksWithoutLocation,
      };
    }
  }

  private async fetchOsrmTable(coords: TaskCoord[]): Promise<number[][]> {
    const coordStr = coords.map((c) => `${c.lng},${c.lat}`).join(';');
    const url = `${this.osrmUrl}/table/v1/driving/${coordStr}?annotations=duration,distance`;

    const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!response.ok) {
      throw new Error(`OSRM /table returned ${response.status}`);
    }

    const data: OsrmTableResponse = await response.json();
    if (data.code !== 'Ok' || !data.durations) {
      throw new Error(`OSRM /table error: ${data.code}`);
    }

    // Round to integers (OR-Tools expects integer costs)
    return data.durations.map((row) => row.map((v) => Math.round(v)));
  }

  private async fetchOptimizedOrder(durationMatrix: number[][]): Promise<number[]> {
    const response = await fetch(`${this.optimizerUrl}/optimize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ duration_matrix: durationMatrix }),
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      throw new Error(`route-optimizer returned ${response.status}`);
    }

    const data: { ordered_indices: number[] } = await response.json();
    return data.ordered_indices;
  }

  private async fetchOsrmRoute(
    coords: TaskCoord[],
  ): Promise<{ legs: RouteLeg[]; polyline: [number, number][] }> {
    const coordStr = coords.map((c) => `${c.lng},${c.lat}`).join(';');
    const url = `${this.osrmUrl}/route/v1/driving/${coordStr}?overview=full&geometries=geojson`;

    const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!response.ok) {
      throw new Error(`OSRM /route returned ${response.status}`);
    }

    const data: OsrmRouteResponse = await response.json();
    if (data.code !== 'Ok' || !data.routes?.length) {
      throw new Error(`OSRM /route error: ${data.code}`);
    }

    const route = data.routes[0];
    const legs: RouteLeg[] = route.legs.map((leg) => ({
      distanceMeters: Math.round(leg.distance),
      durationSecs: Math.round(leg.duration),
    }));

    // GeoJSON coordinates are [lng, lat] — keep as-is for MapLibre
    const polyline = route.geometry.coordinates;

    return { legs, polyline };
  }

  /**
   * Build leg estimates from the duration matrix when OSRM /route is unavailable.
   * Distances are approximated from Haversine; durations come from the matrix.
   */
  private buildLegsFromMatrix(
    orderedIndices: number[],
    durationMatrix: number[][],
    hasOrigin: boolean,
    coords: TaskCoord[],
  ): RouteLeg[] {
    const fullOrder = hasOrigin
      ? [0, ...orderedIndices.filter((i) => i !== 0)]
      : orderedIndices;

    const legs: RouteLeg[] = [];
    for (let i = 0; i < fullOrder.length - 1; i++) {
      const from = fullOrder[i];
      const to = fullOrder[i + 1];
      const durationSecs = durationMatrix[from][to];
      const distanceMeters = Math.round(haversineMeters(
        coords[from].lat, coords[from].lng,
        coords[to].lat, coords[to].lng,
      ));
      legs.push({ distanceMeters, durationSecs });
    }
    return legs;
  }
}
