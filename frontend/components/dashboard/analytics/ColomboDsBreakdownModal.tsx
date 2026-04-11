"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { MapPin, TrendingUp, Info, Loader2 } from "lucide-react";
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
import type { ColomboDsBreakdownResponse, DsDivisionBreakdown } from "@/services/analytics.service";

const RISK_COLORS: Record<string, string> = {
  critical: "#dc2626",
  high:     "#f59e0b",
  medium:   "#3b82f6",
  low:      "#4ade80",
};

const RISK_BADGE_CLASSES: Record<string, string> = {
  critical: "bg-red-600 text-white border-red-700",
  high:     "bg-amber-500 text-white border-amber-600",
  medium:   "bg-blue-500 text-white border-blue-600",
  low:      "bg-emerald-400 text-emerald-950 border-emerald-500",
};

const RISK_DOT_CLASSES: Record<string, string> = {
  critical: "bg-red-600",
  high:     "bg-amber-500",
  medium:   "bg-blue-500",
  low:      "bg-emerald-400",
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
    <div className="bg-background border border-border rounded-lg shadow-lg p-3 text-sm space-y-1 min-w-[200px]">
      <p className="font-semibold">{d.ds_division}</p>
      <p className="tabular-nums">
        <span className="text-muted-foreground">Cases: </span>
        <strong>{d.predicted_cases}</strong>
      </p>
      <p className="text-muted-foreground tabular-nums">
        CI: {d.confidence_interval.lower}–{d.confidence_interval.upper}
      </p>
      <p className="text-muted-foreground">
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

  const criticalCount = data?.ds_breakdown.filter((d) => d.risk_level === "critical").length ?? 0;
  const highCount     = data?.ds_breakdown.filter((d) => d.risk_level === "high").length ?? 0;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto p-6">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <div className="p-1.5 bg-linear-to-br from-emerald-500 to-green-700 rounded-lg shrink-0">
              <MapPin className="h-5 w-5 text-white" />
            </div>
            Colombo District — DS Division Breakdown
          </DialogTitle>
          {data && (
            <DialogDescription>
              Week {data.week}, {data.year} · District forecast:{" "}
              <strong className="text-foreground">
                {data.district_predicted_cases} cases
              </strong>{" "}
              disaggregated across {data.ds_breakdown.length} DS divisions
            </DialogDescription>
          )}
        </DialogHeader>

        {loading && (
          <div className="flex flex-col items-center justify-center h-64 gap-3 text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm">Loading DS breakdown…</p>
          </div>
        )}

        {data && !loading && (
          <div className="space-y-5">
            {/* ── Summary strip ─────────────────────────────────── */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-muted/50 rounded-lg p-3 text-center border border-border">
                <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                  District Total
                </div>
                <div className="text-2xl font-bold">
                  {data.district_predicted_cases}
                </div>
                <div className="text-xs text-muted-foreground">cases</div>
              </div>
              <div className="bg-muted/50 rounded-lg p-3 text-center border border-border">
                <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                  Highest Burden
                </div>
                <div
                  className="text-sm font-bold truncate"
                  title={topDs?.ds_division}
                >
                  {topDs?.ds_division}
                </div>
                <div className="mt-1">
                  <Badge
                    variant="outline"
                    className={`text-xs ${RISK_BADGE_CLASSES[topDs?.risk_level ?? "low"]}`}
                  >
                    {topDs?.risk_level}
                  </Badge>
                </div>
              </div>
              <div className="bg-muted/50 rounded-lg p-3 text-center border border-border">
                <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                  Alert Zones
                </div>
                <div className="text-2xl font-bold text-red-600">
                  {criticalCount + highCount}
                </div>
                <div className="text-xs text-muted-foreground">
                  critical + high
                </div>
              </div>
            </div>

            {/* ── Horizontal bar chart ──────────────────────────── */}
            <div className="rounded-xl border border-border bg-card p-4">
              <h4 className="text-sm font-semibold mb-4 flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" />
                Predicted Cases by DS Division
              </h4>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    layout="vertical"
                    data={data.ds_breakdown}
                    margin={{ top: 0, right: 50, left: 0, bottom: 0 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      horizontal={false}
                      stroke="hsl(var(--border))"
                    />
                    <XAxis
                      type="number"
                      tick={{ fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      type="category"
                      dataKey="ds_division"
                      tick={{ fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                      width={145}
                    />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: "hsl(var(--muted))" }} />
                    <Bar dataKey="predicted_cases" radius={[0, 4, 4, 0]} label={{ position: "right", fontSize: 11, fill: "hsl(var(--muted-foreground))" }}>
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
              <div className="flex items-center gap-4 mt-3 justify-center flex-wrap">
                {(["critical", "high", "medium", "low"] as const).map((level) => (
                  <div key={level} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span
                      className="h-2.5 w-2.5 rounded-sm shrink-0"
                      style={{ backgroundColor: RISK_COLORS[level] }}
                    />
                    {level.charAt(0).toUpperCase() + level.slice(1)}
                  </div>
                ))}
              </div>
            </div>

            {/* ── DS Division cards grid ────────────────────────── */}
            <div>
              <h4 className="text-sm font-semibold mb-3">
                All Divisional Secretariat Areas
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {data.ds_breakdown.map((ds, idx) => (
                  <div
                    key={ds.ds_division}
                    className="border rounded-lg p-3 space-y-1.5 hover:bg-muted/30 transition-colors relative overflow-hidden"
                    style={{
                      borderLeftColor: RISK_COLORS[ds.risk_level],
                      borderLeftWidth: 3,
                    }}
                  >
                    {/* rank badge */}
                    <span className="absolute top-2 right-2 text-[10px] text-muted-foreground font-mono">
                      #{idx + 1}
                    </span>
                    <div className="flex items-start gap-1.5">
                      <span
                        className={`h-2 w-2 rounded-full shrink-0 mt-1 ${RISK_DOT_CLASSES[ds.risk_level]}`}
                      />
                      <div className="text-xs font-semibold leading-tight pr-4">
                        {ds.ds_division}
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xl font-bold tabular-nums">
                        {ds.predicted_cases}
                      </span>
                      <Badge
                        variant="outline"
                        className={`text-xs ${RISK_BADGE_CLASSES[ds.risk_level]}`}
                      >
                        {ds.risk_level}
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground tabular-nums">
                      CI: {ds.confidence_interval.lower}–
                      {ds.confidence_interval.upper}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {(ds.proportion * 100).toFixed(1)}% of district
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* ── Academic footnote ─────────────────────────────── */}
            <div className="flex items-start gap-2 p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800 text-xs text-blue-700 dark:text-blue-300">
              <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              <span>
                DS-level estimates use a two-stage pipeline: district-level
                XGBoost ensemble forecast + spatial disaggregation weighted by
                population proportion (50%), population density (30%), and
                historical dengue burden index (20%). Method consistent with
                established small-area estimation literature.
              </span>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
