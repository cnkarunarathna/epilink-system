"use client";

import { useMemo, useState, useEffect } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
  LabelList,
  ResponsiveContainer,
} from "recharts";
import { useTheme } from "next-themes";
import type { InterventionHistoryResponse } from "@/services/analytics.service";

interface Props {
  data: InterventionHistoryResponse;
}

const EFFECTIVENESS_COLORS: Record<string, string> = {
  rapid: "#22c55e",
  moderate: "#eab308",
  slow: "#ef4444",
};

export default function OutbreakHistoryChart({ data }: Props) {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  const isDark = mounted && resolvedTheme === "dark";

  const chartData = useMemo(
    () =>
      data.response_events.map((e) => ({
        label: `W${e.peak_week} '${String(e.peak_year).slice(2)}`,
        peakCases: e.peak_cases,
        weekRecovery: e.weeks_to_recovery,
        effectiveness: e.response_effectiveness,
        declinePct: Math.round(e.decline_pct),
        inferredAction: e.inferred_action,
      })),
    [data.response_events],
  );

  if (chartData.length === 0) {
    return (
      <div className="h-40 flex items-center justify-center text-sm text-muted-foreground">
        No outbreak events detected in historical data
      </div>
    );
  }

  const gridColor = isDark ? "#374151" : "#e5e7eb";
  const tickColor = isDark ? "#9ca3af" : "#6b7280";

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
        {data.average_weeks_to_recovery !== null && (
          <span>
            Avg recovery:{" "}
            <span className="font-medium text-foreground">
              {data.average_weeks_to_recovery.toFixed(1)} weeks
            </span>
          </span>
        )}
        <span>
          {data.total_events_detected} outbreak event
          {data.total_events_detected !== 1 ? "s" : ""} detected
        </span>
        <span className="ml-auto">
          Bar top = weeks to recovery · Color:{" "}
          <span className="text-green-500">rapid</span> /{" "}
          <span className="text-yellow-500">moderate</span> /{" "}
          <span className="text-red-500">slow</span> response
        </span>
      </div>

      <ResponsiveContainer width="100%" height={190}>
        <BarChart
          data={chartData}
          margin={{ top: 20, right: 16, left: 0, bottom: 4 }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke={gridColor}
            vertical={false}
          />
          <XAxis
            dataKey="label"
            tick={{ fill: tickColor, fontSize: 11 }}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: tickColor, fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            width={40}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: isDark ? "#1f2937" : "#ffffff",
              border: `1px solid ${isDark ? "#374151" : "#e5e7eb"}`,
              borderRadius: "8px",
              fontSize: "12px",
            }}
            formatter={(value: number | undefined, _name: string | undefined, props: { payload?: { declinePct?: number; weekRecovery?: number; effectiveness?: string } }) => {
              const p = props?.payload ?? {};
              return [
                `${value ?? 0} peak cases · −${p.declinePct ?? 0}% decline · ${p.weekRecovery ?? "?"} weeks to recovery`,
                p.effectiveness ?? "",
              ] as [string, string];
            }}
          />
          <Bar
            dataKey="peakCases"
            radius={[4, 4, 0, 0]}
            isAnimationActive={false}
          >
            {chartData.map((entry, i) => (
              <Cell
                key={i}
                fill={
                  EFFECTIVENESS_COLORS[entry.effectiveness] ??
                  (isDark ? "#374151" : "#d1d5db")
                }
              />
            ))}
            <LabelList
              dataKey="weekRecovery"
              position="top"
              formatter={(val: unknown) =>
                typeof val === "number" && val ? `${val}w` : ""
              }
              style={{ fontSize: "10px", fill: tickColor }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
