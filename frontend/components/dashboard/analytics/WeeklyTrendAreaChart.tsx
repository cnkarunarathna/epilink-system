"use client";

import { useState, useEffect } from "react";
import { useTheme } from "next-themes";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts";

interface TimeseriesPoint {
  year: number;
  week: number;
  predicted_cases: number;
}

interface ChartPoint {
  label: string;
  cases: number;
}

interface Props {
  data: TimeseriesPoint[];
  currentWeek?: number;
  currentYear?: number;
}

export default function WeeklyTrendAreaChart({ data, currentWeek, currentYear }: Props) {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isDark = mounted && resolvedTheme === "dark";
  const gridColor = isDark ? "#374151" : "#e5e7eb";
  const tickColor = isDark ? "#9ca3af" : "#6b7280";

  const chartData: ChartPoint[] = data.map((p) => ({
    label: `W${p.week} '${String(p.year).slice(2)}`,
    cases: Math.round(p.predicted_cases),
  }));

  const currentLabel =
    currentWeek && currentYear
      ? `W${currentWeek} '${String(currentYear).slice(2)}`
      : undefined;

  const matchedCurrent = currentLabel && chartData.find((d) => d.label === currentLabel);

  if (chartData.length === 0) {
    return (
      <div className="h-56 flex items-center justify-center text-sm text-muted-foreground">
        No trend data available
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={224}>
      <AreaChart data={chartData} margin={{ top: 12, right: 8, left: -24, bottom: 0 }}>
        <defs>
          <linearGradient id="trendGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#6366f1" stopOpacity={0.5} />
            <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
        <XAxis
          dataKey="label"
          tick={{ fill: tickColor, fontSize: 10 }}
          tickLine={false}
          axisLine={false}
          interval={2}
        />
        <YAxis
          tick={{ fill: tickColor, fontSize: 10 }}
          tickLine={false}
          axisLine={false}
          allowDecimals={false}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: isDark ? "#1f2937" : "#ffffff",
            border: `1px solid ${isDark ? "#374151" : "#e5e7eb"}`,
            borderRadius: "8px",
            fontSize: "12px",
          }}
          labelStyle={{ fontWeight: 600, color: isDark ? "#f9fafb" : "#111827" }}
          formatter={(value: number | undefined) => [`${value ?? 0} cases`, "Predicted"]}
        />
        {matchedCurrent && (
          <ReferenceLine
            x={currentLabel}
            stroke={isDark ? "#f59e0b" : "#d97706"}
            strokeDasharray="4 2"
            strokeWidth={1.5}
            label={{
              value: "Now",
              position: "insideTopRight",
              fill: isDark ? "#f59e0b" : "#d97706",
              fontSize: 10,
            }}
          />
        )}
        <Area
          type="monotone"
          dataKey="cases"
          stroke="#6366f1"
          strokeWidth={2}
          fill="url(#trendGradient)"
          dot={false}
          activeDot={{ r: 4, strokeWidth: 0, fill: "#6366f1" }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
