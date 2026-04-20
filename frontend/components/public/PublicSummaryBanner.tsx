"use client";

interface DashboardSummary {
  current_week: { year: number; week: number };
  total_cases: number;
  previous_total: number;
  change_percent: number;
  district_count: number;
  high_risk_districts: number;
  avg_temperature: number | null;
}

interface DistrictPrediction {
  district: string;
  predicted_cases: number;
}

interface Props {
  summary: DashboardSummary;
  topDistricts: DistrictPrediction[];
}

export default function PublicSummaryBanner({ summary, topDistricts }: Props) {
  const top3 = topDistricts.slice(0, 3).map((d) => d.district);
  const highRisk = summary.high_risk_districts;
  const total = summary.district_count;
  const trend = summary.change_percent;

  const topDistrictText =
    top3.length === 0
      ? ""
      : top3.length === 1
        ? top3[0]
        : top3.length === 2
          ? `${top3[0]} and ${top3[1]}`
          : `${top3[0]}, ${top3[1]}, and ${top3[2]}`;

  const trendText =
    trend > 10
      ? "Cases are rising compared to last week."
      : trend < -10
        ? "Cases are declining compared to last week — a good sign."
        : "Cases are about the same as last week.";

  const alertLevel =
    highRisk >= 8 ? "high" : highRisk >= 4 ? "moderate" : "low";

  return (
    <div
      role="status"
      aria-live="polite"
      className={`rounded-xl p-5 border-l-4 flex items-start gap-4 ${
        alertLevel === "high"
          ? "bg-red-50 dark:bg-red-950/30 border-red-500"
          : alertLevel === "moderate"
            ? "bg-amber-50 dark:bg-amber-950/30 border-amber-500"
            : "bg-green-50 dark:bg-green-950/30 border-green-500"
      }`}
    >
      <div className="mt-0.5 text-2xl select-none">
        {alertLevel === "high"
          ? "🔴"
          : alertLevel === "moderate"
            ? "🟡"
            : "🟢"}
      </div>
      <div>
        <p className="font-semibold text-base text-slate-900 dark:text-slate-100 mb-1">
          {highRisk === 0
            ? `Dengue risk is low across all ${total} districts this week.`
            : `This week, dengue risk is elevated in ${highRisk} out of ${total} districts.`}
        </p>
        {topDistrictText && highRisk > 0 && (
          <p className="text-sm text-slate-700 dark:text-slate-300">
            {topDistrictText}{" "}
            {top3.length === 1 ? "has" : "have"} the highest number of expected
            cases. If you live in or are travelling to{" "}
            {top3.length === 1 ? "this area" : "these areas"}, take extra
            precautions against mosquito bites.
          </p>
        )}
        {highRisk === 0 && (
          <p className="text-sm text-slate-700 dark:text-slate-300">
            Continue regular precautions — dengue is always present in Sri
            Lanka.
          </p>
        )}
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
          {trendText}
        </p>
      </div>
    </div>
  );
}
