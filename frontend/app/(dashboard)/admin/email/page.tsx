"use client";

import { useState, useEffect, useCallback } from "react";
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
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { StatCard } from "@/components/dashboard/shared/StatCard";
import {
  Mail,
  CheckCircle2,
  XCircle,
  MinusCircle,
  Clock,
  RefreshCw,
  RotateCcw,
  Filter,
  X,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  Info,
  Loader2,
  BarChart2,
  Search,
} from "lucide-react";
import { toast } from "sonner";
import emailService, {
  EmailLog,
  EmailLogFilters,
  EmailStats,
  EmailStatus,
} from "@/services/email.service";

// ─── Config ───────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<
  EmailStatus,
  { label: string; color: string; icon: React.ElementType }
> = {
  sent: {
    label: "Sent",
    color:
      "bg-green-500/10 text-green-700 border-green-500/20 dark:text-green-400",
    icon: CheckCircle2,
  },
  failed: {
    label: "Failed",
    color: "bg-destructive/10 text-destructive border-destructive/20",
    icon: XCircle,
  },
  pending: {
    label: "Pending",
    color:
      "bg-amber-500/10 text-amber-700 border-amber-500/20 dark:text-amber-400",
    icon: Clock,
  },
  skipped: {
    label: "Skipped",
    color: "bg-muted text-muted-foreground border-border",
    icon: MinusCircle,
  },
};

const ENTITY_CONFIG: Record<
  string,
  { label: string; color: string }
> = {
  task:     { label: "Task",     color: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20 dark:text-emerald-400" },
  user:     { label: "User",     color: "bg-sky-500/10 text-sky-600 border-sky-500/20 dark:text-sky-400" },
  report:   { label: "Report",   color: "bg-violet-500/10 text-violet-700 border-violet-500/20 dark:text-violet-400" },
  evidence: { label: "Evidence", color: "bg-orange-500/10 text-orange-700 border-orange-500/20 dark:text-orange-400" },
};

const STATS_DAYS_OPTIONS = [
  { value: "7",  label: "Last 7 days" },
  { value: "14", label: "Last 14 days" },
  { value: "30", label: "Last 30 days" },
  { value: "90", label: "Last 90 days" },
];

const PAGE_LIMIT = 20;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function templateLabel(name: string): string {
  return name
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

// ─── Skeleton rows ────────────────────────────────────────────────────────────

function TableSkeletonRows() {
  return (
    <>
      {Array.from({ length: 6 }).map((_, i) => (
        <TableRow key={i}>
          <TableCell><Skeleton className="h-3.5 w-36" /></TableCell>
          <TableCell><Skeleton className="h-3.5 w-48" /></TableCell>
          <TableCell><Skeleton className="h-5 w-24 rounded-full" /></TableCell>
          <TableCell><Skeleton className="h-5 w-16 rounded-full" /></TableCell>
          <TableCell><Skeleton className="h-5 w-20 rounded-full" /></TableCell>
          <TableCell><Skeleton className="h-3.5 w-28" /></TableCell>
          <TableCell><Skeleton className="h-7 w-16 rounded-md" /></TableCell>
        </TableRow>
      ))}
    </>
  );
}

// ─── Log detail dialog ────────────────────────────────────────────────────────

function LogDetailDialog({
  log,
  open,
  onClose,
}: {
  log: EmailLog | null;
  open: boolean;
  onClose: () => void;
}) {
  if (!log) return null;

  const statusCfg = STATUS_CONFIG[log.status];
  const StatusIcon = statusCfg.icon;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[560px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Mail className="h-4 w-4 text-muted-foreground" />
            Email Log Detail
          </DialogTitle>
          <DialogDescription>
            Full record for log ID{" "}
            <code className="text-[11px] bg-muted px-1.5 py-0.5 rounded font-mono">
              {log.id}
            </code>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-1">
          {/* Status + sent at */}
          <div className="flex items-center gap-3">
            <Badge variant="outline" className={`gap-1.5 ${statusCfg.color}`}>
              <StatusIcon className="h-3 w-3" />
              {statusCfg.label}
            </Badge>
            {log.sentAt && (
              <span className="text-xs text-muted-foreground">
                Sent {formatDate(log.sentAt)}
              </span>
            )}
            <span className="text-xs text-muted-foreground ml-auto">
              Created {formatDate(log.createdAt)}
            </span>
          </div>

          <Separator />

          {/* Core fields */}
          <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2.5 text-sm">
            <span className="text-muted-foreground font-medium">To</span>
            <span className="font-mono text-xs break-all">{log.recipientEmail}</span>

            <span className="text-muted-foreground font-medium">Subject</span>
            <span className="break-words">{log.subject}</span>

            <span className="text-muted-foreground font-medium">Template</span>
            <span>
              <code className="text-[11px] bg-muted px-1.5 py-0.5 rounded font-mono">
                {log.templateName}
              </code>
            </span>

            {log.messageId && (
              <>
                <span className="text-muted-foreground font-medium">Message-ID</span>
                <span className="font-mono text-[11px] break-all text-muted-foreground">
                  {log.messageId}
                </span>
              </>
            )}

            {log.relatedEntityType && (
              <>
                <span className="text-muted-foreground font-medium">Related</span>
                <span className="flex items-center gap-1.5 text-xs">
                  {ENTITY_CONFIG[log.relatedEntityType] ? (
                    <Badge
                      variant="outline"
                      className={`text-[10px] ${ENTITY_CONFIG[log.relatedEntityType].color}`}
                    >
                      {ENTITY_CONFIG[log.relatedEntityType].label}
                    </Badge>
                  ) : (
                    <span>{log.relatedEntityType}</span>
                  )}
                  <code className="font-mono text-muted-foreground">
                    {log.relatedEntityId}
                  </code>
                </span>
              </>
            )}
          </div>

          {/* Error message */}
          {log.errorMessage && (
            <>
              <Separator />
              <div className="space-y-1.5">
                <p className="text-xs font-medium flex items-center gap-1.5 text-destructive">
                  <XCircle className="h-3.5 w-3.5" />
                  Error
                </p>
                <pre className="text-[11px] bg-destructive/5 border border-destructive/20 rounded-md p-3 overflow-x-auto whitespace-pre-wrap text-destructive/90 leading-relaxed">
                  {log.errorMessage}
                </pre>
              </div>
            </>
          )}

          {/* Template data */}
          {log.templateData && Object.keys(log.templateData).length > 0 && (
            <>
              <Separator />
              <div className="space-y-1.5">
                <p className="text-xs font-medium flex items-center gap-1.5 text-muted-foreground">
                  <Info className="h-3.5 w-3.5" />
                  Template Context
                </p>
                <pre className="text-[11px] bg-muted rounded-md p-3 overflow-x-auto whitespace-pre-wrap leading-relaxed max-h-52">
                  {JSON.stringify(log.templateData, null, 2)}
                </pre>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function EmailAuditPage() {
  // ── Data state
  const [logs, setLogs]         = useState<EmailLog[]>([]);
  const [stats, setStats]       = useState<EmailStats | null>(null);
  const [logsLoading, setLogsLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);
  const [total, setTotal]       = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  // ── Filter state (pending — applied on "Apply" click)
  const [filterStatus, setFilterStatus]   = useState<EmailStatus | "">("");
  const [filterTemplate, setFilterTemplate] = useState("");
  const [filterRecipient, setFilterRecipient] = useState("");
  const [filterEntityType, setFilterEntityType] = useState("");
  const [filterFrom, setFilterFrom]       = useState("");
  const [filterTo, setFilterTo]           = useState("");

  // ── Applied filters (these drive the actual API call)
  const [appliedFilters, setAppliedFilters] = useState<EmailLogFilters>({});
  const [page, setPage]                   = useState(1);

  // ── Stats period
  const [statsDays, setStatsDays]         = useState("7");

  // ── Resend state
  const [resendingId, setResendingId]     = useState<string | null>(null);

  // ── Detail dialog
  const [detailLog, setDetailLog]         = useState<EmailLog | null>(null);

  // ─────────────────────────────────────────────────────────────────────────

  const loadLogs = useCallback(
    async (filters: EmailLogFilters, currentPage: number) => {
      setLogsLoading(true);
      try {
        const result = await emailService.getLogs({
          ...filters,
          page: currentPage,
          limit: PAGE_LIMIT,
        });
        setLogs(result.data);
        setTotal(result.total);
        setTotalPages(result.totalPages);
      } catch (err: any) {
        toast.error("Failed to load email logs", {
          description: err.response?.data?.message ?? err.message,
        });
      } finally {
        setLogsLoading(false);
      }
    },
    [],
  );

  const loadStats = useCallback(async (days: number) => {
    setStatsLoading(true);
    try {
      const result = await emailService.getStats(days);
      setStats(result);
    } catch (err: any) {
      toast.error("Failed to load email stats", {
        description: err.response?.data?.message ?? err.message,
      });
    } finally {
      setStatsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadLogs(appliedFilters, page);
  }, [appliedFilters, page, loadLogs]);

  useEffect(() => {
    loadStats(parseInt(statsDays, 10));
  }, [statsDays, loadStats]);

  // ── Actions ────────────────────────────────────────────────────────────────

  const applyFilters = () => {
    const filters: EmailLogFilters = {};
    if (filterStatus)      filters.status = filterStatus as EmailStatus;
    if (filterTemplate)    filters.template = filterTemplate.trim();
    if (filterRecipient)   filters.recipientEmail = filterRecipient.trim();
    if (filterEntityType)  filters.relatedEntityType = filterEntityType;
    if (filterFrom)        filters.from = filterFrom;
    if (filterTo)          filters.to = filterTo;
    setAppliedFilters(filters);
    setPage(1);
  };

  const clearFilters = () => {
    setFilterStatus("");
    setFilterTemplate("");
    setFilterRecipient("");
    setFilterEntityType("");
    setFilterFrom("");
    setFilterTo("");
    setAppliedFilters({});
    setPage(1);
  };

  const hasActiveFilters = Object.keys(appliedFilters).length > 0;

  const handleResend = async (log: EmailLog) => {
    setResendingId(log.id);
    try {
      await emailService.resend(log.id);
      toast.success("Email requeued", {
        description: `Re-sending to ${log.recipientEmail}`,
      });
      // Refresh logs after short delay so the new job has time to appear
      setTimeout(() => loadLogs(appliedFilters, page), 1500);
    } catch (err: any) {
      toast.error("Resend failed", {
        description: err.response?.data?.message ?? err.message,
      });
    } finally {
      setResendingId(null);
    }
  };

  const failureRateIsHigh =
    stats &&
    parseFloat(stats.failureRate) >= 10 &&
    stats.totalSent + stats.totalFailed >= 10;

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <TooltipProvider>
      <div className="space-y-6">

        {/* ── Header ── */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Email Audit Log</h2>
            <p className="text-sm text-muted-foreground">
              Monitor email delivery, review failures, and manually resend messages
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Select value={statsDays} onValueChange={setStatsDays}>
              <SelectTrigger className="h-9 w-36 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATS_DAYS_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              disabled={logsLoading && statsLoading}
              onClick={() => {
                loadLogs(appliedFilters, page);
                loadStats(parseInt(statsDays, 10));
              }}
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${logsLoading || statsLoading ? "animate-spin" : ""}`}
              />
              Refresh
            </Button>
          </div>
        </div>

        {/* ── High failure rate alert ── */}
        {failureRateIsHigh && (
          <div className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
            <div>
              <span className="font-semibold">High failure rate detected — </span>
              {stats!.failureRate} of emails failed in the selected period.
              Check your SMTP credentials or queue worker status.
            </div>
          </div>
        )}

        {/* ── Stat cards ── */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Sent"
            value={stats?.totalSent ?? 0}
            description={`In the last ${statsDays} days`}
            icon={CheckCircle2}
            iconColor="text-green-600 bg-green-500/10"
            accent="success"
            loading={statsLoading}
          />
          <StatCard
            title="Failed"
            value={stats?.totalFailed ?? 0}
            description="Delivery failures"
            icon={XCircle}
            iconColor="text-destructive bg-destructive/10"
            accent="danger"
            loading={statsLoading}
          />
          <StatCard
            title="Skipped"
            value={stats?.totalSkipped ?? 0}
            description="Opted-out recipients"
            icon={MinusCircle}
            iconColor="text-muted-foreground bg-muted"
            loading={statsLoading}
          />
          <StatCard
            title="Failure Rate"
            value={stats?.failureRate ?? "—"}
            description="Failed ÷ (sent + failed)"
            icon={BarChart2}
            iconColor={
              failureRateIsHigh
                ? "text-destructive bg-destructive/10"
                : "text-sky-600 bg-sky-500/10"
            }
            accent={failureRateIsHigh ? "danger" : "info"}
            loading={statsLoading}
          />
        </div>

        {/* ── Log table ── */}
        <Card>
          <CardHeader className="pb-3 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <CardTitle className="text-base">Email Logs</CardTitle>
                <CardDescription>
                  {logsLoading
                    ? "Loading…"
                    : `${total.toLocaleString()} log${total !== 1 ? "s" : ""}${hasActiveFilters ? " (filtered)" : ""}`}
                </CardDescription>
              </div>
              {hasActiveFilters && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearFilters}
                  className="gap-1.5 text-muted-foreground hover:text-foreground self-start sm:self-auto"
                >
                  <X className="h-3.5 w-3.5" />
                  Clear filters
                </Button>
              )}
            </div>

            {/* Filter bar */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-2">
              {/* Status */}
              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground uppercase tracking-wide">
                  Status
                </Label>
                <Select
                  value={filterStatus || "all"}
                  onValueChange={(v) =>
                    setFilterStatus(v === "all" ? "" : (v as EmailStatus))
                  }
                >
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue placeholder="All" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All statuses</SelectItem>
                    <SelectItem value="sent">Sent</SelectItem>
                    <SelectItem value="failed">Failed</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="skipped">Skipped</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Entity type */}
              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground uppercase tracking-wide">
                  Entity
                </Label>
                <Select
                  value={filterEntityType || "all"}
                  onValueChange={(v) =>
                    setFilterEntityType(v === "all" ? "" : v)
                  }
                >
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue placeholder="All" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All entities</SelectItem>
                    <SelectItem value="task">Task</SelectItem>
                    <SelectItem value="user">User</SelectItem>
                    <SelectItem value="report">Report</SelectItem>
                    <SelectItem value="evidence">Evidence</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Template */}
              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground uppercase tracking-wide">
                  Template
                </Label>
                <Input
                  placeholder="e.g. task-assigned"
                  value={filterTemplate}
                  onChange={(e) => setFilterTemplate(e.target.value)}
                  className="h-8 text-sm"
                />
              </div>

              {/* Recipient */}
              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground uppercase tracking-wide">
                  Recipient
                </Label>
                <div className="relative">
                  <Search className="absolute left-2 top-2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                  <Input
                    placeholder="email@example.com"
                    value={filterRecipient}
                    onChange={(e) => setFilterRecipient(e.target.value)}
                    className="h-8 text-sm pl-7"
                  />
                </div>
              </div>

              {/* From date */}
              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground uppercase tracking-wide">
                  From
                </Label>
                <Input
                  type="date"
                  value={filterFrom}
                  onChange={(e) => setFilterFrom(e.target.value)}
                  className="h-8 text-sm"
                />
              </div>

              {/* To date */}
              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground uppercase tracking-wide">
                  To
                </Label>
                <Input
                  type="date"
                  value={filterTo}
                  onChange={(e) => setFilterTo(e.target.value)}
                  className="h-8 text-sm"
                />
              </div>
            </div>

            {/* Apply button */}
            <div className="flex items-center gap-2 pt-0.5">
              <Button size="sm" className="gap-1.5 h-8" onClick={applyFilters}>
                <Filter className="h-3.5 w-3.5" />
                Apply Filters
              </Button>
              {(filterStatus || filterTemplate || filterRecipient || filterEntityType || filterFrom || filterTo) && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 text-muted-foreground"
                  onClick={clearFilters}
                >
                  Clear
                </Button>
              )}
            </div>
          </CardHeader>

          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="pl-6 w-[180px]">Recipient</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead className="w-[150px]">Template</TableHead>
                  <TableHead className="w-[90px]">Status</TableHead>
                  <TableHead className="w-[100px]">Entity</TableHead>
                  <TableHead className="w-[130px]">Created</TableHead>
                  <TableHead className="w-[80px] text-right pr-4">Action</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {logsLoading ? (
                  <TableSkeletonRows />
                ) : logs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7}>
                      <div className="flex flex-col items-center justify-center py-14 text-center gap-2">
                        <span className="flex items-center justify-center h-12 w-12 rounded-full bg-muted mb-1">
                          <Mail className="h-5 w-5 text-muted-foreground" />
                        </span>
                        <p className="text-sm font-medium text-muted-foreground">
                          {hasActiveFilters
                            ? "No email logs match your filters"
                            : "No email logs yet"}
                        </p>
                        <p className="text-xs text-muted-foreground/70">
                          {hasActiveFilters
                            ? "Try adjusting the filters"
                            : "Logs will appear here as emails are sent"}
                        </p>
                        {hasActiveFilters && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="mt-1 text-xs"
                            onClick={clearFilters}
                          >
                            Clear filters
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  logs.map((log) => {
                    const statusCfg = STATUS_CONFIG[log.status];
                    const StatusIcon = statusCfg.icon;
                    const entityCfg = log.relatedEntityType
                      ? ENTITY_CONFIG[log.relatedEntityType]
                      : null;
                    const isResending = resendingId === log.id;

                    return (
                      <TableRow
                        key={log.id}
                        className="group cursor-pointer"
                        onClick={() => setDetailLog(log)}
                      >
                        {/* Recipient */}
                        <TableCell className="pl-6">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="text-sm font-mono truncate block max-w-[160px]">
                                {log.recipientEmail}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent side="top">
                              {log.recipientEmail}
                            </TooltipContent>
                          </Tooltip>
                        </TableCell>

                        {/* Subject */}
                        <TableCell>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="text-sm truncate block max-w-[260px]">
                                {log.subject}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent
                              side="top"
                              className="max-w-xs"
                            >
                              {log.subject}
                            </TooltipContent>
                          </Tooltip>
                        </TableCell>

                        {/* Template */}
                        <TableCell>
                          <code className="text-[11px] bg-muted px-1.5 py-0.5 rounded font-mono">
                            {log.templateName}
                          </code>
                        </TableCell>

                        {/* Status */}
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={`gap-1 text-[11px] ${statusCfg.color}`}
                          >
                            <StatusIcon className="h-3 w-3" />
                            {statusCfg.label}
                          </Badge>
                        </TableCell>

                        {/* Entity */}
                        <TableCell>
                          {entityCfg ? (
                            <Badge
                              variant="outline"
                              className={`text-[10px] ${entityCfg.color}`}
                            >
                              {entityCfg.label}
                            </Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>

                        {/* Created at */}
                        <TableCell>
                          <span className="text-xs text-muted-foreground">
                            {formatDate(log.createdAt)}
                          </span>
                        </TableCell>

                        {/* Resend action */}
                        <TableCell
                          className="text-right pr-4"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                disabled={isResending}
                                onClick={() => handleResend(log)}
                                aria-label="Resend email"
                              >
                                {isResending ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <RotateCcw className="h-3.5 w-3.5" />
                                )}
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent side="left">Resend</TooltipContent>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>

            {/* Pagination */}
            {!logsLoading && totalPages > 1 && (
              <div className="flex items-center justify-between px-6 py-3 border-t">
                <p className="text-xs text-muted-foreground">
                  Showing{" "}
                  <span className="font-medium text-foreground">
                    {(page - 1) * PAGE_LIMIT + 1}–
                    {Math.min(page * PAGE_LIMIT, total)}
                  </span>{" "}
                  of{" "}
                  <span className="font-medium text-foreground">
                    {total.toLocaleString()}
                  </span>
                </p>
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 w-7 p-0"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    aria-label="Previous page"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                  </Button>
                  <span className="text-xs px-2 text-muted-foreground">
                    {page} / {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 w-7 p-0"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    aria-label="Next page"
                  >
                    <ChevronRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Template breakdown ── */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Template Breakdown</CardTitle>
            <CardDescription>
              Per-template delivery counts for the selected period
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="pl-6">Template</TableHead>
                  <TableHead className="text-right w-[90px]">Sent</TableHead>
                  <TableHead className="text-right w-[90px]">Failed</TableHead>
                  <TableHead className="text-right w-[90px]">Skipped</TableHead>
                  <TableHead className="text-right w-[90px] pr-6">Pending</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {statsLoading ? (
                  <>
                    {Array.from({ length: 5 }).map((_, i) => (
                      <TableRow key={i}>
                        <TableCell className="pl-6"><Skeleton className="h-3.5 w-32" /></TableCell>
                        <TableCell className="text-right"><Skeleton className="h-3.5 w-8 ml-auto" /></TableCell>
                        <TableCell className="text-right"><Skeleton className="h-3.5 w-8 ml-auto" /></TableCell>
                        <TableCell className="text-right"><Skeleton className="h-3.5 w-8 ml-auto" /></TableCell>
                        <TableCell className="text-right pr-6"><Skeleton className="h-3.5 w-8 ml-auto" /></TableCell>
                      </TableRow>
                    ))}
                  </>
                ) : !stats?.byTemplate.length ? (
                  <TableRow>
                    <TableCell colSpan={5}>
                      <div className="flex flex-col items-center justify-center py-10 text-center gap-1">
                        <BarChart2 className="h-8 w-8 text-muted-foreground/40 mb-1" />
                        <p className="text-sm text-muted-foreground">
                          No data for this period
                        </p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  stats.byTemplate.map((row) => (
                    <TableRow key={row.template}>
                      <TableCell className="pl-6">
                        <div className="flex items-center gap-2">
                          <code className="text-[11px] bg-muted px-1.5 py-0.5 rounded font-mono">
                            {row.template}
                          </code>
                          <span className="text-xs text-muted-foreground hidden sm:inline">
                            {templateLabel(row.template)}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="text-sm font-medium text-green-700 dark:text-green-400">
                          {row.sent}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <span
                          className={`text-sm font-medium ${
                            row.failed > 0
                              ? "text-destructive"
                              : "text-muted-foreground"
                          }`}
                        >
                          {row.failed}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="text-sm text-muted-foreground">
                          {row.skipped}
                        </span>
                      </TableCell>
                      <TableCell className="text-right pr-6">
                        <span className="text-sm text-muted-foreground">
                          {row.pending}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* ── Log detail dialog ── */}
        <LogDetailDialog
          log={detailLog}
          open={!!detailLog}
          onClose={() => setDetailLog(null)}
        />
      </div>
    </TooltipProvider>
  );
}
