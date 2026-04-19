"use client";

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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { PriorityPoint } from "@/services/task-analytics.service";

const PRIORITY_COLORS: Record<string, string> = {
  low:    "#94a3b8",
  medium: "#60a5fa",
  high:   "#f59e0b",
  urgent: "#f87171",
};

const PRIORITY_LABELS: Record<string, string> = {
  low:    "Low",
  medium: "Medium",
  high:   "High",
  urgent: "Urgent",
};

interface Props {
  data: PriorityPoint[];
  loading?: boolean;
}

export function TaskPriorityChart({ data, loading }: Props) {
  const chartData = data.map((d) => ({
    name: PRIORITY_LABELS[d.priority] ?? d.priority,
    Total: d.count,
    Completed: d.completed,
    color: PRIORITY_COLORS[d.priority] ?? "#94a3b8",
  }));

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          Tasks by Priority
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-56 w-full" />
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} width={32} />
              <Tooltip />
              <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="Total" fill="#a78bfa" radius={[3, 3, 0, 0]} />
              <Bar dataKey="Completed" fill="#22c55e" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
