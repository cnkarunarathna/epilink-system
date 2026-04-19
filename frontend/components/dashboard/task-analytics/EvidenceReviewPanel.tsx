"use client";

import {
  RadialBarChart,
  RadialBar,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

interface Props {
  total: number;
  approved: number;
  rejected: number;
  pending: number;
  approvalRate: number;
  loading?: boolean;
}

export function EvidenceReviewPanel({
  total,
  approved,
  rejected,
  pending,
  approvalRate,
  loading,
}: Props) {
  const gaugeData = [
    { name: "Approval Rate", value: approvalRate, fill: "#22c55e" },
  ];

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          Evidence Review
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-40 w-full" />
        ) : (
          <div className="flex items-center gap-6 flex-wrap">
            <div className="relative flex-shrink-0">
              <ResponsiveContainer width={140} height={140}>
                <RadialBarChart
                  innerRadius={45}
                  outerRadius={65}
                  startAngle={90}
                  endAngle={-270}
                  data={gaugeData}
                >
                  <RadialBar
                    dataKey="value"
                    cornerRadius={6}
                    background={{ fill: "#e2e8f0" }}
                  />
                  <Tooltip formatter={(v) => [`${v}%`, "Approval Rate"]} />
                </RadialBarChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-2xl font-bold">{approvalRate}%</span>
                <span className="text-xs text-muted-foreground">approval</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm">
              <Stat label="Total Submitted" value={total} />
              <Stat label="Approved" value={approved} color="text-green-600" />
              <Stat label="Rejected" value={rejected} color="text-destructive" />
              <Stat label="Pending" value={pending} color="text-amber-600" />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Stat({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color?: string;
}) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-lg font-semibold ${color ?? ""}`}>{value}</p>
    </div>
  );
}
