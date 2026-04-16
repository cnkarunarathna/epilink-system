"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Search,
  RefreshCw,
  Loader2,
  ArrowRight,
  Clock,
  Play,
  Upload,
  CheckCircle2,
  XCircle,
  MapPin,
} from "lucide-react";
import {
  fetchTasks,
  Task,
  TaskStatus,
  TaskType,
  getStatusColor,
  getPriorityColor,
} from "@/services/tasks.service";
import { useAuth } from "@/contexts/AuthContext";
import { useSocketEvent } from "@/hooks/useSocket";
import { useUnread } from "@/contexts/UnreadContext";
import { toast } from "sonner";

export default function PHITasksPage() {
  const { user } = useAuth();
  const { counts, refreshCounts } = useUnread();
  const [loading, setLoading] = useState(true);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("active");
  const [typeFilter, setTypeFilter] = useState<TaskType | "all">("all");

  const loadTasks = useCallback(async () => {
    if (!user?.id) return;
    try {
      setLoading(true);
      const data = await fetchTasks({ assignedPhiId: user.id });
      setTasks(data);
      if (data.length > 0) {
        refreshCounts(data.map((t) => t.id));
      }
    } catch (error) {
      console.error("Failed to load tasks:", error);
      toast.error("Failed to load tasks");
    } finally {
      setLoading(false);
    }
  }, [user?.id, refreshCounts]);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  // WebSocket listeners
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

  // Filter tasks
  const filteredTasks = tasks.filter((task) => {
    // Search filter
    const matchesSearch =
      searchQuery === "" ||
      task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      task.address?.toLowerCase().includes(searchQuery.toLowerCase());

    // Status filter
    let matchesStatus = true;
    if (statusFilter === "active") {
      matchesStatus =
        task.status === TaskStatus.ASSIGNED ||
        task.status === TaskStatus.IN_PROGRESS ||
        task.status === TaskStatus.REJECTED;
    } else if (statusFilter === "submitted") {
      matchesStatus = task.status === TaskStatus.SUBMITTED;
    } else if (statusFilter === "completed") {
      matchesStatus =
        task.status === TaskStatus.COMPLETED ||
        task.status === TaskStatus.VERIFIED;
    } else if (statusFilter !== "all") {
      matchesStatus = task.status === statusFilter;
    }

    // Type filter
    const matchesType = typeFilter === "all" || task.type === typeFilter;

    return matchesSearch && matchesStatus && matchesType;
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
      case TaskStatus.ASSIGNED:
        return <Clock className="h-4 w-4 text-blue-500" />;
      case TaskStatus.IN_PROGRESS:
        return <Play className="h-4 w-4 text-yellow-500" />;
      case TaskStatus.SUBMITTED:
        return <Upload className="h-4 w-4 text-purple-500" />;
      case TaskStatus.REJECTED:
        return <XCircle className="h-4 w-4 text-red-500" />;
      case TaskStatus.VERIFIED:
      case TaskStatus.COMPLETED:
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      default:
        return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">My Tasks</h2>
          <p className="text-muted-foreground">
            {tasks.length} total tasks assigned to you
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

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search tasks..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select
          value={statusFilter}
          onValueChange={(value) => setStatusFilter(value)}
        >
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="submitted">Submitted</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={typeFilter}
          onValueChange={(value) => setTypeFilter(value as TaskType | "all")}
        >
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Type" />
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
      </div>

      {/* Tasks List */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredTasks.length > 0 ? (
            <div className="divide-y">
              {filteredTasks.map((task) => (
                <Link key={task.id} href={`/phi/tasks/${task.id}`}>
                  <div className="flex items-center justify-between p-4 hover:bg-accent transition-colors cursor-pointer">
                    <div className="flex items-start gap-3">
                      {getStatusIcon(task.status)}
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <p className="font-medium">{task.title}</p>
                          <span
                            className={`text-xs font-semibold capitalize px-1.5 py-0.5 rounded ${getPriorityColor(task.priority)}`}
                          >
                            {task.priority}
                          </span>
                          {(counts[task.id] ?? 0) > 0 && (
                            <Badge variant="destructive" className="text-xs px-1.5 py-0">
                              {(counts[task.id] ?? 0) > 99 ? "99+" : counts[task.id]}
                            </Badge>
                          )}
                        </div>
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
                        {task.dueDate && (
                          <p className="text-xs text-muted-foreground">
                            Due: {formatDate(task.dueDate)}
                          </p>
                        )}
                        {task.status === TaskStatus.REJECTED &&
                          task.rejectionReason && (
                            <p className="text-xs text-red-600">
                              Rejected: {task.rejectionReason}
                            </p>
                          )}
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
              <CheckCircle2 className="h-10 w-10 mx-auto mb-2 opacity-50" />
              <p>No tasks found</p>
              <p className="text-xs mt-1">
                {searchQuery || statusFilter !== "active"
                  ? "Try adjusting your filters"
                  : "No tasks assigned to you yet"}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
