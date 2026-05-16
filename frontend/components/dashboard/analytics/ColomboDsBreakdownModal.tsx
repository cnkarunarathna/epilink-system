"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import {
  XIcon,
  MapPin,
  Info,
  Loader2,
  AlertTriangle,
  Building2,
  BarChart3,
  Percent,
} from "lucide-react";
import { useTheme } from "next-themes";
import { Badge } from "@/components/ui/badge";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import type {
  ColomboDsBreakdownResponse,
  DsDivisionBreakdown,
} from "@/services/analytics.service";

const RISK_COLORS: Record<string, string> = {
  critical: "#dc2626",
  high: "#f59e0b",
  medium: "#3b82f6",
  low: "#4ade80",
};

const RISK_BADGE_CLASSES: Record<string, string> = {
  critical: "bg-red-600 text-white border-red-700",
  high: "bg-amber-500 text-white border-amber-600",
  medium: "bg-blue-500 text-white border-blue-600",
  low: "bg-emerald-400 text-emerald-950 border-emerald-500",
};

const RISK_DOT_CLASSES: Record<string, string> = {
  critical: "bg-red-600",
  high: "bg-amber-500",
  medium: "bg-blue-500",
  low: "bg-emerald-400",
};

const RISK_BG_CLASSES: Record<string, string> = {
  critical: "bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800",
  high: "bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800",
  medium: "bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800",
  low: "bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800",
};

interface TooltipPayload {
  payload?: DsDivisionBreakdown;
}

function CustomTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: TooltipPayload[];
}) {
  if (!active || !payload?.length || !payload[0].payload) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-background border border-border rounded-lg shadow-xl p-3 text-sm space-y-1.5 min-w-[190px] z-300">
      <p className="font-semibold text-foreground border-b border-border pb-1.5">
        {d.ds_division}
      </p>
      <div className="flex justify-between items-center">
        <span className="text-muted-foreground text-xs">Predicted cases</span>
        <strong className="tabular-nums">{d.predicted_cases}</strong>
      </div>
      <div className="flex justify-between items-center">
        <span className="text-muted-foreground text-xs">95% CI</span>
        <span className="tabular-nums text-xs">
          {d.confidence_interval.lower}–{d.confidence_interval.upper}
        </span>
      </div>
      <div className="flex justify-between items-center">
        <span className="text-muted-foreground text-xs">District share</span>
        <span className="tabular-nums text-xs">
          {(d.proportion * 100).toFixed(1)}%
        </span>
      </div>
      <Badge
        variant="outline"
        className={`text-xs w-full justify-center mt-0.5 ${RISK_BADGE_CLASSES[d.risk_level]}`}
      >
        {d.risk_level.charAt(0).toUpperCase() + d.risk_level.slice(1)} Risk
      </Badge>
    </div>
  );
}

interface Props {
  open: boolean;
  onClose: () => void;
  data: ColomboDsBreakdownResponse | null;
  loading?: boolean;
}

export default function ColomboDsBreakdownModal({
  open,
  onClose,
  data,
  loading,
}: Props) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  const topDs = data?.ds_breakdown[0];
  const criticalCount =
    data?.ds_breakdown.filter((d) => d.risk_level === "critical").length ?? 0;
  const highCount =
    data?.ds_breakdown.filter((d) => d.risk_level === "high").length ?? 0;
  const dsCount = data?.ds_breakdown.length ?? 0;

  return (
    <DialogPrimitive.Root open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogPrimitive.Portal>
        {/* Overlay */}
        <DialogPrimitive.Overlay className="fixed inset-0 z-2000 bg-black/60 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />

        <DialogPrimitive.Content
          className="
            fixed top-1/2 left-1/2 z-2000
            w-full max-w-[calc(100%-1.5rem)] sm:max-w-2xl lg:max-w-3xl
            max-h-[92vh]
            -translate-x-1/2 -translate-y-1/2
            flex flex-col
            rounded-2xl border bg-background shadow-2xl outline-none
            data-[state=open]:animate-in data-[state=closed]:animate-out
            data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0
            data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95
            data-[state=open]:slide-in-from-bottom-4
            duration-200
          "
        >
          {/* ── Hero header with gradient ──────────────────────────────── */}
          <div className="shrink-0 relative overflow-hidden rounded-t-2xl">
            <div className="absolute inset-0 bg-linear-to-br from-emerald-600 via-green-600 to-teal-700" />
            <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-white/10 pointer-events-none" />
            <div className="absolute -bottom-8 -left-8 w-32 h-32 rounded-full bg-white/5 pointer-events-none" />

            <div className="relative px-5 pt-5 pb-4">
              <DialogPrimitive.Close className="absolute top-4 right-4 rounded-lg p-1.5 text-white/70 hover:text-white hover:bg-white/20 transition-all">
                <XIcon className="h-4 w-4" />
                <span className="sr-only">Close</span>
              </DialogPrimitive.Close>

              <div className="flex items-start gap-3 pr-8">
                <div className="p-2.5 bg-white/20 backdrop-blur-sm rounded-xl border border-white/30 shrink-0">
                  <MapPin className="h-5 w-5 text-white" />
                </div>
                <div>
                  <DialogPrimitive.Title className="text-xl font-bold text-white leading-tight">
                    Colombo District
                  </DialogPrimitive.Title>
                  <DialogPrimitive.Description className="text-emerald-100 text-sm mt-0.5">
                    DS Division Breakdown
                    {data && (
                      <span className="ml-2 text-white/60">
                        · Week {data.week}, {data.year}
                      </span>
                    )}
                  </DialogPrimitive.Description>
                </div>
              </div>

              {/* Inline quick stats */}
              {data && (
                <div className="grid grid-cols-3 gap-2 mt-4">
                  <div className="bg-white/15 backdrop-blur-sm rounded-xl p-2.5 text-center border border-white/20">
                    <div className="text-2xl font-bold text-white tabular-nums">
                      {data.district_predicted_cases}
                    </div>
                    <div className="text-[10px] text-emerald-100 mt-0.5 uppercase tracking-wide">
                      District Cases
                    </div>
                  </div>
                  <div className="bg-white/15 backdrop-blur-sm rounded-xl p-2.5 text-center border border-white/20">
                    <div className="text-2xl font-bold text-red-200 tabular-nums">
                      {criticalCount + highCount}
                    </div>
                    <div className="text-[10px] text-emerald-100 mt-0.5 uppercase tracking-wide">
                      Alert Zones
                    </div>
                  </div>
                  <div className="bg-white/15 backdrop-blur-sm rounded-xl p-2.5 text-center border border-white/20">
                    <div className="text-2xl font-bold text-white tabular-nums">
                      {dsCount}
                    </div>
                    <div className="text-[10px] text-emerald-100 mt-0.5 uppercase tracking-wide">
                      DS Divisions
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ── Scrollable body ───────────────────────────────── */}
          <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-4 space-y-5">
            {loading && (
              <div className="flex flex-col items-center justify-center h-56 gap-3 text-muted-foreground">
                <div className="relative">
                  <Loader2 className="h-10 w-10 animate-spin text-emerald-500" />
                  <div className="absolute inset-0 rounded-full bg-emerald-500/10 animate-ping" />
                </div>
                <p className="text-sm font-medium">
                  Loading DS division breakdown…
                </p>
                <p className="text-xs text-muted-foreground/60">
                  Fetching spatial disaggregation data
                </p>
              </div>
            )}

            {data && !loading && (
              <>
                {/* ── Highest burden highlight ────────────────── */}
                {topDs && (
                  <div
                    className={`rounded-xl border p-3.5 flex items-center gap-3 ${RISK_BG_CLASSES[topDs.risk_level]}`}
                  >
                    <div
                      className="p-2 rounded-lg shrink-0"
                      style={{
                        backgroundColor: `${RISK_COLORS[topDs.risk_level]}25`,
                      }}
                    >
                      <AlertTriangle
                        className="h-4 w-4"
                        style={{ color: RISK_COLORS[topDs.risk_level] }}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                        Highest Burden DS Division
                      </p>
                      <p className="font-bold text-sm truncate">
                        {topDs.ds_division}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xl font-bold tabular-nums">
                        {topDs.predicted_cases}
                      </p>
                      <Badge
                        variant="outline"
                        className={`text-xs mt-0.5 ${RISK_BADGE_CLASSES[topDs.risk_level]}`}
                      >
                        {topDs.risk_level}
                      </Badge>
                    </div>
                  </div>
                )}

                {/* ── Horizontal bar chart ───────────────────── */}
                <div className="rounded-xl border border-border bg-card p-3 sm:p-4">
                  <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                    <div className="p-1 bg-primary/10 rounded-md">
                      <BarChart3 className="h-3.5 w-3.5 text-primary" />
                    </div>
                    Predicted Cases by DS Division
                  </h4>

                  <div className="h-72 sm:h-80 lg:h-96 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        layout="vertical"
                        data={data.ds_breakdown}
                        margin={{ top: 4, right: 42, left: 0, bottom: 4 }}
                        barCategoryGap="35%"
                      >
                        <CartesianGrid
                          strokeDasharray="4 4"
                          horizontal={false}
                          stroke={
                            isDark
                              ? "rgba(255,255,255,0.07)"
                              : "rgba(0,0,0,0.07)"
                          }
                        />
                        <XAxis
                          type="number"
                          tick={{
                            fontSize: 10,
                            fill: isDark ? "#94a3b8" : "#64748b",
                          }}
                          axisLine={false}
                          tickLine={false}
                          tickCount={5}
                        />
                        <YAxis
                          type="category"
                          dataKey="ds_division"
                          tick={{
                            fontSize: 10,
                            fill: isDark ? "#94a3b8" : "#64748b",
                          }}
                          axisLine={false}
                          tickLine={false}
                          width={112}
                        />
                        <Tooltip
                          content={<CustomTooltip />}
                          cursor={{
                            fill: isDark
                              ? "rgba(255,255,255,0.05)"
                              : "rgba(0,0,0,0.05)",
                          }}
                        />
                        <Bar
                          dataKey="predicted_cases"
                          radius={[0, 5, 5, 0]}
                          barSize={13}
                          animationDuration={550}
                          background={{
                            fill: isDark
                              ? "rgba(255,255,255,0.04)"
                              : "rgba(0,0,0,0.04)",
                            radius: 4,
                          }}
                          label={{
                            position: "right",
                            fontSize: 10,
                            fill: isDark ? "#94a3b8" : "#64748b",
                          }}
                        >
                          {data.ds_breakdown.map((entry) => (
                            <Cell
                              key={entry.ds_division}
                              fill={RISK_COLORS[entry.risk_level]}
                            />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="flex items-center gap-3 sm:gap-4 mt-3 justify-center flex-wrap">
                    {(["critical", "high", "medium", "low"] as const).map(
                      (level) => (
                        <div
                          key={level}
                          className="flex items-center gap-1.5 text-xs text-muted-foreground"
                        >
                          <span
                            className="h-2.5 w-2.5 rounded-sm shrink-0"
                            style={{ backgroundColor: RISK_COLORS[level] }}
                          />
                          {level.charAt(0).toUpperCase() + level.slice(1)}
                        </div>
                      ),
                    )}
                  </div>
                </div>

                {/* ── DS Division cards ──────────────────────── */}
                <div>
                  <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                    <div className="p-1 bg-muted rounded-md">
                      <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                    </div>
                    All {dsCount} Divisional Secretariat Areas
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                    {data.ds_breakdown.map((ds, idx) => (
                      <div
                        key={ds.ds_division}
                        className="border rounded-xl p-3.5 space-y-2.5 hover:shadow-md hover:bg-muted/20 transition-all duration-150 relative overflow-hidden group"
                        style={{
                          borderLeftColor: RISK_COLORS[ds.risk_level],
                          borderLeftWidth: 3,
                        }}
                      >
                        <span className="absolute top-2 right-2 text-[10px] text-muted-foreground/40 font-mono group-hover:text-muted-foreground/70 transition-colors">
                          #{idx + 1}
                        </span>

                        <div className="flex items-start gap-2 pr-5">
                          <span
                            className={`h-2 w-2 rounded-full shrink-0 mt-1.5 ${RISK_DOT_CLASSES[ds.risk_level]}`}
                          />
                          <p className="text-xs font-bold leading-tight">
                            {ds.ds_division}
                          </p>
                        </div>

                        <div className="flex items-end justify-between">
                          <div>
                            <p className="text-2xl font-bold tabular-nums leading-none">
                              {ds.predicted_cases}
                            </p>
                            <p className="text-[10px] text-muted-foreground mt-0.5">
                              predicted cases
                            </p>
                          </div>
                          <Badge
                            variant="outline"
                            className={`text-xs shrink-0 ${RISK_BADGE_CLASSES[ds.risk_level]}`}
                          >
                            {ds.risk_level}
                          </Badge>
                        </div>

                        {/* Proportion progress bar */}
                        <div className="space-y-1">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1">
                              <Percent className="h-3 w-3 text-muted-foreground" />
                              <span className="text-[10px] text-muted-foreground">
                                District share
                              </span>
                            </div>
                            <span className="text-[10px] font-semibold tabular-nums">
                              {(ds.proportion * 100).toFixed(1)}%
                            </span>
                          </div>
                          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all duration-700"
                              style={{
                                width: `${(ds.proportion * 100).toFixed(1)}%`,
                                backgroundColor: RISK_COLORS[ds.risk_level],
                              }}
                            />
                          </div>
                        </div>

                        <p className="text-[10px] text-muted-foreground tabular-nums">
                          95% CI: {ds.confidence_interval.lower}–
                          {ds.confidence_interval.upper}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* ── Methodology footnote (collapsible) ──────── */}
                <details className="group">
                  <summary className="cursor-pointer list-none flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors select-none p-3 rounded-lg hover:bg-muted/50 border border-dashed border-border">
                    <Info className="h-3.5 w-3.5 shrink-0 text-blue-500" />
                    <span className="font-medium">
                      Methodology &amp; Data Sources
                    </span>
                    <span className="ml-auto text-[10px] text-muted-foreground/50 group-open:hidden">
                      Click to expand
                    </span>
                  </summary>
                  <div className="mt-2 p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800 text-xs text-blue-700 dark:text-blue-300 leading-relaxed">
                    DS-level estimates use a two-stage pipeline: district-level
                    XGBoost ensemble forecast + spatial disaggregation weighted
                    by population proportion (50%), population density (30%),
                    and historical dengue burden index (20%). Consistent with
                    established small-area estimation methods.
                  </div>
                </details>
              </>
            )}
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
