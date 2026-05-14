"use client";

import { useMemo, useState, useEffect } from "react";
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { useTheme } from "next-themes";
import type { WeeklyReport } from "@/services/reports.service";

interface Props {
  reports: WeeklyReport[];
}

const STATUS_META: { key: string; label: string; color: string }[] = [
  { key: "approved", label: "Approved", color: "#22c55e" },
  { key: "pending", label: "Pending", color: "#eab308" },
  { key: "archived", label: "Archived", color: "#9ca3af" },
];

export default function ReportStatusDonut({ reports }: Props) {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isDark = mounted && resolvedTheme === "dark";

  const data = useMemo(() => {
    const counts: Record<string, number> = { approved: 0, pending: 0, archived: 0 };
    for (const r of reports) {
      if (r.status in counts) counts[r.status]++;
    }
    return STATUS_META.filter((m) => counts[m.key] > 0).map((m) => ({
      ...m,
      value: counts[m.key],
    }));
  }, [reports]);

  if (reports.length === 0 || data.length === 0) {
    return (
      <div className="h-40 flex items-center justify-center text-sm text-muted-foreground">
        No reports yet
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={160}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={40}
          outerRadius={60}
          paddingAngle={2}
          dataKey="value"
          isAnimationActive={false}
        >
          {data.map((entry) => (
            <Cell key={entry.key} fill={entry.color} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{
            backgroundColor: isDark ? "#1f2937" : "#ffffff",
            border: `1px solid ${isDark ? "#374151" : "#e5e7eb"}`,
            borderRadius: "8px",
            fontSize: "12px",
          }}
          formatter={(value: number | undefined) =>
            [`${value ?? 0} report${(value ?? 0) !== 1 ? "s" : ""}`, ""] as [string, string]
          }
        />
        <Legend wrapperStyle={{ fontSize: "11px" }} />
      </PieChart>
    </ResponsiveContainer>
  );
}
