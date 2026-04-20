"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  AlertTriangle,
  Activity,
  ChevronDown,
  ChevronUp,
  TrendingUp,
} from "lucide-react";
import { useEffect, useState } from "react";
import { fetchPublicOutbreakAlerts } from "@/services/public-analytics.service";

interface Alert {
  district: string;
  current_cases: number;
  avg_cases: number;
  alert_level: string;
  description: string;
  severity: string;
}

const HIGH_RISK_TIPS = [
  "Use mosquito repellent (DEET-based) every day, especially morning and evening",
  "Wear long-sleeved shirts and trousers at dawn and dusk",
  "Empty, cover, or remove any containers holding standing water",
  "Sleep under a mosquito net — even during the day",
  "See a doctor immediately if you develop a fever",
];

const WATCH_TIPS = [
  "Check and empty standing water containers weekly",
  "Apply mosquito repellent when outdoors",
  "Monitor for fever or flu-like symptoms",
];

export default function PublicHealthWarnings() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    try {
      const data = await fetchPublicOutbreakAlerts();
      setAlerts(data);
    } catch (e) {
      console.error("Failed to load health warnings:", e);
    } finally {
      setLoading(false);
    }
  };

  const isWarning = (severity: string) =>
    severity === "critical" || severity === "high";

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Health Warnings
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-32">
            <Activity className="h-6 w-6 animate-pulse text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (alerts.length === 0) {
    return (
      <Card className="border-2 border-dashed">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <div className="p-2 bg-green-100 dark:bg-green-900/50 rounded-lg">
              <AlertTriangle className="h-5 w-5 text-green-600 dark:text-green-400" />
            </div>
            Health Warnings
          </CardTitle>
          <CardDescription>
            Areas where dengue cases have risen sharply this week
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
            <div className="p-4 bg-green-50 dark:bg-green-900/30 rounded-full mb-3">
              <Activity className="h-8 w-8 text-green-600 dark:text-green-400" />
            </div>
            <p className="font-medium text-green-700 dark:text-green-400">
              ✓ All Clear!
            </p>
            <p className="text-sm">No major health warnings this week</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-lg border-2">
      <CardHeader className="bg-gradient-to-r from-red-50 to-orange-50 dark:from-red-950/50 dark:to-orange-950/50">
        <CardTitle className="flex items-center gap-2">
          <div className="p-2 bg-red-100 dark:bg-red-900/50 rounded-lg animate-pulse">
            <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
          </div>
          Health Warnings
          <Badge variant="destructive" className="ml-auto">
            {alerts.length} Active
          </Badge>
        </CardTitle>
        <CardDescription>
          Areas where dengue cases have risen sharply this week
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-6 space-y-3">
        {alerts.map((alert, i) => {
          const warn = isWarning(alert.severity);
          const isOpen = expanded === alert.district;
          const tips = warn ? HIGH_RISK_TIPS : WATCH_TIPS;
          const pct = alert.avg_cases > 0
            ? ((alert.current_cases / alert.avg_cases - 1) * 100).toFixed(0)
            : null;

          return (
            <div
              key={alert.district}
              className={`rounded-lg border-l-4 overflow-hidden transition-all animate-in slide-in-from-left-5 ${
                warn
                  ? "border-red-500 bg-gradient-to-r from-red-50 to-red-100/50 dark:from-red-950/50 dark:to-red-900/30"
                  : "border-yellow-500 bg-gradient-to-r from-yellow-50 to-yellow-100/50 dark:from-yellow-950/50 dark:to-yellow-900/30"
              }`}
              style={{ animationDelay: `${i * 100}ms` }}
            >
              <div className="p-4">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <h4 className="font-semibold">{alert.district}</h4>
                    <Badge variant={warn ? "destructive" : "default"}>
                      {warn ? "🔴 Warning" : "⚠️ Watch"}
                    </Badge>
                  </div>
                  <button
                    onClick={() =>
                      setExpanded(isOpen ? null : alert.district)
                    }
                    className="text-xs text-muted-foreground flex items-center gap-1 hover:text-foreground transition-colors"
                  >
                    What to do
                    {isOpen ? (
                      <ChevronUp className="h-3 w-3" />
                    ) : (
                      <ChevronDown className="h-3 w-3" />
                    )}
                  </button>
                </div>
                <p className="text-sm text-muted-foreground mb-1">
                  {alert.description}
                </p>
                {pct && alert.current_cases > alert.avg_cases && (
                  <div className="flex items-center gap-1 text-xs text-red-600 dark:text-red-400 mt-1">
                    <TrendingUp className="h-3 w-3 shrink-0" />
                    Cases rose by <strong>{pct}%</strong> above the recent
                    average
                  </div>
                )}
              </div>
              {isOpen && (
                <div className="px-4 pb-4 border-t border-white/30 dark:border-black/20">
                  <p className="text-xs font-semibold text-foreground mb-2 mt-3">
                    What you can do:
                  </p>
                  <ul className="space-y-1.5">
                    {tips.map((tip) => (
                      <li
                        key={tip}
                        className="flex items-start gap-2 text-xs text-muted-foreground"
                      >
                        <span className="text-green-600 dark:text-green-400 shrink-0 mt-0.5">
                          ✓
                        </span>
                        {tip}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
