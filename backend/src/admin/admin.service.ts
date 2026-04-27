import { Injectable } from '@nestjs/common';
import { AnalyticsService } from '../analytics/analytics.service';
import { TasksAnalyticsService } from '../tasks/tasks-analytics.service';
import { UsersService } from '../users/users.service';
import { CacheHelperService } from '../cache/cache-helper.service';

const DISTRICTS: Array<{
  id: number;
  name: string;
  code: string;
  province: string;
  population: number;
}> = [
  { id: 1,  name: 'Colombo',       code: 'COL', province: 'Western',       population: 2324349 },
  { id: 2,  name: 'Gampaha',       code: 'GAM', province: 'Western',       population: 2304833 },
  { id: 3,  name: 'Kalutara',      code: 'KAL', province: 'Western',       population: 1221948 },
  { id: 4,  name: 'Kandy',         code: 'KAN', province: 'Central',       population: 1375382 },
  { id: 5,  name: 'Matale',        code: 'MTL', province: 'Central',       population:  489976 },
  { id: 6,  name: 'NuwaraEliya',   code: 'NUE', province: 'Central',       population:  711644 },
  { id: 7,  name: 'Galle',         code: 'GAL', province: 'Southern',      population: 1063334 },
  { id: 8,  name: 'Matara',        code: 'MAT', province: 'Southern',      population:  814535 },
  { id: 9,  name: 'Hambanthota',   code: 'HAM', province: 'Southern',      population:  599903 },
  { id: 10, name: 'Jaffna',        code: 'JAF', province: 'Northern',      population:  583882 },
  { id: 11, name: 'Kilinochchi',   code: 'KIL', province: 'Northern',      population:  113510 },
  { id: 12, name: 'Mannar',        code: 'MAN', province: 'Northern',      population:   99051 },
  { id: 13, name: 'Mullaitivu',    code: 'MUL', province: 'Northern',      population:   92238 },
  { id: 14, name: 'Vavuniya',      code: 'VAV', province: 'Northern',      population:  172081 },
  { id: 15, name: 'Ampara',        code: 'AMP', province: 'Eastern',       population:  649402 },
  { id: 16, name: 'Batticaloa',    code: 'BAT', province: 'Eastern',       population:  526567 },
  { id: 17, name: 'Trincomalee',   code: 'TRI', province: 'Eastern',       population:  379541 },
  { id: 18, name: 'Kurunegala',    code: 'KUR', province: 'North Western', population: 1618465 },
  { id: 19, name: 'Puttalam',      code: 'PUT', province: 'North Western', population:  762396 },
  { id: 20, name: 'Anuradhapura',  code: 'ANU', province: 'North Central', population:  856232 },
  { id: 21, name: 'Polonnaruwa',   code: 'POL', province: 'North Central', population:  406088 },
  { id: 22, name: 'Badulla',       code: 'BAD', province: 'Uva',           population:  895436 },
  { id: 23, name: 'Monaragala',    code: 'MON', province: 'Uva',           population:  451058 },
  { id: 24, name: 'Kegalle',       code: 'KEG', province: 'Sabaragamuwa',  population:  840648 },
  { id: 25, name: 'Ratnapura',     code: 'RAT', province: 'Sabaragamuwa',  population: 1088007 },
];

const TTL_MS   = 5 * 60 * 1000;  // 5 min fresh
const GRACE_MS = 10 * 60 * 1000; // 10 min grace (SWR)

function casesToRiskLevel(cases: number): 'Low' | 'Medium' | 'High' {
  if (cases >= 100) return 'High';
  if (cases >= 50)  return 'Medium';
  return 'Low';
}

function prevWeek(year: number, week: number): { year: number; week: number } {
  if (week > 1) return { year, week: week - 1 };
  return { year: year - 1, week: 52 };
}

@Injectable()
export class AdminService {
  constructor(
    private readonly analyticsService: AnalyticsService,
    private readonly tasksAnalyticsService: TasksAnalyticsService,
    private readonly usersService: UsersService,
    private readonly cache: CacheHelperService,
  ) {}

  getDistrictsSummary() {
    return this.cache.getOrRefresh(
      'admin:districts:summary',
      TTL_MS,
      () => this._buildSummary(),
      GRACE_MS,
    );
  }

  private async _buildSummary() {
    const [latest, taskSummaries, phiList, users] = await Promise.all([
      this.analyticsService.getLatestWeekPerDistrict(),
      this.tasksAnalyticsService.getByDistrict(),
      this.tasksAnalyticsService.getPhiMetrics(),
      this.usersService.findAll(),
    ]);

    // Fetch previous-week data for trend computation
    let prevCasesByDistrict = new Map<string, number>();
    if (latest.length > 0) {
      const { year: currYear, week: currWeek } = latest[0];
      const { year: pYear, week: pWeek } = prevWeek(currYear, currWeek);
      try {
        const rangeData: Array<{ year: number; week: number; district: string; cases: number }> =
          await this.analyticsService.getHistoricalRange(pYear, pWeek, currYear, currWeek);
        for (const row of rangeData) {
          if (row.year === pYear && row.week === pWeek) {
            prevCasesByDistrict.set(row.district.toLowerCase(), row.cases);
          }
        }
      } catch {
        // trend unavailable — weeklyTrend will be null
      }
    }

    // Build lookup maps
    const latestByDistrict = new Map(
      latest.map((d: any) => [d.district.toLowerCase(), d]),
    );
    const tasksByDistrict = new Map(
      taskSummaries.map((d: any) => [d.districtName.toLowerCase(), d]),
    );

    const phiCountByDistrict = new Map<string, number>();
    for (const phi of phiList as any[]) {
      if (!phi.isActive) continue;
      const key = (phi.district ?? '').toLowerCase();
      if (!key) continue;
      phiCountByDistrict.set(key, (phiCountByDistrict.get(key) ?? 0) + 1);
    }

    const supervisorByDistrict = new Map<string, string>();
    for (const user of users as any[]) {
      if (user.role !== 'supervisor' || !user.district) continue;
      const key = user.district.toLowerCase();
      if (!supervisorByDistrict.has(key)) {
        supervisorByDistrict.set(key, user.name);
      }
    }

    return DISTRICTS.map((meta) => {
      const key = meta.name.toLowerCase();
      const analytics: any = latestByDistrict.get(key);
      const taskSummary: any = tasksByDistrict.get(key);

      const currentCases: number | null = analytics?.predicted_cases ?? null;
      const previousCases: number | null = prevCasesByDistrict.get(key) ?? null;
      const weeklyTrend =
        currentCases !== null && previousCases !== null && previousCases > 0
          ? Math.round(((currentCases - previousCases) / previousCases) * 100)
          : null;

      const incidenceRate =
        currentCases !== null && meta.population > 0
          ? parseFloat(((currentCases / meta.population) * 100_000).toFixed(1))
          : null;

      return {
        ...meta,
        riskLevel: currentCases !== null ? casesToRiskLevel(currentCases) : null,
        predictedCases: currentCases,
        weeklyTrend,
        incidenceRate,
        activeTasks: taskSummary
          ? taskSummary.inProgress + taskSummary.assigned
          : 0,
        completedTasks: taskSummary?.completed ?? 0,
        phiCount: phiCountByDistrict.get(key) ?? 0,
        supervisorName: supervisorByDistrict.get(key) ?? null,
      };
    });
  }
}
