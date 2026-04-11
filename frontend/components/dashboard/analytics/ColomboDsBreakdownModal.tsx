"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { XIcon, MapPin, TrendingUp, Info, Loader2 } from "lucide-react";
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
    <div className="bg-background border border-border rounded-lg shadow-xl p-3 text-sm space-y-1 min-w-[180px] z-300">
      <p className="font-semibold text-foreground">{d.ds_division}</p>
      <p className="tabular-nums">
        <span className="text-muted-foreground">Cases: </span>
        <strong>{d.predicted_cases}</strong>
      </p>
      <p className="text-muted-foreground tabular-nums text-xs">
        CI: {d.confidence_interval.lower}–{d.confidence_interval.upper}
      </p>
      <p className="text-muted-foreground text-xs">
        {(d.proportion * 100).toFixed(1)}% of district
      </p>
      <Badge
        variant="outline"
        className={`text-xs ${RISK_BADGE_CLASSES[d.risk_level]}`}
      >
        {d.risk_level}
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
  const topDs = data?.ds_breakdown[0];
  const criticalCount =
    data?.ds_breakdown.filter((d) => d.risk_level === "critical").length ?? 0;
  const highCount =
    data?.ds_breakdown.filter((d) => d.risk_level === "high").length ?? 0;

  return (
    <DialogPrimitive.Root open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogPrimitive.Portal>
        {/* Overlay — z-2000 ensures it sits above MapLibre GL canvas layers */}
        <DialogPrimitive.Overlay className="fixed inset-0 z-2000 bg-black/60 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />

        {/* Dialog content — flex column so header is sticky and body scrolls */}
        <DialogPrimitive.Content
          className="
            fixed top-1/2 left-1/2 z-2000
            w-full max-w-[calc(100%-1.5rem)] sm:max-w-2xl lg:max-w-3xl
            max-h-[92vh]
            -translate-x-1/2 -translate-y-1/2
            flex flex-col
            rounded-xl border bg-background shadow-2xl outline-none
            data-[state=open]:animate-in data-[state=closed]:animate-out
            data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0
            data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95
            duration-200
          "
        >
          {/* ── Sticky header ─────────────────────────────────── */}
          <div className="shrink-0 px-5 pt-5 pb-4 border-b border-border">
            <DialogPrimitive.Close className="absolute top-4 right-4 rounded-md p-1 opacity-70 hover:opacity-100 hover:bg-muted transition-all">
              <XIcon className="h-4 w-4" />
              <span className="sr-only">Close</span>
            </DialogPrimitive.Close>

            <DialogPrimitive.Title className="flex items-center gap-2.5 text-lg font-semibold pr-8">
              <span className="p-1.5 bg-linear-to-br from-emerald-500 to-green-700 rounded-lg shrink-0">
                <MapPin className="h-4 w-4 text-white" />
              </span>
              Colombo — DS Division Breakdown
            </DialogPrimitive.Title>

            {data && (
              <DialogPrimitive.Description className="mt-1 text-sm text-muted-foreground">
                Week {data.week}, {data.year} · District forecast:{" "}
                <strong className="text-foreground font-semibold">
                  {data.district_predicted_cases} cases
                </strong>{" "}
                across {data.ds_breakdown.length} DS divisions
              </DialogPrimitive.Description>
            )}
          </div>

          {/* ── Scrollable body ───────────────────────────────── */}
          <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-4 space-y-5">
            {loading && (
              <div className="flex flex-col items-center justify-center h-56 gap-3 text-muted-foreground">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm">Loading DS breakdown…</p>
              </div>
            )}

            {data && !loading && (
              <>
                {/* ── Summary strip ──────────────────────────── */}
                <div className="grid grid-cols-3 gap-2 sm:gap-3">
                  <div className="bg-muted/50 rounded-lg p-2.5 sm:p-3 text-center border border-border">
                    <div className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wide mb-1">
                      District Total
                    </div>
                    <div className="text-xl sm:text-2xl font-bold">
                      {data.district_predicted_cases}
                    </div>
                    <div className="text-[10px] sm:text-xs text-muted-foreground">
                      cases
                    </div>
                  </div>

                  <div className="bg-muted/50 rounded-lg p-2.5 sm:p-3 text-center border border-border">
                    <div className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wide mb-1">
                      Highest Burden
                    </div>
                    <div
                      className="text-xs sm:text-sm font-bold truncate"
                      title={topDs?.ds_division}
                    >
                      {topDs?.ds_division}
                    </div>
                    <div className="mt-1">
                      <Badge
                        variant="outline"
                        className={`text-[10px] sm:text-xs ${RISK_BADGE_CLASSES[topDs?.risk_level ?? "low"]}`}
                      >
                        {topDs?.risk_level}
                      </Badge>
                    </div>
                  </div>

                  <div className="bg-muted/50 rounded-lg p-2.5 sm:p-3 text-center border border-border">
                    <div className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wide mb-1">
                      Alert Zones
                    </div>
                    <div className="text-xl sm:text-2xl font-bold text-red-600">
                      {criticalCount + highCount}
                    </div>
                    <div className="text-[10px] sm:text-xs text-muted-foreground">
                      high + critical
                    </div>
                  </div>
                </div>

                {/* ── Horizontal bar chart ───────────────────── */}
                <div className="rounded-xl border border-border bg-card p-3 sm:p-4">
                  <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-primary shrink-0" />
                    Predicted Cases by DS Division
                  </h4>

                  {/* Chart — taller on desktop, shorter on mobile */}
                  <div className="h-64 sm:h-72 lg:h-80 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        layout="vertical"
                        data={data.ds_breakdown}
                        margin={{ top: 0, right: 36, left: 0, bottom: 0 }}
                      >
                        <CartesianGrid
                          strokeDasharray="3 3"
                          horizontal={false}
                          stroke="hsl(var(--border))"
                        />
                        <XAxis
                          type="number"
                          tick={{ fontSize: 10 }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <YAxis
                          type="category"
                          dataKey="ds_division"
                          tick={{ fontSize: 10 }}
                          axisLine={false}
                          tickLine={false}
                          width={108}
                        />
                        <Tooltip
                          content={<CustomTooltip />}
                          cursor={{ fill: "hsl(var(--muted))" }}
                        />
                        <Bar
                          dataKey="predicted_cases"
                          radius={[0, 4, 4, 0]}
                          label={{
                            position: "right",
                            fontSize: 10,
                            fill: "hsl(var(--muted-foreground))",
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

                  {/* Legend */}
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
                  <h4 className="text-sm font-semibold mb-3">
                    All Divisional Secretariat Areas
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                    {data.ds_breakdown.map((ds, idx) => (
                      <div
                        key={ds.ds_division}
                        className="border rounded-lg p-3 space-y-1.5 hover:bg-muted/30 transition-colors relative overflow-hidden"
                        style={{
                          borderLeftColor: RISK_COLORS[ds.risk_level],
                          borderLeftWidth: 3,
                        }}
                      >
                        <span className="absolute top-2 right-2 text-[10px] text-muted-foreground font-mono">
                          #{idx + 1}
                        </span>
                        <div className="flex items-start gap-1.5">
                          <span
                            className={`h-2 w-2 rounded-full shrink-0 mt-0.5 ${RISK_DOT_CLASSES[ds.risk_level]}`}
                          />
                          <div className="text-xs font-semibold leading-tight pr-5">
                            {ds.ds_division}
                          </div>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-lg font-bold tabular-nums">
                            {ds.predicted_cases}
                          </span>
                          <Badge
                            variant="outline"
                            className={`text-xs ${RISK_BADGE_CLASSES[ds.risk_level]}`}
                          >
                            {ds.risk_level}
                          </Badge>
                        </div>
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span className="tabular-nums">
                            CI: {ds.confidence_interval.lower}–
                            {ds.confidence_interval.upper}
                          </span>
                          <span>{(ds.proportion * 100).toFixed(1)}%</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* ── Academic footnote ──────────────────────── */}
                <div className="flex items-start gap-2 p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800 text-xs text-blue-700 dark:text-blue-300">
                  <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                  <span>
                    DS-level estimates use a two-stage pipeline: district-level
                    XGBoost ensemble forecast + spatial disaggregation weighted
                    by population proportion (50%), population density (30%),
                    and historical dengue burden index (20%). Consistent with
                    established small-area estimation methods.
                  </span>
                </div>
              </>
            )}
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
