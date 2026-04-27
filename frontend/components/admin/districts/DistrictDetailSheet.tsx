"use client";

import { useEffect, useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Users, ClipboardList, CheckCircle2, Clock, UserCheck } from "lucide-react";
import { fetchTimeseries } from "@/services/analytics.service";
import { fetchPhisByDistrict } from "@/services/tasks.service";
import type { DistrictRow } from "@/services/districts.service";

interface Props {
  district: DistrictRow | null;
  onClose: () => void;
}

interface TimeseriesPoint {
  year: number;
  week: number;
  cases: number;
}

interface PhiEntry {
  id: string;
  name: string;
  email: string;
  isActive: boolean;
}

// ── Small stat tile used inside the sheet ─────────────────────────────────────
function MetricTile({
  label,
  value,
  sub,
}: {
  label: string;
  value: React.ReactNode;
  sub?: string;
}) {
  return (
    <div className="flex flex-col gap-0.5 rounded-lg border p-3">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-xl font-bold">{value}</span>
      {sub && <span className="text-xs text-muted-foreground">{sub}</span>}
    </div>
  );
}

export function DistrictDetailSheet({ district, onClose }: Props) {
  const [chartData, setChartData] = useState<
    { label: string; cases: number }[]
  >([]);
  const [phis, setPhis] = useState<PhiEntry[]>([]);
  const [loadingChart, setLoadingChart] = useState(false);
  const [loadingPersonnel, setLoadingPersonnel] = useState(false);

  // Fetch lazily when a district is selected
  useEffect(() => {
    if (!district) {
      setChartData([]);
      setPhis([]);
      return;
    }

    // 8-week sparkline
    setLoadingChart(true);
    fetchTimeseries(district.name)
      .then((raw: TimeseriesPoint[]) => {
        const last8 = raw.slice(-8);
        setChartData(
          last8.map((p) => ({ label: `W${p.week}`, cases: p.cases })),
        );
      })
      .catch(() => setChartData([]))
      .finally(() => setLoadingChart(false));

    // PHI list
    setLoadingPersonnel(true);
    fetchPhisByDistrict(district.name)
      .then(setPhis)
      .catch(() => setPhis([]))
      .finally(() => setLoadingPersonnel(false));
  }, [district]);

  const incidenceRate =
    district && district.predictedCases !== null && district.population > 0
      ? ((district.predictedCases / district.population) * 100_000).toFixed(1)
      : null;

  // activeTasks = inProgress + assigned; completedTasks = completed
  // We don't have a raw "pending" count so surface it as 0 until Phase 4 adds it
  const pendingTasks = 0;

  return (
    <Sheet open={!!district} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side="right"
        className="sm:max-w-lg w-full overflow-y-auto flex flex-col gap-0 p-0"
      >
        {district && (
          <>
            {/* ── Header ──────────────────────────────────────────────── */}
            <SheetHeader className="px-6 pt-6 pb-4 border-b">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline" className="text-xs">
                  {district.province}
                </Badge>
                {district.riskLevel && (
                  <Badge
                    variant={
                      district.riskLevel === "High"
                        ? "destructive"
                        : district.riskLevel === "Medium"
                        ? "secondary"
                        : "outline"
                    }
                  >
                    {district.riskLevel} Risk
                  </Badge>
                )}
              </div>
              <SheetTitle className="text-2xl">{district.name}</SheetTitle>
              <SheetDescription>
                District code: <code>{district.code}</code>
              </SheetDescription>
            </SheetHeader>

            <div className="flex flex-col gap-6 px-6 py-5 flex-1">
              {/* ── Key metrics ─────────────────────────────────────── */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
                  Key Metrics
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <MetricTile
                    label="Population"
                    value={district.population.toLocaleString()}
                    sub="2012 census"
                  />
                  <MetricTile
                    label="Incidence Rate"
                    value={
                      incidenceRate !== null ? `${incidenceRate}` : "—"
                    }
                    sub="cases per 100 000"
                  />
                  <MetricTile
                    label="Active Tasks"
                    value={district.activeTasks}
                    sub="assigned or in progress"
                  />
                  <MetricTile
                    label="Active PHIs"
                    value={district.phiCount}
                    sub="field inspectors"
                  />
                </div>
              </div>

              <Separator />

              {/* ── 8-week risk trend chart ──────────────────────────── */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
                  8-Week Case Trend
                </p>
                {loadingChart ? (
                  <Skeleton className="h-40 w-full rounded-lg" />
                ) : chartData.length === 0 ? (
                  <div className="flex items-center justify-center h-40 rounded-lg border-2 border-dashed text-sm text-muted-foreground">
                    No historical data available
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={160}>
                    <AreaChart
                      data={chartData}
                      margin={{ top: 4, right: 4, left: -24, bottom: 0 }}
                    >
                      <defs>
                        <linearGradient
                          id="casesFill"
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop
                            offset="5%"
                            stopColor="#f59e0b"
                            stopOpacity={0.4}
                          />
                          <stop
                            offset="95%"
                            stopColor="#f59e0b"
                            stopOpacity={0}
                          />
                        </linearGradient>
                      </defs>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        vertical={false}
                        stroke="hsl(var(--border))"
                      />
                      <XAxis
                        dataKey="label"
                        tick={{ fontSize: 11 }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        tick={{ fontSize: 11 }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip
                        formatter={(v: number | undefined) => [v ?? 0, "Cases"]}
                        contentStyle={{
                          fontSize: 12,
                          borderRadius: 6,
                        }}
                      />
                      <Area
                        type="monotone"
                        dataKey="cases"
                        stroke="#f59e0b"
                        strokeWidth={2}
                        fill="url(#casesFill)"
                        dot={false}
                        name="Cases"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </div>

              <Separator />

              {/* ── Task breakdown ───────────────────────────────────── */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
                  Task Breakdown
                </p>
                <div className="grid grid-cols-3 gap-3">
                  <div className="flex flex-col items-center gap-1 rounded-lg border p-3 text-center">
                    <ClipboardList className="h-4 w-4 text-blue-500" />
                    <span className="text-lg font-bold">
                      {district.activeTasks}
                    </span>
                    <span className="text-xs text-muted-foreground">Active</span>
                  </div>
                  <div className="flex flex-col items-center gap-1 rounded-lg border p-3 text-center">
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    <span className="text-lg font-bold">
                      {district.completedTasks}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      Completed
                    </span>
                  </div>
                  <div className="flex flex-col items-center gap-1 rounded-lg border p-3 text-center">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span className="text-lg font-bold">{pendingTasks}</span>
                    <span className="text-xs text-muted-foreground">
                      Pending
                    </span>
                  </div>
                </div>
              </div>

              <Separator />

              {/* ── Assigned personnel ───────────────────────────────── */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
                  Assigned Personnel
                </p>

                {/* Supervisor */}
                <div className="flex items-center gap-2 mb-4">
                  <UserCheck className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground">Supervisor</p>
                    <p className="text-sm font-medium">
                      {district.supervisorName ?? (
                        <span className="text-muted-foreground">
                          Not assigned
                        </span>
                      )}
                    </p>
                  </div>
                </div>

                {/* PHI list */}
                <div className="flex items-center gap-2 mb-2">
                  <Users className="h-4 w-4 text-muted-foreground shrink-0" />
                  <p className="text-xs text-muted-foreground">
                    Field Inspectors (PHI)
                  </p>
                </div>

                {loadingPersonnel ? (
                  <div className="space-y-2">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <Skeleton key={i} className="h-8 w-full rounded" />
                    ))}
                  </div>
                ) : phis.length === 0 ? (
                  <p className="text-sm text-muted-foreground pl-6">
                    No PHIs assigned to this district.
                  </p>
                ) : (
                  <ul className="space-y-1 pl-6">
                    {phis.map((phi) => (
                      <li
                        key={phi.id}
                        className="flex items-center justify-between py-1.5 border-b last:border-0"
                      >
                        <div>
                          <p className="text-sm font-medium">{phi.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {phi.email}
                          </p>
                        </div>
                        <Badge
                          variant={phi.isActive ? "secondary" : "outline"}
                          className="text-xs shrink-0"
                        >
                          {phi.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
