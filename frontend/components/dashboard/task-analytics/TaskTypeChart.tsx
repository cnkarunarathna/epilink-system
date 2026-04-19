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
import type { TypePoint } from "@/services/task-analytics.service";

const TYPE_LABELS: Record<string, string> = {
  cleanup:       "Cleanup",
  fogging:       "Fogging",
  inspection:    "Inspection",
  investigation: "Investigation",
};

interface Props {
  data: TypePoint[];
  loading?: boolean;
}

export function TaskTypeChart({ data, loading }: Props) {
  const chartData = data.map((d) => ({
    name: TYPE_LABELS[d.type] ?? d.type,
    Total: d.count,
    Completed: d.completed,
  }));

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          Tasks by Type
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
              <Bar dataKey="Total" fill="#60a5fa" radius={[3, 3, 0, 0]} />
              <Bar dataKey="Completed" fill="#22c55e" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
