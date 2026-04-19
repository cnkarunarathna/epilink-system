"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { RefreshCw, Loader2, ChevronRight, LayoutGrid } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { DistrictKpiCards } from "@/components/dashboard/task-analytics/DistrictKpiCards";
import { SupervisorTable } from "@/components/dashboard/task-analytics/SupervisorTable";
import { PhiPerformanceTable } from "@/components/dashboard/task-analytics/PhiPerformanceTable";
import { TaskTrendChart } from "@/components/dashboard/task-analytics/TaskTrendChart";
import {
  fetchNationalSummary,
  fetchByDistrict,
  fetchSupervisorMetrics,
  fetchPhiMetrics,
  fetchTrend,
  type NationalSummary,
  type DistrictSummary,
  type SupervisorMetrics,
  type PhiMetrics,
  type TrendPoint,
} from "@/services/task-analytics.service";

type Period = "day" | "week" | "month";

export default function DistrictAnalyticsPage() {
  const params = useParams();
  const router = useRouter();
  const districtId = Number(params.districtId);
  const initialLoad = useRef(false);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [period, setPeriod] = useState<Period>("day");

  const [summary, setSummary] = useState<NationalSummary | null>(null);
  const [districtInfo, setDistrictInfo] = useState<DistrictSummary | null>(null);
  const [supervisors, setSupervisors] = useState<SupervisorMetrics[]>([]);
  const [phis, setPhis] = useState<PhiMetrics[]>([]);
  const [trendData, setTrendData] = useState<TrendPoint[]>([]);

  const load = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      else setRefreshing(true);

      try {
        const [s, allDistricts, sup, phi, trend] = await Promise.all([
          fetchNationalSummary(districtId),
          fetchByDistrict(),
          fetchSupervisorMetrics(districtId),
          fetchPhiMetrics(districtId),
          fetchTrend(period, undefined, undefined, districtId),
        ]);
        setSummary(s);
        setDistrictInfo(allDistricts.find((d) => d.districtId === districtId) ?? null);
        setSupervisors(sup);
        setPhis(phi);
        setTrendData(trend);
      } catch (err: any) {
        toast.error("Failed to load district analytics", { description: err?.message });
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [districtId, period],
  );

  useEffect(() => {
    if (initialLoad.current) return;
    initialLoad.current = true;
    load();
  }, [load]);

  useEffect(() => {
    if (!initialLoad.current) return;
    load(true);
  }, [period]); // eslint-disable-line react-hooks/exhaustive-deps

  const districtName = districtInfo?.districtName ?? `District ${districtId}`;

  function handlePhiClick(phiId: string) {
    router.push(`/admin/tasks/analytics/phi/${phiId}`);
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          {/* Breadcrumb */}
          <nav className="flex items-center gap-1.5 text-sm text-muted-foreground mb-1">
            <button
              onClick={() => router.push("/admin/tasks/analytics")}
              className="flex items-center gap-1 hover:text-foreground transition-colors"
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              National
            </button>
            <ChevronRight className="h-3.5 w-3.5" />
            <span className="text-foreground font-medium">{districtName}</span>
          </nav>
          <h1 className="text-xl font-semibold tracking-tight">{districtName} District</h1>
          <p className="text-sm text-muted-foreground">
            Task performance breakdown — supervisors & PHIs
          </p>
        </div>

        <div className="flex items-center gap-2">
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
      <DistrictKpiCards
        summary={summary}
        district={districtInfo}
        loading={loading}
      />

      {/* Supervisor Table */}
      <SupervisorTable data={supervisors} loading={loading} />

      {/* PHI Performance Table */}
      <PhiPerformanceTable
        data={phis}
        loading={loading}
        onPhiClick={handlePhiClick}
      />

      {/* District Trend Chart */}
      <TaskTrendChart data={trendData} loading={loading} />
    </div>
  );
}
