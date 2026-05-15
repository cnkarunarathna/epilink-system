"use client";

import { useState, useEffect } from "react";
import { useTheme } from "next-themes";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts";
import { Loader2 } from "lucide-react";
import { fetchTrend } from "@/services/task-analytics.service";
import type { TrendPoint } from "@/services/task-analytics.service";

interface Props {
  districtId: number;
}

const WEEK_OPTIONS = [4, 8, 12] as const;
type WeekOption = (typeof WEEK_OPTIONS)[number];

export default function WeeklyTaskTrendChart({ districtId }: Props) {
  const [data, setData] = useState<TrendPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [weeks, setWeeks] = useState<WeekOption>(8);
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isDark = mounted && resolvedTheme === "dark";

  useEffect(() => {
    setLoading(true);
    setError(false);
    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - weeks * 7);
    fetchTrend(
      "week",
      from.toISOString().split("T")[0],
      to.toISOString().split("T")[0],
      districtId,
    )
      .then((points) => setData(points.slice(-weeks)))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [districtId, weeks]);

  if (loading) {
    return (
      <div className="h-48 flex items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-48 flex items-center justify-center text-sm text-red-500">
        Failed to load trend data. Please refresh.
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="h-48 flex items-center justify-center text-sm text-muted-foreground">
        No task activity in the last {weeks} weeks for this district
      </div>
    );
  }

  const gridColor = isDark ? "#374151" : "#e5e7eb";
  const tickColor = isDark ? "#9ca3af" : "#6b7280";
  const lastPeriod = data[data.length - 1]?.period;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-end gap-0.5">
        {WEEK_OPTIONS.map((w) => (
          <button
            key={w}
            onClick={() => setWeeks(w)}
            className={`px-2 py-0.5 text-xs rounded font-medium transition-colors ${
              weeks === w
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {w}w
          </button>
        ))}
      </div>
    <ResponsiveContainer width="100%" height={192}>
      <LineChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
        <XAxis
          dataKey="period"
          tick={{ fill: tickColor, fontSize: 10 }}
          tickLine={false}
          axisLine={false}
          interval={1}
        />
        <YAxis
          tick={{ fill: tickColor, fontSize: 10 }}
          tickLine={false}
          axisLine={false}
          allowDecimals={false}
          label={{
            value: "Tasks",
            angle: -90,
            position: "insideLeft",
            offset: 12,
            style: { fontSize: 9, fill: tickColor },
          }}
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
        {lastPeriod && (
          <ReferenceLine
            x={lastPeriod}
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
        <Line
          type="monotone"
          dataKey="created"
          name="Created"
          stroke={isDark ? "#6b7280" : "#9ca3af"}
          strokeWidth={2}
          strokeDasharray="4 2"
          dot={false}
          activeDot={{ r: 4, strokeWidth: 0 }}
        />
        <Line
          type="monotone"
          dataKey="completed"
          name="Completed"
          stroke="#22c55e"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4, strokeWidth: 0, fill: "#22c55e" }}
        />
      </LineChart>
    </ResponsiveContainer>
    </div>
  );
}
