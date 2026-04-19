import { Flag } from "lucide-react";

const LEVELS = [
  {
    label: "Calm",
    threshold: 0,
    fill: 10,
    barClass: "bg-green-500",
    textClass: "text-green-700 dark:text-green-300",
    cardClass:
      "border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/40",
  },
  {
    label: "Low",
    threshold: 1,
    fill: 28,
    barClass: "bg-yellow-400",
    textClass: "text-yellow-700 dark:text-yellow-300",
    cardClass:
      "border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-950/40",
  },
  {
    label: "Elevated",
    threshold: 4,
    fill: 52,
    barClass: "bg-orange-500",
    textClass: "text-orange-700 dark:text-orange-300",
    cardClass:
      "border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-950/40",
  },
  {
    label: "High",
    threshold: 8,
    fill: 75,
    barClass: "bg-red-500",
    textClass: "text-red-700 dark:text-red-300",
    cardClass:
      "border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/40",
  },
  {
    label: "Critical",
    threshold: 13,
    fill: 100,
    barClass: "bg-red-800",
    textClass: "text-red-900 dark:text-red-200",
    cardClass:
      "border-red-300 dark:border-red-700 bg-red-100 dark:bg-red-950/60",
  },
];

interface Props {
  highRiskDistricts: number;
  totalDistricts: number;
}

export default function NationalStatusBar({
  highRiskDistricts,
  totalDistricts,
}: Props) {
  const level =
    [...LEVELS].reverse().find((l) => highRiskDistricts >= l.threshold) ??
    LEVELS[0];

  return (
    <div className={`rounded-xl border-2 px-5 py-4 ${level.cardClass}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Flag className={`h-4 w-4 ${level.textClass}`} />
          <span className={`text-sm font-semibold ${level.textClass}`}>
            National Dengue Status
          </span>
        </div>
        <span className={`text-sm font-bold tracking-wide ${level.textClass}`}>
          {level.label.toUpperCase()}
        </span>
      </div>
      <div className="h-2.5 bg-black/10 dark:bg-white/10 rounded-full overflow-hidden mb-2">
        <div
          className={`h-full rounded-full transition-all duration-700 ${level.barClass}`}
          style={{ width: `${level.fill}%` }}
        />
      </div>
      <p className={`text-xs ${level.textClass}`}>
        {highRiskDistricts} of {totalDistricts} district
        {totalDistricts !== 1 ? "s" : ""} are at high or very high risk this
        week
      </p>
    </div>
  );
}
