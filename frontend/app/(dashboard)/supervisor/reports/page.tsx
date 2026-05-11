"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  FileText,
  Download,
  Search,
  CheckCircle,
  Clock,
  Eye,
  TrendingUp,
  BarChart2,
  Loader2,
  LineChart as LineChartIcon,
  PieChart as PieChartIcon,
  MapPin,
} from "lucide-react";
import {
  listReports,
  getReportDownloadUrl,
  WeeklyReport,
} from "@/services/reports.service";
import ReportDetailModal from "@/components/dashboard/reports/ReportDetailModal";
import CaseTrendChart from "@/components/dashboard/reports/CaseTrendChart";
import ReportStatusDonut from "@/components/dashboard/reports/ReportStatusDonut";
import HighRiskFrequencyChart from "@/components/dashboard/reports/HighRiskFrequencyChart";
import { useAuth } from "@/contexts/AuthContext";

export default function SupervisorReportsPage() {
  const { user } = useAuth();
  const supervisorDistrict = user?.district ?? "Colombo";

  const [reports, setReports] = useState<WeeklyReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [detailReport, setDetailReport] = useState<WeeklyReport | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await listReports();
      setReports(data);
    } catch {
      toast.error("Failed to load reports.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = reports.filter((r) =>
    `${r.title} week ${r.weekNumber} ${r.year} ${r.status} ${r.createdBy?.name ?? ''} ${r.reportType}`
      .toLowerCase()
      .includes(searchQuery.toLowerCase()),
  );

  const totalReports = reports.length;
  const approvedReports = reports.filter((r) => r.status === "approved").length;
  const pendingReports = reports.filter((r) => r.status === "pending").length;
  const latestReport = reports[0];

  async function handleDownload(id: string) {
    setDownloadingId(id);
    try {
      const { url } = await getReportDownloadUrl(id);
      window.open(url, "_blank");
    } catch {
      toast.error("Could not fetch download link.");
    } finally {
      setDownloadingId(null);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Weekly Reports</h2>
        <p className="text-muted-foreground">
          View and download epidemiological surveillance reports
        </p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Total Reports
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <>
                <div className="text-2xl font-bold">{totalReports}</div>
                <p className="text-xs text-muted-foreground">All time</p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              Approved
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <>
                <div className="text-2xl font-bold">{approvedReports}</div>
                <p className="text-xs text-green-500">
                  {totalReports > 0
                    ? `${Math.round((approvedReports / totalReports) * 100)}% approval rate`
                    : "No reports yet"}
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Clock className="h-4 w-4 text-yellow-500" />
              Pending Review
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <>
                <div className="text-2xl font-bold text-yellow-500">
                  {pendingReports}
                </div>
                <p className="text-xs text-muted-foreground">
                  Awaiting approval
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <BarChart2 className="h-4 w-4" />
              Latest Report
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-24" />
            ) : latestReport ? (
              <>
                <div className="text-2xl font-bold">
                  W{latestReport.weekNumber}
                </div>
                <p className="text-xs text-muted-foreground">
                  {latestReport.year} &mdash;{" "}
                  {latestReport.totalPredictedCases.toLocaleString()} cases
                </p>
              </>
            ) : (
              <>
                <div className="text-2xl font-bold text-muted-foreground">—</div>
                <p className="text-xs text-muted-foreground">No reports yet</p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Reports Analytics */}
      {!loading && reports.length > 0 && (
        <div className="space-y-6">
          <h3 className="text-lg font-semibold">Report Analytics</h3>
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <LineChartIcon className="h-4 w-4 text-orange-500" />
                  Case Count Trend
                </CardTitle>
                <CardDescription>
                  Predicted and actual cases across all reports
                </CardDescription>
              </CardHeader>
              <CardContent>
                <CaseTrendChart reports={reports} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <PieChartIcon className="h-4 w-4 text-green-500" />
                  Approval Status
                </CardTitle>
                <CardDescription>
                  Breakdown of report statuses
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ReportStatusDonut reports={reports} />
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-red-500" />
                High-Risk District Frequency
              </CardTitle>
              <CardDescription>
                Districts flagged as high-risk or critical across reports —{" "}
                <span className="text-orange-500 font-medium">
                  {supervisorDistrict}
                </span>{" "}
                highlighted
              </CardDescription>
            </CardHeader>
            <CardContent>
              <HighRiskFrequencyChart
                reports={reports}
                supervisorDistrict={supervisorDistrict}
              />
            </CardContent>
          </Card>
        </div>
      )}

      {/* Reports Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>All Reports</CardTitle>
              <CardDescription>
                Weekly epidemiological surveillance reports
              </CardDescription>
            </div>
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search reports…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 w-[250px]"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <FileText className="h-10 w-10 mb-3 opacity-30" />
              <p className="text-sm font-medium">
                {searchQuery ? "No reports match your search." : "No reports available yet."}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Period</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Date Range</TableHead>
                  <TableHead className="text-right">Cases</TableHead>
                  <TableHead className="text-right">High-Risk</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created By</TableHead>
                  <TableHead>Approved By</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((report) => (
                  <TableRow key={report.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span className="font-medium">
                          Week {report.weekNumber}, {report.year}
                        </span>
                      </div>
                    </TableCell>

                    <TableCell>
                      <Badge variant={report.reportType === 'historical' ? "outline" : "secondary"} className="text-xs">
                        {report.reportType === 'historical' ? "Historical" : "Predicted"}
                      </Badge>
                    </TableCell>

                    <TableCell className="text-sm text-muted-foreground">
                      {report.startDate} &ndash; {report.endDate}
                    </TableCell>

                    <TableCell className="text-right font-medium tabular-nums">
                      {report.totalPredictedCases.toLocaleString()}
                    </TableCell>

                    <TableCell className="text-right">
                      {report.highRiskDistricts > 0 ? (
                        <span className="flex items-center justify-end gap-1 text-red-500 font-medium">
                          <TrendingUp className="h-3.5 w-3.5" />
                          {report.highRiskDistricts}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">0</span>
                      )}
                    </TableCell>

                    <TableCell>
                      <Badge
                        variant={report.status === "approved" ? "default" : "secondary"}
                        className="capitalize"
                      >
                        {report.status === "approved" ? (
                          <CheckCircle className="mr-1 h-3 w-3" />
                        ) : (
                          <Clock className="mr-1 h-3 w-3" />
                        )}
                        {report.status}
                      </Badge>
                    </TableCell>

                    <TableCell className="text-sm">
                      {report.createdBy?.name ?? (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>

                    <TableCell className="text-sm">
                      {report.approvedBy?.name ?? (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>

                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {/* View detail */}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => setDetailReport(report)}
                          title="View details"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>

                        {/* Download */}
                        {report.s3Key && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => handleDownload(report.id)}
                            disabled={downloadingId === report.id}
                            title="Download PDF"
                          >
                            {downloadingId === report.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Download className="h-4 w-4" />
                            )}
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Report detail side sheet */}
      <ReportDetailModal
        report={detailReport}
        onClose={() => setDetailReport(null)}
      />
    </div>
  );
}
