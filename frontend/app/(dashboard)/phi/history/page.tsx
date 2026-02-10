"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  RefreshCw,
  Loader2,
  ArrowRight,
  CheckCircle2,
  Upload,
  XCircle,
  MapPin,
  History,
} from "lucide-react";
import {
  fetchTasks,
  Task,
  TaskStatus,
  TaskType,
  getStatusColor,
} from "@/services/tasks.service";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export default function PHIHistoryPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [typeFilter, setTypeFilter] = useState<TaskType | "all">("all");

  const loadTasks = useCallback(async () => {
    if (!user?.id) return;
    try {
      setLoading(true);
      const data = await fetchTasks({ assignedPhiId: user.id });
      setTasks(data);
    } catch (error) {
      console.error("Failed to load tasks:", error);
      toast.error("Failed to load task history");
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  // Show only completed, verified, and submitted tasks
  const historyTasks = tasks
    .filter((t) => {
      const isHistory =
        t.status === TaskStatus.COMPLETED ||
        t.status === TaskStatus.VERIFIED ||
        t.status === TaskStatus.SUBMITTED;
      const matchesType = typeFilter === "all" || t.type === typeFilter;
      return isHistory && matchesType;
    })
    .sort((a, b) => {
      // Sort by most recent completion/submission first
      const dateA = a.completedAt || a.submittedAt || a.updatedAt;
      const dateB = b.completedAt || b.submittedAt || b.updatedAt;
      return new Date(dateB).getTime() - new Date(dateA).getTime();
    });

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const getStatusIcon = (status: TaskStatus) => {
    switch (status) {
      case TaskStatus.SUBMITTED:
        return <Upload className="h-4 w-4 text-purple-500" />;
      case TaskStatus.VERIFIED:
        return <CheckCircle2 className="h-4 w-4 text-teal-500" />;
      case TaskStatus.COMPLETED:
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      default:
        return <CheckCircle2 className="h-4 w-4 text-muted-foreground" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Task History</h2>
          <p className="text-muted-foreground">
            {historyTasks.length} completed and submitted tasks
          </p>
        </div>
        <div className="flex gap-2">
          <Select
            value={typeFilter}
            onValueChange={(value) => setTypeFilter(value as TaskType | "all")}
          >
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="All Types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              {Object.values(TaskType).map((type) => (
                <SelectItem key={type} value={type}>
                  {type.charAt(0).toUpperCase() + type.slice(1)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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
      </div>

      {/* History List */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : historyTasks.length > 0 ? (
            <div className="divide-y">
              {historyTasks.map((task) => (
                <Link key={task.id} href={`/phi/tasks/${task.id}`}>
                  <div className="flex items-center justify-between p-4 hover:bg-accent transition-colors cursor-pointer">
                    <div className="flex items-start gap-3">
                      {getStatusIcon(task.status)}
                      <div className="space-y-1">
                        <p className="font-medium">{task.title}</p>
                        <p className="text-sm text-muted-foreground">
                          {task.type.charAt(0).toUpperCase() +
                            task.type.slice(1)}
                          {task.address && (
                            <>
                              {" "}
                              <span className="inline-flex items-center gap-1">
                                <MapPin className="h-3 w-3" />
                                {task.address}
                              </span>
                            </>
                          )}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {task.completedAt
                            ? `Completed: ${formatDate(task.completedAt)}`
                            : task.submittedAt
                              ? `Submitted: ${formatDate(task.submittedAt)}`
                              : `Updated: ${formatDate(task.updatedAt)}`}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className={getStatusColor(task.status)}>
                        {task.status.replace("_", " ")}
                      </Badge>
                      <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <History className="h-10 w-10 mx-auto mb-2 opacity-50" />
              <p>No completed tasks yet</p>
              <p className="text-xs mt-1">
                Tasks you complete will appear here
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
