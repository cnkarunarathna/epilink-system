"use client";

import { useState, useEffect, useCallback } from "react";
import { AlertTriangle, ChevronDown, ChevronUp, RefreshCw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useSocket } from "@/contexts/SocketContext";
import { fetchOverdueTasks, type OverdueTask } from "@/services/task-analytics.service";

function groupByDistrict(tasks: OverdueTask[]): Map<string, OverdueTask[]> {
  const map = new Map<string, OverdueTask[]>();
  for (const t of tasks) {
    const key = t.districtName || "Unknown";
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(t);
  }
  return map;
}

function fmtHours(h: number): string {
  if (h < 24) return `${Math.round(h)}h overdue`;
  return `${Math.round(h / 24)}d overdue`;
}

export function OverdueTasksAlert() {
  const { socket } = useSocket();
  const [tasks, setTasks] = useState<OverdueTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(true);

  const load = useCallback(async () => {
    try {
      const data = await fetchOverdueTasks();
      setTasks(data);
    } catch {
      // silent — alert panel is non-critical
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!socket) return;
    const handler = (data: { type: string }) => {
      if (data.type === "task-status-changed") load();
    };
    socket.on("analytics:updated", handler);
    return () => { socket.off("analytics:updated", handler); };
  }, [socket, load]);

  const criticalCount = tasks.filter((t) => t.severity === "critical").length;
  const warningCount = tasks.filter((t) => t.severity === "warning").length;
  const grouped = groupByDistrict(tasks);

  return (
    <Card className={criticalCount > 0 ? "border-destructive/40" : warningCount > 0 ? "border-amber-500/40" : ""}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <AlertTriangle className={`h-4 w-4 ${criticalCount > 0 ? "text-destructive" : "text-amber-500"}`} />
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Overdue Tasks
            </CardTitle>
            {!loading && tasks.length > 0 && (
              <div className="flex items-center gap-1">
                {criticalCount > 0 && (
                  <Badge variant="outline" className="text-xs bg-destructive/10 text-destructive border-destructive/20">
                    {criticalCount} critical
                  </Badge>
                )}
                {warningCount > 0 && (
                  <Badge variant="outline" className="text-xs bg-amber-500/10 text-amber-700 border-amber-500/20">
                    {warningCount} warning
                  </Badge>
                )}
              </div>
            )}
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => load()}>
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setOpen((v) => !v)}>
              {open ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            </Button>
          </div>
        </div>
      </CardHeader>

      {open && (
        <CardContent className="pt-0">
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-8 w-full" />
              ))}
            </div>
          ) : tasks.length === 0 ? (
            <p className="text-sm text-muted-foreground py-2">No overdue tasks.</p>
          ) : (
            <div className="space-y-4">
              {Array.from(grouped.entries()).map(([district, dtasks]) => (
                <div key={district}>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
                    {district}
                  </p>
                  <div className="space-y-1.5">
                    {dtasks.map((t) => (
                      <div
                        key={t.id}
                        className="flex items-center justify-between gap-2 text-sm rounded-md px-3 py-2 bg-muted/40"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <Badge
                            variant="outline"
                            className={`text-xs shrink-0 ${
                              t.severity === "critical"
                                ? "bg-destructive/10 text-destructive border-destructive/20"
                                : "bg-amber-500/10 text-amber-700 border-amber-500/20"
                            }`}
                          >
                            {t.severity}
                          </Badge>
                          <span className="truncate font-medium">{t.title}</span>
                          {t.phiName && (
                            <span className="text-xs text-muted-foreground shrink-0">
                              — {t.phiName}
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground shrink-0">
                          {fmtHours(t.hoursOverdue)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}
