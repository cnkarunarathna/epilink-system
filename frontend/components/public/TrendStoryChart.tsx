"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { TrendingUp } from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";

interface TrendData {
  year: number;
  week: number;
  total_cases: number;
}

export default function TrendStoryChart({ data }: { data: TrendData[] }) {
  if (!data.length) return null;

  const avg = Math.round(
    data.reduce((s, d) => s + d.total_cases, 0) / data.length,
  );
  const peak = Math.max(...data.map((d) => d.total_cases));
  const peakEntry = data.find((d) => d.total_cases === peak);

  return (
    <Card className="shadow-lg border-2">
      <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/50 dark:to-indigo-950/50">
        <CardTitle className="flex items-center gap-2">
          <div className="p-2 bg-blue-100 dark:bg-blue-900/50 rounded-lg">
            <TrendingUp className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          </div>
          Is dengue getting better or worse?
        </CardTitle>
        <CardDescription>
          How the total number of expected dengue cases across Sri Lanka has
          changed over the past 12 weeks
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-6">
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={data}
              margin={{ top: 16, right: 8, bottom: 0, left: 0 }}
            >
              <defs>
                <linearGradient id="trendGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                stroke="#e2e8f0"
              />
              <XAxis
                dataKey="week"
                tickFormatter={(v) => `Wk ${v}`}
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 11 }}
                dy={8}
              />
              <Tooltip
                cursor={{
                  stroke: "#3b82f6",
                  strokeWidth: 1,
                  strokeDasharray: "4 2",
                }}
                formatter={(value) => [
                  typeof value === "number"
                    ? value.toLocaleString()
                    : String(value ?? ""),
                  "Expected cases",
                ]}
                labelFormatter={(label, payload) => {
                  if (payload?.length > 0)
                    return `Week ${label}, ${payload[0].payload.year}`;
                  return `Week ${label}`;
                }}
              />
              <ReferenceLine
                y={avg}
                stroke="#94a3b8"
                strokeDasharray="6 3"
                label={{
                  value: `Avg: ${avg.toLocaleString()}`,
                  fill: "#94a3b8",
                  fontSize: 10,
                  position: "insideTopRight",
                }}
              />
              {peakEntry && (
                <ReferenceLine
                  x={peakEntry.week}
                  stroke="#f87171"
                  strokeDasharray="4 2"
                  label={{
                    value: "Peak",
                    fill: "#f87171",
                    fontSize: 10,
                    position: "insideTopLeft",
                  }}
                />
              )}
              <Area
                type="monotone"
                dataKey="total_cases"
                stroke="#3b82f6"
                strokeWidth={2.5}
                fill="url(#trendGradient)"
                dot={false}
                activeDot={{
                  r: 5,
                  stroke: "#3b82f6",
                  fill: "#fff",
                  strokeWidth: 2,
                }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <p className="text-xs text-muted-foreground text-center mt-3">
          The dashed line shows the 12-week average ({avg.toLocaleString()}{" "}
          cases). Hover the chart to see weekly details.
        </p>
      </CardContent>
    </Card>
  );
}
