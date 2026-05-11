"use client";

import { useState, useEffect } from "react";
import { LineChart, Line, ResponsiveContainer } from "recharts";
import { Loader2 } from "lucide-react";
import { fetchPhiProfile } from "@/services/task-analytics.service";
import type { PhiMonthlyTrend } from "@/services/task-analytics.service";

interface Props {
  phiId: string;
}

export default function PhiSparkline({ phiId }: Props) {
  const [trend, setTrend] = useState<PhiMonthlyTrend[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPhiProfile(phiId)
      .then((profile) => setTrend(profile.monthlyTrend.slice(-4)))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [phiId]);

  if (loading) {
    return (
      <div className="w-20 h-8 rounded bg-muted animate-pulse" />
    );
  }

  if (trend.length < 2) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }

  const first = trend[0].completed;
  const last = trend[trend.length - 1].completed;
  const strokeColor =
    last > first ? "#22c55e" : last < first ? "#ef4444" : "#9ca3af";

  return (
    <div className="w-20 h-8">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={trend} margin={{ top: 2, right: 2, left: 2, bottom: 2 }}>
          <Line
            type="monotone"
            dataKey="completed"
            stroke={strokeColor}
            strokeWidth={1.5}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
