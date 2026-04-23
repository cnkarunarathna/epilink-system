"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Download,
  TrendingUp,
  TrendingDown,
  Minus,
  AlertTriangle,
  BarChart3,
  TableProperties,
  FileText,
} from "lucide-react";
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
import { WeeklyReport, HotspotRow, getReportDownloadUrl } from "@/services/reports.service";

interface Props {
  report: WeeklyReport | null;
  onClose: () => void;
}

const TREND_COLORS: Record<string, string> = {
  Rising: "#ef4444",
  Stable: "#3b82f6",
  Falling: "#10b981",
};

const SEVERITY_COLORS: Record<string, string> = {
  critical:
    "bg-red-100 border-red-300 text-red-800 dark:bg-red-950/40 dark:border-red-800 dark:text-red-300",
  high: "bg-amber-100 border-amber-300 text-amber-800 dark:bg-amber-950/40 dark:border-amber-800 dark:text-amber-300",
  moderate:
    "bg-blue-100 border-blue-300 text-blue-800 dark:bg-blue-950/40 dark:border-blue-800 dark:text-blue-300",
};

function TrendIcon({ trend }: { trend: string }) {
  if (trend === "Rising")
    return <TrendingUp className="h-3.5 w-3.5 text-red-500" />;
  if (trend === "Falling")
    return <TrendingDown className="h-3.5 w-3.5 text-green-500" />;
  return <Minus className="h-3.5 w-3.5 text-muted-foreground" />;
}

export default function ReportDetailModal({ report, onClose }: Props) {
  const [downloading, setDownloading] = useState(false);

  if (!report) return null;

  const forecast = report.reportData?.forecast ?? [];
  const alerts = report.reportData?.alerts ?? [];
  const hotspots: HotspotRow[] = report.reportData?.hotspots ?? [];
  const nationalSummary = report.reportData?.nationalSummary;
  // Prefer the dedicated DB column; fall back to JSONB for older records
  const isHistorical = (report.reportType ?? report.reportData?.reportType) === 'historical';
  const totalCurrentCases = report.totalCurrentCases ?? report.reportData?.totalCurrentCases;
  const nationalText =
    typeof nationalSummary === "string"
      ? nationalSummary
      : (nationalSummary?.situation_report ?? "Summary not available.");

  const top10 = [...forecast]
    .sort((a, b) => {
      const bVal = isHistorical ? (b.reported_cases ?? 0) : (b.predicted_cases ?? 0);
      const aVal = isHistorical ? (a.reported_cases ?? 0) : (a.predicted_cases ?? 0);
      return bVal - aVal;
    })
    .slice(0, 10)
    .map((d) => ({
      ...d,
      name: d.district,
      displayVal: isHistorical ? (d.reported_cases ?? 0) : (d.predicted_cases ?? 0),
    }));

  async function handleDownload() {
    if (!report) return;
    setDownloading(true);
    try {
      const { url } = await getReportDownloadUrl(report.id);
      window.open(url, "_blank");
    } catch {
      toast.error("Could not fetch download link. Please try again.");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <Sheet open={!!report} onOpenChange={(v) => !v && onClose()}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-3xl overflow-y-auto p-0"
      >
        {/* Sticky header */}
        <div className="sticky top-0 z-10 bg-background border-b px-6 py-4">
          <SheetHeader className="space-y-1">
            <div className="flex items-start justify-between gap-4">
              <div>
                <SheetTitle className="text-base leading-tight">
                  Week {report.weekNumber}, {report.year}
                </SheetTitle>
                <SheetDescription className="text-xs mt-0.5">
                  {report.startDate} &mdash; {report.endDate}
                </SheetDescription>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Badge
                  variant={
                    report.status === "approved" ? "default" : "secondary"
                  }
                >
                  {report.status}
                </Badge>
                {report.s3Key && (
                  <Button
                    size="sm"
                    onClick={handleDownload}
                    disabled={downloading}
                  >
                    <Download className="mr-1.5 h-3.5 w-3.5" />
                    {downloading ? "Loading…" : "Download PDF"}
                  </Button>
                )}
              </div>
            </div>
          </SheetHeader>
        </div>

        {/* Summary stats */}
        <div className={`grid gap-3 px-6 py-4 bg-muted/30 ${!isHistorical && totalCurrentCases !== undefined ? 'grid-cols-4' : 'grid-cols-3'}`}>
          <div className="text-center">
            <p className="text-2xl font-bold">
              {report.totalPredictedCases.toLocaleString()}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {isHistorical ? 'Total Reported Cases' : 'Predicted Cases (Next Wk)'}
            </p>
          </div>
          {!isHistorical && totalCurrentCases !== undefined && (
            <div className="text-center border-l">
              <p className="text-2xl font-bold text-green-600">
                {totalCurrentCases.toLocaleString()}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Current Week (Actual)
              </p>
            </div>
          )}
          <div className="text-center border-l">
            <p className="text-2xl font-bold text-red-500">
              {report.highRiskDistricts}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              High-Risk Districts
            </p>
          </div>
          <div className="text-center border-l">
            <p className="text-2xl font-bold text-amber-500">{alerts.length}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Active Alerts
            </p>
          </div>
        </div>

        <Separator />

        {/* Tabs */}
        <Tabs defaultValue="chart" className="px-6 py-4">
          <TabsList className="w-full grid grid-cols-4">
            <TabsTrigger value="chart" className="text-xs">
              <BarChart3 className="mr-1.5 h-3.5 w-3.5" />
              Chart
            </TabsTrigger>
            <TabsTrigger value="table" className="text-xs">
              <TableProperties className="mr-1.5 h-3.5 w-3.5" />
              Districts
            </TabsTrigger>
            <TabsTrigger value="alerts" className="text-xs">
              <AlertTriangle className="mr-1.5 h-3.5 w-3.5" />
              Alerts
              {(alerts.length + hotspots.length) > 0 && (
                <span className="ml-1.5 rounded-full bg-red-500 text-white text-[10px] px-1.5 py-0.5 leading-none">
                  {alerts.length + hotspots.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="summary" className="text-xs">
              <FileText className="mr-1.5 h-3.5 w-3.5" />
              Summary
            </TabsTrigger>
          </TabsList>

          {/* Chart tab */}
          <TabsContent value="chart" className="mt-4">
            <p className="text-sm font-medium mb-3">
              {isHistorical
                ? 'Top 10 Districts — Reported Cases This Week'
                : 'Top 10 Districts — Predicted Cases Next Week'}
            </p>
            {top10.length > 0 ? (
              <ResponsiveContainer width="100%" height={320}>
                <BarChart
                  data={top10}
                  layout="vertical"
                  margin={{ top: 0, right: 40, left: 80, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    tick={{ fontSize: 11 }}
                    width={75}
                  />
                  <Tooltip
                    formatter={(value: number | undefined) => [
                      (value ?? 0).toLocaleString(),
                      isHistorical ? "Reported Cases" : "Predicted Cases",
                    ]}
                  />
                  <Bar dataKey="displayVal" radius={[0, 4, 4, 0]}>
                    {top10.map((entry, i) => (
                      <Cell
                        key={i}
                        fill={TREND_COLORS[entry.trend] ?? "#3b82f6"}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-muted-foreground py-8 text-center">
                No forecast data available.
              </p>
            )}
            <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
              {(["Rising", "Stable", "Falling"] as const).map((t) => (
                <span key={t} className="flex items-center gap-1">
                  <span
                    className="inline-block h-2.5 w-2.5 rounded-sm"
                    style={{ backgroundColor: TREND_COLORS[t] }}
                  />
                  {t}
                </span>
              ))}
            </div>
          </TabsContent>

          {/* Districts table */}
          <TabsContent value="table" className="mt-4">
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/60 text-xs">
                    <th className="text-left px-3 py-2 font-semibold">
                      District
                    </th>
                    <th className="text-right px-3 py-2 font-semibold">
                      {isHistorical ? 'Reported' : 'Current'}
                    </th>
                    <th className="text-right px-3 py-2 font-semibold">
                      {isHistorical ? 'vs Prior Wk' : 'Predicted'}
                    </th>
                    <th className="text-right px-3 py-2 font-semibold">
                      4-Wk Avg
                    </th>
                    <th className="px-3 py-2 font-semibold">Trend</th>
                    <th className="px-3 py-2 font-semibold">Source</th>
                  </tr>
                </thead>
                <tbody>
                  {[...forecast]
                    .sort((a, b) => {
                      const bVal = isHistorical ? (b.reported_cases ?? 0) : (b.predicted_cases ?? 0);
                      const aVal = isHistorical ? (a.reported_cases ?? 0) : (a.predicted_cases ?? 0);
                      return bVal - aVal;
                    })
                    .map((row, i) => {
                      const isActual = row.confidence === 'actual';
                      const primaryVal = isHistorical ? (row.reported_cases ?? 0) : (row.predicted_cases ?? 0);
                      const secondaryVal = isHistorical ? (row.prior_cases ?? null) : (row.reported_cases ?? null);
                      return (
                      <tr
                        key={i}
                        className="border-t hover:bg-muted/30 transition-colors"
                      >
                        <td className="px-3 py-2 font-medium">
                          {row.district}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {primaryVal.toLocaleString()}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums font-semibold">
                          {secondaryVal !== null ? secondaryVal.toLocaleString() : '—'}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                          {Math.round(row.avg_4week).toLocaleString()}
                        </td>
                        <td className="px-3 py-2">
                          <span className="flex items-center gap-1">
                            <TrendIcon trend={row.trend} />
                            <span
                              className="text-xs"
                              style={{
                                color: TREND_COLORS[row.trend] ?? "inherit",
                              }}
                            >
                              {row.trend}
                            </span>
                          </span>
                        </td>
                        <td className="px-3 py-2">
                          <span
                            className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-medium capitalize ${
                              isActual
                                ? 'bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400'
                                : 'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400'
                            }`}
                          >
                            {isActual ? 'Actual' : 'Forecast'}
                          </span>
                        </td>
                      </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </TabsContent>

          {/* Alerts tab */}
          <TabsContent value="alerts" className="mt-4 space-y-4">
            {/* Outbreak alerts */}
            <div className="space-y-3">
              {alerts.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  No active outbreak alerts for this period.
                </p>
              ) : (
                alerts.map((alert, i) => (
                  <div
                    key={i}
                    className={`rounded-lg border p-4 ${SEVERITY_COLORS[alert.severity] ?? SEVERITY_COLORS.moderate}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold text-sm">{alert.district}</p>
                        {alert.current_cases !== undefined && (
                          <p className="text-xs mt-0.5 opacity-80">
                            {alert.current_cases.toLocaleString()} current cases
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {!isHistorical && (
                          <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-300 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-700">
                            Forecast-based
                          </Badge>
                        )}
                        <Badge variant="outline" className="text-xs uppercase">
                          {alert.severity}
                        </Badge>
                      </div>
                    </div>
                    {alert.message && (
                      <p className="text-xs mt-2 opacity-90">{alert.message}</p>
                    )}
                    {alert.recommendation && (
                      <p className="text-xs mt-1 italic opacity-75">
                        {alert.recommendation}
                      </p>
                    )}
                  </div>
                ))
              )}
            </div>

            {/* Hotspots */}
            {hotspots.length > 0 && (
              <div>
                <p className="text-sm font-medium mb-2">
                  Geographic Hotspots
                  <span className="ml-2 rounded-full bg-amber-500 text-white text-[10px] px-1.5 py-0.5 leading-none">
                    {hotspots.length}
                  </span>
                </p>
                <div className="overflow-x-auto rounded-md border">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-muted/60">
                        <th className="text-left px-3 py-2 font-semibold">District</th>
                        <th className="text-right px-3 py-2 font-semibold">Cases</th>
                        <th className="text-right px-3 py-2 font-semibold">Growth</th>
                        <th className="px-3 py-2 font-semibold">Severity</th>
                      </tr>
                    </thead>
                    <tbody>
                      {hotspots.map((h, i) => (
                        <tr key={i} className="border-t hover:bg-muted/30 transition-colors">
                          <td className="px-3 py-2 font-medium">{h.district}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{h.current_cases.toLocaleString()}</td>
                          <td className="px-3 py-2 text-right tabular-nums">
                            {h.growth_rate > 0 ? '+' : ''}{h.growth_rate.toFixed(0)}%
                          </td>
                          <td className="px-3 py-2">
                            <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-medium capitalize ${
                              h.severity === 'critical' ? 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400'
                              : h.severity === 'high' ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400'
                              : h.severity === 'moderate' ? 'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400'
                              : 'bg-muted text-muted-foreground'
                            }`}>
                              {h.severity}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </TabsContent>

          {/* National summary tab */}
          <TabsContent value="summary" className="mt-4 space-y-4">
            {/* Week-over-week stats from reportData.summary */}
            {report.reportData?.summary && (() => {
              const s = report.reportData.summary;
              const changePercent = Number(s.change_percent ?? 0);
              const previousTotal = Number(s.previous_total ?? 0);
              const avgTemp = s.avg_temperature != null ? Number(s.avg_temperature) : null;
              const districtCount = Number(s.district_count ?? 0);
              return (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <div className="rounded-lg border bg-muted/30 px-3 py-2 text-center">
                    <p className={`text-lg font-bold ${changePercent > 0 ? 'text-red-500' : changePercent < 0 ? 'text-green-600' : ''}`}>
                      {changePercent > 0 ? '+' : ''}{changePercent.toFixed(1)}%
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">Week-on-Week Change</p>
                  </div>
                  <div className="rounded-lg border bg-muted/30 px-3 py-2 text-center">
                    <p className="text-lg font-bold">{previousTotal.toLocaleString()}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">Previous Week Total</p>
                  </div>
                  <div className="rounded-lg border bg-muted/30 px-3 py-2 text-center">
                    <p className="text-lg font-bold">{districtCount}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">Districts Reporting</p>
                  </div>
                  <div className="rounded-lg border bg-muted/30 px-3 py-2 text-center">
                    <p className="text-lg font-bold">
                      {avgTemp != null ? `${avgTemp.toFixed(1)}°C` : '—'}
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">Avg Temperature</p>
                  </div>
                </div>
              );
            })()}
            <div className="rounded-lg bg-muted/40 border p-4 text-sm leading-relaxed text-foreground/90">
              {nationalText}
            </div>
            {report.approvedBy && (
              <p className="mt-1 text-xs text-muted-foreground">
                Approved by{" "}
                <span className="font-medium">{report.approvedBy.name}</span>
                {report.approvedAt &&
                  ` on ${new Date(report.approvedAt).toLocaleDateString()}`}
              </p>
            )}
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}
