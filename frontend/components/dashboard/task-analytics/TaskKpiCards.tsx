"use client";

import {
  ClipboardList,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Users,
} from "lucide-react";
import { StatCard } from "@/components/dashboard/shared/StatCard";
import type { NationalSummary } from "@/services/task-analytics.service";

interface Props {
  data: NationalSummary | null;
  loading?: boolean;
}

export function TaskKpiCards({ data, loading }: Props) {
  const avgHours = data?.avgCompletionHours
    ? `${data.avgCompletionHours.toFixed(1)}h`
    : "—";

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
      <StatCard
        title="Total Tasks"
        value={loading ? "—" : (data?.total ?? 0)}
        description="All time"
        icon={ClipboardList}
        iconColor="text-primary bg-primary/10"
        accent="primary"
        loading={loading}
      />
      <StatCard
        title="Completion Rate"
        value={loading ? "—" : `${(data?.completionRate ?? 0).toFixed(1)}%`}
        description="Completed + verified"
        icon={CheckCircle2}
        iconColor="text-green-600 bg-green-500/10"
        accent="success"
        loading={loading}
      />
      <StatCard
        title="Overdue"
        value={loading ? "—" : (data?.overdue ?? 0)}
        description="Past due date"
        icon={AlertTriangle}
        iconColor="text-destructive bg-destructive/10"
        accent="danger"
        loading={loading}
      />
      <StatCard
        title="Avg Completion"
        value={loading ? "—" : avgHours}
        description="From assigned to done"
        icon={Clock}
        iconColor="text-amber-600 bg-amber-500/10"
        accent="warning"
        loading={loading}
      />
      <StatCard
        title="Active PHIs"
        value={loading ? "—" : (data?.activePhi ?? 0)}
        description={`${data?.activeSupervisors ?? 0} supervisors`}
        icon={Users}
        iconColor="text-sky-600 bg-sky-500/10"
        accent="info"
        loading={loading}
      />
    </div>
  );
}
