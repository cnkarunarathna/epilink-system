"use client";

import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { StatusPoint } from "@/services/task-analytics.service";

const STATUS_COLORS: Record<string, string> = {
  pending:     "#94a3b8",
  assigned:    "#60a5fa",
  in_progress: "#f59e0b",
  submitted:   "#a78bfa",
  verified:    "#34d399",
  completed:   "#22c55e",
  rejected:    "#f87171",
};

const STATUS_LABELS: Record<string, string> = {
  pending:     "Pending",
  assigned:    "Assigned",
  in_progress: "In Progress",
  submitted:   "Submitted",
  verified:    "Verified",
  completed:   "Completed",
  rejected:    "Rejected",
};

interface Props {
  data: StatusPoint[];
  loading?: boolean;
}

export function TaskStatusDonut({ data, loading }: Props) {
  const chartData = data.map((d) => ({
    name: STATUS_LABELS[d.status] ?? d.status,
    value: d.count,
    color: STATUS_COLORS[d.status] ?? "#94a3b8",
  }));

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          Status Distribution
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-56 w-full" />
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={80}
                paddingAngle={2}
                dataKey="value"
              >
                {chartData.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                formatter={(value) => [value, "Tasks"]}
              />
              <Legend
                iconType="circle"
                iconSize={8}
                wrapperStyle={{ fontSize: 11 }}
              />
            </PieChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
