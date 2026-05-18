"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import {
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  TrendingDown,
  Activity,
} from "lucide-react";
import { fetchOutbreakAlerts } from "@/services/analytics.service";

interface Alert {
  district: string;
  current_cases: number;
  avg_cases: number;
  alert_level: string;
  description: string;
  severity: string;
}

interface Props {
  district: string;
}

const SEVERITY_STYLES = {
  critical: {
    border: "border-l-red-500",
    bg: "bg-red-50 dark:bg-red-950/30",
    text: "text-red-700 dark:text-red-300",
    badge: "destructive" as const,
  },
  high: {
    border: "border-l-orange-500",
    bg: "bg-orange-50 dark:bg-orange-950/30",
    text: "text-orange-700 dark:text-orange-300",
    badge: "default" as const,
  },
  moderate: {
    border: "border-l-yellow-500",
    bg: "bg-yellow-50 dark:bg-yellow-950/30",
    text: "text-yellow-700 dark:text-yellow-300",
    badge: "secondary" as const,
  },
} as const;

export default function DistrictOutbreakAlert({ district }: Props) {
  const [alert, setAlert] = useState<Alert | null | undefined>(undefined);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetchOutbreakAlerts()
      .then((all: Alert[]) => {
        const match = all.find(
          (a) => a.district.toLowerCase() === district.toLowerCase(),
        );
        setAlert(match ?? null);
      })
      .catch((err) => {
        console.error("Outbreak alerts fetch failed:", err);
        setError(true);
        setAlert(null);
      });
  }, [district]);

  if (alert === undefined) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
        <Activity className="h-4 w-4 animate-pulse" />
        <span>Checking district alert status…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-3 p-3.5 rounded-lg bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-800">
        <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-400 shrink-0" />
        <div>
          <p className="text-sm font-semibold text-yellow-700 dark:text-yellow-300">
            Alert Status Unavailable
          </p>
          <p className="text-xs text-yellow-600/80 dark:text-yellow-400/80">
            Could not check district alert status — verify your connection
          </p>
        </div>
      </div>
    );
  }

  if (alert === null) {
    return (
      <div className="flex items-center gap-3 p-3.5 rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800">
        <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 shrink-0" />
        <div>
          <p className="text-sm font-semibold text-green-700 dark:text-green-300">
            No Active Alerts
          </p>
          <p className="text-xs text-green-600/80 dark:text-green-400/80">
            {district} is within normal case levels this week
          </p>
        </div>
      </div>
    );
  }

  const style =
    SEVERITY_STYLES[alert.severity as keyof typeof SEVERITY_STYLES] ??
    SEVERITY_STYLES.moderate;

  const isRising = alert.current_cases > alert.avg_cases;
  const pctChange =
    alert.avg_cases > 0
      ? Math.abs(
          Math.round((alert.current_cases / alert.avg_cases - 1) * 100),
        )
      : 0;

  return (
    <div
      className={`p-4 rounded-lg border-l-4 ${style.border} ${style.bg} space-y-2`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <AlertTriangle className={`h-4 w-4 ${style.text} shrink-0`} />
          <span className={`text-sm font-semibold ${style.text}`}>
            District Alert Active
          </span>
        </div>
        <Badge variant={style.badge} className="text-xs capitalize">
          {alert.severity}
        </Badge>
      </div>

      <p className="text-sm text-muted-foreground">{alert.description}</p>

      <div className="flex items-center gap-4 text-xs">
        <span>
          <span className="text-muted-foreground">Current: </span>
          <span className="font-bold text-red-600 dark:text-red-400">
            {alert.current_cases}
          </span>
        </span>
        <span>
          <span className="text-muted-foreground">4-wk avg: </span>
          <span className="font-medium">{Math.round(alert.avg_cases)}</span>
        </span>
        <span className="flex items-center gap-1">
          {isRising ? (
            <>
              <TrendingUp className="h-3 w-3 text-red-500" />
              <span className="text-red-600 dark:text-red-400 font-medium">
                +{pctChange}%
              </span>
            </>
          ) : (
            <>
              <TrendingDown className="h-3 w-3 text-green-500" />
              <span className="text-green-600 dark:text-green-400 font-medium">
                -{pctChange}%
              </span>
            </>
          )}
        </span>
      </div>
    </div>
  );
}
