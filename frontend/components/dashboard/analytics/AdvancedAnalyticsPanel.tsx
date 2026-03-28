"use client";

import { useCallback, useEffect, useState, JSX } from "react";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  RefreshCw,
  Loader2,
  CalendarRange,
  GitMerge,
  Syringe,
  LineChart,
  MapPinned,
  TrendingUp,
  TrendingDown,
  Minus,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  ChevronRight,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import {
  fetchSeasonalPattern,
  fetchSpilloverRisk,
  fetchInterventionHistory,
  fetchModelPerformance,
  fetchDemographicHotspots,
  SeasonalPatternResponse,
  SpilloverResponse,
  InterventionHistoryResponse,
  ModelPerformanceResponse,
  DemographicHotspotsResponse,
} from "@/services/analytics.service";

// ── Shared helpers ───────────────────────────────────────────────

const RISK_COLORS: Record<string, string> = {
  critical:
    "bg-red-100 text-red-800 border-red-200 dark:bg-red-950/50 dark:text-red-300 dark:border-red-800",
  high: "bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-950/50 dark:text-orange-300 dark:border-orange-800",
  moderate:
    "bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-950/50 dark:text-yellow-300 dark:border-yellow-800",
  low: "bg-green-100 text-green-800 border-green-200 dark:bg-green-950/50 dark:text-green-300 dark:border-green-800",
};

const RISK_DOT: Record<string, string> = {
  critical: "bg-red-500",
  high: "bg-orange-500",
  moderate: "bg-yellow-500",
  low: "bg-green-500",
};

const SPILLOVER_COLORS: Record<string, string> = {
  high: "text-red-600 dark:text-red-400",
  moderate: "text-yellow-600 dark:text-yellow-400",
  low: "text-green-600 dark:text-green-400",
};

const ACCURACY_COLORS: Record<string, string> = {
  excellent: "text-green-600 dark:text-green-400",
  good: "text-blue-600 dark:text-blue-400",
  moderate: "text-yellow-600 dark:text-yellow-400",
  poor: "text-red-600 dark:text-red-400",
  unavailable: "text-muted-foreground",
};

const PRIORITY_COLORS: Record<string, string> = {
  immediate:
    "bg-red-100 text-red-800 border-red-200 dark:bg-red-950/50 dark:text-red-300 dark:border-red-800",
  high: "bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-950/50 dark:text-orange-300 dark:border-orange-800",
  moderate:
    "bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-950/50 dark:text-yellow-300 dark:border-yellow-800",
  routine:
    "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700",
};

function DistrictSelector({
  districts,
  value,
  onChange,
}: {
  districts: string[];
  value: string | null;
  onChange: (d: string) => void;
}) {
  return (
    <Select value={value ?? ""} onValueChange={onChange}>
      <SelectTrigger className="w-[240px]">
        <SelectValue placeholder="Select a district..." />
      </SelectTrigger>
      <SelectContent>
        {districts.map((d) => (
          <SelectItem key={d} value={d}>
            {d}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function LoadingCard({ label }: { label: string }) {
  return (
    <Card>
      <CardContent className="py-12 flex flex-col items-center gap-3">
        <Loader2 className="h-7 w-7 animate-spin text-blue-500" />
        <p className="text-sm text-muted-foreground">{label}</p>
      </CardContent>
    </Card>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <Card className="border-dashed">
      <CardContent className="py-10 text-center text-sm text-muted-foreground">
        {label}
      </CardContent>
    </Card>
  );
}

function ErrorCard({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <Card className="border-red-200 dark:border-red-800">
      <CardContent className="py-6 flex flex-col items-center gap-3 text-center">
        <AlertCircle className="h-7 w-7 text-red-500" />
        <p className="text-sm text-muted-foreground">{message}</p>
        <Button variant="outline" size="sm" onClick={onRetry}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Retry
        </Button>
      </CardContent>
    </Card>
  );
}

// ── Seasonal Pattern ─────────────────────────────────────────────

function SeasonalPatternTab({ districts }: { districts: string[] }) {
  const [district, setDistrict] = useState<string | null>(null);
  const [years, setYears] = useState(3);
  const [data, setData] = useState<SeasonalPatternResponse | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (d: string, y: number) => {
    try {
      setLoading(true);
      setData(await fetchSeasonalPattern(d, y));
    } catch (err: any) {
      toast.error("Failed to load seasonal pattern", {
        description: err.message,
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (district) load(district, years);
  }, [district, years, load]);

  const sortedWeeks = data
    ? Object.entries(data.weekly_averages)
        .map(([wk, avg]) => ({ week: Number(wk), avg }))
        .sort((a, b) => a.week - b.week)
    : [];

  const maxAvg = sortedWeeks.length
    ? Math.max(...sortedWeeks.map((w) => w.avg))
    : 1;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <DistrictSelector
          districts={districts}
          value={district}
          onChange={(d) => {
            setDistrict(d);
          }}
        />
        <Select
          value={String(years)}
          onValueChange={(v) => setYears(Number(v))}
        >
          <SelectTrigger className="w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {[1, 2, 3, 4, 5].map((y) => (
              <SelectItem key={y} value={String(y)}>
                {y} year{y > 1 ? "s" : ""} overlay
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {district && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => load(district, years)}
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
          </Button>
        )}
      </div>

      {!district && (
        <EmptyState label="Select a district to view its seasonal dengue pattern." />
      )}
      {district && loading && !data && (
        <LoadingCard label="Loading seasonal pattern..." />
      )}
      {data?.error && (
        <ErrorCard
          message={data.error}
          onRetry={() => load(district!, years)}
        />
      )}
      {data && !data.error && (
        <div className="space-y-4">
          {/* Status banner */}
          <div
            className={`flex items-center gap-3 p-3 rounded-lg border ${data.in_peak_season ? "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800" : "bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800"}`}
          >
            {data.in_peak_season ? (
              <AlertTriangle className="h-4 w-4 text-red-600 shrink-0" />
            ) : (
              <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
            )}
            <span
              className={`text-sm font-medium ${data.in_peak_season ? "text-red-800 dark:text-red-300" : "text-green-800 dark:text-green-300"}`}
            >
              {data.in_peak_season
                ? "Currently in peak season"
                : "Outside peak season"}
            </span>
            {data.vs_baseline_pct !== null && (
              <Badge variant="outline" className="ml-auto text-xs">
                {data.vs_baseline_pct >= 0 ? "+" : ""}
                {data.vs_baseline_pct}% vs baseline
              </Badge>
            )}
          </div>

          {/* Stat cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Card>
              <CardContent className="pt-4 pb-3 text-center">
                <p className="text-xs text-muted-foreground mb-1">
                  Current Cases
                </p>
                <p className="text-2xl font-bold">{data.current_cases}</p>
                <p className="text-xs text-muted-foreground">
                  Week {data.current_week}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-3 text-center">
                <p className="text-xs text-muted-foreground mb-1">
                  Seasonal Baseline
                </p>
                <p className="text-2xl font-bold">
                  {data.seasonal_baseline_this_week.toFixed(1)}
                </p>
                <p className="text-xs text-muted-foreground">avg this week</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-3 text-center">
                <p className="text-xs text-muted-foreground mb-1">
                  Historical Peak
                </p>
                <p className="text-2xl font-bold">
                  {data.absolute_peak_avg_cases.toFixed(1)}
                </p>
                <p className="text-xs text-muted-foreground">
                  avg at Week {data.absolute_peak_week}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-3 text-center">
                <p className="text-xs text-muted-foreground mb-1">
                  Peak Windows
                </p>
                <p className="text-2xl font-bold">
                  {data.peak_season_windows.length}
                </p>
                <p className="text-xs text-muted-foreground">
                  season{data.peak_season_windows.length !== 1 ? "s" : ""}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Weekly bar chart */}
          <Card>
            <CardHeader className="pb-2 pt-4">
              <CardTitle className="text-sm">
                {years}-Year Weekly Average (Cases)
              </CardTitle>
              <CardDescription className="text-xs">
                Bar height = average cases across {years} year
                {years > 1 ? "s" : ""}. Red = peak season week.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-end gap-0.5 h-28">
                {sortedWeeks.map(({ week, avg }) => {
                  const isPeak = data.peak_weeks.includes(week);
                  const isCurrent = week === data.current_week;
                  const height =
                    maxAvg > 0 ? Math.max(4, (avg / maxAvg) * 100) : 4;
                  return (
                    <div
                      key={week}
                      className="flex-1 flex flex-col items-center group relative"
                      title={`Week ${week}: avg ${avg}`}
                    >
                      <div
                        className={`w-full rounded-sm transition-all ${isCurrent ? "bg-blue-500 ring-1 ring-blue-400" : isPeak ? "bg-red-400" : "bg-slate-300 dark:bg-slate-600"}`}
                        style={{ height: `${height}%` }}
                      />
                    </div>
                  );
                })}
              </div>
              <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground flex-wrap">
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded-sm bg-red-400 inline-block" />{" "}
                  Peak season
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded-sm bg-blue-500 inline-block" />{" "}
                  Current week
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded-sm bg-slate-300 dark:bg-slate-600 inline-block" />{" "}
                  Off-season
                </span>
              </div>
            </CardContent>
          </Card>

          <p className="text-xs text-muted-foreground leading-relaxed">
            {data.narrative}
          </p>
        </div>
      )}
    </div>
  );
}

// ── Cross-District Spillover ──────────────────────────────────────

function SpilloverTab({ districts }: { districts: string[] }) {
  const [district, setDistrict] = useState<string | null>(null);
  const [data, setData] = useState<SpilloverResponse | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (d: string) => {
    try {
      setLoading(true);
      setData(await fetchSpilloverRisk(d));
    } catch (err: any) {
      toast.error("Failed to load spillover data", {
        description: err.message,
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (district) load(district);
  }, [district, load]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <DistrictSelector
          districts={districts}
          value={district}
          onChange={(d) => {
            setDistrict(d);
          }}
        />
        {district && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => load(district)}
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
          </Button>
        )}
      </div>

      {!district && (
        <EmptyState label="Select a focal district to assess geographic spillover risk." />
      )}
      {district && loading && !data && (
        <LoadingCard label="Analysing neighbours..." />
      )}
      {data?.error && (
        <ErrorCard message={data.error} onRetry={() => load(district!)} />
      )}
      {data && !data.error && (
        <div className="space-y-4">
          {/* Spillover risk banner */}
          <div
            className={`flex items-center gap-3 p-4 rounded-xl border ${data.spillover_risk === "high" ? "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800" : data.spillover_risk === "moderate" ? "bg-yellow-50 dark:bg-yellow-950/30 border-yellow-200 dark:border-yellow-800" : "bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800"}`}
          >
            <GitMerge
              className={`h-5 w-5 shrink-0 ${SPILLOVER_COLORS[data.spillover_risk]}`}
            />
            <div>
              <p
                className={`text-sm font-semibold ${SPILLOVER_COLORS[data.spillover_risk]}`}
              >
                Spillover Risk: {data.spillover_risk.toUpperCase()}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {data.rising_neighbours.length} rising neighbour
                {data.rising_neighbours.length !== 1 ? "s" : ""} ·{" "}
                {data.high_risk_neighbours.length} high/critical-risk
              </p>
            </div>
          </div>

          {/* Neighbour table */}
          <Card>
            <CardHeader className="pb-2 pt-4">
              <CardTitle className="text-sm">
                Focal + Neighbouring Districts
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-muted/60">
                    <tr>
                      <th className="text-left px-4 py-2 font-medium text-muted-foreground">
                        District
                      </th>
                      <th className="text-right px-4 py-2 font-medium text-muted-foreground">
                        Cases
                      </th>
                      <th className="text-right px-4 py-2 font-medium text-muted-foreground">
                        WoW %
                      </th>
                      <th className="text-center px-4 py-2 font-medium text-muted-foreground">
                        Trend
                      </th>
                      <th className="text-center px-4 py-2 font-medium text-muted-foreground">
                        Risk
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {[data.focal_stats, ...data.neighbours]
                      .filter(Boolean)
                      .map((n, idx) => (
                        <tr
                          key={n!.district}
                          className={`border-t border-border/50 ${n!.is_focal ? "bg-blue-50/40 dark:bg-blue-950/20" : n!.is_rising ? "bg-red-50/30 dark:bg-red-950/10" : idx % 2 === 0 ? "" : "bg-muted/20"}`}
                        >
                          <td className="px-4 py-2 font-medium">
                            {n!.is_focal && (
                              <Badge
                                variant="outline"
                                className="mr-1.5 text-[9px] py-0 px-1"
                              >
                                Focal
                              </Badge>
                            )}
                            {n!.district}
                          </td>
                          <td className="px-4 py-2 text-right tabular-nums font-semibold">
                            {n!.current_cases}
                          </td>
                          <td
                            className={`px-4 py-2 text-right tabular-nums ${(n!.wow_change_pct ?? 0) > 10 ? "text-red-600 dark:text-red-400 font-semibold" : (n!.wow_change_pct ?? 0) < -5 ? "text-green-600 dark:text-green-400" : "text-muted-foreground"}`}
                          >
                            {n!.wow_change_pct !== null
                              ? `${n!.wow_change_pct >= 0 ? "+" : ""}${n!.wow_change_pct}%`
                              : "—"}
                          </td>
                          <td className="px-4 py-2 text-center">
                            {n!.is_rising ? (
                              <TrendingUp className="h-3.5 w-3.5 text-red-500 mx-auto" />
                            ) : (
                              <Minus className="h-3.5 w-3.5 text-blue-400 mx-auto" />
                            )}
                          </td>
                          <td className="px-4 py-2 text-center">
                            <span
                              className={`px-1.5 py-0.5 rounded-full border text-xs font-medium ${RISK_COLORS[n!.risk_level] || RISK_COLORS.low}`}
                            >
                              {n!.risk_level}
                            </span>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          <p className="text-xs text-muted-foreground leading-relaxed">
            {data.narrative}
          </p>
        </div>
      )}
    </div>
  );
}

// ── Intervention History ──────────────────────────────────────────

function InterventionHistoryTab({ districts }: { districts: string[] }) {
  const [district, setDistrict] = useState<string | null>(null);
  const [data, setData] = useState<InterventionHistoryResponse | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (d: string) => {
    try {
      setLoading(true);
      setData(await fetchInterventionHistory(d));
    } catch (err: any) {
      toast.error("Failed to load intervention history", {
        description: err.message,
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (district) load(district);
  }, [district, load]);

  const effectivenessColor: Record<string, string> = {
    rapid: "text-green-600 dark:text-green-400",
    moderate: "text-yellow-600 dark:text-yellow-400",
    slow: "text-red-600 dark:text-red-400",
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <DistrictSelector
          districts={districts}
          value={district}
          onChange={(d) => {
            setDistrict(d);
          }}
        />
        {district && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => load(district)}
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
          </Button>
        )}
      </div>

      {!district && (
        <EmptyState label="Select a district to view inferred intervention history." />
      )}
      {district && loading && !data && (
        <LoadingCard label="Scanning for response events..." />
      )}
      {data?.error && (
        <ErrorCard message={data.error} onRetry={() => load(district!)} />
      )}
      {data && !data.error && (
        <div className="space-y-4">
          {/* Summary row */}
          <div className="grid grid-cols-3 gap-3">
            <Card>
              <CardContent className="pt-4 pb-3 text-center">
                <p className="text-xs text-muted-foreground mb-1">
                  Response Events
                </p>
                <p className="text-2xl font-bold">
                  {data.total_events_detected}
                </p>
                <p className="text-xs text-muted-foreground">detected</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-3 text-center">
                <p className="text-xs text-muted-foreground mb-1">
                  Avg Recovery
                </p>
                <p className="text-2xl font-bold">
                  {data.average_weeks_to_recovery ?? "—"}
                </p>
                <p className="text-xs text-muted-foreground">weeks to trough</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-3 text-center">
                <p className="text-xs text-muted-foreground mb-1">
                  Most Recent Peak
                </p>
                <p className="text-sm font-bold">
                  {data.most_recent_event
                    ? `W${data.most_recent_event.peak_week}/${data.most_recent_event.peak_year}`
                    : "—"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {data.most_recent_event
                    ? `${data.most_recent_event.peak_cases} cases`
                    : "no data"}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Timeline */}
          {data.response_events.length > 0 ? (
            <Card>
              <CardHeader className="pb-2 pt-4">
                <CardTitle className="text-sm">
                  Response Events Timeline
                </CardTitle>
                <CardDescription className="text-xs">
                  Inferred from ≥30% post-peak case decline
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {data.response_events.map((ev, idx) => (
                  <div
                    key={idx}
                    className="flex items-start gap-3 p-3 rounded-lg border bg-muted/20"
                  >
                    <Syringe className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-semibold">
                          W{ev.peak_week}/{ev.peak_year}
                        </span>
                        <span className="text-xs text-muted-foreground">→</span>
                        <span className="text-xs text-muted-foreground">
                          W{ev.trough_week}/{ev.trough_year}
                        </span>
                        <Badge
                          variant="outline"
                          className={`text-[10px] ml-auto ${effectivenessColor[ev.response_effectiveness]}`}
                        >
                          {ev.response_effectiveness}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                        <span>
                          Peak:{" "}
                          <strong className="text-foreground">
                            {ev.peak_cases}
                          </strong>{" "}
                          → Trough:{" "}
                          <strong className="text-foreground">
                            {ev.trough_cases}
                          </strong>
                        </span>
                        <span className="text-red-600 dark:text-red-400 font-medium">
                          {ev.decline_pct}%
                        </span>
                        <span>{ev.weeks_to_recovery}w</span>
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">
                        {ev.inferred_action}
                      </p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : (
            <Card className="border-dashed">
              <CardContent className="py-8 text-center text-sm text-muted-foreground">
                No significant response events detected in the available data
                window.
              </CardContent>
            </Card>
          )}

          <p className="text-[11px] text-muted-foreground leading-relaxed italic">
            {data.data_note}
          </p>
        </div>
      )}
    </div>
  );
}

// ── Model Performance ────────────────────────────────────────────

function ModelPerformanceTab({ districts }: { districts: string[] }) {
  const [district, setDistrict] = useState<string | null>(null);
  const [data, setData] = useState<ModelPerformanceResponse | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (d: string) => {
    try {
      setLoading(true);
      setData(await fetchModelPerformance(d));
    } catch (err: any) {
      toast.error("Failed to load model performance", {
        description: err.message,
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (district) load(district);
  }, [district, load]);

  const trendIcon: Record<string, JSX.Element> = {
    rising: <TrendingUp className="h-4 w-4 text-red-500" />,
    falling: <TrendingDown className="h-4 w-4 text-green-500" />,
    stable: <Minus className="h-4 w-4 text-blue-500" />,
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <DistrictSelector
          districts={districts}
          value={district}
          onChange={(d) => {
            setDistrict(d);
          }}
        />
        {district && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => load(district)}
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
          </Button>
        )}
      </div>

      {!district && (
        <EmptyState label="Select a district to evaluate ML prediction accuracy." />
      )}
      {district && loading && !data && (
        <LoadingCard label="Comparing predictions to actuals..." />
      )}
      {data?.error && (
        <ErrorCard message={data.error} onRetry={() => load(district!)} />
      )}
      {data && !data.error && (
        <div className="space-y-4">
          {/* Accuracy badge */}
          <div className="flex items-center gap-3 p-4 rounded-xl bg-muted/40 border">
            <LineChart className="h-5 w-5 text-muted-foreground shrink-0" />
            <div>
              <span className="text-sm font-semibold">Accuracy Class: </span>
              <span
                className={`text-sm font-bold capitalize ${ACCURACY_COLORS[data.accuracy_class]}`}
              >
                {data.accuracy_class}
              </span>
            </div>
            {data.predicted_cases !== null && (
              <div className="ml-auto flex items-center gap-1.5">
                {data.percentage_error_pct !== null && (
                  <Badge variant="outline" className="text-xs">
                    {data.percentage_error_pct}% error
                  </Badge>
                )}
              </div>
            )}
          </div>

          {/* Prediction vs Actual */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Card>
              <CardContent className="pt-4 pb-3 text-center">
                <p className="text-xs text-muted-foreground mb-1">
                  Actual Cases
                </p>
                <p className="text-2xl font-bold">{data.actual_cases}</p>
                <p className="text-xs text-muted-foreground">
                  {data.actual_week ?? "latest"}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-3 text-center">
                <p className="text-xs text-muted-foreground mb-1">
                  Predicted Cases
                </p>
                <p className="text-2xl font-bold">
                  {data.predicted_cases ?? "—"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {data.prediction_week ?? "—"}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-3 text-center">
                <p className="text-xs text-muted-foreground mb-1">Abs. Error</p>
                <p className="text-2xl font-bold">
                  {data.absolute_error ?? "—"}
                </p>
                <p className="text-xs text-muted-foreground">cases</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-3 text-center">
                <p className="text-xs text-muted-foreground mb-1">
                  Naive MAE (8w)
                </p>
                <p className="text-2xl font-bold">
                  {data.naive_persistence_mae_8w ?? "—"}
                </p>
                <p className="text-xs text-muted-foreground">baseline</p>
              </CardContent>
            </Card>
          </div>

          {/* Trend */}
          <Card>
            <CardContent className="py-4 flex items-center gap-3">
              {trendIcon[data.observed_trend] ?? trendIcon.stable}
              <div>
                <p className="text-sm font-medium capitalize">
                  Observed trend: {data.observed_trend}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Based on 8-week actual timeseries
                </p>
              </div>
            </CardContent>
          </Card>

          <p className="text-xs text-muted-foreground leading-relaxed">
            {data.narrative}
          </p>
        </div>
      )}
    </div>
  );
}

// ── Demographic Hotspots ──────────────────────────────────────────

function DemographicHotspotsTab({ districts }: { districts: string[] }) {
  const [district, setDistrict] = useState<string | null>(null);
  const [data, setData] = useState<DemographicHotspotsResponse | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (d: string) => {
    try {
      setLoading(true);
      setData(await fetchDemographicHotspots(d));
    } catch (err: any) {
      toast.error("Failed to load hotspot data", { description: err.message });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (district) load(district);
  }, [district, load]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <DistrictSelector
          districts={districts}
          value={district}
          onChange={(d) => {
            setDistrict(d);
          }}
        />
        {district && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => load(district)}
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
          </Button>
        )}
      </div>

      {!district && (
        <EmptyState label="Select a district to identify demographic hotspot zones." />
      )}
      {district && loading && !data && (
        <LoadingCard label="Analysing zone risk distribution..." />
      )}
      {data?.error && (
        <ErrorCard message={data.error} onRetry={() => load(district!)} />
      )}
      {data && !data.error && (
        <div className="space-y-4">
          {/* Top priority alert */}
          {data.top_priority_zones.length > 0 && (
            <div className="flex items-start gap-3 p-3 rounded-lg bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800">
              <MapPinned className="h-4 w-4 text-orange-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-orange-800 dark:text-orange-300">
                  Priority Intervention Zones
                </p>
                <p className="text-xs text-orange-700 dark:text-orange-400 mt-0.5">
                  {data.top_priority_zones.join(" · ")}
                </p>
              </div>
            </div>
          )}

          {/* District summary */}
          <div className="grid grid-cols-3 gap-3">
            <Card>
              <CardContent className="pt-4 pb-3 text-center">
                <p className="text-xs text-muted-foreground mb-1">
                  Total Cases
                </p>
                <p className="text-2xl font-bold">
                  {data.total_district_cases}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-3 text-center">
                <p className="text-xs text-muted-foreground mb-1">
                  District Risk
                </p>
                <p
                  className={`text-lg font-bold capitalize ${RISK_COLORS[data.district_risk_level]?.includes("red") ? "text-red-600" : data.district_risk_level === "high" ? "text-orange-600" : data.district_risk_level === "moderate" ? "text-yellow-600" : "text-green-600"}`}
                >
                  {data.district_risk_level}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-3 text-center">
                <p className="text-xs text-muted-foreground mb-1">Zones</p>
                <p className="text-2xl font-bold">
                  {data.zone_breakdown.length}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Zone breakdown */}
          <Card>
            <CardHeader className="pb-2 pt-4">
              <CardTitle className="text-sm">Zone Breakdown</CardTitle>
              <CardDescription className="text-xs">
                Estimated case distribution by settlement type
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {data.zone_breakdown.map((zone, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-lg border bg-muted/20 space-y-1.5"
                >
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2">
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${RISK_DOT[zone.relative_risk] || "bg-slate-400"}`}
                      />
                      <span className="text-sm font-medium">{zone.zone}</span>
                      <Badge variant="outline" className="text-[10px]">
                        {zone.type}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2 ml-auto">
                      <span className="text-xs text-muted-foreground">
                        ~{zone.estimated_cases} cases
                      </span>
                      <span
                        className={`text-xs px-1.5 py-0.5 rounded-full border font-medium ${PRIORITY_COLORS[zone.intervention_priority]}`}
                      >
                        {zone.intervention_priority}
                      </span>
                    </div>
                  </div>
                  {zone.context_flags.length > 0 && (
                    <div className="space-y-0.5 pl-4">
                      {zone.context_flags.map((flag, fi) => (
                        <div
                          key={fi}
                          className="flex items-start gap-1.5 text-xs text-muted-foreground"
                        >
                          <ChevronRight className="h-3 w-3 shrink-0 mt-0.5" />
                          <span>{flag}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>

          <p className="text-[11px] text-muted-foreground leading-relaxed italic">
            {data.data_note}
          </p>
        </div>
      )}
    </div>
  );
}

// ── Main panel ───────────────────────────────────────────────────

interface Props {
  districts: string[];
}

export default function AdvancedAnalyticsPanel({ districts }: Props) {
  return (
    <Card>
      <CardHeader className="bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-950/40 dark:to-purple-950/40 pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <div className="p-1.5 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg shadow">
            <LineChart className="h-4 w-4 text-white" />
          </div>
          Advanced Analytical Tools
        </CardTitle>
        <CardDescription className="text-xs">
          Seasonal patterns · geographic spillover · intervention history ·
          model performance · demographic hotspots
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-5">
        <Tabs defaultValue="seasonal" className="space-y-4">
          <TabsList className="flex flex-wrap h-auto gap-1 bg-muted/50 p-1">
            <TabsTrigger value="seasonal" className="gap-1.5 text-xs">
              <CalendarRange className="h-3.5 w-3.5" />
              Seasonal
            </TabsTrigger>
            <TabsTrigger value="spillover" className="gap-1.5 text-xs">
              <GitMerge className="h-3.5 w-3.5" />
              Spillover
            </TabsTrigger>
            <TabsTrigger value="interventions" className="gap-1.5 text-xs">
              <Syringe className="h-3.5 w-3.5" />
              Interventions
            </TabsTrigger>
            <TabsTrigger value="model" className="gap-1.5 text-xs">
              <LineChart className="h-3.5 w-3.5" />
              Model Accuracy
            </TabsTrigger>
            <TabsTrigger value="hotspots" className="gap-1.5 text-xs">
              <MapPinned className="h-3.5 w-3.5" />
              Hotspots
            </TabsTrigger>
          </TabsList>

          <TabsContent value="seasonal">
            <SeasonalPatternTab districts={districts} />
          </TabsContent>
          <TabsContent value="spillover">
            <SpilloverTab districts={districts} />
          </TabsContent>
          <TabsContent value="interventions">
            <InterventionHistoryTab districts={districts} />
          </TabsContent>
          <TabsContent value="model">
            <ModelPerformanceTab districts={districts} />
          </TabsContent>
          <TabsContent value="hotspots">
            <DemographicHotspotsTab districts={districts} />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
