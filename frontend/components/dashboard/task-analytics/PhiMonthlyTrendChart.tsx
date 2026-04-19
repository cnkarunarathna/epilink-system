"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { PhiMonthlyTrend } from "@/services/task-analytics.service";

interface Props {
  data: PhiMonthlyTrend[];
  loading?: boolean;
}

function fmtMonth(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-GB", { month: "short", year: "2-digit" });
  } catch {
    return iso;
  }
}

export function PhiMonthlyTrendChart({ data, loading }: Props) {
  const chartData = data.map((d) => ({
    month: fmtMonth(d.month),
    Completed: d.completed,
  }));

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          Monthly Completed Tasks (Last 6 Months)
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-52 w-full" />
        ) : chartData.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">No completed tasks in the last 6 months.</p>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} width={28} allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="Completed" fill="#22c55e" radius={[3, 3, 0, 0]} maxBarSize={48} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
