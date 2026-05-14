"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Loader2, AlertCircle, CheckCircle2, User, ArrowRight } from "lucide-react";
import { fetchOverdueTasks } from "@/services/task-analytics.service";
import type { OverdueTask } from "@/services/task-analytics.service";

const TYPE_ICONS: Record<string, string> = {
  cleanup: "🧹",
  fogging: "💨",
  inspection: "🔍",
  investigation: "📋",
};

const PRIORITY_STYLES: Record<string, string> = {
  urgent: "text-red-600 bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-900/40",
  high: "text-orange-600 bg-orange-50 dark:bg-orange-950/30 border-orange-200 dark:border-orange-900/40",
  medium: "text-blue-600 bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-900/40",
  low: "text-gray-600 bg-gray-50 dark:bg-gray-950/30 border-gray-200 dark:border-gray-900/40",
};

interface Props {
  districtId: number;
}

function formatOverdue(hours: number): string {
  if (hours < 24) return `${Math.round(hours)}h overdue`;
  const days = Math.round(hours / 24);
  return `${days}d overdue`;
}

export default function OverdueTaskCards({ districtId }: Props) {
  const [tasks, setTasks] = useState<OverdueTask[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchOverdueTasks(districtId)
      .then((all) =>
        setTasks(all.sort((a, b) => b.hoursOverdue - a.hoursOverdue).slice(0, 5)),
      )
      .catch((err) => console.error("Overdue tasks fetch failed:", err))
      .finally(() => setLoading(false));
  }, [districtId]);

  if (loading) {
    return (
      <div className="h-40 flex items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (tasks.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-8 text-center">
        <CheckCircle2 className="h-8 w-8 text-green-500" />
        <p className="text-sm font-medium text-green-600 dark:text-green-400">No overdue tasks</p>
        <p className="text-xs text-muted-foreground">All tasks are on schedule</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {tasks.map((task) => (
        <div
          key={task.id}
          className="flex items-start gap-3 p-3 rounded-lg border border-border bg-card hover:bg-accent/50 transition-colors"
        >
          <span className="text-base shrink-0 mt-0.5">{TYPE_ICONS[task.type] ?? "📌"}</span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{task.title}</p>
            <div className="flex items-center gap-3 mt-0.5 flex-wrap">
              <span className="flex items-center gap-1 text-xs text-red-500 dark:text-red-400">
                <AlertCircle className="h-3 w-3" />
                {formatOverdue(task.hoursOverdue)}
              </span>
              {task.phiName && (
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <User className="h-3 w-3" />
                  {task.phiName}
                </span>
              )}
            </div>
          </div>
          <span
            className={`text-xs px-1.5 py-0.5 rounded border font-medium capitalize shrink-0 ${PRIORITY_STYLES[task.priority] ?? ""}`}
          >
            {task.priority}
          </span>
        </div>
      ))}
      <Link
        href="/supervisor/tasks"
        className="flex items-center justify-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors pt-1"
      >
        View all tasks <ArrowRight className="h-3 w-3" />
      </Link>
    </div>
  );
}
