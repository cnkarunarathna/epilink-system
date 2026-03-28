"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Globe,
  RefreshCw,
  Loader2,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Minus,
  AlertCircle,
  Sparkles,
  MapPin,
  BarChart3,
} from "lucide-react";
import { toast } from "sonner";
import {
  fetchNationalSummary,
  NationalSummaryResponse,
  DistrictHighlight,
} from "@/services/analytics.service";

const riskColors: Record<string, string> = {
  critical: "bg-red-100 text-red-800 border-red-200 dark:bg-red-950/50 dark:text-red-300 dark:border-red-800",
  high:     "bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-950/50 dark:text-orange-300 dark:border-orange-800",
  moderate: "bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-950/50 dark:text-yellow-300 dark:border-yellow-800",
  low:      "bg-green-100 text-green-800 border-green-200 dark:bg-green-950/50 dark:text-green-300 dark:border-green-800",
};

const riskDot: Record<string, string> = {
  critical: "bg-red-500",
  high:     "bg-orange-500",
  moderate: "bg-yellow-500",
  low:      "bg-green-500",
};

const trendIcon = {
  rising:  <TrendingUp  className="h-3.5 w-3.5 text-red-500"   />,
  falling: <TrendingDown className="h-3.5 w-3.5 text-green-500" />,
  stable:  <Minus        className="h-3.5 w-3.5 text-blue-500"  />,
};

function RiskDistributionBar({ byRisk }: { byRisk: Record<string, number> }) {
  const total = Object.values(byRisk).reduce((a, b) => a + b, 0) || 1;
  const segments = [
    { key: "critical", color: "bg-red-500",    label: "Critical" },
    { key: "high",     color: "bg-orange-500", label: "High"     },
    { key: "moderate", color: "bg-yellow-500", label: "Moderate" },
    { key: "low",      color: "bg-green-500",  label: "Low"      },
  ];
  return (
    <div className="space-y-2">
      <div className="flex h-3 rounded-full overflow-hidden gap-px">
        {segments.map(({ key, color }) => {
          const pct = ((byRisk[key] ?? 0) / total) * 100;
          return pct > 0 ? (
            <div
              key={key}
              className={`${color} transition-all duration-500`}
              style={{ width: `${pct}%` }}
              title={`${key}: ${byRisk[key]}`}
            />
          ) : null;
        })}
      </div>
      <div className="flex items-center gap-3 flex-wrap">
        {segments.map(({ key, color, label }) => (
          <div key={key} className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <div className={`h-2 w-2 rounded-full ${color}`} />
            <span>{label}: {byRisk[key] ?? 0}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function NationalSummaryPanel() {
  const [data, setData] = useState<NationalSummaryResponse | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (showToast = false) => {
    try {
      setLoading(true);
      const result = await fetchNationalSummary();
      setData(result);
      if (showToast) {
        toast.success("Report refreshed", {
          description: `Generated at ${new Date(result.generated_at).toLocaleTimeString()}`,
        });
      }
    } catch (err: any) {
      toast.error("Failed to load national summary", {
        description: err.response?.data?.message || err.message,
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-4">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg shadow-md">
            <Globe className="h-5 w-5 text-white" />
          </div>
          <div>
            <h3 className="text-base font-semibold">National Situation Report</h3>
            <p className="text-xs text-muted-foreground">
              Executive summary across all Sri Lanka districts
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => load(true)}
          disabled={loading}
          className="gap-2"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          Refresh
        </Button>
      </div>

      {/* Loading skeleton */}
      {loading && !data && (
        <Card>
          <CardContent className="py-12 flex flex-col items-center gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
            <p className="text-sm text-muted-foreground">
              Generating national situation report...
            </p>
          </CardContent>
        </Card>
      )}

      {data && (
        <>
          {/* Urgent alert banner */}
          {data.urgent_districts.length > 0 && (
            <div className="flex items-start gap-3 p-4 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 animate-in slide-in-from-top-2">
              <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-red-800 dark:text-red-300">
                  URGENT — Critical districts require immediate action
                </p>
                <p className="text-xs text-red-700 dark:text-red-400 mt-0.5">
                  {data.urgent_districts.join(", ")}
                </p>
              </div>
            </div>
          )}

          {/* National metrics row */}
          <div className="grid grid-cols-3 gap-3">
            <Card className="bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900/60 dark:to-slate-800/40">
              <CardContent className="pt-4 pb-3">
                <p className="text-xs text-muted-foreground mb-1">Total National Cases</p>
                <p className="text-2xl font-bold tabular-nums">
                  {data.total_national_cases.toLocaleString()}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {data.prediction_week ?? "Current week"}
                </p>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900/60 dark:to-slate-800/40">
              <CardContent className="pt-4 pb-3">
                <p className="text-xs text-muted-foreground mb-1">Districts Analysed</p>
                <p className="text-2xl font-bold tabular-nums">
                  {data.total_districts_analysed}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {data.urgent_districts.length} urgent
                </p>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900/60 dark:to-slate-800/40">
              <CardContent className="pt-4 pb-3">
                <p className="text-xs text-muted-foreground mb-1">Critical / High Risk</p>
                <p className="text-2xl font-bold tabular-nums">
                  {(data.by_risk_level.critical ?? 0) + (data.by_risk_level.high ?? 0)}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  of {data.total_districts_analysed} districts
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Risk distribution bar */}
          {data.total_districts_analysed > 0 && (
            <Card>
              <CardHeader className="pb-2 pt-4">
                <CardTitle className="text-sm flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-muted-foreground" />
                  Risk Distribution
                </CardTitle>
              </CardHeader>
              <CardContent className="pb-4">
                <RiskDistributionBar byRisk={data.by_risk_level} />
              </CardContent>
            </Card>
          )}

          {/* Situation report — the 3-paragraph Gemini narrative */}
          <Card className="border-blue-200 dark:border-blue-900/50 shadow-sm">
            <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/40 dark:to-indigo-950/40 pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                AI-Generated Situation Report
              </CardTitle>
              <CardDescription className="text-xs">
                Generated {new Date(data.generated_at).toLocaleString()} ·{" "}
                {data.implementation_phase}
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="space-y-3">
                {data.situation_report
                  .split("\n\n")
                  .filter(Boolean)
                  .map((para, idx) => (
                    <p
                      key={idx}
                      className={`text-sm leading-relaxed ${
                        para.startsWith("URGENT:")
                          ? "text-red-700 dark:text-red-400 font-medium"
                          : "text-slate-700 dark:text-slate-300"
                      }`}
                    >
                      {para}
                    </p>
                  ))}
              </div>
            </CardContent>
          </Card>

          {/* District highlights table */}
          {data.district_highlights.length > 0 && (
            <Card>
              <CardHeader className="pb-2 pt-4">
                <CardTitle className="text-sm flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  District Breakdown
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="max-h-72 overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-muted/80 backdrop-blur-sm">
                      <tr>
                        <th className="text-left px-4 py-2 font-medium text-muted-foreground">District</th>
                        <th className="text-right px-4 py-2 font-medium text-muted-foreground">Cases</th>
                        <th className="text-right px-4 py-2 font-medium text-muted-foreground">WoW %</th>
                        <th className="text-center px-4 py-2 font-medium text-muted-foreground">Trend</th>
                        <th className="text-center px-4 py-2 font-medium text-muted-foreground">Risk</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.district_highlights.map((h: DistrictHighlight, idx: number) => (
                        <tr
                          key={h.district}
                          className={`border-t border-border/50 ${
                            h.is_urgent ? "bg-red-50/50 dark:bg-red-950/20" : idx % 2 === 0 ? "" : "bg-muted/20"
                          }`}
                        >
                          <td className="px-4 py-2 font-medium flex items-center gap-1.5">
                            {h.is_urgent && (
                              <AlertCircle className="h-3 w-3 text-red-500 shrink-0" />
                            )}
                            <span className={h.is_urgent ? "text-red-700 dark:text-red-400" : ""}>
                              {h.district}
                            </span>
                          </td>
                          <td className="px-4 py-2 text-right tabular-nums font-semibold">
                            {h.recent_case_count.toLocaleString()}
                          </td>
                          <td className={`px-4 py-2 text-right tabular-nums ${
                            (h.wow_pct ?? 0) >= 15
                              ? "text-red-600 dark:text-red-400 font-semibold"
                              : (h.wow_pct ?? 0) < -5
                              ? "text-green-600 dark:text-green-400"
                              : "text-muted-foreground"
                          }`}>
                            {h.wow_pct !== null
                              ? `${h.wow_pct >= 0 ? "+" : ""}${h.wow_pct.toFixed(1)}%`
                              : "—"}
                          </td>
                          <td className="px-4 py-2 text-center">
                            <span className="flex justify-center">
                              {trendIcon[h.trend]}
                            </span>
                          </td>
                          <td className="px-4 py-2 text-center">
                            <span className="inline-flex items-center gap-1">
                              <span className={`h-1.5 w-1.5 rounded-full ${riskDot[h.risk_level]}`} />
                              <span className={`px-1.5 py-0.5 rounded-full border text-xs font-medium ${riskColors[h.risk_level]}`}>
                                {h.risk_level}
                              </span>
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
