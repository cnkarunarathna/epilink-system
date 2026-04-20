"use client";

import { useMemo } from "react";
import { MapPin, Navigation, AlertCircle, Clock, Ruler } from "lucide-react";
import {
  Map as RouteMapView,
  MapMarker,
  MarkerContent,
  MarkerPopup,
  MapControls,
  MapRoute,
} from "@/components/ui/map";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import {
  Task,
  TaskStatus,
  RouteResult,
  getStatusColor,
} from "@/services/tasks.service";
import Link from "next/link";
import { useTheme } from "next-themes";

interface RouteMapProps {
  tasks: Task[];
  routeResult: RouteResult;
  className?: string;
  height?: string | number;
  basePath?: string;
}

function formatDuration(secs: number): string {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function formatDistance(meters: number): string {
  if (meters >= 1000) return `${(meters / 1000).toFixed(1)} km`;
  return `${meters} m`;
}

const statusLabels: Record<TaskStatus, string> = {
  [TaskStatus.PENDING]: "Pending",
  [TaskStatus.ASSIGNED]: "Assigned",
  [TaskStatus.IN_PROGRESS]: "In Progress",
  [TaskStatus.SUBMITTED]: "Submitted",
  [TaskStatus.VERIFIED]: "Verified",
  [TaskStatus.COMPLETED]: "Completed",
  [TaskStatus.REJECTED]: "Rejected",
};

export function RouteMap({
  tasks,
  routeResult,
  className,
  height = 500,
  basePath = "/phi/tasks",
}: RouteMapProps) {
  const { resolvedTheme } = useTheme();

  const taskById = useMemo(
    () => new globalThis.Map<string, Task>(tasks.map((t) => [t.id, t])),
    [tasks],
  );

  const routeColors = useMemo(
    () =>
      resolvedTheme === "dark"
        ? {
            halo: "#f8fafc",
            line: "#60a5fa",
          }
        : {
            halo: "#0f172a",
            line: "#1d4ed8",
          },
    [resolvedTheme],
  );

  // Build ordered task list, preserving only tasks present in orderedTaskIds
  const orderedTasks = useMemo(
    () =>
      routeResult.orderedTaskIds
        .map((id) => taskById.get(id))
        .filter((t): t is Task => t !== undefined),
    [routeResult.orderedTaskIds, taskById],
  );

  const mapCenter = useMemo<[number, number]>(() => {
    const withCoords = orderedTasks.filter(
      (t) => t.latitude !== null && t.longitude !== null,
    );
    if (withCoords.length === 0) return [80.7718, 7.8731];
    const avgLng =
      withCoords.reduce((s, t) => s + Number(t.longitude), 0) /
      withCoords.length;
    const avgLat =
      withCoords.reduce((s, t) => s + Number(t.latitude), 0) /
      withCoords.length;
    return [avgLng, avgLat];
  }, [orderedTasks]);

  return (
    <div className="space-y-3">
      {/* Unavailability notice */}
      {routeResult.routingUnavailable && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Road routing is unavailable. Showing estimated straight-line
            distances.
          </AlertDescription>
        </Alert>
      )}

      {/* Route summary bar */}
      {(routeResult.totalDistanceMeters !== null ||
        routeResult.totalDurationSecs !== null) && (
        <div className="flex items-center gap-4 text-sm text-muted-foreground px-1">
          {routeResult.totalDurationSecs !== null && (
            <span className="flex items-center gap-1.5">
              <Clock className="h-4 w-4" />
              {formatDuration(routeResult.totalDurationSecs)}
            </span>
          )}
          {routeResult.totalDistanceMeters !== null && (
            <span className="flex items-center gap-1.5">
              <Ruler className="h-4 w-4" />
              {formatDistance(routeResult.totalDistanceMeters)}
            </span>
          )}
          <span className="text-xs">
            {orderedTasks.length} stop{orderedTasks.length !== 1 ? "s" : ""}
          </span>
        </div>
      )}

      {/* Map */}
      <div
        className={cn("relative rounded-lg overflow-hidden border", className)}
        style={{ height: typeof height === "number" ? `${height}px` : height }}
      >
        <RouteMapView center={mapCenter} zoom={10} minZoom={6} maxZoom={18}>
          {/* Road polyline */}
          {routeResult.polyline.length > 1 && (
            <>
              <MapRoute
                coordinates={routeResult.polyline}
                color={routeColors.halo}
                width={8}
                opacity={0.3}
                interactive={false}
              />
              <MapRoute
                coordinates={routeResult.polyline}
                color={routeColors.line}
                width={4}
                opacity={0.95}
                interactive={false}
              />
            </>
          )}

          {/* Numbered markers in optimized order */}
          {orderedTasks.map((task, index) => {
            if (task.latitude === null || task.longitude === null) return null;
            const leg = routeResult.legs[index];
            const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${task.latitude},${task.longitude}&travelmode=driving`;

            return (
              <MapMarker
                key={task.id}
                longitude={Number(task.longitude)}
                latitude={Number(task.latitude)}
              >
                <MarkerContent>
                  <div
                    className={cn(
                      "relative h-7 w-7 rounded-full flex items-center justify-center shadow-lg cursor-pointer transition-transform hover:scale-110 border-2 border-white",
                      task.status === TaskStatus.COMPLETED ||
                        task.status === TaskStatus.VERIFIED
                        ? "bg-green-500"
                        : "bg-blue-600",
                    )}
                  >
                    <span className="text-white text-[11px] font-bold leading-none">
                      {index + 1}
                    </span>
                  </div>
                </MarkerContent>

                <MarkerPopup closeButton>
                  <div className="min-w-[200px] max-w-[280px] space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white text-[10px] font-bold">
                        {index + 1}
                      </span>
                      <p className="font-semibold text-sm line-clamp-2">
                        {task.title}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Badge
                        className={cn(
                          "text-[10px]",
                          getStatusColor(task.status),
                        )}
                      >
                        {statusLabels[task.status]}
                      </Badge>
                      <span className="capitalize">{task.type}</span>
                    </div>

                    {task.address && (
                      <div className="flex items-start gap-1.5 text-xs text-muted-foreground">
                        <MapPin className="h-3 w-3 mt-0.5 shrink-0" />
                        <span className="line-clamp-2">{task.address}</span>
                      </div>
                    )}

                    {leg && (
                      <div className="flex items-center gap-3 text-xs text-muted-foreground border-t pt-2">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatDuration(leg.durationSecs)}
                        </span>
                        <span className="flex items-center gap-1">
                          <Ruler className="h-3 w-3" />
                          {formatDistance(leg.distanceMeters)}
                        </span>
                      </div>
                    )}

                    <div className="flex gap-2 pt-1 border-t">
                      <Link
                        href={googleMapsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1"
                      >
                        <Button
                          size="sm"
                          variant="default"
                          className="w-full h-7 text-xs"
                        >
                          <Navigation className="h-3 w-3 mr-1" />
                          Navigate
                        </Button>
                      </Link>
                      <Link href={`${basePath}/${task.id}`} className="flex-1">
                        <Button
                          size="sm"
                          variant="outline"
                          className="w-full h-7 text-xs"
                        >
                          Details
                        </Button>
                      </Link>
                    </div>
                  </div>
                </MarkerPopup>
              </MapMarker>
            );
          })}

          <MapControls position="bottom-right" showZoom />
        </RouteMapView>
      </div>

      {/* Tasks without location warning */}
      {routeResult.tasksWithoutLocation.length > 0 && (
        <p className="text-xs text-muted-foreground px-1">
          {routeResult.tasksWithoutLocation.length} task
          {routeResult.tasksWithoutLocation.length !== 1 ? "s" : ""} excluded
          (no location set).
        </p>
      )}
    </div>
  );
}

export default RouteMap;
