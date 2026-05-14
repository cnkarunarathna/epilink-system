"use client";

import { useMemo, useState, useEffect } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { useTheme } from "next-themes";

interface TimeseriesPoint {
  year: number;
  week: number;
  predicted_cases: number;
}

interface Props {
  data: TimeseriesPoint[];
}

const YEAR_COLORS = ["#6366f1", "#f97316", "#22c55e", "#ec4899", "#14b8a6"];

export default function YearOverYearChart({ data }: Props) {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  const isDark = mounted && resolvedTheme === "dark";

  const { chartData, years } = useMemo(() => {
    if (data.length === 0) return { chartData: [], years: [] as number[] };

    const byYear: Record<number, Record<number, number>> = {};
    for (const pt of data) {
      if (!byYear[pt.year]) byYear[pt.year] = {};
      byYear[pt.year][pt.week] = pt.predicted_cases;
    }

    const distinctYears = Object.keys(byYear).map(Number).sort();
    if (distinctYears.length < 2) return { chartData: [], years: [] as number[] };

    const allWeeks = [...new Set(data.map((d) => d.week))].sort((a, b) => a - b);

    const mapped = allWeeks.map((week) => {
      const point: Record<string, number | string> = { weekLabel: `W${week}` };
      for (const year of distinctYears) {
        const val = byYear[year][week];
        if (val !== undefined) {
          point[String(year)] = Math.round(val);
        }
      }
      return point;
    });

    return { chartData: mapped, years: distinctYears };
  }, [data]);

  if (chartData.length === 0) {
    return (
      <div className="h-56 flex items-center justify-center text-sm text-muted-foreground">
        Insufficient data for year-over-year comparison (need ≥ 2 years)
      </div>
    );
  }

  const gridColor = isDark ? "#374151" : "#e5e7eb";
  const tickColor = isDark ? "#9ca3af" : "#6b7280";

  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart
        data={chartData}
        margin={{ top: 4, right: 16, left: 0, bottom: 4 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
        <XAxis
          dataKey="weekLabel"
          tick={{ fill: tickColor, fontSize: 10 }}
          tickLine={false}
          interval={3}
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
          formatter={(value: number | undefined) =>
            [`${value ?? 0} predicted cases`, ""] as [string, string]
          }
        />
        <Legend wrapperStyle={{ fontSize: "11px" }} />
        {years.map((year, i) => (
          <Line
            key={year}
            dataKey={String(year)}
            stroke={YEAR_COLORS[i % YEAR_COLORS.length]}
            strokeWidth={2}
            dot={false}
            connectNulls={false}
            isAnimationActive={false}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
