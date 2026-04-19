"use client";

import { useState, useEffect } from "react";
import { Radio } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useSocket } from "@/contexts/SocketContext";

interface ActivityEntry {
  id: string;
  taskTitle: string;
  taskType: string;
  phiName: string | null;
  districtName: string | null;
  oldStatus: string;
  newStatus: string;
  timestamp: string;
}

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

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  return `${diffHr}h ago`;
}

export function LiveActivityFeed() {
  const { socket, isConnected } = useSocket();
  const [feed, setFeed] = useState<ActivityEntry[]>([]);
  const [, forceRender] = useState(0);

  // Re-render every 30s to update time-ago labels
  useEffect(() => {
    const interval = setInterval(() => forceRender((n) => n + 1), 30_000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!socket) return;

    const handler = (data: { type: string; payload?: any }) => {
      if (data.type !== "task-status-changed" || !data.payload) return;
      const p = data.payload;
      const entry: ActivityEntry = {
        id: `${p.taskId}-${p.timestamp}`,
        taskTitle: p.taskTitle ?? "Task",
        taskType: p.taskType ?? "",
        phiName: p.phiName ?? null,
        districtName: p.districtName ?? null,
        oldStatus: p.oldStatus,
        newStatus: p.newStatus,
        timestamp: p.timestamp ?? new Date().toISOString(),
      };
      setFeed((prev) => [entry, ...prev].slice(0, 20));
    };

    socket.on("analytics:updated", handler);
    return () => { socket.off("analytics:updated", handler); };
  }, [socket]);

  return (
    <Card className="flex flex-col">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Radio className="h-4 w-4 text-primary" />
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Live Activity
            </CardTitle>
          </div>
          <span className={`flex items-center gap-1 text-xs ${isConnected ? "text-green-600" : "text-muted-foreground"}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${isConnected ? "bg-green-500 animate-pulse" : "bg-muted-foreground"}`} />
            {isConnected ? "Live" : "Offline"}
          </span>
        </div>
      </CardHeader>
      <CardContent className="flex-1 overflow-hidden pt-0">
        {feed.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Radio className="h-8 w-8 text-muted-foreground/30 mb-2" />
            <p className="text-sm text-muted-foreground">
              {isConnected ? "Waiting for task updates..." : "Connect to see live updates"}
            </p>
          </div>
        ) : (
          <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
            {feed.map((entry) => (
              <div key={entry.id} className="flex items-start gap-2 text-xs py-1.5 border-b last:border-0">
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{entry.taskTitle}</p>
                  <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                    {entry.phiName && (
                      <span className="text-muted-foreground">{entry.phiName}</span>
                    )}
                    {entry.districtName && (
                      <span className="text-muted-foreground">· {entry.districtName}</span>
                    )}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <Badge
                    variant="outline"
                    className={`text-[10px] px-1.5 py-0 ${STATUS_COLORS[entry.newStatus] ?? ""}`}
                  >
                    {STATUS_LABELS[entry.newStatus] ?? entry.newStatus}
                  </Badge>
                  <span className="text-muted-foreground">{timeAgo(entry.timestamp)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
