"use client";

import { useState } from "react";
import { ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { PhiMetrics } from "@/services/task-analytics.service";

type SortKey = keyof Pick<
  PhiMetrics,
  "name" | "assigned" | "completed" | "overdue" | "rejected" | "completionRate" | "avgCompletionHours"
>;

interface Props {
  data: PhiMetrics[];
  loading?: boolean;
  onPhiClick?: (phiId: string) => void;
}

function rateColor(rate: number): string {
  if (rate >= 75) return "bg-green-500/10 text-green-700 border-green-500/20";
  if (rate >= 50) return "bg-amber-500/10 text-amber-700 border-amber-500/20";
  return "bg-destructive/10 text-destructive border-destructive/20";
}

function rejectionRate(phi: PhiMetrics): number {
  if (!phi.assigned) return 0;
  return (phi.rejected / phi.assigned) * 100;
}

export function PhiPerformanceTable({ data, loading, onPhiClick }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>("completionRate");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  const sorted = [...data].sort((a, b) => {
    const av = a[sortKey];
    const bv = b[sortKey];
    if (av === null && bv === null) return 0;
    if (av === null) return sortDir === "asc" ? -1 : 1;
    if (bv === null) return sortDir === "asc" ? 1 : -1;
    if (typeof av === "string" && typeof bv === "string") {
      return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
    }
    return sortDir === "asc" ? (av as number) - (bv as number) : (bv as number) - (av as number);
  });

  function SortIcon({ col }: { col: SortKey }) {
    if (sortKey !== col) return <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground/50" />;
    return sortDir === "asc"
      ? <ArrowUp className="h-3.5 w-3.5" />
      : <ArrowDown className="h-3.5 w-3.5" />;
  }

  function Th({ col, label }: { col: SortKey; label: string }) {
    return (
      <TableHead
        className="cursor-pointer select-none whitespace-nowrap"
        onClick={() => toggleSort(col)}
      >
        <span className="flex items-center gap-1">
          {label}
          <SortIcon col={col} />
        </span>
      </TableHead>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          PHI Performance
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {loading ? (
          <div className="p-4 space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-9 w-full" />
            ))}
          </div>
        ) : sorted.length === 0 ? (
          <p className="text-sm text-muted-foreground px-4 pb-4">No PHIs found.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <Th col="name" label="Name" />
                <TableHead>Status</TableHead>
                <Th col="assigned" label="Tasks" />
                <Th col="completed" label="Completed" />
                <Th col="overdue" label="Overdue" />
                <Th col="rejected" label="Rejection Rate" />
                <Th col="avgCompletionHours" label="Avg Time" />
                <Th col="completionRate" label="Rate" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((phi) => (
                <TableRow
                  key={phi.phiId}
                  className={onPhiClick ? "cursor-pointer hover:bg-muted/60" : undefined}
                  onClick={() => onPhiClick?.(phi.phiId)}
                >
                  <TableCell className="font-medium">{phi.name}</TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={
                        phi.isActive
                          ? "bg-green-500/10 text-green-700 border-green-500/20"
                          : "bg-muted text-muted-foreground"
                      }
                    >
                      {phi.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell>{phi.assigned}</TableCell>
                  <TableCell>{phi.completed}</TableCell>
                  <TableCell>
                    {phi.overdue > 0 ? (
                      <span className="text-destructive font-medium">{phi.overdue}</span>
                    ) : (
                      phi.overdue
                    )}
                  </TableCell>
                  <TableCell>
                    {rejectionRate(phi) > 0
                      ? `${rejectionRate(phi).toFixed(1)}%`
                      : "0%"}
                  </TableCell>
                  <TableCell>
                    {phi.avgCompletionHours != null
                      ? `${phi.avgCompletionHours.toFixed(1)}h`
                      : "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={rateColor(phi.completionRate)}>
                      {phi.completionRate.toFixed(1)}%
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
