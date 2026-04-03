"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, RefreshCw, MapPin, Route, X } from "lucide-react";
import {
  fetchTasks,
  getOptimizedRoute,
  Task,
  TaskStatus,
  RouteResult,
} from "@/services/tasks.service";
import { TasksMap } from "@/components/tasks/TasksMap";
import { RouteMap } from "@/components/tasks/RouteMap";
import { useAuth } from "@/contexts/AuthContext";
import { useSocketEvent } from "@/hooks/useSocket";
import { toast } from "sonner";

export default function PHIMapViewPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [tasks, setTasks] = useState<Task[]>([]);

  // Route mode
  const [routeMode, setRouteMode] = useState(false);
  const [routeLoading, setRouteLoading] = useState(false);
  const [routeResult, setRouteResult] = useState<RouteResult | null>(null);
  const recalcTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadTasks = useCallback(async () => {
    if (!user?.id) return;
    try {
      setLoading(true);
      const data = await fetchTasks({ assignedPhiId: user.id });
      setTasks(data);
    } catch {
      toast.error("Failed to load tasks");
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  const activeTasks = tasks.filter(
    (t) => t.status !== TaskStatus.COMPLETED && t.status !== TaskStatus.VERIFIED,
  );

  const routableTaskIds = activeTasks
    .filter((t) => t.latitude !== null && t.longitude !== null)
    .map((t) => t.id);

  const fetchRoute = useCallback(async () => {
    if (routableTaskIds.length < 2) {
      toast.info("Need at least 2 tasks with locations to optimize a route.");
      return;
    }
    setRouteLoading(true);
    try {
      // Request browser geolocation as origin if available
      let origin: { lat: number; lng: number } | undefined;
      try {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            timeout: 4000,
          }),
        );
        origin = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      } catch {
        // geolocation denied or unavailable — proceed without origin
      }

      const result = await getOptimizedRoute(routableTaskIds, origin);
      setRouteResult(result);
      setRouteMode(true);

      if (result.routingUnavailable) {
        toast.warning("Road routing unavailable — showing estimated order.");
      }
    } catch {
      toast.error("Failed to optimize route. Please try again.");
    } finally {
      setRouteLoading(false);
    }
  }, [routableTaskIds]);

  const exitRouteMode = useCallback(() => {
    setRouteMode(false);
    setRouteResult(null);
  }, []);

  // WebSocket: keep tasks in sync
  const handleTaskCreated = useCallback(
    (newTask: Task) => {
      if (newTask.assignedPhiId === user?.id) {
        setTasks((prev) => [newTask, ...prev]);
        toast.success(`New task assigned: ${newTask.title}`);
      }
    },
    [user?.id],
  );

  const handleTaskUpdated = useCallback(
    (updatedTask: Task) => {
      if (updatedTask.assignedPhiId === user?.id) {
        setTasks((prev) =>
          prev.map((t) => (t.id === updatedTask.id ? updatedTask : t)),
        );
      }
    },
    [user?.id],
  );

  const handleTaskStatusChanged = useCallback(
    (data: { task: Task }) => {
      if (data.task.assignedPhiId === user?.id) {
        setTasks((prev) =>
          prev.map((t) => (t.id === data.task.id ? data.task : t)),
        );
      }
    },
    [user?.id],
  );

  const handleTaskAssigned = useCallback(
    (data: { task: Task; phiId: string }) => {
      if (data.phiId === user?.id) {
        setTasks((prev) => {
          const exists = prev.some((t) => t.id === data.task.id);
          if (exists) {
            return prev.map((t) => (t.id === data.task.id ? data.task : t));
          }
          return [data.task, ...prev];
        });
        toast.success(`New task assigned: ${data.task.title}`);
      }
    },
    [user?.id],
  );

  const handleTaskDeleted = useCallback((data: { taskId: string }) => {
    setTasks((prev) => {
      const task = prev.find((t) => t.id === data.taskId);
      if (task) toast.info(`Task "${task.title}" was removed`);
      return prev.filter((t) => t.id !== data.taskId);
    });
  }, []);

  // Debounced route recalculation when in route mode and tasks change via WebSocket
  const scheduleRecalc = useCallback(() => {
    if (!routeMode) return;
    if (recalcTimerRef.current) clearTimeout(recalcTimerRef.current);
    recalcTimerRef.current = setTimeout(() => {
      fetchRoute();
    }, 2000);
  }, [routeMode, fetchRoute]);

  useSocketEvent("task:created", (t: Task) => { handleTaskCreated(t); scheduleRecalc(); }, [handleTaskCreated, scheduleRecalc]);
  useSocketEvent("task:updated", (t: Task) => { handleTaskUpdated(t); scheduleRecalc(); }, [handleTaskUpdated, scheduleRecalc]);
  useSocketEvent("task:status-changed", (d: { task: Task }) => { handleTaskStatusChanged(d); scheduleRecalc(); }, [handleTaskStatusChanged, scheduleRecalc]);
  useSocketEvent("task:assigned", handleTaskAssigned, [handleTaskAssigned]);
  useSocketEvent("task:deleted", handleTaskDeleted, [handleTaskDeleted]);

  const tasksWithLocation = activeTasks.filter(
    (t) => t.latitude !== null && t.longitude !== null,
  );

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">
            {routeMode ? "Optimized Route" : "Map View"}
          </h2>
          <p className="text-muted-foreground">
            {routeMode && routeResult
              ? `${routeResult.orderedTaskIds.length} stops in optimized order`
              : `${tasksWithLocation.length} active task${tasksWithLocation.length !== 1 ? "s" : ""} on map`}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {routeMode ? (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={fetchRoute}
                disabled={routeLoading}
              >
                {routeLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                <span className="ml-1.5 hidden sm:inline">Recalculate</span>
              </Button>
              <Button variant="outline" size="sm" onClick={exitRouteMode}>
                <X className="h-4 w-4" />
                <span className="ml-1.5 hidden sm:inline">Exit Route</span>
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="default"
                size="sm"
                onClick={fetchRoute}
                disabled={routeLoading || routableTaskIds.length < 2}
              >
                {routeLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Route className="h-4 w-4" />
                )}
                <span className="ml-1.5">Optimize Route</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={loadTasks}
                disabled={loading}
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Map */}
      <Card>
        <CardContent className="p-4">
          {loading ? (
            <div
              className="flex items-center justify-center"
              style={{ height: 600 }}
            >
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : routeMode && routeResult ? (
            <RouteMap
              tasks={activeTasks}
              routeResult={routeResult}
              height={600}
              basePath="/phi/tasks"
            />
          ) : activeTasks.length > 0 ? (
            <TasksMap tasks={activeTasks} height={600} basePath="/phi/tasks" />
          ) : (
            <div
              className="flex flex-col items-center justify-center py-16 text-muted-foreground"
              style={{ height: 400 }}
            >
              <MapPin className="h-12 w-12 mb-3 opacity-50" />
              <p className="text-lg font-medium">No active tasks</p>
              <p className="text-sm">
                Tasks assigned to you will appear here on the map
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
