"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Activity,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  RotateCcw,
  Loader2,
  ShieldAlert,
  CheckCircle2,
  Info,
} from "lucide-react";
import { useEffect, useState } from "react";
import { fetchGrowthRate } from "@/services/analytics.service";
import { fetchPublicGrowthRate } from "@/services/public-analytics.service";

interface GrowthData {
  district: string;
  avg_growth_rate: number;
  current_cases: number;
  prev_cases: number;
  trend: string;
}

// 5-tier interpretation regardless of backend's 3-tier classification
function getInterpretation(rate: number, publicMode: boolean) {
  if (rate >= 25)
    return {
      label: publicMode ? "Spreading fast" : "Surging",
      shortLabel: publicMode ? "Spreading fast" : "Surging",
      color: "text-red-700 dark:text-red-400",
      barColor: "bg-red-600 dark:bg-red-500",
      border: "border-l-red-600 dark:border-l-red-500",
      bg: "bg-red-50/70 dark:bg-red-950/20",
      chipBg: "bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400",
    };
  if (rate >= 10)
    return {
      label: publicMode ? "Spreading" : "Rising",
      shortLabel: publicMode ? "Spreading" : "Rising",
      color: "text-orange-600 dark:text-orange-400",
      barColor: "bg-orange-500 dark:bg-orange-400",
      border: "border-l-orange-500 dark:border-l-orange-400",
      bg: "bg-orange-50/70 dark:bg-orange-950/20",
      chipBg: "bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-400",
    };
  if (rate <= -25)
    return {
      label: publicMode ? "Recovering" : "Declining",
      shortLabel: publicMode ? "Recovering" : "Declining",
      color: "text-emerald-700 dark:text-emerald-400",
      barColor: "bg-emerald-600 dark:bg-emerald-500",
      border: "border-l-emerald-600 dark:border-l-emerald-500",
      bg: "bg-emerald-50/70 dark:bg-emerald-950/20",
      chipBg: "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400",
    };
  if (rate <= -10)
    return {
      label: publicMode ? "Improving" : "Easing",
      shortLabel: publicMode ? "Improving" : "Easing",
      color: "text-green-600 dark:text-green-400",
      barColor: "bg-green-500 dark:bg-green-400",
      border: "border-l-green-500 dark:border-l-green-400",
      bg: "bg-green-50/70 dark:bg-green-950/20",
      chipBg: "bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400",
    };
  return {
    label: publicMode ? "Holding steady" : "Stable",
    shortLabel: publicMode ? "Steady" : "Stable",
    color: "text-slate-500 dark:text-slate-400",
    barColor: "bg-slate-300 dark:bg-slate-600",
    border: "border-l-slate-300 dark:border-l-slate-600",
    bg: "bg-slate-50/60 dark:bg-slate-900/20",
    chipBg: "bg-slate-100 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400",
  };
}

function getAssessment(data: GrowthData[], publicMode: boolean) {
  const surging = data.filter((d) => d.avg_growth_rate >= 25);
  const rising = data.filter((d) => d.avg_growth_rate >= 10);
  const declining = data.filter((d) => d.avg_growth_rate <= -10);

  if (surging.length > 0) {
    const names = surging
      .slice(0, 2)
      .map((d) => d.district)
      .join(", ");
    return {
      icon: ShieldAlert,
      text: publicMode
        ? `Dengue is spreading rapidly in ${surging.length} area${surging.length > 1 ? "s" : ""}${surging.length <= 2 ? ` (${names})` : ""}. Take extra precautions.`
        : `Outbreak-level growth in ${surging.length} district${surging.length > 1 ? "s" : ""}${surging.length <= 2 ? ` — ${names}` : ""}. Urgent action recommended.`,
      severity: "critical" as const,
    };
  }
  if (rising.length > 0 && declining.length === 0) {
    return {
      icon: TrendingUp,
      text: publicMode
        ? `Cases are rising in ${rising.length} area${rising.length > 1 ? "s" : ""}. Stay vigilant and use mosquito prevention measures.`
        : `Rising trends detected in ${rising.length} district${rising.length > 1 ? "s" : ""}. Allocate resources to high-growth areas.`,
      severity: "warning" as const,
    };
  }
  if (rising.length > 0 && declining.length > 0) {
    return {
      icon: Activity,
      text: publicMode
        ? `Mixed picture — cases spreading in ${rising.length} area${rising.length > 1 ? "s" : ""}, improving in ${declining.length}.`
        : `Mixed trends — ${rising.length} rising, ${declining.length} declining. Monitor rising districts closely.`,
      severity: "mixed" as const,
    };
  }
  if (declining.length > 0) {
    return {
      icon: TrendingDown,
      text: publicMode
        ? `Good news — the situation is improving in ${declining.length} area${declining.length > 1 ? "s" : ""}. Keep up prevention efforts.`
        : `Positive signal — cases declining in ${declining.length} district${declining.length > 1 ? "s" : ""}. Continue active surveillance.`,
      severity: "good" as const,
    };
  }
  return {
    icon: CheckCircle2,
    text: publicMode
      ? "Dengue activity is stable across most areas this week. No major outbreaks detected."
      : "All districts stable — no significant surge or decline. Routine monitoring sufficient.",
    severity: "stable" as const,
  };
}

const SEVERITY_STYLES = {
  critical: "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800 text-red-800 dark:text-red-300",
  warning: "bg-orange-50 dark:bg-orange-950/30 border-orange-200 dark:border-orange-800 text-orange-800 dark:text-orange-300",
  mixed: "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300",
  good: "bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800 text-green-800 dark:text-green-300",
  stable: "bg-slate-50 dark:bg-slate-900/30 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300",
};

export default function GrowthRatePanel({
  usePublicApi = false,
}: {
  usePublicApi?: boolean;
}) {
  const [growthData, setGrowthData] = useState<GrowthData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadGrowthRate();
  }, []);

  const loadGrowthRate = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = usePublicApi
        ? await fetchPublicGrowthRate(4)
        : await fetchGrowthRate(4);
      setGrowthData(Array.isArray(data) ? data : []);
    } catch (err: any) {
      console.error("Failed to load growth rate:", err);
      setError(
        err?.response?.data?.message || err?.message || "Failed to load data",
      );
    } finally {
      setLoading(false);
    }
  };

  // ── derived values ──────────────────────────────────────────────────
  const allSorted = [...growthData].sort(
    (a, b) => b.avg_growth_rate - a.avg_growth_rate,
  );
  const maxRate = Math.max(...growthData.map((d) => Math.abs(d.avg_growth_rate)), 1);
  const risingCount = growthData.filter((d) => d.avg_growth_rate >= 10).length;
  const stableCount = growthData.filter(
    (d) => d.avg_growth_rate > -10 && d.avg_growth_rate < 10,
  ).length;
  const decliningCount = growthData.filter((d) => d.avg_growth_rate <= -10).length;

  // ── skeleton / error / empty ────────────────────────────────────────
  const cardShell = (children: React.ReactNode) => (
    <Card className="shadow-lg border-2 hover:shadow-xl transition-shadow max-h-[600px] flex flex-col">
      <CardHeader className="bg-linear-to-r from-blue-50 to-indigo-50 dark:from-blue-950/40 dark:to-indigo-950/40 pb-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/50 rounded-lg shrink-0">
              <Activity className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <CardTitle className="text-base leading-tight">
                {usePublicApi
                  ? "Is dengue spreading or slowing?"
                  : "Growth Rate Analysis"}
              </CardTitle>
              <CardDescription className="text-xs mt-0.5">
                {usePublicApi
                  ? "How cases changed over the past 4 weeks"
                  : "4-week avg week-over-week change · all districts"}
              </CardDescription>
            </div>
          </div>
          {!loading && !error && growthData.length > 0 && (
            <button
              onClick={loadGrowthRate}
              className="text-muted-foreground hover:text-foreground transition-colors mt-0.5 shrink-0"
              title="Refresh"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </CardHeader>
      {children}
    </Card>
  );

  if (loading) {
    return cardShell(
      <CardContent className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-2 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span className="text-sm">Loading growth data…</span>
        </div>
      </CardContent>,
    );
  }

  if (error) {
    return cardShell(
      <CardContent className="flex flex-col items-center justify-center h-64 gap-3 text-muted-foreground">
        <AlertCircle className="h-8 w-8 text-red-400" />
        <p className="text-sm text-center max-w-xs">{error}</p>
        <button
          onClick={loadGrowthRate}
          className="flex items-center gap-1.5 text-xs text-primary hover:underline"
        >
          <RotateCcw className="h-3.5 w-3.5" /> Retry
        </button>
      </CardContent>,
    );
  }

  if (growthData.length === 0) {
    return cardShell(
      <CardContent className="flex flex-col items-center justify-center h-64 gap-2 text-muted-foreground">
        <Activity className="h-8 w-8 opacity-25" />
        <p className="text-sm">No growth rate data available</p>
      </CardContent>,
    );
  }

  const assessment = getAssessment(growthData, usePublicApi);
  const AssessmentIcon = assessment.icon;

  return cardShell(
    <CardContent className="pt-4 flex-1 flex flex-col gap-4 min-h-0">
      {/* ── Summary stat chips ───────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30 py-2.5 px-1">
          <div className="text-2xl font-bold text-red-600 dark:text-red-400 leading-none">
            {risingCount}
          </div>
          <div className="text-[10px] text-red-600/80 dark:text-red-400/80 font-medium mt-1 uppercase tracking-wide">
            {usePublicApi ? "Rising" : "Rising"}
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/30 py-2.5 px-1">
          <div className="text-2xl font-bold text-slate-600 dark:text-slate-400 leading-none">
            {stableCount}
          </div>
          <div className="text-[10px] text-slate-500 dark:text-slate-400 font-medium mt-1 uppercase tracking-wide">
            Stable
          </div>
        </div>
        <div className="rounded-xl border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/30 py-2.5 px-1">
          <div className="text-2xl font-bold text-green-600 dark:text-green-400 leading-none">
            {decliningCount}
          </div>
          <div className="text-[10px] text-green-600/80 dark:text-green-400/80 font-medium mt-1 uppercase tracking-wide">
            {usePublicApi ? "Improving" : "Declining"}
          </div>
        </div>
      </div>

      {/* ── Overall situation assessment ─────────────────────────── */}
      <div
        className={`flex items-start gap-2.5 rounded-lg border p-3 text-sm ${SEVERITY_STYLES[assessment.severity]}`}
      >
        <AssessmentIcon className="h-4 w-4 mt-0.5 shrink-0" />
        <span className="leading-snug">{assessment.text}</span>
      </div>

      {/* ── District list header ─────────────────────────────────── */}
      <div className="flex items-center justify-between text-xs text-muted-foreground px-0.5">
        <span className="font-medium uppercase tracking-wide">District</span>
        <div className="flex items-center gap-6 pr-1">
          <span className="hidden sm:block">Trend</span>
          <span>Rate</span>
          <span className="hidden md:block w-14 text-right">Cases</span>
        </div>
      </div>

      {/* ── Sorted district rows ─────────────────────────────────── */}
      <div className="space-y-1.5 flex-1 min-h-0 overflow-y-auto -mx-1 px-1 pb-0.5">
        {allSorted.map((item, i) => {
          const interp = getInterpretation(item.avg_growth_rate, usePublicApi);
          const pct = (Math.abs(item.avg_growth_rate) / maxRate) * 100;
          const delta = item.current_cases - item.prev_cases;
          const sign = item.avg_growth_rate >= 0 ? "+" : "";
          return (
            <div
              key={item.district}
              className={`flex items-center gap-2.5 rounded-lg border-l-4 px-3 py-2.5 ${interp.border} ${interp.bg} hover:brightness-[0.97] dark:hover:brightness-110 transition-all`}
            >
              {/* Rank */}
              <span className="text-[11px] text-muted-foreground w-4 text-right shrink-0 tabular-nums">
                {i + 1}
              </span>

              {/* Name + interpretation label */}
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-sm leading-tight truncate">
                  {item.district}
                </div>
                <span
                  className={`text-[10px] font-semibold uppercase tracking-wide ${interp.color}`}
                >
                  {interp.shortLabel}
                </span>
              </div>

              {/* Relative progress bar */}
              <div className="w-20 hidden sm:flex flex-col gap-1">
                <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${interp.barColor} transition-all duration-500`}
                    style={{ width: `${Math.max(pct, 4)}%` }}
                  />
                </div>
              </div>

              {/* Growth rate % */}
              <div
                className={`text-sm font-bold tabular-nums shrink-0 w-[52px] text-right ${interp.color}`}
              >
                {sign}
                {item.avg_growth_rate.toFixed(1)}%
              </div>

              {/* Case count + delta */}
              <div className="text-right shrink-0 hidden md:block w-14">
                <div className="text-xs font-semibold tabular-nums leading-tight">
                  {item.current_cases.toLocaleString()}
                </div>
                <div
                  className={`text-[10px] tabular-nums leading-tight ${
                    delta > 0
                      ? "text-red-500 dark:text-red-400"
                      : delta < 0
                        ? "text-green-500 dark:text-green-400"
                        : "text-muted-foreground"
                  }`}
                >
                  {delta > 0 ? "+" : ""}
                  {delta !== 0 ? delta.toLocaleString() : "—"}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Legend / threshold note ──────────────────────────────── */}
      <div className="flex items-start gap-1.5 pt-1 border-t border-border">
        <Info className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          <span className="font-medium">How to read:</span> Rate = avg week-over-week % change over 4 weeks.{" "}
          <span className="text-orange-600 dark:text-orange-400 font-medium">Rising</span> ≥ +10% ·{" "}
          <span className="text-slate-500 dark:text-slate-400 font-medium">Stable</span> within ±10% ·{" "}
          <span className="text-green-600 dark:text-green-400 font-medium">
            {usePublicApi ? "Improving" : "Declining"}
          </span>{" "}
          ≤ −10% · Cases column shows current week vs prior week (Δ).
        </p>
      </div>
    </CardContent>,
  );
}
