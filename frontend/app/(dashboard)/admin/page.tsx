"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/dashboard/shared/StatCard";
import {
  Users,
  MapPin,
  AlertTriangle,
  TrendingUp,
  ArrowRight,
  RefreshCw,
  Loader2,
  BarChart3,
  FileText,
  Settings,
  Activity,
  Clock,
  Wifi,
  WifiOff,
  ClipboardList,
} from "lucide-react";
import { useSocket } from "@/contexts/SocketContext";
import { useSocketEvent } from "@/hooks/useSocket";
import usersService from "@/services/users.service";
import { fetchDashboardSummary } from "@/services/analytics.service";

// ─── Types ────────────────────────────────────────────────────────────────────

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

// ─── Quick-link card config ───────────────────────────────────────────────────

const QUICK_LINKS = [
  {
    href: "/admin/analytics",
    label: "Analytics",
    description: "Dengue trends, ML predictions & outbreak alerts",
    icon: BarChart3,
    iconColor: "text-primary bg-primary/10",
    accent: "primary" as const,
  },
  {
    href: "/admin/users",
    label: "User Management",
    description: "Create and manage role-based user accounts",
    icon: Users,
    iconColor: "text-sky-600 bg-sky-500/10",
    accent: "info" as const,
  },
  {
    href: "/admin/districts",
    label: "Districts",
    description: "Configure district boundaries and assignments",
    icon: MapPin,
    iconColor: "text-emerald-600 bg-emerald-500/10",
    accent: "success" as const,
  },
  {
    href: "/admin/tasks/analytics",
    label: "Task Analytics",
    description: "Assignment, completion & performance metrics across districts",
    icon: ClipboardList,
    iconColor: "text-emerald-600 bg-emerald-500/10",
    accent: "success" as const,
  },
  {
    href: "/admin/reports",
    label: "Weekly Reports",
    description: "View, approve and download weekly reports",
    icon: FileText,
    iconColor: "text-amber-600 bg-amber-500/10",
    accent: "warning" as const,
  },
  {
    href: "/admin/settings",
    label: "Settings",
    description: "System configuration, notifications & AI corpus",
    icon: Settings,
    iconColor: "text-violet-600 bg-violet-500/10",
    accent: "primary" as const,
  },
] as const;

// ─── Activity type config ─────────────────────────────────────────────────────

const ACTIVITY_CONFIG: Record<
  ActivityItem["type"],
  { icon: React.ElementType; color: string; bg: string }
> = {
  user:      { icon: Users,       color: "text-sky-600",     bg: "bg-sky-500/10"     },
  analytics: { icon: TrendingUp,  color: "text-primary",     bg: "bg-primary/10"     },
  report:    { icon: FileText,    color: "text-amber-600",   bg: "bg-amber-500/10"   },
  system:    { icon: Activity,    color: "text-violet-600",  bg: "bg-violet-500/10"  },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatRelativeTime(date: Date): string {
  const diffMs = Date.now() - date.getTime();
  const diffSec = Math.round(diffMs / 1000);
  if (diffSec < 60) return "Just now";
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  return `${Math.floor(diffSec / 3600)}h ago`;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function AdminDashboard() {
  const [stats, setStats] = useState<DashboardStats>({
    totalDistricts: 25,
    highRiskAreas: 0,
    activeUsers: 0,
    totalCases: 0,
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [recentActivity, setRecentActivity] = useState<ActivityItem[]>([]);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());

  const { isConnected, connectionStatus } = useSocket();

  // ── Data loading ─────────────────────────────────────────────────────────

  const loadDashboardData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const [userStats, analyticsSummary] = await Promise.all([
        usersService.getStats().catch(() => null),
        fetchDashboardSummary().catch(() => null),
      ]);
      setStats((prev) => ({
        ...prev,
        activeUsers: userStats?.activeUsers ?? prev.activeUsers,
        highRiskAreas: analyticsSummary?.high_risk_districts ?? prev.highRiskAreas,
        totalCases: analyticsSummary?.total_cases ?? prev.totalCases,
      }));
      setLastRefreshed(new Date());
    } catch (err) {
      console.error("Failed to load dashboard data:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  // ── WebSocket handlers ────────────────────────────────────────────────────

  const pushActivity = useCallback(
    (item: Omit<ActivityItem, "id" | "time">) => {
      setRecentActivity((prev) => [
        { ...item, id: `${item.type}-${Date.now()}`, time: "Just now" },
        ...prev.slice(0, 6),
      ]);
    },
    [],
  );

  const handleUserCreated = useCallback(
    (user: any) => {
      pushActivity({ title: `New user created: ${user.name}`, type: "user" });
      setStats((prev) => ({
        ...prev,
        activeUsers: user.isActive ? prev.activeUsers + 1 : prev.activeUsers,
      }));
    },
    [pushActivity],
  );

  const handleUserUpdated = useCallback(
    (user: any) => {
      pushActivity({ title: `User updated: ${user.name}`, type: "user" });
    },
    [pushActivity],
  );

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
    [],
  );

  const handleAnalyticsUpdated = useCallback(
    (data: { type: string }) => {
      pushActivity({ title: `Analytics updated: ${data.type}`, type: "analytics" });
      loadDashboardData(true);
    },
    [pushActivity, loadDashboardData],
  );

  useSocketEvent("user:created",       handleUserCreated,       [handleUserCreated]);
  useSocketEvent("user:updated",       handleUserUpdated,       [handleUserUpdated]);
  useSocketEvent("user:deleted",       handleUserDeleted,       [handleUserDeleted]);
  useSocketEvent("user:status-changed",handleUserStatusChanged, [handleUserStatusChanged]);
  useSocketEvent("analytics:updated",  handleAnalyticsUpdated,  [handleAnalyticsUpdated]);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* ── Page header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Dashboard Overview</h2>
          <div className="flex flex-wrap items-center gap-2 mt-1">
            <p className="text-sm text-muted-foreground">
              Monitor national dengue risk and system activity
            </p>
            <Badge
              variant="secondary"
              className={
                isConnected
                  ? "bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20"
                  : "bg-muted text-muted-foreground border-border"
              }
            >
              {isConnected ? (
                <Wifi className="h-3 w-3 mr-1" />
              ) : (
                <WifiOff className="h-3 w-3 mr-1" />
              )}
              {isConnected ? "Live" : "Offline"}
            </Badge>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span className="hidden sm:flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock className="h-3.5 w-3.5" />
            Updated {formatRelativeTime(lastRefreshed)}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => loadDashboardData(true)}
            disabled={loading || refreshing}
            className="gap-2"
          >
            {refreshing ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
            Refresh
          </Button>
        </div>
      </div>

      {/* ── Key metrics ── */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Districts"
          value={stats.totalDistricts}
          description="Across Sri Lanka"
          icon={MapPin}
          iconColor="text-primary bg-primary/10"
          accent="primary"
          loading={loading}
        />
        <StatCard
          title="High Risk Areas"
          value={loading ? "—" : stats.highRiskAreas}
          description="Districts with ≥50 cases"
          icon={AlertTriangle}
          iconColor="text-destructive bg-destructive/10"
          accent="danger"
          loading={loading}
        />
        <StatCard
          title="Active Users"
          value={loading ? "—" : stats.activeUsers}
          description="System users online"
          icon={Users}
          iconColor="text-sky-600 bg-sky-500/10"
          accent="info"
          loading={loading}
        />
        <StatCard
          title="Total Cases"
          value={loading ? "—" : stats.totalCases.toLocaleString()}
          description="This week nationally"
          icon={TrendingUp}
          iconColor="text-amber-600 bg-amber-500/10"
          accent="warning"
          loading={loading}
        />
      </div>

      {/* ── Quick links ── */}
      <div>
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-widest mb-3">
          Quick access
        </h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {QUICK_LINKS.map((link) => (
            <Link key={link.href} href={link.href} className="group">
              <Card className="h-full relative overflow-hidden transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 border-border/60 group-hover:border-border">
                {/* accent bar */}
                <span
                  className={`absolute inset-x-0 top-0 h-0.5 transition-opacity duration-200 opacity-0 group-hover:opacity-100 ${
                    link.accent === "primary" ? "bg-primary" :
                    link.accent === "info"    ? "bg-sky-500" :
                    link.accent === "success" ? "bg-emerald-500" :
                    link.accent === "warning" ? "bg-amber-500" :
                                                "bg-primary"
                  }`}
                />
                <CardHeader className="pb-2 pt-4 px-4">
                  <div className="flex items-start justify-between gap-2">
                    <span
                      className={`flex items-center justify-center h-9 w-9 rounded-lg shrink-0 ${link.iconColor}`}
                    >
                      <link.icon className="h-4 w-4" />
                    </span>
                    <ArrowRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors mt-1 shrink-0" />
                  </div>
                  <CardTitle className="text-sm font-semibold mt-2">
                    {link.label}
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4 pt-0">
                  <CardDescription className="text-xs leading-relaxed">
                    {link.description}
                  </CardDescription>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>

      {/* ── Real-time activity feed ── */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                Real-time Activity
                {isConnected && (
                  <span className="relative flex h-2 w-2" aria-hidden>
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
                  </span>
                )}
              </CardTitle>
              <CardDescription>
                Live system events from WebSocket
              </CardDescription>
            </div>
            <Badge
              variant="outline"
              className={
                connectionStatus === "connected"
                  ? "text-green-600 border-green-500/30 bg-green-500/5"
                  : connectionStatus === "connecting"
                  ? "text-amber-600 border-amber-500/30 bg-amber-500/5"
                  : "text-muted-foreground"
              }
            >
              {connectionStatus === "connected"   ? "Connected"    :
               connectionStatus === "connecting"  ? "Connecting…"  :
                                                    "Disconnected"}
            </Badge>
          </div>
        </CardHeader>

        <CardContent>
          <AnimatePresence initial={false}>
            {recentActivity.length > 0 ? (
              <ul className="space-y-1">
                {recentActivity.map((activity) => {
                  const cfg = ACTIVITY_CONFIG[activity.type];
                  return (
                    <motion.li
                      key={activity.id}
                      initial={{ opacity: 0, y: -8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.2 }}
                      className="flex items-start gap-3 rounded-lg px-3 py-2.5 hover:bg-muted/50 transition-colors"
                    >
                      <span
                        className={`flex items-center justify-center h-7 w-7 rounded-md shrink-0 mt-0.5 ${cfg.bg} ${cfg.color}`}
                      >
                        <cfg.icon className="h-3.5 w-3.5" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">
                          {activity.title}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {activity.time}
                        </p>
                      </div>
                    </motion.li>
                  );
                })}
              </ul>
            ) : (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex flex-col items-center justify-center py-12 text-center gap-2"
              >
                <span className="flex items-center justify-center h-12 w-12 rounded-full bg-muted mb-1">
                  <Activity className="h-5 w-5 text-muted-foreground" />
                </span>
                <p className="text-sm font-medium text-muted-foreground">
                  No recent activity
                </p>
                <p className="text-xs text-muted-foreground/70 max-w-[200px]">
                  {isConnected
                    ? "Live events will appear here as they happen"
                    : "Connect to start receiving real-time events"}
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </CardContent>
      </Card>
    </div>
  );
}
