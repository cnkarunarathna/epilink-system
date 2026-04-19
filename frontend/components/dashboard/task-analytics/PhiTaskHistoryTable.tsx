"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { PhiTaskItem } from "@/services/task-analytics.service";

const STATUS_COLORS: Record<string, string> = {
  pending:     "bg-slate-500/10 text-slate-600 border-slate-500/20",
  assigned:    "bg-blue-500/10 text-blue-600 border-blue-500/20",
  in_progress: "bg-amber-500/10 text-amber-700 border-amber-500/20",
  submitted:   "bg-violet-500/10 text-violet-700 border-violet-500/20",
  verified:    "bg-emerald-500/10 text-emerald-700 border-emerald-500/20",
  completed:   "bg-green-500/10 text-green-700 border-green-500/20",
  rejected:    "bg-destructive/10 text-destructive border-destructive/20",
};

const STATUS_LABELS: Record<string, string> = {
  pending: "Pending", assigned: "Assigned", in_progress: "In Progress",
  submitted: "Submitted", verified: "Verified", completed: "Completed", rejected: "Rejected",
};

const PRIORITY_COLORS: Record<string, string> = {
  low:    "bg-slate-500/10 text-slate-600 border-slate-500/20",
  medium: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  high:   "bg-amber-500/10 text-amber-700 border-amber-500/20",
  urgent: "bg-destructive/10 text-destructive border-destructive/20",
};

interface Filters {
  status?: string;
  type?: string;
}

interface Props {
  tasks: PhiTaskItem[];
  total: number;
  page: number;
  limit: number;
  loading?: boolean;
  onPageChange: (page: number) => void;
  onFilterChange: (filters: Filters) => void;
  filters: Filters;
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  } catch {
    return iso;
  }
}

export function PhiTaskHistoryTable({
  tasks,
  total,
  page,
  limit,
  loading,
  onPageChange,
  onFilterChange,
  filters,
}: Props) {
  const totalPages = Math.max(1, Math.ceil(total / limit));

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Task History ({total})
          </CardTitle>
          <div className="flex items-center gap-2">
            <Select
              value={filters.status ?? "all"}
              onValueChange={(v) => onFilterChange({ ...filters, status: v === "all" ? undefined : v })}
            >
              <SelectTrigger className="h-8 w-36 text-xs">
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {Object.entries(STATUS_LABELS).map(([k, label]) => (
                  <SelectItem key={k} value={k}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={filters.type ?? "all"}
              onValueChange={(v) => onFilterChange({ ...filters, type: v === "all" ? undefined : v })}
            >
              <SelectTrigger className="h-8 w-36 text-xs">
                <SelectValue placeholder="All types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                {["cleanup", "fogging", "inspection", "investigation"].map((t) => (
                  <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        {loading ? (
          <div className="p-4 space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-9 w-full" />
            ))}
          </div>
        ) : tasks.length === 0 ? (
          <p className="text-sm text-muted-foreground px-4 pb-4">No tasks found.</p>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Assigned</TableHead>
                  <TableHead>Completed</TableHead>
                  <TableHead>Due</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tasks.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="font-medium max-w-[200px] truncate">{t.title}</TableCell>
                    <TableCell>
                      <span className="capitalize text-xs">{t.type}</span>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`capitalize text-xs ${PRIORITY_COLORS[t.priority] ?? ""}`}>
                        {t.priority}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`text-xs ${STATUS_COLORS[t.status] ?? ""}`}>
                        {STATUS_LABELS[t.status] ?? t.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{fmtDate(t.assignedAt)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{fmtDate(t.completedAt)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{fmtDate(t.dueDate)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t text-sm text-muted-foreground">
                <span>Page {page} of {totalPages}</span>
                <div className="flex gap-1">
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-7 w-7"
                    disabled={page <= 1}
                    onClick={() => onPageChange(page - 1)}
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-7 w-7"
                    disabled={page >= totalPages}
                    onClick={() => onPageChange(page + 1)}
                  >
                    <ChevronRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
