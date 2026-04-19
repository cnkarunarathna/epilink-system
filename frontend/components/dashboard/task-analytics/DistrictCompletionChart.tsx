"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { DistrictSummary } from "@/services/task-analytics.service";

interface Props {
  data: DistrictSummary[];
  loading?: boolean;
  onDistrictClick?: (districtId: number) => void;
}

function rateColor(rate: number): string {
  if (rate >= 75) return "#22c55e";
  if (rate >= 50) return "#f59e0b";
  return "#f87171";
}

export function DistrictCompletionChart({ data, loading, onDistrictClick }: Props) {
  const chartData = data.map((d) => ({
    name: d.districtName,
    rate: parseFloat(d.completionRate.toFixed(1)),
    districtId: d.districtId,
    total: d.total,
  }));

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          Completion Rate by District
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-56 w-full" />
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 40 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 10 }}
                angle={-35}
                textAnchor="end"
                interval={0}
              />
              <YAxis
                domain={[0, 100]}
                tickFormatter={(v) => `${v}%`}
                tick={{ fontSize: 10 }}
                width={38}
              />
              <Tooltip
                formatter={(v) => [`${v}%`, "Completion Rate"]}
              />
              <Bar
                dataKey="rate"
                radius={[3, 3, 0, 0]}
                cursor={onDistrictClick ? "pointer" : undefined}
                onClick={(entry: any) => onDistrictClick?.(entry.districtId)}
              >
                {chartData.map((entry, i) => (
                  <Cell key={i} fill={rateColor(entry.rate)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
