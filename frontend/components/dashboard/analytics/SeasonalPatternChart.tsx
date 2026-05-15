"use client";

import { useMemo, useState, useEffect } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  Cell,
  ResponsiveContainer,
} from "recharts";
import { useTheme } from "next-themes";
import type { SeasonalPatternResponse } from "@/services/analytics.service";

interface Props {
  data: SeasonalPatternResponse;
}

export default function SeasonalPatternChart({ data }: Props) {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  const isDark = mounted && resolvedTheme === "dark";

  const chartData = useMemo(
    () =>
      Object.entries(data.weekly_averages)
        .map(([week, avg]) => ({
          weekLabel: `W${week}`,
          weekNum: parseInt(week),
          avg: Math.round(avg),
        }))
        .sort((a, b) => a.weekNum - b.weekNum),
    [data.weekly_averages],
  );

  const peakMultiplier = useMemo(() => {
    const peakSet = new Set(data.peak_weeks);
    const entries = Object.entries(data.weekly_averages);
    const peakAvgs = entries.filter(([w]) => peakSet.has(parseInt(w))).map(([, v]) => v);
    const offPeakAvgs = entries.filter(([w]) => !peakSet.has(parseInt(w))).map(([, v]) => v);
    if (peakAvgs.length === 0 || offPeakAvgs.length === 0) return null;
    const mean = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length;
    const offMean = mean(offPeakAvgs);
    return offMean === 0 ? null : mean(peakAvgs) / offMean;
  }, [data.peak_weeks, data.weekly_averages]);

  if (chartData.length === 0) {
    return (
      <div className="h-48 flex items-center justify-center text-sm text-muted-foreground">
        No seasonal data available
      </div>
    );
  }

  const gridColor = isDark ? "#374151" : "#e5e7eb";
  const tickColor = isDark ? "#9ca3af" : "#6b7280";
  const peakSet = new Set(data.peak_weeks);

  return (
    <div className="space-y-3">
      <div
        className={`text-xs px-3 py-1.5 rounded-md font-medium flex items-center gap-2 ${
          data.in_peak_season
            ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
            : "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
        }`}
      >
        <span
          className={`h-2 w-2 rounded-full shrink-0 ${
            data.in_peak_season ? "bg-red-500" : "bg-green-500"
          } animate-pulse`}
        />
        {data.in_peak_season
          ? `Peak season active — W${data.current_week}${
              data.vs_baseline_pct !== null
                ? ` is ${data.vs_baseline_pct > 0 ? "+" : ""}${data.vs_baseline_pct.toFixed(0)}% vs seasonal baseline`
                : " is above seasonal average"
            }${peakMultiplier !== null ? ` · peak weeks avg ${peakMultiplier.toFixed(1)}× off-peak` : ""}`
          : `Off-peak — W${data.current_week} · ${data.current_cases} predicted cases · baseline: ${Math.round(data.seasonal_baseline_this_week)}${peakMultiplier !== null ? ` · peak season is typically ${peakMultiplier.toFixed(1)}× higher` : ""}`}
      </div>

      <ResponsiveContainer width="100%" height={180}>
        <BarChart
          data={chartData}
          margin={{ top: 4, right: 8, left: 0, bottom: 4 }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke={gridColor}
            vertical={false}
          />
          <XAxis
            dataKey="weekLabel"
            tick={{ fill: tickColor, fontSize: 9 }}
            tickLine={false}
            interval={3}
          />
          <YAxis
            tick={{ fill: tickColor, fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            width={36}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: isDark ? "#1f2937" : "#ffffff",
              border: `1px solid ${isDark ? "#374151" : "#e5e7eb"}`,
              borderRadius: "8px",
              fontSize: "12px",
            }}
            formatter={(value: number | undefined) =>
              [`${value ?? 0} avg cases`, "Seasonal average"] as [
                string,
                string,
              ]
            }
          />
          <ReferenceLine
            x={`W${data.current_week}`}
            stroke="#6366f1"
            strokeDasharray="4 2"
            label={{ value: "Now", fill: "#6366f1", fontSize: 10 }}
          />
          <Bar dataKey="avg" radius={[2, 2, 0, 0]} isAnimationActive={false}>
            {chartData.map((entry) => (
              <Cell
                key={entry.weekLabel}
                fill={
                  entry.weekNum === data.current_week
                    ? "#6366f1"
                    : peakSet.has(entry.weekNum)
                      ? "#f97316"
                      : isDark
                        ? "#4b5563"
                        : "#d1d5db"
                }
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      <p className="text-xs text-muted-foreground">
        Based on {data.years_analysed} year
        {data.years_analysed !== 1 ? "s" : ""} of data. Peak weeks in orange ·
        current week in indigo.
      </p>
    </div>
  );
}
