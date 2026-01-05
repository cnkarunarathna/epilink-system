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
  Users,
  MapPin,
  AlertTriangle,
  CheckCircle2,
  FileText,
  TrendingUp,
  ArrowRight,
  Wifi,
  WifiOff,
  RefreshCw,
  Loader2,
} from "lucide-react";
import { useSocket } from "@/contexts/SocketContext";
import { useSocketEvent } from "@/hooks/useSocket";
import usersService, { UserStats } from "@/services/users.service";
import { fetchDashboardSummary } from "@/services/analytics.service";
import { toast } from "sonner";

interface DashboardStats {
  totalDistricts: number;
  highRiskAreas: number;
  activeUsers: number;
  totalCases: number;
}

interface ActivityItem {
  id: string;
  title: string;
  time: string;
  type: "user" | "analytics" | "report" | "system";
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<DashboardStats>({
    totalDistricts: 25,
    highRiskAreas: 0,
    activeUsers: 0,
    totalCases: 0,
  });
  const [loading, setLoading] = useState(true);
  const [recentActivity, setRecentActivity] = useState<ActivityItem[]>([]);

  // WebSocket connection status
  const { isConnected, connectionStatus } = useSocket();

  // Load dashboard data
  const loadDashboardData = useCallback(async () => {
    try {
      setLoading(true);
      const [userStats, analyticsSummary] = await Promise.all([
        usersService.getStats().catch(() => null),
        fetchDashboardSummary().catch(() => null),
      ]);

      setStats((prev) => ({
        ...prev,
        activeUsers: userStats?.activeUsers || prev.activeUsers,
        highRiskAreas:
          analyticsSummary?.high_risk_districts || prev.highRiskAreas,
        totalCases: analyticsSummary?.total_cases || prev.totalCases,
      }));
    } catch (error) {
      console.error("Failed to load dashboard data:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch data on mount
  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  // WebSocket handlers for real-time updates
  const handleUserCreated = useCallback((user: any) => {
    setRecentActivity((prev) => [
      {
        id: `user-${Date.now()}`,
        title: `New user created: ${user.name}`,
        time: "Just now",
        type: "user",
      },
      ...prev.slice(0, 4),
    ]);
    setStats((prev) => ({
      ...prev,
      activeUsers: user.isActive ? prev.activeUsers + 1 : prev.activeUsers,
    }));
  }, []);

  const handleUserUpdated = useCallback((user: any) => {
    setRecentActivity((prev) => [
      {
        id: `user-update-${Date.now()}`,
        title: `User updated: ${user.name}`,
        time: "Just now",
        type: "user",
      },
      ...prev.slice(0, 4),
    ]);
  }, []);

  const handleUserDeleted = useCallback(() => {
    setStats((prev) => ({
      ...prev,
      activeUsers: Math.max(0, prev.activeUsers - 1),
    }));
  }, []);

  const handleUserStatusChanged = useCallback(
    ({ isActive }: { id: string; isActive: boolean }) => {
      setStats((prev) => ({
        ...prev,
        activeUsers: isActive ? prev.activeUsers + 1 : prev.activeUsers - 1,
      }));
    },
    []
  );

  const handleAnalyticsUpdated = useCallback(
    (data: { type: string; payload?: any }) => {
      setRecentActivity((prev) => [
        {
          id: `analytics-${Date.now()}`,
          title: `Analytics updated: ${data.type}`,
          time: "Just now",
          type: "analytics",
        },
        ...prev.slice(0, 4),
      ]);
      // Reload stats to get fresh data
      loadDashboardData();
    },
    [loadDashboardData]
  );

  // Subscribe to WebSocket events
  useSocketEvent("user:created", handleUserCreated, [handleUserCreated]);
  useSocketEvent("user:updated", handleUserUpdated, [handleUserUpdated]);
  useSocketEvent("user:deleted", handleUserDeleted, [handleUserDeleted]);
  useSocketEvent("user:status-changed", handleUserStatusChanged, [
    handleUserStatusChanged,
  ]);
  useSocketEvent("analytics:updated", handleAnalyticsUpdated, [
    handleAnalyticsUpdated,
  ]);

  const getActivityIcon = (type: string) => {
    switch (type) {
      case "user":
        return Users;
      case "analytics":
        return TrendingUp;
      case "report":
        return FileText;
      default:
        return CheckCircle2;
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">
            Dashboard Overview
          </h2>
          <div className="flex items-center gap-3 mt-1">
            <p className="text-muted-foreground">
              Monitor national dengue risk and system activity
            </p>
            {/* Real-time connection indicator */}
            <Badge
              variant={isConnected ? "default" : "secondary"}
              className={`flex items-center gap-1.5 ${
                isConnected
                  ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                  : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
              }`}
            >
              {isConnected ? (
                <Wifi className="h-3 w-3" />
              ) : (
                <WifiOff className="h-3 w-3" />
              )}
              <span className="text-xs font-medium">
                {isConnected ? "Live" : "Offline"}
              </span>
            </Badge>
          </div>
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

      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Districts
            </CardTitle>
            <MapPin className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalDistricts}</div>
            <p className="text-xs text-muted-foreground">Across Sri Lanka</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              High Risk Areas
            </CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-500">
              {loading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                stats.highRiskAreas
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Districts with ≥50 cases
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                stats.activeUsers
              )}
            </div>
            <p className="text-xs text-muted-foreground">System users online</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Cases</CardTitle>
            <TrendingUp className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                stats.totalCases.toLocaleString()
              )}
            </div>
            <p className="text-xs text-muted-foreground">This week</p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Links */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Link href="/admin/analytics">
          <Card className="cursor-pointer hover:bg-accent transition-colors">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                Analytics
                <ArrowRight className="h-4 w-4" />
              </CardTitle>
              <CardDescription>View trends and ML predictions</CardDescription>
            </CardHeader>
          </Card>
        </Link>

        <Link href="/admin/users">
          <Card className="cursor-pointer hover:bg-accent transition-colors">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                User Management
                <ArrowRight className="h-4 w-4" />
              </CardTitle>
              <CardDescription>Manage system users and roles</CardDescription>
            </CardHeader>
          </Card>
        </Link>

        <Link href="/admin/districts">
          <Card className="cursor-pointer hover:bg-accent transition-colors">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                Districts
                <ArrowRight className="h-4 w-4" />
              </CardTitle>
              <CardDescription>Configure district boundaries</CardDescription>
            </CardHeader>
          </Card>
        </Link>

        <Link href="/admin/reports">
          <Card className="cursor-pointer hover:bg-accent transition-colors">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                Weekly Reports
                <ArrowRight className="h-4 w-4" />
              </CardTitle>
              <CardDescription>View and approve reports</CardDescription>
            </CardHeader>
          </Card>
        </Link>

        <Link href="/admin/settings">
          <Card className="cursor-pointer hover:bg-accent transition-colors">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                Settings
                <ArrowRight className="h-4 w-4" />
              </CardTitle>
              <CardDescription>System configuration</CardDescription>
            </CardHeader>
          </Card>
        </Link>
      </div>

      {/* Real-time Activity Feed */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                Real-time Activity
                {isConnected && (
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                  </span>
                )}
              </CardTitle>
              <CardDescription>Live updates from the system</CardDescription>
            </div>
            <Badge variant="outline" className="text-xs">
              {connectionStatus === "connected"
                ? "Connected"
                : connectionStatus === "connecting"
                ? "Connecting..."
                : "Disconnected"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {recentActivity.length > 0 ? (
            <div className="space-y-4 text-sm">
              {recentActivity.map((activity) => {
                const Icon = getActivityIcon(activity.type);
                return (
                  <div
                    key={activity.id}
                    className="flex items-start gap-2 animate-in slide-in-from-top-2 duration-300"
                  >
                    <Icon className="h-4 w-4 text-primary mt-0.5" />
                    <div>
                      <p className="font-medium">{activity.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {activity.time}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <p>No recent activity</p>
              <p className="text-xs mt-1">Real-time updates will appear here</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
