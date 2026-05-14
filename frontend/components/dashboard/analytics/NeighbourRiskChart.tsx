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
import type { SpilloverResponse } from "@/services/analytics.service";

interface Props {
  data: SpilloverResponse;
}

const RISK_COLORS: Record<string, string> = {
  critical: "#ef4444",
  high: "#f97316",
  moderate: "#eab308",
  medium: "#eab308",
  low: "#22c55e",
};

const SPILLOVER_META = {
  high: {
    banner: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
    label: "High",
  },
  moderate: {
    banner:
      "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
    label: "Moderate",
  },
  low: {
    banner:
      "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
    label: "Low",
  },
};

export default function NeighbourRiskChart({ data }: Props) {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  const isDark = mounted && resolvedTheme === "dark";

  const chartData = useMemo(() => {
    const all = data.focal_stats
      ? [data.focal_stats, ...data.neighbours]
      : data.neighbours;
    return all
      .map((n) => ({
        district:
          n.district.length > 13
            ? n.district.substring(0, 13) + "…"
            : n.district,
        fullName: n.district,
        cases: Math.round(n.current_cases),
        riskLevel: n.risk_level,
        isFocal: n.is_focal,
        isRising: n.is_rising,
        wowPct: n.wow_change_pct,
      }))
      .sort((a, b) => b.cases - a.cases);
  }, [data]);

  if (chartData.length === 0) {
    return (
      <div className="h-48 flex items-center justify-center text-sm text-muted-foreground">
        No neighbour data available
      </div>
    );
  }

  const meta =
    SPILLOVER_META[data.spillover_risk] ?? SPILLOVER_META.low;
  const gridColor = isDark ? "#374151" : "#e5e7eb";
  const tickColor = isDark ? "#9ca3af" : "#6b7280";
  const chartHeight = Math.min(Math.max(140, chartData.length * 32), 280);

  return (
    <div className="space-y-2">
      <div className={`text-xs px-3 py-1.5 rounded-md font-medium ${meta.banner}`}>
        Spillover risk:{" "}
        <span className="font-semibold">{meta.label}</span>
        {data.rising_neighbours.length > 0 &&
          ` · ${data.rising_neighbours.length} neighbouring district${data.rising_neighbours.length !== 1 ? "s" : ""} trending up`}
      </div>

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
            dataKey="district"
            tick={{ fill: tickColor, fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            width={90}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: isDark ? "#1f2937" : "#ffffff",
              border: `1px solid ${isDark ? "#374151" : "#e5e7eb"}`,
              borderRadius: "8px",
              fontSize: "12px",
            }}
            formatter={(value: number | undefined) =>
              [`${value ?? 0} predicted cases`, ""] as [string, string]
            }
          />
          <Bar dataKey="cases" radius={[0, 4, 4, 0]} isAnimationActive={false}>
            {chartData.map((entry, i) => (
              <Cell
                key={i}
                fill={
                  RISK_COLORS[entry.riskLevel] ??
                  (isDark ? "#374151" : "#d1d5db")
                }
                opacity={entry.isFocal ? 1 : 0.75}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      <p className="text-xs text-muted-foreground">
        Your district shown at full opacity. Colors: 🔴 critical · 🟠 high · 🟡 moderate · 🟢 low risk
      </p>
    </div>
  );
}
