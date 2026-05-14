import { TrendingUp, TrendingDown, Users } from "lucide-react";

interface PhiEntry {
  name: string;
  tasksAssigned: number;
  tasksCompleted: number;
  isActive: boolean;
}

interface Props {
  phis: PhiEntry[];
}

export default function PhiSummaryBar({ phis }: Props) {
  if (phis.length === 0) return null;

  const active = phis.filter((p) => p.isActive);
  const totalAssigned = active.reduce((s, p) => s + p.tasksAssigned, 0);
  const totalCompleted = active.reduce((s, p) => s + p.tasksCompleted, 0);
  const avgRate =
    totalAssigned > 0 ? Math.round((totalCompleted / totalAssigned) * 100) : 0;

  const sorted = [...active].sort((a, b) => b.tasksAssigned - a.tasksAssigned);
  const highest = sorted[0];
  const least = sorted[sorted.length - 1];

  return (
    <div className="flex items-center gap-6 px-4 py-3 rounded-lg border bg-muted/30 text-sm flex-wrap">
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground">Avg completion</span>
        <span
          className={`font-semibold ${
            avgRate >= 70
              ? "text-green-600"
              : avgRate >= 40
                ? "text-yellow-600"
                : "text-red-600"
          }`}
        >
          {avgRate}%
        </span>
      </div>

      {highest && (
        <div className="flex items-center gap-1.5">
          <TrendingUp className="h-3.5 w-3.5 text-orange-500 shrink-0" />
          <span className="text-muted-foreground">Highest load:</span>
          <span className="font-medium">{highest.name.split(" ")[0]}</span>
          <span className="text-xs text-muted-foreground">
            ({highest.tasksAssigned} tasks)
          </span>
        </div>
      )}

      {least && least !== highest && (
        <div className="flex items-center gap-1.5">
          <TrendingDown className="h-3.5 w-3.5 text-sky-500 shrink-0" />
          <span className="text-muted-foreground">Least load:</span>
          <span className="font-medium">{least.name.split(" ")[0]}</span>
          <span className="text-xs text-muted-foreground">
            ({least.tasksAssigned} tasks)
          </span>
        </div>
      )}

      <div className="flex items-center gap-1.5 ml-auto">
        <Users className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        <span className="text-muted-foreground">
          {active.length} active PHI{active.length !== 1 ? "s" : ""}
        </span>
      </div>
    </div>
  );
}
