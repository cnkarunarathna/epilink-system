"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { RefreshCw, Loader2, ChevronRight, LayoutGrid, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { PhiProfileHeader } from "@/components/dashboard/task-analytics/PhiProfileHeader";
import { PhiMonthlyTrendChart } from "@/components/dashboard/task-analytics/PhiMonthlyTrendChart";
import { EvidenceReviewPanel } from "@/components/dashboard/task-analytics/EvidenceReviewPanel";
import { PhiTaskHistoryTable } from "@/components/dashboard/task-analytics/PhiTaskHistoryTable";
import { TaskStatusDonut } from "@/components/dashboard/task-analytics/TaskStatusDonut";
import { StatCard } from "@/components/dashboard/shared/StatCard";
import {
  ClipboardList,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ShieldCheck,
} from "lucide-react";
import {
  fetchPhiProfile,
  fetchPhiTasks,
  type PhiProfile,
  type PhiTasksPage,
  type StatusPoint,
} from "@/services/task-analytics.service";

interface TaskFilters {
  status?: string;
  type?: string;
}

export default function PhiProfilePage() {
  const params = useParams();
  const router = useRouter();
  const phiId = params.phiId as string;
  const initialLoad = useRef(false);

  const [loading, setLoading] = useState(true);
  const [tasksLoading, setTasksLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [profile, setProfile] = useState<PhiProfile | null>(null);
  const [tasksPage, setTasksPage] = useState<PhiTasksPage | null>(null);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<TaskFilters>({});

  const loadProfile = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const p = await fetchPhiProfile(phiId);
      setProfile(p);
    } catch (err: any) {
      toast.error("Failed to load PHI profile", { description: err?.message });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [phiId]);

  const loadTasks = useCallback(async (pg: number, f: TaskFilters) => {
    setTasksLoading(true);
    try {
      const result = await fetchPhiTasks(phiId, pg, 20, f.status, f.type);
      setTasksPage(result);
    } catch (err: any) {
      toast.error("Failed to load task history", { description: err?.message });
    } finally {
      setTasksLoading(false);
    }
  }, [phiId]);

  useEffect(() => {
    if (initialLoad.current) return;
    initialLoad.current = true;
    loadProfile();
    loadTasks(1, {});
  }, [loadProfile, loadTasks]);

  function handlePageChange(newPage: number) {
    setPage(newPage);
    loadTasks(newPage, filters);
  }

  function handleFilterChange(newFilters: TaskFilters) {
    setFilters(newFilters);
    setPage(1);
    loadTasks(1, newFilters);
  }

  function handleRefresh() {
    loadProfile(true);
    loadTasks(page, filters);
  }

  const statusData: StatusPoint[] = profile?.statusBreakdown ?? [];
  const districtName = profile?.district ?? "";

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <nav className="flex items-center gap-1.5 text-sm text-muted-foreground mb-1">
            <button
              onClick={() => router.push("/admin/tasks/analytics")}
              className="flex items-center gap-1 hover:text-foreground transition-colors"
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              National
            </button>
            {districtName && (
              <>
                <ChevronRight className="h-3.5 w-3.5" />
                <button
                  onClick={() => router.back()}
                  className="flex items-center gap-1 hover:text-foreground transition-colors"
                >
                  <MapPin className="h-3.5 w-3.5" />
                  {districtName}
                </button>
              </>
            )}
            <ChevronRight className="h-3.5 w-3.5" />
            <span className="text-foreground font-medium">
              {profile?.name ?? "PHI Profile"}
            </span>
          </nav>
          <h1 className="text-xl font-semibold tracking-tight">
            {loading ? "Loading..." : (profile?.name ?? "PHI Profile")}
          </h1>
          <p className="text-sm text-muted-foreground">Individual performance & task history</p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          disabled={refreshing}
        >
          {refreshing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          <span className="ml-1.5">Refresh</span>
        </Button>
      </div>

      {/* Profile Header Card */}
      <PhiProfileHeader profile={profile} loading={loading} />

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard
          title="Total Assigned"
          value={loading ? "—" : (profile?.assigned ?? 0)}
          description="All-time tasks assigned"
          icon={ClipboardList}
          iconColor="text-primary bg-primary/10"
          accent="primary"
          loading={loading}
        />
        <StatCard
          title="Completed"
          value={loading ? "—" : (profile?.completed ?? 0)}
          description="Completed + verified"
          icon={CheckCircle2}
          iconColor="text-green-600 bg-green-500/10"
          accent="success"
          loading={loading}
        />
        <StatCard
          title="Overdue"
          value={loading ? "—" : (profile?.overdue ?? 0)}
          description="Past due date"
          icon={AlertTriangle}
          iconColor="text-destructive bg-destructive/10"
          accent="danger"
          loading={loading}
        />
        <StatCard
          title="Avg Completion"
          value={loading ? "—" : (
            profile?.avgCompletionHours != null
              ? `${profile.avgCompletionHours.toFixed(1)}h`
              : "—"
          )}
          description="From assigned to done"
          icon={Clock}
          iconColor="text-amber-600 bg-amber-500/10"
          accent="warning"
          loading={loading}
        />
        <StatCard
          title="Evidence Approval"
          value={loading ? "—" : `${profile?.evidenceApprovalRate ?? 0}%`}
          description="Evidence approved rate"
          icon={ShieldCheck}
          iconColor="text-sky-600 bg-sky-500/10"
          accent="info"
          loading={loading}
        />
      </div>

      {/* Status Donut + Monthly Trend */}
      <div className="grid gap-6 lg:grid-cols-2">
        <TaskStatusDonut data={statusData} loading={loading} />
        <PhiMonthlyTrendChart data={profile?.monthlyTrend ?? []} loading={loading} />
      </div>

      {/* Evidence Review Panel */}
      <EvidenceReviewPanel
        total={profile?.evidenceTotal ?? 0}
        approved={profile?.evidenceApproved ?? 0}
        rejected={profile?.evidenceRejected ?? 0}
        pending={profile?.evidencePending ?? 0}
        approvalRate={profile?.evidenceApprovalRate ?? 0}
        loading={loading}
      />

      {/* Task History Table */}
      <PhiTaskHistoryTable
        tasks={tasksPage?.tasks ?? []}
        total={tasksPage?.total ?? 0}
        page={page}
        limit={20}
        loading={tasksLoading}
        filters={filters}
        onPageChange={handlePageChange}
        onFilterChange={handleFilterChange}
      />
    </div>
  );
}
