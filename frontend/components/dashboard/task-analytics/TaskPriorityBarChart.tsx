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
  Cell,
  ResponsiveContainer,
} from "recharts";
import { Loader2 } from "lucide-react";
import { fetchByPriority } from "@/services/task-analytics.service";
import type { PriorityPoint } from "@/services/task-analytics.service";

const PRIORITY_ORDER = ["urgent", "high", "medium", "low"] as const;
const PRIORITY_COLORS: Record<string, string> = {
  urgent: "#ef4444",
  high: "#f97316",
  medium: "#3b82f6",
  low: "#94a3b8",
};
const PRIORITY_LABELS: Record<string, string> = {
  urgent: "Urgent",
  high: "High",
  medium: "Medium",
  low: "Low",
};

interface Props {
  districtId: number;
}

export default function TaskPriorityBarChart({ districtId }: Props) {
  const [data, setData] = useState<PriorityPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isDark = mounted && resolvedTheme === "dark";

  useEffect(() => {
    setLoading(true);
    setError(false);
    fetchByPriority(districtId)
      .then((d) => { setData(d); })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [districtId]);

  if (loading) {
    return (
      <div className="h-40 flex items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const chartData = PRIORITY_ORDER.map((p) => {
    const point = data.find((d) => d.priority === p);
    const count = point?.count ?? 0;
    const completed = point?.completed ?? 0;
    return {
      name: PRIORITY_LABELS[p],
      completed,
      remaining: count - completed,
      color: PRIORITY_COLORS[p],
    };
  }).filter((d) => d.completed + d.remaining > 0);

  if (error) {
    return (
      <div className="h-40 flex items-center justify-center text-sm text-red-500">
        Failed to load priority data. Please refresh.
      </div>
    );
  }

  if (chartData.length === 0) {
    return (
      <div className="h-40 flex items-center justify-center text-sm text-muted-foreground">
        No tasks found for this district
      </div>
    );
  }

  const gridColor = isDark ? "#374151" : "#e5e7eb";
  const tickColor = isDark ? "#9ca3af" : "#6b7280";

  return (
    <ResponsiveContainer width="100%" height={160}>
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
          width={56}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: isDark ? "#1f2937" : "#ffffff",
            border: `1px solid ${isDark ? "#374151" : "#e5e7eb"}`,
            borderRadius: "8px",
            fontSize: "12px",
          }}
          formatter={(value: number | undefined, name: string | undefined) =>
            [`${value ?? 0}`, name ?? ""] as [string, string]
          }
        />
        <Bar dataKey="completed" name="Completed" stackId="a" fill="#22c55e" />
        <Bar dataKey="remaining" name="Remaining" stackId="a" radius={[0, 4, 4, 0]}>
          {chartData.map((entry, idx) => (
            <Cell key={`cell-r-${idx}`} fill={entry.color} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
