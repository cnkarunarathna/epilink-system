"use client";

import { useState, useEffect } from "react";
import { useTheme } from "next-themes";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { Loader2 } from "lucide-react";
import { fetchPhiMetrics } from "@/services/task-analytics.service";
import type { PhiMetrics } from "@/services/task-analytics.service";

interface Props {
  districtId: number;
}

export default function PhiWorkloadChart({ districtId }: Props) {
  const [data, setData] = useState<PhiMetrics[]>([]);
  const [loading, setLoading] = useState(true);
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isDark = mounted && resolvedTheme === "dark";

  useEffect(() => {
    fetchPhiMetrics(districtId)
      .then(setData)
      .catch((err) => console.error("PHI metrics fetch failed:", err))
      .finally(() => setLoading(false));
  }, [districtId]);

  if (loading) {
    return (
      <div className="h-40 flex items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const chartData = data
    .map((phi) => ({
      name: phi.name.length > 14 ? phi.name.split(" ")[0] : phi.name,
      completed: phi.completed,
      remaining: Math.max(0, phi.assigned - phi.completed),
    }))
    .filter((d) => d.completed + d.remaining > 0);

  if (chartData.length === 0) {
    return (
      <div className="h-40 flex items-center justify-center text-sm text-muted-foreground">
        No tasks assigned yet
      </div>
    );
  }

  const gridColor = isDark ? "#374151" : "#e5e7eb";
  const tickColor = isDark ? "#9ca3af" : "#6b7280";
  const chartHeight = Math.min(Math.max(160, chartData.length * 44), 420);

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
          dataKey="name"
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
          labelStyle={{ fontWeight: 600, color: isDark ? "#f9fafb" : "#111827" }}
          formatter={(value: number | undefined, name: string | undefined) =>
            [`${value ?? 0} tasks`, name ?? ""] as [string, string]
          }
        />
        <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }} />
        <Bar dataKey="completed" name="Completed" stackId="a" fill="#22c55e" />
        <Bar
          dataKey="remaining"
          name="Remaining"
          stackId="a"
          fill="#fb923c"
          radius={[0, 4, 4, 0]}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
