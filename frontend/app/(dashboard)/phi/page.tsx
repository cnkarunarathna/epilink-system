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
import {
  ClipboardCheck,
  Clock,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  RefreshCw,
  Loader2,
  MapPin,
  Play,
  Upload,
  XCircle,
} from "lucide-react";
import {
  fetchTasks,
  Task,
  TaskStatus,
  getStatusColor,
  getPriorityColor,
} from "@/services/tasks.service";
import {
  fetchLatestPerDistrict,
  DistrictLatest,
} from "@/services/analytics.service";
import { useAuth } from "@/contexts/AuthContext";
import { useSocketEvent } from "@/hooks/useSocket";
import { toast } from "sonner";

// Risk level classification
function getRiskLevel(cases: number) {
  if (cases >= 90)
    return {
      level: "Critical",
      color: "text-red-600",
      bg: "bg-red-50 dark:bg-red-900/20",
    };
  if (cases >= 50)
    return {
      level: "High",
      color: "text-orange-500",
      bg: "bg-orange-50 dark:bg-orange-900/20",
    };
  if (cases >= 25)
    return {
      level: "Medium",
      color: "text-yellow-500",
      bg: "bg-yellow-50 dark:bg-yellow-900/20",
    };
  return {
    level: "Low",
    color: "text-green-500",
    bg: "bg-green-50 dark:bg-green-900/20",
  };
}

export default function PHIDashboard() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [districtData, setDistrictData] = useState<DistrictLatest | null>(null);

  const phiDistrict = user?.district || "Colombo";

  const loadDashboardData = useCallback(async () => {
    if (!user?.id) return;
    try {
      setLoading(true);
      const [tasksData, districtsData] = await Promise.all([
        fetchTasks({ assignedPhiId: user.id }).catch(() => []),
        fetchLatestPerDistrict().catch(() => []),
      ]);
      setTasks(tasksData);

      const myDistrict = districtsData.find(
        (d) => d.district.toLowerCase() === phiDistrict.toLowerCase(),
      );
      if (myDistrict) {
        setDistrictData(myDistrict);
      }
    } catch (error) {
      console.error("Failed to load dashboard data:", error);
      toast.error("Failed to load dashboard data");
    } finally {
      setLoading(false);
    }
  }, [user?.id, phiDistrict]);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  // WebSocket: Real-time task updates
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

  const handleTaskCreated = useCallback(
    (newTask: Task) => {
      if (newTask.assignedPhiId === user?.id) {
        setTasks((prev) => [newTask, ...prev]);
        toast.success(`New task assigned: ${newTask.title}`);
      }
    },
    [user?.id],
  );

  const handleTaskStatusChanged = useCallback(
    (data: { task: Task; oldStatus: string; newStatus: string }) => {
      if (data.task.assignedPhiId === user?.id) {
        setTasks((prev) =>
          prev.map((t) => (t.id === data.task.id ? data.task : t)),
        );
        if (data.newStatus === TaskStatus.REJECTED) {
          toast.warning(`Task "${data.task.title}" was rejected`);
        } else if (data.newStatus === TaskStatus.VERIFIED) {
          toast.success(`Task "${data.task.title}" was verified`);
        }
      }
    },
    [user?.id],
  );

  useSocketEvent("task:created", handleTaskCreated, [handleTaskCreated]);
  useSocketEvent("task:updated", handleTaskUpdated, [handleTaskUpdated]);
  useSocketEvent("task:status-changed", handleTaskStatusChanged, [
    handleTaskStatusChanged,
  ]);

  // Compute stats
  const assignedCount = tasks.filter(
    (t) => t.status === TaskStatus.ASSIGNED,
  ).length;
  const inProgressCount = tasks.filter(
    (t) => t.status === TaskStatus.IN_PROGRESS,
  ).length;
  const submittedCount = tasks.filter(
    (t) => t.status === TaskStatus.SUBMITTED,
  ).length;
  const completedCount = tasks.filter(
    (t) =>
      t.status === TaskStatus.COMPLETED || t.status === TaskStatus.VERIFIED,
  ).length;
  const rejectedCount = tasks.filter(
    (t) => t.status === TaskStatus.REJECTED,
  ).length;

  // Active tasks = assigned + in_progress + rejected (need attention)
  const activeTasks = tasks.filter(
    (t) =>
      t.status === TaskStatus.ASSIGNED ||
      t.status === TaskStatus.IN_PROGRESS ||
      t.status === TaskStatus.REJECTED,
  );

  const riskInfo = districtData
    ? getRiskLevel(districtData.predicted_cases)
    : { level: "N/A", color: "text-muted-foreground", bg: "bg-muted" };

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
      default:
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">
            Welcome, {user?.name || "PHI"}
          </h2>
          <p className="text-muted-foreground">
            {phiDistrict} District - Field Operations Dashboard
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={loadDashboardData}
          disabled={loading}
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
        </Button>
      </div>

      {/* Quick Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Assigned</CardTitle>
            <Clock className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                assignedCount
              )}
            </div>
            <p className="text-xs text-muted-foreground">Awaiting start</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">In Progress</CardTitle>
            <Play className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                inProgressCount
              )}
            </div>
            <p className="text-xs text-muted-foreground">Currently working</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Submitted</CardTitle>
            <Upload className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                submittedCount
              )}
            </div>
            <p className="text-xs text-muted-foreground">Pending review</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                completedCount
              )}
            </div>
            <p className="text-xs text-muted-foreground">Total completed</p>
          </CardContent>
        </Card>

        {rejectedCount > 0 && (
          <Card className="border-red-200 dark:border-red-800">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Rejected</CardTitle>
              <XCircle className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">
                {rejectedCount}
              </div>
              <p className="text-xs text-muted-foreground">
                Needs resubmission
              </p>
            </CardContent>
          </Card>
        )}

        {rejectedCount === 0 && (
          <Card className={riskInfo.bg}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Area Risk</CardTitle>
              <AlertTriangle className={`h-4 w-4 ${riskInfo.color}`} />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${riskInfo.color}`}>
                {loading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  riskInfo.level
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                {districtData
                  ? `~${Math.round(districtData.predicted_cases)} predicted cases`
                  : "Dengue risk level"}
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Quick Actions */}
      <div className="grid gap-4 md:grid-cols-3">
        <Link href="/phi/tasks">
          <Card className="cursor-pointer hover:bg-accent transition-colors">
            <CardHeader>
              <CardTitle className="flex items-center justify-between text-base">
                <div className="flex items-center gap-2">
                  <ClipboardCheck className="h-4 w-4" />
                  My Tasks
                </div>
                <ArrowRight className="h-4 w-4" />
              </CardTitle>
              <CardDescription>View all assigned tasks</CardDescription>
            </CardHeader>
          </Card>
        </Link>

        <Link href="/phi/map">
          <Card className="cursor-pointer hover:bg-accent transition-colors">
            <CardHeader>
              <CardTitle className="flex items-center justify-between text-base">
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  Map View
                </div>
                <ArrowRight className="h-4 w-4" />
              </CardTitle>
              <CardDescription>View tasks on map</CardDescription>
            </CardHeader>
          </Card>
        </Link>

        <Link href="/phi/history">
          <Card className="cursor-pointer hover:bg-accent transition-colors">
            <CardHeader>
              <CardTitle className="flex items-center justify-between text-base">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4" />
                  Task History
                </div>
                <ArrowRight className="h-4 w-4" />
              </CardTitle>
              <CardDescription>View completed tasks</CardDescription>
            </CardHeader>
          </Card>
        </Link>
      </div>

      {/* Active Tasks */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Active Tasks</CardTitle>
              <CardDescription>Tasks requiring your attention</CardDescription>
            </div>
            <Link href="/phi/tasks">
              <Button variant="outline" size="sm">
                View All
                <ArrowRight className="ml-2 h-3 w-3" />
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : activeTasks.length > 0 ? (
            <div className="space-y-3">
              {activeTasks.map((task) => (
                <Link key={task.id} href={`/phi/tasks/${task.id}`}>
                  <div className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent transition-colors cursor-pointer">
                    <div className="flex items-start gap-3">
                      {getStatusIcon(task.status)}
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <p className="font-medium">{task.title}</p>
                          <span
                            className={`text-xs font-medium capitalize ${getPriorityColor(task.priority)}`}
                          >
                            {task.priority}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {task.type.charAt(0).toUpperCase() +
                            task.type.slice(1)}{" "}
                          {task.address && `• ${task.address}`}
                        </p>
                        {task.dueDate && (
                          <p className="text-xs text-muted-foreground">
                            Due: {formatDate(task.dueDate)}
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
            <div className="text-center py-8 text-muted-foreground">
              <CheckCircle2 className="h-10 w-10 mx-auto mb-2 opacity-50" />
              <p>No active tasks</p>
              <p className="text-xs mt-1">
                All caught up! Check back later for new assignments.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
