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
  ResponsiveContainer,
} from "recharts";
import { useTheme } from "next-themes";
import type { DemographicHotspotsResponse } from "@/services/analytics.service";

interface Props {
  data: DemographicHotspotsResponse;
}

const PRIORITY_COLORS: Record<string, string> = {
  immediate: "#ef4444",
  high: "#f97316",
  moderate: "#eab308",
  routine: "#22c55e",
};

const PRIORITY_LABELS: Record<string, string> = {
  immediate: "Immediate",
  high: "High",
  moderate: "Moderate",
  routine: "Routine",
};

export default function ZoneHotspotChart({ data }: Props) {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  const isDark = mounted && resolvedTheme === "dark";

  const chartData = useMemo(
    () =>
      [...data.zone_breakdown]
        .sort((a, b) => b.estimated_cases - a.estimated_cases)
        .map((z) => ({
          zone:
            z.zone.length > 20 ? z.zone.substring(0, 20) + "…" : z.zone,
          fullZone: z.zone,
          cases: z.estimated_cases,
          priority: z.intervention_priority,
          risk: z.relative_risk,
          type: z.type,
          flags: z.context_flags,
        })),
    [data.zone_breakdown],
  );

  if (chartData.length === 0) {
    return (
      <div className="h-40 flex items-center justify-center text-sm text-muted-foreground">
        No zone breakdown available
      </div>
    );
  }

  const gridColor = isDark ? "#374151" : "#e5e7eb";
  const tickColor = isDark ? "#9ca3af" : "#6b7280";
  const chartHeight = Math.min(Math.max(140, chartData.length * 32), 300);

  const hasImmediate = chartData.some((z) => z.priority === "immediate");

  return (
    <div className="space-y-2">
      {hasImmediate && (
        <div className="text-xs px-3 py-1.5 rounded-md font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
          ⚠ Immediate intervention required in{" "}
          {chartData
            .filter((z) => z.priority === "immediate")
            .map((z) => z.fullZone)
            .join(", ")}
        </div>
      )}

      <ResponsiveContainer width="100%" height={chartHeight}>
        <BarChart
          data={chartData}
          layout="vertical"
          margin={{ top: 4, right: 16, left: 8, bottom: 4 }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke={gridColor}
            horizontal={false}
          />
          <XAxis
            type="number"
            tick={{ fill: tickColor, fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            allowDecimals={false}
          />
          <YAxis
            type="category"
            dataKey="zone"
            tick={{ fill: tickColor, fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            width={100}
          />
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload || payload.length === 0) return null;
              const d = payload[0].payload as {
                fullZone: string;
                cases: number;
                priority: string;
                type: string;
                flags: string[];
              };
              return (
                <div
                  style={{
                    backgroundColor: isDark ? "#1f2937" : "#ffffff",
                    border: `1px solid ${isDark ? "#374151" : "#e5e7eb"}`,
                    borderRadius: "8px",
                    padding: "8px 12px",
                    fontSize: "12px",
                    lineHeight: "1.6",
                  }}
                >
                  <p style={{ fontWeight: 600, marginBottom: 2 }}>{d.fullZone}</p>
                  <p>
                    {d.cases} est. cases ·{" "}
                    {PRIORITY_LABELS[d.priority] ?? "—"} priority
                  </p>
                  {d.type && (
                    <p style={{ color: isDark ? "#9ca3af" : "#6b7280", marginTop: 2 }}>
                      {d.type}
                    </p>
                  )}
                  {d.flags && d.flags.length > 0 && (
                    <p style={{ color: isDark ? "#9ca3af" : "#6b7280" }}>
                      {d.flags.join(" · ")}
                    </p>
                  )}
                </div>
              );
            }}
          />
          <Bar dataKey="cases" radius={[0, 4, 4, 0]} isAnimationActive={false}>
            {chartData.map((entry, i) => (
              <Cell
                key={i}
                fill={
                  PRIORITY_COLORS[entry.priority] ??
                  (isDark ? "#374151" : "#d1d5db")
                }
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      <p className="text-xs text-muted-foreground">
        Color by intervention priority: 🔴 immediate · 🟠 high · 🟡 moderate · 🟢 routine
      </p>
    </div>
  );
}
