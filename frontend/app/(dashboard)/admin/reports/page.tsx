"use client";

import { useEffect, useState, useCallback } from "react";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  FileText,
  Plus,
  Download,
  Search,
  CheckCircle,
  Clock,
  Eye,
  Trash2,
  TrendingUp,
  AlertTriangle,
  BarChart2,
  Loader2,
} from "lucide-react";
import {
  listReports,
  approveReport,
  getReportDownloadUrl,
  deleteReport,
  WeeklyReport,
} from "@/services/reports.service";
import GenerateReportDialog from "@/components/dashboard/reports/GenerateReportDialog";
import ReportDetailModal from "@/components/dashboard/reports/ReportDetailModal";

export default function ReportsPage() {
  const [reports, setReports] = useState<WeeklyReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [generateOpen, setGenerateOpen] = useState(false);
  const [detailReport, setDetailReport] = useState<WeeklyReport | null>(null);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<WeeklyReport | null>(null);
  const [deleting, setDeleting] = useState(false);

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

  // Stats
  const totalReports = reports.length;
  const approvedReports = reports.filter((r) => r.status === "approved").length;
  const pendingReports = reports.filter((r) => r.status === "pending").length;
  const latestReport = reports[0];

  async function handleApprove(id: string) {
    setApprovingId(id);
    try {
      const updated = await approveReport(id);
      setReports((prev) =>
        prev.map((r) => (r.id === id ? { ...r, ...updated } : r)),
      );
      toast.success("Report approved successfully.");
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? "Failed to approve report.");
    } finally {
      setApprovingId(null);
    }
  }

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

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteReport(deleteTarget.id);
      setReports((prev) => prev.filter((r) => r.id !== deleteTarget.id));
      toast.success("Report deleted.");
    } catch {
      toast.error("Failed to delete report.");
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  }

  function handleGenerated(report: WeeklyReport) {
    setReports((prev) => [report, ...prev]);
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Weekly Reports</h2>
          <p className="text-muted-foreground">
            Generate, approve, and download epidemiological surveillance reports
          </p>
        </div>
        <Button onClick={() => setGenerateOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Generate Report
        </Button>
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
                  {(latestReport.reportType === 'historical'
                    ? (latestReport.totalActualCases ?? latestReport.totalPredictedCases)
                    : (latestReport.totalForecastCases ?? latestReport.totalPredictedCases)
                  ).toLocaleString()}{" "}
                  {latestReport.reportType === 'historical' ? 'reported' : 'forecast'}
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
                {searchQuery ? "No reports match your search." : "No reports generated yet."}
              </p>
              {!searchQuery && (
                <Button
                  className="mt-4"
                  variant="outline"
                  onClick={() => setGenerateOpen(true)}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Generate your first report
                </Button>
              )}
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
                      {(report.reportType === 'historical'
                        ? (report.totalActualCases ?? report.totalPredictedCases)
                        : (report.totalForecastCases ?? report.totalPredictedCases)
                      ).toLocaleString()}
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
                        variant={
                          report.status === "approved" ? "default" : "secondary"
                        }
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
                        {/* Approve */}
                        {report.status === "pending" && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleApprove(report.id)}
                            disabled={approvingId === report.id}
                          >
                            {approvingId === report.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <CheckCircle className="h-3.5 w-3.5" />
                            )}
                            <span className="ml-1 hidden sm:inline">Approve</span>
                          </Button>
                        )}

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

                        {/* Delete */}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => setDeleteTarget(report)}
                          title="Delete report"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Dialogs & Modals */}
      <GenerateReportDialog
        open={generateOpen}
        onClose={() => setGenerateOpen(false)}
        onGenerated={handleGenerated}
      />

      <ReportDetailModal
        report={detailReport}
        onClose={() => setDetailReport(null)}
      />

      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(v) => !v && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Delete Report
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete{" "}
              <strong>
                Week {deleteTarget?.weekNumber}, {deleteTarget?.year}
              </strong>
              ? The PDF will be removed from S3 and cannot be recovered.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting…
                </>
              ) : (
                "Delete"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
