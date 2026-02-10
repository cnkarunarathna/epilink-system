"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, RefreshCw, MapPin } from "lucide-react";
import { fetchTasks, Task } from "@/services/tasks.service";
import { TasksMap } from "@/components/tasks/TasksMap";
import { useAuth } from "@/contexts/AuthContext";
import { useSocketEvent } from "@/hooks/useSocket";
import { toast } from "sonner";

export default function PHIMapViewPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [tasks, setTasks] = useState<Task[]>([]);

  const loadTasks = useCallback(async () => {
    if (!user?.id) return;
    try {
      setLoading(true);
      const data = await fetchTasks({ assignedPhiId: user.id });
      setTasks(data);
    } catch (error) {
      console.error("Failed to load tasks:", error);
      toast.error("Failed to load tasks");
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

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

  useSocketEvent("task:created", handleTaskCreated, [handleTaskCreated]);
  useSocketEvent("task:updated", handleTaskUpdated, [handleTaskUpdated]);
  useSocketEvent("task:status-changed", handleTaskStatusChanged, [
    handleTaskStatusChanged,
  ]);

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
      if (task) {
        toast.info(`Task "${task.title}" was removed`);
      }
      return prev.filter((t) => t.id !== data.taskId);
    });
  }, []);

  useSocketEvent("task:assigned", handleTaskAssigned, [handleTaskAssigned]);
  useSocketEvent("task:deleted", handleTaskDeleted, [handleTaskDeleted]);

  // Filter only active tasks (not completed)
  const activeTasks = tasks.filter(
    (t) => t.status !== "completed" && t.status !== "verified",
  );

  const tasksWithLocation = activeTasks.filter(
    (t) => t.latitude !== null && t.longitude !== null,
  );

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Map View</h2>
          <p className="text-muted-foreground">
            {tasksWithLocation.length} active task
            {tasksWithLocation.length !== 1 ? "s" : ""} on map
          </p>
        </div>
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
      </div>

      {/* Map */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div
              className="flex items-center justify-center"
              style={{ height: 600 }}
            >
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
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
