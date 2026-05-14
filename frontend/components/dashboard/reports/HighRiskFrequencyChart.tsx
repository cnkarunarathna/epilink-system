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
import type { WeeklyReport } from "@/services/reports.service";

interface Props {
  reports: WeeklyReport[];
  supervisorDistrict: string;
}

export default function HighRiskFrequencyChart({ reports, supervisorDistrict }: Props) {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isDark = mounted && resolvedTheme === "dark";

  const chartData = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const r of reports) {
      if (!r.reportData?.hotspots) continue;
      for (const hs of r.reportData.hotspots) {
        if (hs.severity === "critical" || hs.severity === "high") {
          counts[hs.district] = (counts[hs.district] ?? 0) + 1;
        }
      }
    }
    return Object.entries(counts)
      .map(([district, count]) => ({ district, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }, [reports]);

  if (chartData.length === 0) {
    return (
      <div className="h-40 flex items-center justify-center text-sm text-muted-foreground">
        No high-risk data in reports
      </div>
    );
  }

  const gridColor = isDark ? "#374151" : "#e5e7eb";
  const tickColor = isDark ? "#9ca3af" : "#6b7280";
  const defaultBar = isDark ? "#374151" : "#d1d5db";
  const chartHeight = Math.min(Math.max(160, chartData.length * 36), 360);

  return (
    <ResponsiveContainer width="100%" height={chartHeight}>
      <BarChart
        data={chartData}
        layout="vertical"
        margin={{ top: 4, right: 16, left: 8, bottom: 4 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke={gridColor} horizontal={false} />
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
          width={80}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: isDark ? "#1f2937" : "#ffffff",
            border: `1px solid ${isDark ? "#374151" : "#e5e7eb"}`,
            borderRadius: "8px",
            fontSize: "12px",
          }}
          formatter={(value: number | undefined) =>
            [
              `${value ?? 0} report${(value ?? 0) !== 1 ? "s" : ""}`,
              "High-risk appearances",
            ] as [string, string]
          }
        />
        <Bar dataKey="count" radius={[0, 4, 4, 0]} isAnimationActive={false}>
          {chartData.map((entry) => (
            <Cell
              key={entry.district}
              fill={
                entry.district.toLowerCase() === supervisorDistrict.toLowerCase()
                  ? "#f97316"
                  : defaultBar
              }
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
