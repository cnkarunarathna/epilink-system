"use client";

import { useState, useEffect } from "react";
import { useTheme } from "next-themes";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { TaskStats } from "@/services/tasks.service";

interface Props {
  stats: TaskStats;
}

const STATUS_CONFIG = [
  { key: "completed", label: "Completed", color: "#22c55e" },
  { key: "submitted", label: "Submitted", color: "#a855f7" },
  { key: "inProgress", label: "In Progress", color: "#eab308" },
  { key: "assigned", label: "Assigned", color: "#3b82f6" },
  { key: "pending", label: "Pending", color: "#94a3b8" },
  { key: "rejected", label: "Rejected", color: "#ef4444" },
] as const;

export default function TaskStatusDonutChart({ stats }: Props) {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isDark = mounted && resolvedTheme === "dark";

  const chartData = STATUS_CONFIG.map((s) => ({
    name: s.label,
    value: stats[s.key as keyof TaskStats] as number,
    color: s.color,
  })).filter((d) => d.value > 0);

  const completionRate =
    stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0;

  if (stats.total === 0) {
    return (
      <div className="h-48 flex items-center justify-center text-sm text-muted-foreground">
        No tasks in your district yet
      </div>
    );
  }

  return (
    <div className="flex items-center gap-6">
      <div className="relative shrink-0">
        <ResponsiveContainer width={160} height={160}>
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={46}
              outerRadius={72}
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
          <span className="text-2xl font-bold leading-tight">{completionRate}%</span>
          <span className="text-xs text-muted-foreground">Done</span>
        </div>
      </div>

      <div className="flex-1 space-y-1.5">
        {STATUS_CONFIG.filter(
          (s) => (stats[s.key as keyof TaskStats] as number) > 0,
        ).map((s) => (
          <div key={s.key} className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2 min-w-0">
              <div
                className="w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: s.color }}
              />
              <span className="text-muted-foreground truncate">{s.label}</span>
            </div>
            <span className="font-medium tabular-nums ml-2">
              {stats[s.key as keyof TaskStats] as number}
            </span>
          </div>
        ))}
        <div className="flex items-center justify-between text-sm border-t border-border pt-1.5 mt-1.5">
          <span className="font-medium">Total</span>
          <span className="font-bold tabular-nums">{stats.total}</span>
        </div>
        {stats.overdueCount > 0 && (
          <p className="text-xs text-red-500 dark:text-red-400 font-medium pt-0.5">
            {stats.overdueCount} overdue
          </p>
        )}
      </div>
    </div>
  );
}
