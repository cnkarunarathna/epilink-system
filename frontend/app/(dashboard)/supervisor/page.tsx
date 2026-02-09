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
  MapPin,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Plus,
  Users,
  ArrowRight,
  RefreshCw,
  Loader2,
  ClipboardList,
  TrendingUp,
} from "lucide-react";
import {
  fetchTaskStats,
  fetchTasks,
  TaskStats,
  Task,
  TaskStatus,
  getStatusColor,
} from "@/services/tasks.service";
import {
  fetchLatestPerDistrict,
  DistrictLatest,
} from "@/services/analytics.service";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

// Risk level classification based on predicted cases
function getRiskLevel(cases: number): {
  level: string;
  color: string;
  icon: React.ElementType;
} {
  if (cases >= 90)
    return { level: "Critical", color: "text-red-600", icon: AlertTriangle };
  if (cases >= 50)
    return { level: "High", color: "text-orange-500", icon: AlertTriangle };
  if (cases >= 25)
    return { level: "Medium", color: "text-yellow-500", icon: AlertTriangle };
  return { level: "Low", color: "text-green-500", icon: CheckCircle2 };
}

export default function SupervisorDashboard() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [taskStats, setTaskStats] = useState<TaskStats | null>(null);
  const [recentTasks, setRecentTasks] = useState<Task[]>([]);
  const [districtData, setDistrictData] = useState<DistrictLatest | null>(null);
  const [phiCount, setPhiCount] = useState<number>(0);

  // Get supervisor's district from user profile
  const supervisorDistrict = user?.district || "Colombo";

  const loadDashboardData = useCallback(async () => {
    try {
      setLoading(true);

      // Fetch task stats, recent tasks, and district analytics in parallel
      const [statsData, tasksData, districtsData] = await Promise.all([
        fetchTaskStats().catch(() => null),
        fetchTasks().catch(() => []),
        fetchLatestPerDistrict().catch(() => []),
      ]);

      // Set task stats
      if (statsData) {
        setTaskStats(statsData);
      }

      // Get most recent 5 tasks
      setRecentTasks(tasksData.slice(0, 5));

      // Find supervisor's district data
      const myDistrict = districtsData.find(
        (d) => d.district.toLowerCase() === supervisorDistrict.toLowerCase(),
      );
      if (myDistrict) {
        setDistrictData(myDistrict);
      }

      // TODO: Fetch actual PHI count from users endpoint
      setPhiCount(24);
    } catch (error) {
      console.error("Failed to load dashboard data:", error);
      toast.error("Failed to load dashboard data");
    } finally {
      setLoading(false);
    }
  }, [supervisorDistrict]);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  const riskInfo = districtData
    ? getRiskLevel(districtData.predicted_cases)
    : { level: "Medium", color: "text-yellow-500", icon: AlertTriangle };
  const RiskIcon = riskInfo.icon;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">
            District Dashboard
          </h2>
          <p className="text-muted-foreground">
            {supervisorDistrict} District Overview
          </p>
        </div>
        <div className="flex gap-2">
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
          <Link href="/supervisor/tasks/new">
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Create Task
            </Button>
          </Link>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* Risk Level Card */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Risk Level</CardTitle>
            <RiskIcon className={`h-4 w-4 ${riskInfo.color}`} />
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
                ? `~${Math.round(districtData.predicted_cases)} predicted cases this week`
                : "This week prediction"}
            </p>
          </CardContent>
        </Card>

        {/* Active PHIs Card */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active PHIs</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                phiCount
              )}
            </div>
            <p className="text-xs text-muted-foreground">In your district</p>
          </CardContent>
        </Card>

        {/* Pending Tasks Card */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Tasks</CardTitle>
            <Clock className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                (taskStats?.pending || 0) +
                (taskStats?.assigned || 0) +
                (taskStats?.inProgress || 0)
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {taskStats?.overdueCount
                ? `${taskStats.overdueCount} overdue`
                : "Awaiting completion"}
            </p>
          </CardContent>
        </Card>

        {/* Completed Today Card */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Completed Tasks
            </CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                taskStats?.completed || 0
              )}
            </div>
            <p className="text-xs text-muted-foreground">Total completed</p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Link href="/supervisor/tasks">
          <Card className="cursor-pointer hover:bg-accent transition-colors">
            <CardHeader>
              <CardTitle className="flex items-center justify-between text-base">
                <div className="flex items-center gap-2">
                  <ClipboardList className="h-4 w-4" />
                  All Tasks
                </div>
                <ArrowRight className="h-4 w-4" />
              </CardTitle>
              <CardDescription>View and manage all tasks</CardDescription>
            </CardHeader>
          </Card>
        </Link>

        <Link href="/supervisor/phis">
          <Card className="cursor-pointer hover:bg-accent transition-colors">
            <CardHeader>
              <CardTitle className="flex items-center justify-between text-base">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  PHI Management
                </div>
                <ArrowRight className="h-4 w-4" />
              </CardTitle>
              <CardDescription>View PHI workloads and status</CardDescription>
            </CardHeader>
          </Card>
        </Link>

        <Link href="/supervisor/analytics">
          <Card className="cursor-pointer hover:bg-accent transition-colors">
            <CardHeader>
              <CardTitle className="flex items-center justify-between text-base">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  Analytics
                </div>
                <ArrowRight className="h-4 w-4" />
              </CardTitle>
              <CardDescription>District predictions & trends</CardDescription>
            </CardHeader>
          </Card>
        </Link>

        <Link href="/supervisor/reports">
          <Card className="cursor-pointer hover:bg-accent transition-colors">
            <CardHeader>
              <CardTitle className="flex items-center justify-between text-base">
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  Reports
                </div>
                <ArrowRight className="h-4 w-4" />
              </CardTitle>
              <CardDescription>Generate weekly reports</CardDescription>
            </CardHeader>
          </Card>
        </Link>
      </div>

      {/* Recent Tasks */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Recent Tasks</CardTitle>
              <CardDescription>Latest tasks in your district</CardDescription>
            </div>
            <Link href="/supervisor/tasks">
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
          ) : recentTasks.length > 0 ? (
            <div className="space-y-4">
              {recentTasks.map((task) => (
                <Link key={task.id} href={`/supervisor/tasks/${task.id}`}>
                  <div className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent transition-colors cursor-pointer">
                    <div className="space-y-1">
                      <p className="font-medium">{task.title}</p>
                      <p className="text-sm text-muted-foreground">
                        {task.assignedPhi?.name || "Unassigned"} •{" "}
                        {task.type.charAt(0).toUpperCase() + task.type.slice(1)}
                      </p>
                    </div>
                    <Badge className={getStatusColor(task.status)}>
                      {task.status.replace("_", " ")}
                    </Badge>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <ClipboardList className="h-10 w-10 mx-auto mb-2 opacity-50" />
              <p>No tasks yet</p>
              <p className="text-xs mt-1">
                Create your first task to get started
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Task Stats Summary */}
      {taskStats && !loading && (
        <Card>
          <CardHeader>
            <CardTitle>Task Overview</CardTitle>
            <CardDescription>Status breakdown of all tasks</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-4 rounded-lg bg-gray-50 dark:bg-gray-900">
                <p className="text-2xl font-bold text-gray-600">
                  {taskStats.pending}
                </p>
                <p className="text-xs text-muted-foreground">Pending</p>
              </div>
              <div className="text-center p-4 rounded-lg bg-blue-50 dark:bg-blue-900/20">
                <p className="text-2xl font-bold text-blue-600">
                  {taskStats.assigned}
                </p>
                <p className="text-xs text-muted-foreground">Assigned</p>
              </div>
              <div className="text-center p-4 rounded-lg bg-yellow-50 dark:bg-yellow-900/20">
                <p className="text-2xl font-bold text-yellow-600">
                  {taskStats.inProgress}
                </p>
                <p className="text-xs text-muted-foreground">In Progress</p>
              </div>
              <div className="text-center p-4 rounded-lg bg-purple-50 dark:bg-purple-900/20">
                <p className="text-2xl font-bold text-purple-600">
                  {taskStats.submitted}
                </p>
                <p className="text-xs text-muted-foreground">Submitted</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
