import { fetchLatestPerDistrict, fetchHistoricalRange } from "./analytics.service";
import { fetchByDistrict, fetchPhiMetrics } from "./task-analytics.service";
import usersService from "./users.service";
import { DISTRICTS } from "@/lib/constants/districts";
import type { DistrictMeta } from "@/lib/constants/districts";
import type { RiskLevel } from "@/lib/types";

export interface DistrictRow extends DistrictMeta {
  riskLevel: RiskLevel | null;
  predictedCases: number | null;
  weeklyTrend: number | null; // % change vs previous week, null if unavailable
  activeTasks: number;
  completedTasks: number;
  phiCount: number;
  supervisorName: string | null;
}

interface HistoricalRow {
  year: number;
  week: number;
  district: string;
  cases: number;
}

function casesToRiskLevel(cases: number): RiskLevel {
  if (cases >= 100) return "High";
  if (cases >= 50) return "Medium";
  return "Low";
}

// ISO week arithmetic — handles week 1 → previous year week 52/53 rollover
function prevWeek(year: number, week: number): { year: number; week: number } {
  if (week > 1) return { year, week: week - 1 };
  // Week 1 → last week of previous year (conservatively 52)
  return { year: year - 1, week: 52 };
}

export async function fetchDistrictRows(): Promise<DistrictRow[]> {
  // Fetch the four primary data sources in parallel
  const [latestRes, taskRes, phiRes, usersRes] = await Promise.allSettled([
    fetchLatestPerDistrict(),
    fetchByDistrict(),
    fetchPhiMetrics(),
    usersService.getAll(),
  ]);

  const latest = latestRes.status === "fulfilled" ? latestRes.value : [];
  const tasks = taskRes.status === "fulfilled" ? taskRes.value : [];
  const phis = phiRes.status === "fulfilled" ? phiRes.value : [];
  const users = usersRes.status === "fulfilled" ? usersRes.value : [];

  // Fetch previous-week data for all districts to compute trend.
  // Uses the most common latest year/week across districts.
  let prevCasesByDistrict = new Map<string, number>();
  if (latest.length > 0) {
    const { year: currYear, week: currWeek } = latest[0];
    const { year: pYear, week: pWeek } = prevWeek(currYear, currWeek);
    try {
      const rangeData: HistoricalRow[] = await fetchHistoricalRange(
        pYear,
        pWeek,
        currYear,
        currWeek,
      );
      for (const row of rangeData) {
        if (row.year === pYear && row.week === pWeek) {
          prevCasesByDistrict.set(row.district.toLowerCase(), row.cases);
        }
      }
    } catch {
      // Trend unavailable — columns will show null
    }
  }

  // Build lookup maps keyed by lowercase district name
  const latestByDistrict = new Map(
    latest.map((d) => [d.district.toLowerCase(), d]),
  );
  const tasksByDistrict = new Map(
    tasks.map((d) => [d.districtName.toLowerCase(), d]),
  );

  // PHI count per district (active PHIs only)
  const phiCountByDistrict = new Map<string, number>();
  for (const phi of phis) {
    if (!phi.isActive) continue;
    const key = (phi.district ?? "").toLowerCase();
    if (!key) continue;
    phiCountByDistrict.set(key, (phiCountByDistrict.get(key) ?? 0) + 1);
  }

  // First supervisor found per district
  const supervisorByDistrict = new Map<string, string>();
  for (const user of users) {
    if (user.role !== "supervisor" || !user.district) continue;
    const key = user.district.toLowerCase();
    if (!supervisorByDistrict.has(key)) {
      supervisorByDistrict.set(key, user.name);
    }
  }

  return DISTRICTS.map((meta) => {
    const key = meta.name.toLowerCase();
    const analytics = latestByDistrict.get(key);
    const taskSummary = tasksByDistrict.get(key);

    const currentCases = analytics?.predicted_cases ?? null;
    const previousCases = prevCasesByDistrict.get(key) ?? null;
    const weeklyTrend =
      currentCases !== null && previousCases !== null && previousCases > 0
        ? Math.round(((currentCases - previousCases) / previousCases) * 100)
        : null;

    return {
      ...meta,
      riskLevel: currentCases !== null ? casesToRiskLevel(currentCases) : null,
      predictedCases: currentCases,
      weeklyTrend,
      activeTasks: taskSummary
        ? taskSummary.inProgress + taskSummary.assigned
        : 0,
      completedTasks: taskSummary?.completed ?? 0,
      phiCount: phiCountByDistrict.get(key) ?? 0,
      supervisorName: supervisorByDistrict.get(key) ?? null,
    };
  });
}
