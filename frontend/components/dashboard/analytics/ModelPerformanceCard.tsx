"use client";

import { useState, useEffect } from "react";
import { TrendingUp, TrendingDown, Minus, Activity, Loader2 } from "lucide-react";
import {
  fetchModelPerformance,
  type ModelPerformanceResponse,
} from "@/services/analytics.service";

interface Props {
  district: string;
}

const ACCURACY_BADGE: Record<string, { label: string; className: string }> = {
  excellent: {
    label: "Excellent",
    className:
      "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  },
  good: {
    label: "Good",
    className:
      "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  },
  moderate: {
    label: "Moderate",
    className:
      "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
  },
  poor: {
    label: "Poor",
    className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  },
  unavailable: {
    label: "Unavailable",
    className: "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400",
  },
};

function TrendIcon({ trend }: { trend: string }) {
  const t = trend.toLowerCase();
  if (t.includes("ris"))
    return <TrendingUp className="h-3.5 w-3.5 text-red-500 inline mr-1" />;
  if (t.includes("fall"))
    return <TrendingDown className="h-3.5 w-3.5 text-green-500 inline mr-1" />;
  return <Minus className="h-3.5 w-3.5 text-gray-400 inline mr-1" />;
}

export default function ModelPerformanceCard({ district }: Props) {
  const [data, setData] = useState<ModelPerformanceResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetchModelPerformance(district)
      .then((res) => setData(res))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [district]);

  if (loading) {
    return (
      <div className="h-40 flex items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!data || data.error) {
    return (
      <div className="h-40 flex items-center justify-center text-sm text-muted-foreground">
        Model performance data unavailable
      </div>
    );
  }

  const badge = ACCURACY_BADGE[data.accuracy_class] ?? ACCURACY_BADGE.unavailable;

  const naiveComparison = (() => {
    if (data.naive_persistence_mae_8w === null || data.absolute_error === null)
      return null;
    const diff = Math.round(
      Math.abs(data.naive_persistence_mae_8w - data.absolute_error),
    );
    return data.absolute_error < data.naive_persistence_mae_8w
      ? `Model beats naive baseline by ~${diff} cases`
      : `Naive baseline outperforms by ~${diff} cases`;
  })();

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Activity className="h-4 w-4 text-muted-foreground shrink-0" />
        <span
          className={`text-xs font-semibold px-2 py-0.5 rounded-full ${badge.className}`}
        >
          {badge.label}
        </span>
        <span className="text-xs text-muted-foreground">accuracy</span>
      </div>

      <dl className="space-y-2.5 text-sm">
        <div className="flex justify-between">
          <dt className="text-muted-foreground">Prediction error</dt>
          <dd className="font-medium">
            {data.percentage_error_pct !== null
              ? `±${data.percentage_error_pct.toFixed(1)}%`
              : "—"}
          </dd>
        </div>

        {data.absolute_error !== null && (
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Absolute error</dt>
            <dd className="font-medium">~{Math.round(data.absolute_error)} cases</dd>
          </div>
        )}

        <div className="flex justify-between items-center">
          <dt className="text-muted-foreground">Observed trend</dt>
          <dd className="font-medium flex items-center">
            <TrendIcon trend={data.observed_trend} />
            {data.observed_trend}
          </dd>
        </div>

        {naiveComparison && (
          <div className="border-t pt-2 text-xs text-muted-foreground">
            {naiveComparison}
          </div>
        )}
      </dl>

      {data.narrative && (
        <details className="text-xs text-muted-foreground">
          <summary className="cursor-pointer select-none font-medium text-foreground/70 hover:text-foreground transition-colors">
            Context note
          </summary>
          <p className="mt-1.5 leading-relaxed">{data.narrative}</p>
        </details>
      )}
    </div>
  );
}
