"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, Loader2, ClipboardList } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { TaskKpiCards } from "@/components/dashboard/task-analytics/TaskKpiCards";
import { DistrictCompletionChart } from "@/components/dashboard/task-analytics/DistrictCompletionChart";
import { TaskStatusDonut } from "@/components/dashboard/task-analytics/TaskStatusDonut";
import { TaskTypeChart } from "@/components/dashboard/task-analytics/TaskTypeChart";
import { TaskPriorityChart } from "@/components/dashboard/task-analytics/TaskPriorityChart";
import { TaskTrendChart } from "@/components/dashboard/task-analytics/TaskTrendChart";
import { OverdueTasksAlert } from "@/components/dashboard/task-analytics/OverdueTasksAlert";
import { LiveActivityFeed } from "@/components/dashboard/task-analytics/LiveActivityFeed";
import {
  fetchNationalSummary,
  fetchByDistrict,
  fetchByStatus,
  fetchByType,
  fetchByPriority,
  fetchTrend,
  type NationalSummary,
  type DistrictSummary,
  type StatusPoint,
  type TypePoint,
  type PriorityPoint,
  type TrendPoint,
} from "@/services/task-analytics.service";

type Period = "day" | "week" | "month";

export default function TaskAnalyticsPage() {
  const router = useRouter();
  const initialLoad = useRef(false);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [period, setPeriod] = useState<Period>("day");

  const [summary, setSummary] = useState<NationalSummary | null>(null);
  const [districts, setDistricts] = useState<DistrictSummary[]>([]);
  const [statusData, setStatusData] = useState<StatusPoint[]>([]);
  const [typeData, setTypeData] = useState<TypePoint[]>([]);
  const [priorityData, setPriorityData] = useState<PriorityPoint[]>([]);
  const [trendData, setTrendData] = useState<TrendPoint[]>([]);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);

    try {
      const [s, d, st, ty, pr, tr] = await Promise.all([
        fetchNationalSummary(),
        fetchByDistrict(),
        fetchByStatus(),
        fetchByType(),
        fetchByPriority(),
        fetchTrend(period),
      ]);
      setSummary(s);
      setDistricts(d);
      setStatusData(st);
      setTypeData(ty);
      setPriorityData(pr);
      setTrendData(tr);
    } catch (err: any) {
      toast.error("Failed to load analytics", { description: err?.message });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [period]);

  useEffect(() => {
    if (initialLoad.current) return;
    initialLoad.current = true;
    load();
  }, [load]);

  useEffect(() => {
    if (!initialLoad.current) return;
    load(true);
  }, [period]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleDistrictClick(districtId: number) {
    router.push(`/admin/tasks/analytics/district/${districtId}`);
  }

  const isLoading = loading;

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="flex items-center justify-center h-10 w-10 rounded-lg bg-primary/10 text-primary">
            <ClipboardList className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Task Analytics</h1>
            <p className="text-sm text-muted-foreground">
              National task management overview — assignment, completion & performance
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Period selector */}
          <div className="flex rounded-md border text-sm overflow-hidden">
            {(["day", "week", "month"] as Period[]).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-3 py-1.5 capitalize transition-colors ${
                  period === p
                    ? "bg-primary text-primary-foreground"
                    : "hover:bg-muted"
                }`}
              >
                {p}
              </button>
            ))}
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => load(true)}
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
      </div>

      {/* KPI Cards */}
      <TaskKpiCards data={summary} loading={isLoading} />

      {/* Middle row: District chart + Status donut */}
      <div className="grid gap-4 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <DistrictCompletionChart
            data={districts}
            loading={isLoading}
            onDistrictClick={handleDistrictClick}
          />
        </div>
        <div className="lg:col-span-2">
          <TaskStatusDonut data={statusData} loading={isLoading} />
        </div>
      </div>

      {/* Bottom row: Type chart + Priority chart */}
      <div className="grid gap-4 lg:grid-cols-2">
        <TaskTypeChart data={typeData} loading={isLoading} />
        <TaskPriorityChart data={priorityData} loading={isLoading} />
      </div>

      {/* Trend line — full width */}
      <TaskTrendChart data={trendData} loading={isLoading} />

      {/* Real-time monitoring row */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <OverdueTasksAlert />
        </div>
        <div className="lg:col-span-1">
          <LiveActivityFeed />
        </div>
      </div>
    </div>
  );
}
