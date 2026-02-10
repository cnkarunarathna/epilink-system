"use client";

import { useState, useCallback, useMemo } from "react";
import { MapPin, Eye, Calendar, User, AlertCircle } from "lucide-react";
import {
  Map,
  MapMarker,
  MarkerContent,
  MarkerPopup,
  MapControls,
} from "@/components/ui/map";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  Task,
  TaskStatus,
  TaskPriority,
  getStatusColor,
} from "@/services/tasks.service";
import Link from "next/link";

interface TasksMapProps {
  tasks: Task[];
  className?: string;
  height?: string | number;
  onTaskClick?: (task: Task) => void;
}

// Status colors for markers
const statusMarkerColors: Record<TaskStatus, string> = {
  [TaskStatus.PENDING]: "bg-gray-500",
  [TaskStatus.ASSIGNED]: "bg-blue-500",
  [TaskStatus.IN_PROGRESS]: "bg-yellow-500",
  [TaskStatus.SUBMITTED]: "bg-purple-500",
  [TaskStatus.VERIFIED]: "bg-teal-500",
  [TaskStatus.COMPLETED]: "bg-green-500",
  [TaskStatus.REJECTED]: "bg-red-500",
};

// Priority ring colors
const priorityRingColors: Record<TaskPriority, string> = {
  [TaskPriority.LOW]: "",
  [TaskPriority.MEDIUM]: "ring-2 ring-blue-300",
  [TaskPriority.HIGH]: "ring-2 ring-orange-400",
  [TaskPriority.URGENT]: "ring-2 ring-red-500 animate-pulse",
};

// Status display labels
const statusLabels: Record<TaskStatus, string> = {
  [TaskStatus.PENDING]: "Pending",
  [TaskStatus.ASSIGNED]: "Assigned",
  [TaskStatus.IN_PROGRESS]: "In Progress",
  [TaskStatus.SUBMITTED]: "Submitted",
  [TaskStatus.VERIFIED]: "Verified",
  [TaskStatus.COMPLETED]: "Completed",
  [TaskStatus.REJECTED]: "Rejected",
};

export function TasksMap({
  tasks,
  className,
  height = 500,
  onTaskClick,
}: TasksMapProps) {
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  // Filter tasks with valid coordinates
  const tasksWithLocation = useMemo(() => {
    return tasks.filter(
      (task) =>
        task.latitude !== null &&
        task.longitude !== null &&
        !isNaN(Number(task.latitude)) &&
        !isNaN(Number(task.longitude)),
    );
  }, [tasks]);

  // Calculate map center based on tasks
  const mapCenter = useMemo<[number, number]>(() => {
    if (tasksWithLocation.length === 0) {
      return [80.7718, 7.8731]; // Sri Lanka center
    }

    const avgLng =
      tasksWithLocation.reduce((sum, t) => sum + Number(t.longitude), 0) /
      tasksWithLocation.length;
    const avgLat =
      tasksWithLocation.reduce((sum, t) => sum + Number(t.latitude), 0) /
      tasksWithLocation.length;

    return [avgLng, avgLat];
  }, [tasksWithLocation]);

  const handleMarkerClick = useCallback(
    (task: Task) => {
      setSelectedTask(task);
      onTaskClick?.(task);
    },
    [onTaskClick],
  );

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "Not set";
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const isOverdue = (task: Task) => {
    if (!task.dueDate) return false;
    if (
      task.status === TaskStatus.COMPLETED ||
      task.status === TaskStatus.REJECTED
    )
      return false;
    return new Date(task.dueDate) < new Date();
  };

  return (
    <div
      className={cn("relative rounded-lg overflow-hidden border", className)}
      style={{ height: typeof height === "number" ? `${height}px` : height }}
    >
      <Map center={mapCenter} zoom={10} minZoom={6} maxZoom={18}>
        {tasksWithLocation.map((task) => (
          <MapMarker
            key={task.id}
            longitude={Number(task.longitude)}
            latitude={Number(task.latitude)}
            onClick={() => handleMarkerClick(task)}
          >
            <MarkerContent>
              <div
                className={cn(
                  "relative h-6 w-6 rounded-full flex items-center justify-center shadow-lg cursor-pointer transition-transform hover:scale-110",
                  statusMarkerColors[task.status],
                  priorityRingColors[task.priority],
                )}
              >
                <MapPin className="h-3.5 w-3.5 text-white" />
                {isOverdue(task) && (
                  <div className="absolute -top-1 -right-1 h-3 w-3 bg-red-500 rounded-full border border-white flex items-center justify-center">
                    <AlertCircle className="h-2 w-2 text-white" />
                  </div>
                )}
              </div>
            </MarkerContent>

            <MarkerPopup>
              <div className="min-w-[200px] max-w-[280px]">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h3 className="font-semibold text-sm line-clamp-2 flex-1">
                    {task.title}
                  </h3>
                </div>

                <div className="space-y-1.5 text-xs text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <Badge
                      className={cn("text-[10px]", getStatusColor(task.status))}
                    >
                      {statusLabels[task.status]}
                    </Badge>
                    <span className="capitalize">{task.type}</span>
                  </div>

                  {task.assignedPhi && (
                    <div className="flex items-center gap-1.5">
                      <User className="h-3 w-3" />
                      <span>{task.assignedPhi.name}</span>
                    </div>
                  )}

                  <div className="flex items-center gap-1.5">
                    <Calendar className="h-3 w-3" />
                    <span
                      className={
                        isOverdue(task) ? "text-red-500 font-medium" : ""
                      }
                    >
                      Due: {formatDate(task.dueDate)}
                    </span>
                  </div>

                  {task.address && (
                    <div className="flex items-start gap-1.5">
                      <MapPin className="h-3 w-3 mt-0.5 shrink-0" />
                      <span className="line-clamp-2">{task.address}</span>
                    </div>
                  )}
                </div>

                <div className="mt-3 pt-2 border-t">
                  <Link href={`/supervisor/tasks/${task.id}`}>
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full h-7 text-xs"
                    >
                      <Eye className="h-3 w-3 mr-1" />
                      View Details
                    </Button>
                  </Link>
                </div>
              </div>
            </MarkerPopup>
          </MapMarker>
        ))}
        <MapControls position="bottom-right" showZoom />
      </Map>

      {/* Legend */}
      <div className="absolute top-3 right-3 z-10 bg-background/95 backdrop-blur-sm rounded-lg border p-2 shadow-sm">
        <p className="text-[10px] font-medium mb-1.5">Status</p>
        <div className="grid grid-cols-2 gap-x-3 gap-y-1">
          {Object.entries(statusMarkerColors).map(([status, color]) => (
            <div key={status} className="flex items-center gap-1.5">
              <div className={cn("h-2.5 w-2.5 rounded-full", color)} />
              <span className="text-[10px] text-muted-foreground capitalize">
                {statusLabels[status as TaskStatus]}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Task count indicator */}
      <div className="absolute bottom-2 left-2 z-10 bg-background/90 backdrop-blur-sm rounded px-2 py-1 text-xs text-muted-foreground">
        {tasksWithLocation.length} of {tasks.length} tasks with location
      </div>
    </div>
  );
}

export default TasksMap;
