"use client";

import { useState, useEffect } from "react";
import { useTheme } from "next-themes";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { Loader2 } from "lucide-react";
import { fetchByType } from "@/services/task-analytics.service";
import type { TypePoint } from "@/services/task-analytics.service";

const TYPE_CONFIG = [
  { key: "cleanup", label: "Cleanup", color: "#3b82f6" },
  { key: "fogging", label: "Fogging", color: "#f97316" },
  { key: "inspection", label: "Inspection", color: "#14b8a6" },
  { key: "investigation", label: "Investigation", color: "#ef4444" },
] as const;

interface Props {
  districtId: number;
}

export default function TaskTypeDonutChart({ districtId }: Props) {
  const [data, setData] = useState<TypePoint[]>([]);
  const [loading, setLoading] = useState(true);
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isDark = mounted && resolvedTheme === "dark";

  useEffect(() => {
    fetchByType(districtId)
      .then(setData)
      .catch((err) => console.error("Task type fetch failed:", err))
      .finally(() => setLoading(false));
  }, [districtId]);

  if (loading) {
    return (
      <div className="h-48 flex items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const chartData = TYPE_CONFIG.map((t) => {
    const point = data.find((d) => d.type === t.key);
    return { name: t.label, value: point?.count ?? 0, color: t.color, completed: point?.completed ?? 0 };
  }).filter((d) => d.value > 0);

  const total = chartData.reduce((s, d) => s + d.value, 0);

  if (total === 0) {
    return (
      <div className="h-48 flex items-center justify-center text-sm text-muted-foreground">
        No tasks found
      </div>
    );
  }

  return (
    <div className="flex items-center gap-4">
      <div className="relative shrink-0">
        <ResponsiveContainer width={140} height={140}>
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={40}
              outerRadius={64}
              paddingAngle={2}
              dataKey="value"
              startAngle={90}
              endAngle={-270}
              strokeWidth={0}
            >
              {chartData.map((entry, idx) => (
                <Cell key={`cell-${idx}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                backgroundColor: isDark ? "#1f2937" : "#ffffff",
                border: `1px solid ${isDark ? "#374151" : "#e5e7eb"}`,
                borderRadius: "8px",
                fontSize: "12px",
              }}
              formatter={(value: number | undefined, name: string | undefined) =>
                [`${value ?? 0} tasks`, name ?? ""] as [string, string]
              }
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none select-none">
          <span className="text-2xl font-bold leading-tight">{total}</span>
          <span className="text-xs text-muted-foreground">Total</span>
        </div>
      </div>

      <div className="flex-1 space-y-1.5">
        {chartData.map((entry) => {
          const rate = entry.value > 0 ? Math.round((entry.completed / entry.value) * 100) : 0;
          return (
            <div key={entry.name} className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: entry.color }} />
                <span className="text-muted-foreground truncate">{entry.name}</span>
              </div>
              <div className="flex items-center gap-2 ml-2">
                <span className="font-medium tabular-nums">{entry.value}</span>
                <span className="text-xs text-muted-foreground">({rate}%)</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
