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
import type { SupervisorMetrics } from "@/services/task-analytics.service";

type SortKey = keyof Pick<
  SupervisorMetrics,
  "name" | "tasksCreated" | "completed" | "pending" | "rejected" | "overdue" | "completionRate"
>;

interface Props {
  data: SupervisorMetrics[];
  loading?: boolean;
}

function rateColor(rate: number): string {
  if (rate >= 75) return "bg-green-500/10 text-green-700 border-green-500/20";
  if (rate >= 50) return "bg-amber-500/10 text-amber-700 border-amber-500/20";
  return "bg-destructive/10 text-destructive border-destructive/20";
}

export function SupervisorTable({ data, loading }: Props) {
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
          Supervisors
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {loading ? (
          <div className="p-4 space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-9 w-full" />
            ))}
          </div>
        ) : sorted.length === 0 ? (
          <p className="text-sm text-muted-foreground px-4 pb-4">No supervisors found.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <Th col="name" label="Name" />
                <Th col="tasksCreated" label="Assigned" />
                <Th col="completed" label="Completed" />
                <Th col="pending" label="Pending" />
                <Th col="rejected" label="Rejected" />
                <Th col="overdue" label="Overdue" />
                <Th col="completionRate" label="Rate" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((s) => (
                <TableRow key={s.supervisorId}>
                  <TableCell className="font-medium">{s.name}</TableCell>
                  <TableCell>{s.tasksCreated}</TableCell>
                  <TableCell>{s.completed}</TableCell>
                  <TableCell>{s.pending}</TableCell>
                  <TableCell>{s.rejected}</TableCell>
                  <TableCell>
                    {s.overdue > 0 ? (
                      <span className="text-destructive font-medium">{s.overdue}</span>
                    ) : (
                      s.overdue
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={rateColor(s.completionRate)}>
                      {s.completionRate.toFixed(1)}%
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
