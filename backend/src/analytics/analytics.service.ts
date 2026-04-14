import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { District } from '../entities/district.entity';
import { EventsGateway } from '../events/events.gateway';
import { CacheHelperService } from '../cache/cache-helper.service';
import axios from 'axios';
import { COLOMBO_DS_WEIGHTS, classifyDsRisk } from './colombo-ds-weights';
import {
  buildServiceHeaders,
  ValidatedServiceUser,
} from '../common/service-headers.util';

type DashboardSummary = {
  current_week: { year: number | null; week: number | null };
  total_cases: number;
  previous_total: number;
  change_percent: number;
  district_count: number;
  high_risk_districts: number;
  avg_temperature: number | null;
};

// ── Sri Lanka district adjacency map (Enhancement 5) ────────────────
// Each key lists land-border adjacent districts, mirroring the Python
// service's _ADJACENCY map in explain_analytics/services/tools.py.
const SL_ADJACENCY: Record<string, string[]> = {
  Colombo: ['Gampaha', 'Kalutara'],
  Gampaha: ['Colombo', 'Kalutara', 'Kandy', 'Kegalle', 'Kurunegala'],
  Kalutara: ['Colombo', 'Gampaha', 'Ratnapura', 'Galle'],
  Kandy: [
    'Gampaha',
    'Kegalle',
    'Matale',
    'NuwaraEliya',
    'Badulla',
    'Kurunegala',
  ],
  Matale: ['Kandy', 'Kurunegala', 'Anuradhapura', 'Polonnaruwa'],
  NuwaraEliya: ['Kandy', 'Badulla', 'Ratnapura', 'Galle', 'Matara'],
  Galle: ['Kalutara', 'Ratnapura', 'Matara', 'NuwaraEliya'],
  Matara: ['Galle', 'Hambanthota', 'NuwaraEliya'],
  Hambanthota: ['Matara', 'Ratnapura', 'Monaragala', 'Badulla'],
  Jaffna: ['Kilinochchi', 'Mannar'],
  Mannar: ['Jaffna', 'Vavuniya', 'Anuradhapura'],
  Vavuniya: [
    'Mannar',
    'Kilinochchi',
    'Mullaitivu',
    'Anuradhapura',
    'Trincomalee',
  ],
  Mullaitivu: ['Kilinochchi', 'Vavuniya', 'Trincomalee', 'Batticaloa'],
  Kilinochchi: ['Jaffna', 'Mannar', 'Vavuniya', 'Mullaitivu'],
  Batticaloa: ['Mullaitivu', 'Trincomalee', 'Ampara', 'Badulla'],
  Ampara: ['Batticaloa', 'Monaragala', 'Badulla', 'Polonnaruwa'],
  Trincomalee: [
    'Vavuniya',
    'Mullaitivu',
    'Batticaloa',
    'Polonnaruwa',
    'Anuradhapura',
  ],
  Kurunegala: [
    'Gampaha',
    'Kandy',
    'Matale',
    'Anuradhapura',
    'Puttalam',
    'Kegalle',
  ],
  Puttalam: ['Kurunegala', 'Anuradhapura', 'Mannar'],
  Anuradhapura: [
    'Mannar',
    'Vavuniya',
    'Trincomalee',
    'Polonnaruwa',
    'Matale',
    'Kurunegala',
    'Puttalam',
  ],
  Polonnaruwa: [
    'Trincomalee',
    'Batticaloa',
    'Ampara',
    'Anuradhapura',
    'Matale',
  ],
  Badulla: [
    'Kandy',
    'NuwaraEliya',
    'Monaragala',
    'Ampara',
    'Batticaloa',
    'Hambanthota',
  ],
  Monaragala: ['Badulla', 'Ampara', 'Hambanthota', 'Ratnapura'],
  Ratnapura: [
    'Kalutara',
    'Galle',
    'NuwaraEliya',
    'Hambanthota',
    'Monaragala',
    'Kegalle',
  ],
  Kegalle: ['Gampaha', 'Kandy', 'Ratnapura', 'Kurunegala'],
};

@Injectable()
export class AnalyticsService implements OnModuleInit {
  private readonly logger = new Logger(AnalyticsService.name);

  constructor(
    @InjectDataSource() private dataSource: DataSource,
    private readonly eventsGateway: EventsGateway,
    private readonly cacheHelper: CacheHelperService,
  ) {}

  /** Pre-warm the most expensive analytics caches so the first user never hits a cold DB query. */
  onModuleInit() {
    void this.warmCaches();
  }

  private async warmCaches(): Promise<void> {
    const jobs: Array<[string, () => Promise<unknown>]> = [
      ['dashboard_summary', () => this.getDashboardSummary()],
      ['latest_week_districts', () => this.getLatestWeekPerDistrict()],
      ['hotspots', () => this.getHotspots()],
      ['outbreak_alerts', () => this.getOutbreakAlerts()],
      ['weather_correlation', () => this.getWeatherCorrelation()],
      ['weekly_forecast', () => this.getWeeklyForecast()],
      ['growth_rate:4', () => this.getGrowthRate(4)],
      ['trends:12', () => this.getTrends(12)],
      ['district_features_bulk', () => this.getDistrictFeaturesForBulk()],
    ];

    await Promise.allSettled(
      jobs.map(async ([name, fn]) => {
        try {
          await fn();
          this.logger.log(`Cache warmed: analytics:${name}`);
        } catch (err) {
          this.logger.warn(
            `Cache warm-up failed for analytics:${name}: ${err instanceof Error ? err.message : err}`,
          );
        }
      }),
    );
  }

  async getLatestWeekPerDistrict() {
    return this.cacheHelper.getOrRefresh(
      'analytics:latest_week_districts',
      3600000, // 1 hour fresh
      async () => {
        const manager = this.dataSource.manager;
        const latest = await manager.query(`
          WITH ranked AS (
            SELECT dc.district_id, dc.year, dc.week, dc.cases,
                   ROW_NUMBER() OVER (PARTITION BY dc.district_id ORDER BY dc.year DESC, dc.week DESC) as rn
            FROM dengue_cases dc
          )
          SELECT d.id as district_id, d.name, d.latitude, d.longitude,
                 r.year, r.week, r.cases,
                 w.temperature_2m_mean, w.precipitation_sum
          FROM ranked r
          JOIN districts d ON d.id = r.district_id
          LEFT JOIN weather_data w ON w.district_id = r.district_id AND w.year = r.year AND w.week = r.week
          WHERE r.rn = 1
          ORDER BY d.name;
        `);
        return latest.map((row: any) => ({
          district: row.name,
          predicted_cases: row.cases,
          year: row.year,
          week: row.week,
          latitude: Number(row.latitude),
          longitude: Number(row.longitude),
          temperature:
            row.temperature_2m_mean !== null
              ? Number(row.temperature_2m_mean)
              : null,
          precipitation:
            row.precipitation_sum !== null
              ? Number(row.precipitation_sum)
              : null,
        }));
      },
    );
  }

  async getTimeSeries(districtName: string) {
    return this.cacheHelper.getOrRefresh(
      `analytics:timeseries:${districtName}`,
      3600000, // 1 hour fresh
      async () => {
        const manager = this.dataSource.manager;
        const district = await manager
          .getRepository(District)
          .findOne({ where: { name: districtName } });
        if (!district) return [];

        const rows = await manager.query(
          `SELECT dc.year, dc.week, dc.cases,
                  w.temperature_2m_mean, w.precipitation_sum
           FROM dengue_cases dc
           LEFT JOIN weather_data w ON w.district_id = dc.district_id AND w.year = dc.year AND w.week = dc.week
           WHERE dc.district_id = $1
           ORDER BY dc.year, dc.week`,
          [district.id],
        );
        return rows.map((r: any) => ({
          year: r.year,
          week: r.week,
          cases: r.cases,
          temperature:
            r.temperature_2m_mean !== null
              ? Number(r.temperature_2m_mean)
              : null,
          precipitation:
            r.precipitation_sum !== null ? Number(r.precipitation_sum) : null,
        }));
      },
    );
  }

  async getDistrictFeaturesForBulk(): Promise<
    Array<{
      district: string;
      cases_lag1: number;
      cases_lag2: number;
      cases_lag3: number;
      cases_mean_4w: number;
      temperature_2m_mean: number;
      precipitation_sum: number;
    }>
  > {
    return this.cacheHelper.getOrRefresh(
      'analytics:district_features_bulk',
      3600000, // 1 hour fresh
      async () => {
        const manager = this.dataSource.manager;
        const rows = await manager.query(`
          WITH ordered AS (
            SELECT dc.district_id, d.name as district,
                   dc.year, dc.week, dc.cases,
                   ROW_NUMBER() OVER (PARTITION BY dc.district_id ORDER BY dc.year DESC, dc.week DESC) as rn
            FROM dengue_cases dc
            JOIN districts d ON d.id = dc.district_id
          ),
          agg AS (
            SELECT o.district_id, o.district,
                   MAX(CASE WHEN o.rn = 1 THEN o.cases END) AS lag1,
                   MAX(CASE WHEN o.rn = 2 THEN o.cases END) AS lag2,
                   MAX(CASE WHEN o.rn = 3 THEN o.cases END) AS lag3,
                   AVG(CASE WHEN o.rn <= 4 THEN o.cases END) AS mean4
            FROM ordered o
            WHERE o.rn <= 4
            GROUP BY o.district_id, o.district
          ),
          latest_week AS (
            SELECT dc.district_id, dc.year, dc.week,
                   ROW_NUMBER() OVER (PARTITION BY dc.district_id ORDER BY dc.year DESC, dc.week DESC) as rn
            FROM dengue_cases dc
          ),
          weather AS (
            SELECT w.district_id,
                   w.temperature_2m_mean,
                   w.precipitation_sum
            FROM weather_data w
            JOIN latest_week lw ON lw.district_id = w.district_id AND lw.year = w.year AND lw.week = w.week
            WHERE lw.rn = 1
          )
          SELECT a.district,
                 COALESCE(a.lag1, 0) as cases_lag1,
                 COALESCE(a.lag2, 0) as cases_lag2,
                 COALESCE(a.lag3, 0) as cases_lag3,
                 COALESCE(a.mean4, 0) as cases_mean_4w,
                 COALESCE(w.temperature_2m_mean, 0) as temperature_2m_mean,
                 COALESCE(w.precipitation_sum, 0) as precipitation_sum
          FROM agg a
          LEFT JOIN weather w ON w.district_id = a.district_id
          ORDER BY a.district;
        `);
        return rows.map((r: any) => ({
          district: r.district,
          cases_lag1: Number(r.cases_lag1) || 0,
          cases_lag2: Number(r.cases_lag2) || 0,
          cases_lag3: Number(r.cases_lag3) || 0,
          cases_mean_4w: Number(r.cases_mean_4w) || 0,
          temperature_2m_mean: Number(r.temperature_2m_mean) || 0,
          precipitation_sum: Number(r.precipitation_sum) || 0,
        }));
      },
    ) as Promise<any>;
  }

  async predictBulkFromML() {
    const features = await this.getDistrictFeaturesForBulk();
    const mlUrl = process.env.ML_SERVICE_URL || 'http://localhost:8000';
    const resp = await axios.post(
      `${mlUrl}/predict/bulk`,
      {
        districts: features,
      },
      { headers: buildServiceHeaders() },
    );

    // Emit real-time update to connected clients
    this.eventsGateway.emitAnalyticsUpdated({
      type: 'predictions',
      payload: { count: resp.data?.length || 0 },
    });

    return resp.data;
  }

  async getDashboardSummary(
    year?: number,
    weekNumber?: number,
  ): Promise<DashboardSummary> {
    const isAnchored = year !== undefined && weekNumber !== undefined;

    // Anchored calls (report generation) use a per-week cache key with a long
    // TTL — historical data is immutable so it never needs refreshing.
    // Live calls (dashboard) keep the existing short-TTL key unchanged.
    const cacheKey = isAnchored
      ? `analytics:dashboard_summary:${year}:${weekNumber}`
      : 'analytics:dashboard_summary';
    const ttl = isAnchored
      ? 86400000 // 24 hours — historical data does not change
      : 600000; // 10 minutes for live data

    return this.cacheHelper.getOrRefresh<DashboardSummary>(
      cacheKey,
      ttl,
      async () => {
        const manager = this.dataSource.manager;
        let summary: any[];

        if (isAnchored) {
          // Anchor every sub-query to the requested (year, weekNumber).
          summary = await manager.query(
            `
            WITH current_week AS (
              SELECT dc.year, dc.week,
                     SUM(dc.cases) as total_cases,
                     COUNT(DISTINCT dc.district_id) as district_count
              FROM dengue_cases dc
              WHERE dc.year = $1 AND dc.week = $2
              GROUP BY dc.year, dc.week
            ),
            previous_week AS (
              SELECT SUM(dc.cases) as total_cases
              FROM dengue_cases dc
              WHERE (dc.year, dc.week) = (
                SELECT year, week FROM dengue_cases
                WHERE (year < $1) OR (year = $1 AND week < $2)
                ORDER BY year DESC, week DESC LIMIT 1
              )
            ),
            -- Prior 4-week averages per district (excludes the target week itself)
            prior_avgs AS (
              SELECT ranked.district_id, AVG(ranked.cases) as avg_4week
              FROM (
                SELECT dc.district_id, dc.cases,
                       ROW_NUMBER() OVER (
                         PARTITION BY dc.district_id
                         ORDER BY dc.year DESC, dc.week DESC
                       ) as rn
                FROM dengue_cases dc
                WHERE (dc.year < $1) OR (dc.year = $1 AND dc.week < $2)
              ) ranked
              WHERE ranked.rn <= 4
              GROUP BY ranked.district_id
            ),
            -- Rising trend: cases > prior 4-week avg × 1.3 (matches weekly_reports.high_risk_districts)
            high_risk AS (
              SELECT COUNT(*) as count
              FROM dengue_cases dc
              LEFT JOIN prior_avgs pa ON pa.district_id = dc.district_id
              WHERE dc.year = $1 AND dc.week = $2
                AND dc.cases > COALESCE(pa.avg_4week, dc.cases) * 1.3
            ),
            avg_temp AS (
              SELECT AVG(w.temperature_2m_mean) as avg_temp
              FROM weather_data w
              WHERE w.year = $1 AND w.week = $2
            )
            SELECT
              c.year, c.week, c.total_cases, c.district_count,
              p.total_cases as previous_total,
              COALESCE(((c.total_cases - p.total_cases) * 100.0 / NULLIF(p.total_cases, 0)), 0) as change_percent,
              h.count as high_risk_districts,
              a.avg_temp
            FROM current_week c
            LEFT JOIN previous_week p ON true
            LEFT JOIN high_risk h ON true
            LEFT JOIN avg_temp a ON true;
            `,
            [year, weekNumber],
          );
        } else {
          // Live query — always returns the latest week in the database.
          summary = await manager.query(`
            WITH current_week AS (
              SELECT dc.year, dc.week, SUM(dc.cases) as total_cases, COUNT(DISTINCT dc.district_id) as district_count
              FROM dengue_cases dc
              WHERE (dc.year, dc.week) = (
                SELECT year, week FROM dengue_cases ORDER BY year DESC, week DESC LIMIT 1
              )
              GROUP BY dc.year, dc.week
            ),
            previous_week AS (
              SELECT dc.year, dc.week, SUM(dc.cases) as total_cases
              FROM dengue_cases dc
              WHERE (dc.year, dc.week) = (
                SELECT year, week FROM dengue_cases
                WHERE (year, week) < (SELECT year, week FROM dengue_cases ORDER BY year DESC, week DESC LIMIT 1)
                ORDER BY year DESC, week DESC LIMIT 1
              )
              GROUP BY dc.year, dc.week
            ),
            -- Absolute burden metric for the live dashboard: districts with >= 50 cases
            -- (distinct from the trend-based Rising definition used in report generation)
            high_risk AS (
              SELECT COUNT(*) as count
              FROM (
                SELECT dc.district_id, dc.cases,
                       ROW_NUMBER() OVER (PARTITION BY dc.district_id ORDER BY dc.year DESC, dc.week DESC) as rn
                FROM dengue_cases dc
              ) ranked
              WHERE ranked.rn = 1 AND ranked.cases >= 50
            ),
            avg_temp AS (
              SELECT AVG(w.temperature_2m_mean) as avg_temp
              FROM weather_data w
              WHERE (w.year, w.week) = (
                SELECT year, week FROM weather_data ORDER BY year DESC, week DESC LIMIT 1
              )
            )
            SELECT
              c.year, c.week, c.total_cases, c.district_count,
              p.total_cases as previous_total,
              COALESCE(((c.total_cases - p.total_cases) * 100.0 / NULLIF(p.total_cases, 0)), 0) as change_percent,
              h.count as high_risk_districts,
              a.avg_temp
            FROM current_week c
            LEFT JOIN previous_week p ON true
            LEFT JOIN high_risk h ON true
            LEFT JOIN avg_temp a ON true;
          `);
        }

        if (summary.length === 0) {
          return {
            current_week: { year: null, week: null },
            total_cases: 0,
            previous_total: 0,
            change_percent: 0,
            district_count: 0,
            high_risk_districts: 0,
            avg_temperature: null,
          };
        }

        const row = summary[0];
        return {
          current_week: { year: row.year, week: row.week },
          total_cases: Number(row.total_cases) || 0,
          previous_total: Number(row.previous_total) || 0,
          change_percent: Number(row.change_percent) || 0,
          district_count: Number(row.district_count) || 0,
          high_risk_districts: Number(row.high_risk_districts) || 0,
          avg_temperature: row.avg_temp ? Number(row.avg_temp) : null,
        };
      },
    );
  }

  async getTrends(weeks: number = 12) {
    return this.cacheHelper.getOrRefresh(
      `analytics:trends:${weeks}`,
      3600000, // 1 hour fresh
      async () => {
        const manager = this.dataSource.manager;
        const trends = await manager.query(
          `
          SELECT dc.year, dc.week, SUM(dc.cases) as total_cases,
                 AVG(w.temperature_2m_mean) as avg_temp,
                 AVG(w.precipitation_sum) as avg_precip
          FROM dengue_cases dc
          LEFT JOIN weather_data w ON w.district_id = dc.district_id AND w.year = dc.year AND w.week = dc.week
          GROUP BY dc.year, dc.week
          ORDER BY dc.year DESC, dc.week DESC
          LIMIT $1
        `,
          [weeks],
        );
        return trends.reverse().map((row: any) => ({
          year: row.year,
          week: row.week,
          total_cases: Number(row.total_cases) || 0,
          avg_temperature: row.avg_temp ? Number(row.avg_temp) : null,
          avg_precipitation: row.avg_precip ? Number(row.avg_precip) : null,
        }));
      },
    );
  }

  async getHistoricalRange(
    startYear?: number,
    startWeek?: number,
    endYear?: number,
    endWeek?: number,
  ) {
    const manager = this.dataSource.manager;

    // Default to last year of data if no range specified
    const defaultEnd = await manager.query(`
      SELECT year, week FROM dengue_cases ORDER BY year DESC, week DESC LIMIT 1
    `);
    const defaultStart = await manager.query(`
      SELECT year, week FROM dengue_cases ORDER BY year ASC, week ASC LIMIT 1
    `);

    const finalStartYear = startYear || defaultStart[0]?.year;
    const finalStartWeek = startWeek || defaultStart[0]?.week;
    const finalEndYear = endYear || defaultEnd[0]?.year;
    const finalEndWeek = endWeek || defaultEnd[0]?.week;

    const cacheKey = `analytics:historical:${finalStartYear}:${finalStartWeek}:${finalEndYear}:${finalEndWeek}`;
    return this.cacheHelper.getOrRefresh(
      cacheKey,
      7200000, // 2 hours fresh
      async () => {
        const data = await manager.query(
          `
          SELECT dc.year, dc.week, d.name as district, dc.cases,
                 w.temperature_2m_mean, w.precipitation_sum
          FROM dengue_cases dc
          JOIN districts d ON d.id = dc.district_id
          LEFT JOIN weather_data w ON w.district_id = dc.district_id AND w.year = dc.year AND w.week = dc.week
          WHERE (dc.year > $1 OR (dc.year = $1 AND dc.week >= $2))
            AND (dc.year < $3 OR (dc.year = $3 AND dc.week <= $4))
          ORDER BY dc.year, dc.week, d.name
        `,
          [finalStartYear, finalStartWeek, finalEndYear, finalEndWeek],
        );
        return data.map((row: any) => ({
          year: row.year,
          week: row.week,
          district: row.district,
          cases: Number(row.cases) || 0,
          temperature: row.temperature_2m_mean
            ? Number(row.temperature_2m_mean)
            : null,
          precipitation: row.precipitation_sum
            ? Number(row.precipitation_sum)
            : null,
        }));
      },
    );
  }

  async compareDistricts(districts: string[]) {
    const manager = this.dataSource.manager;

    if (districts.length === 0) {
      const allDistricts = await manager.query(`
        SELECT DISTINCT d.name FROM districts d ORDER BY d.name
      `);
      districts = allDistricts.map((d: any) => d.name);
    }

    const cacheKey = `analytics:compare:${[...districts].sort().join(',')}`;
    return this.cacheHelper.getOrRefresh(
      cacheKey,
      3600000, // 1 hour fresh
      async () => {
        const placeholders = districts.map((_, i) => `$${i + 1}`).join(',');
        const data = await manager.query(
          `
          SELECT dc.year, dc.week, d.name as district, dc.cases,
                 w.temperature_2m_mean, w.precipitation_sum
          FROM dengue_cases dc
          JOIN districts d ON d.id = dc.district_id
          LEFT JOIN weather_data w ON w.district_id = dc.district_id AND w.year = dc.year AND w.week = dc.week
          WHERE d.name IN (${placeholders})
          ORDER BY dc.year, dc.week, d.name
        `,
          districts,
        );
        return data.map((row: any) => ({
          year: row.year,
          week: row.week,
          district: row.district,
          cases: Number(row.cases) || 0,
          temperature: row.temperature_2m_mean
            ? Number(row.temperature_2m_mean)
            : null,
          precipitation: row.precipitation_sum
            ? Number(row.precipitation_sum)
            : null,
        }));
      },
    );
  }

  async getYearlySummary(year?: number) {
    const manager = this.dataSource.manager;

    const targetYear =
      year ||
      (
        await manager.query(
          `SELECT year FROM dengue_cases ORDER BY year DESC LIMIT 1`,
        )
      )[0]?.year;

    const cacheKey = `analytics:yearly_summary:${targetYear}`;
    return this.cacheHelper.getOrRefresh(
      cacheKey,
      7200000, // 2 hours fresh
      async () => {
        const summary = await manager.query(
          `
          WITH yearly_data AS (
            SELECT d.name as district,
                   SUM(dc.cases) as total_cases,
                   AVG(dc.cases) as avg_cases,
                   MAX(dc.cases) as max_cases,
                   MIN(dc.cases) as min_cases,
                   COUNT(dc.cases) as week_count
            FROM dengue_cases dc
            JOIN districts d ON d.id = dc.district_id
            WHERE dc.year = $1
            GROUP BY d.name
          )
          SELECT district, total_cases, avg_cases, max_cases, min_cases, week_count
          FROM yearly_data
          ORDER BY total_cases DESC
        `,
          [targetYear],
        );
        return {
          year: targetYear,
          districts: summary.map((row: any) => ({
            district: row.district,
            total_cases: Number(row.total_cases) || 0,
            avg_cases: Number(row.avg_cases) || 0,
            max_cases: Number(row.max_cases) || 0,
            min_cases: Number(row.min_cases) || 0,
            week_count: Number(row.week_count) || 0,
          })),
        };
      },
    );
  }

  async getWeatherCorrelation() {
    return this.cacheHelper.getOrRefresh(
      'analytics:weather_correlation',
      3600000, // 1 hour fresh
      async () => {
        const manager = this.dataSource.manager;
        const data = await manager.query(`
          SELECT
            d.name as district,
            CORR(dc.cases, w.temperature_2m_mean) as temp_correlation,
            CORR(dc.cases, w.precipitation_sum) as precip_correlation,
            AVG(dc.cases) as avg_cases,
            AVG(w.temperature_2m_mean) as avg_temp,
            AVG(w.precipitation_sum) as avg_precip,
            COUNT(*) as data_points
          FROM dengue_cases dc
          JOIN districts d ON d.id = dc.district_id
          LEFT JOIN weather_data w ON w.district_id = dc.district_id
            AND w.year = dc.year AND w.week = dc.week
          WHERE w.temperature_2m_mean IS NOT NULL
            AND w.precipitation_sum IS NOT NULL
          GROUP BY d.name
          HAVING COUNT(*) >= 10
          ORDER BY ABS(CORR(dc.cases, w.temperature_2m_mean)) DESC
        `);
        return data.map((row: any) => ({
          district: row.district,
          temp_correlation: row.temp_correlation
            ? Number(row.temp_correlation)
            : 0,
          precip_correlation: row.precip_correlation
            ? Number(row.precip_correlation)
            : 0,
          avg_cases: Number(row.avg_cases) || 0,
          avg_temp: Number(row.avg_temp) || 0,
          avg_precip: Number(row.avg_precip) || 0,
          data_points: Number(row.data_points) || 0,
        }));
      },
    );
  }

  async getGrowthRate(weeks: number = 4) {
    return this.cacheHelper.getOrRefresh(
      `analytics:growth_rate:${weeks}`,
      1800000, // 30 minutes fresh
      async () => {
        const manager = this.dataSource.manager;
        const data = await manager.query(
          `
          WITH recent_weeks AS (
            SELECT dc.district_id, d.name, dc.year, dc.week, dc.cases,
                   LAG(dc.cases, 1) OVER (PARTITION BY dc.district_id ORDER BY dc.year, dc.week) as prev_week,
                   ROW_NUMBER() OVER (PARTITION BY dc.district_id ORDER BY dc.year DESC, dc.week DESC) as rn
            FROM dengue_cases dc
            JOIN districts d ON d.id = dc.district_id
          )
          SELECT name as district,
                 AVG(CASE WHEN prev_week > 0
                   THEN ((cases - prev_week) * 100.0 / prev_week)
                   ELSE 0 END) as avg_growth_rate,
                 MAX(cases) as current_cases,
                 MAX(CASE WHEN rn = 2 THEN cases END) as prev_cases
          FROM recent_weeks
          WHERE rn <= $1
          GROUP BY name
          ORDER BY avg_growth_rate DESC
        `,
          [weeks],
        );
        return data.map((row: any) => ({
          district: row.district,
          avg_growth_rate: Number(row.avg_growth_rate) || 0,
          current_cases: Number(row.current_cases) || 0,
          prev_cases: Number(row.prev_cases) || 0,
          trend:
            Number(row.avg_growth_rate) > 10
              ? 'increasing'
              : Number(row.avg_growth_rate) < -10
                ? 'decreasing'
                : 'stable',
        }));
      },
    );
  }

  async getHotspots(year?: number, weekNumber?: number) {
    const isAnchored = year !== undefined && weekNumber !== undefined;

    const cacheKey = isAnchored
      ? `analytics:hotspots:${year}:${weekNumber}`
      : 'analytics:hotspots';
    const ttl = isAnchored
      ? 86400000 // 24 hours — historical data does not change
      : 900000; // 15 minutes for live data

    return this.cacheHelper.getOrRefresh(
      cacheKey,
      ttl,
      async () => {
        const manager = this.dataSource.manager;
        let data: any[];

        if (isAnchored) {
          // Anchor both the target week and the comparison week to the
          // requested (year, weekNumber).
          data = await manager.query(
            `
            WITH latest AS (
              SELECT dc.district_id, d.name, d.latitude, d.longitude,
                     dc.cases, dc.year, dc.week
              FROM dengue_cases dc
              JOIN districts d ON d.id = dc.district_id
              WHERE dc.year = $1 AND dc.week = $2
            ),
            prev_week AS (
              SELECT dc.district_id, dc.cases as prev_cases
              FROM dengue_cases dc
              WHERE (dc.year, dc.week) = (
                SELECT year, week FROM dengue_cases
                WHERE (year < $1) OR (year = $1 AND week < $2)
                ORDER BY year DESC, week DESC LIMIT 1
              )
            )
            SELECT l.name as district,
                   l.cases as current_cases,
                   COALESCE(p.prev_cases, 0) as previous_cases,
                   CASE WHEN p.prev_cases > 0
                     THEN ((l.cases - p.prev_cases) * 100.0 / p.prev_cases)
                     ELSE 0 END as growth_rate,
                   l.latitude,
                   l.longitude,
                   CASE
                     WHEN l.cases >= 100 THEN 'critical'
                     WHEN l.cases >= 50 AND (l.cases - COALESCE(p.prev_cases, 0)) > 20 THEN 'high'
                     WHEN l.cases >= 25 THEN 'moderate'
                     ELSE 'low'
                   END as severity
            FROM latest l
            LEFT JOIN prev_week p ON p.district_id = l.district_id
            WHERE l.cases >= 25
            ORDER BY l.cases DESC, growth_rate DESC
            `,
            [year, weekNumber],
          );
        } else {
          // Live query — always uses the latest week in the database.
          data = await manager.query(`
            WITH latest AS (
              SELECT dc.district_id, d.name, d.latitude, d.longitude,
                     dc.cases, dc.year, dc.week,
                     ROW_NUMBER() OVER (PARTITION BY dc.district_id ORDER BY dc.year DESC, dc.week DESC) as rn
              FROM dengue_cases dc
              JOIN districts d ON d.id = dc.district_id
            ),
            prev_week AS (
              SELECT dc.district_id, dc.cases as prev_cases
              FROM dengue_cases dc
              WHERE (dc.year, dc.week) = (
                SELECT year, week FROM dengue_cases
                WHERE (year, week) < (SELECT year, week FROM dengue_cases ORDER BY year DESC, week DESC LIMIT 1)
                ORDER BY year DESC, week DESC LIMIT 1
              )
            )
            SELECT l.name as district,
                   l.cases as current_cases,
                   COALESCE(p.prev_cases, 0) as previous_cases,
                   CASE WHEN p.prev_cases > 0
                     THEN ((l.cases - p.prev_cases) * 100.0 / p.prev_cases)
                     ELSE 0 END as growth_rate,
                   l.latitude,
                   l.longitude,
                   CASE
                     WHEN l.cases >= 100 THEN 'critical'
                     WHEN l.cases >= 50 AND (l.cases - COALESCE(p.prev_cases, 0)) > 20 THEN 'high'
                     WHEN l.cases >= 25 THEN 'moderate'
                     ELSE 'low'
                   END as severity
            FROM latest l
            LEFT JOIN prev_week p ON p.district_id = l.district_id
            WHERE l.rn = 1 AND l.cases >= 25
            ORDER BY l.cases DESC, growth_rate DESC
          `);
        }

        return data.map((row: any) => ({
          district: row.district,
          current_cases: Number(row.current_cases) || 0,
          previous_cases: Number(row.previous_cases) || 0,
          growth_rate: Number(row.growth_rate) || 0,
          latitude: Number(row.latitude),
          longitude: Number(row.longitude),
          severity: row.severity,
        }));
      },
    );
  }

  async getOutbreakAlerts() {
    return this.cacheHelper.getOrRefresh(
      'analytics:outbreak_alerts',
      900000, // 15 minutes fresh
      async () => {
        const manager = this.dataSource.manager;
        const data = await manager.query(`
          WITH latest AS (
            SELECT dc.district_id, d.name, dc.cases, dc.year, dc.week,
                   ROW_NUMBER() OVER (PARTITION BY dc.district_id ORDER BY dc.year DESC, dc.week DESC) as rn
            FROM dengue_cases dc
            JOIN districts d ON d.id = dc.district_id
          ),
          prev_4weeks AS (
            SELECT dc.district_id,
                   AVG(dc.cases) as avg_cases,
                   MAX(dc.cases) as max_cases
            FROM dengue_cases dc
            WHERE (dc.year, dc.week) IN (
              SELECT year, week FROM dengue_cases
              ORDER BY year DESC, week DESC
              LIMIT 4 OFFSET 1
            )
            GROUP BY dc.district_id
          )
          SELECT l.name as district,
                 l.cases as current_cases,
                 p.avg_cases,
                 CASE
                   WHEN l.cases > p.avg_cases * 2 THEN 'Outbreak Alert'
                   WHEN l.cases > p.avg_cases * 1.5 THEN 'Warning'
                   WHEN l.cases >= 100 THEN 'High Cases'
                   ELSE 'Normal'
                 END as alert_level,
                 CASE
                   WHEN l.cases > p.avg_cases * 2 THEN 'Cases doubled compared to 4-week average'
                   WHEN l.cases > p.avg_cases * 1.5 THEN 'Cases 50% above average'
                   WHEN l.cases >= 100 THEN 'Very high case count'
                   ELSE 'Within normal range'
                 END as description
          FROM latest l
          LEFT JOIN prev_4weeks p ON p.district_id = l.district_id
          WHERE l.rn = 1 AND (l.cases > p.avg_cases * 1.5 OR l.cases >= 50)
          ORDER BY
            CASE
              WHEN l.cases > p.avg_cases * 2 THEN 1
              WHEN l.cases > p.avg_cases * 1.5 THEN 2
              ELSE 3
            END,
            l.cases DESC
        `);
        return data.map((row: any) => ({
          district: row.district,
          current_cases: Number(row.current_cases) || 0,
          avg_cases: Number(row.avg_cases) || 0,
          alert_level: row.alert_level,
          description: row.description,
          severity:
            row.alert_level === 'Outbreak Alert'
              ? 'critical'
              : row.alert_level === 'Warning'
                ? 'high'
                : 'moderate',
        }));
      },
    );
  }

  async getWeeklyForecast() {
    return this.cacheHelper.getOrRefresh(
      'analytics:weekly_forecast',
      1800000, // 30 minutes fresh
      async () => {
        const manager = this.dataSource.manager;
        const data = await manager.query(`
          WITH recent AS (
            SELECT dc.district_id, d.name, dc.year, dc.week, dc.cases,
                   ROW_NUMBER() OVER (PARTITION BY dc.district_id ORDER BY dc.year DESC, dc.week DESC) as rn
            FROM dengue_cases dc
            JOIN districts d ON d.id = dc.district_id
          ),
          stats AS (
            SELECT district_id, name,
                   AVG(cases) as avg_4week,
                   MAX(CASE WHEN rn = 1 THEN cases END) as current,
                   MAX(CASE WHEN rn = 2 THEN cases END) as prev1,
                   MAX(CASE WHEN rn = 3 THEN cases END) as prev2
            FROM recent
            WHERE rn <= 4
            GROUP BY district_id, name
          )
          SELECT name as district,
                 current,
                 avg_4week,
                 ROUND(avg_4week + (current - prev1) * 0.7) as forecast,
                 CASE
                   WHEN current > avg_4week * 1.3 THEN 'Rising'
                   WHEN current < avg_4week * 0.7 THEN 'Falling'
                   ELSE 'Stable'
                 END as trend
          FROM stats
          WHERE current IS NOT NULL
          ORDER BY forecast DESC
        `);
        return data.map((row: any) => ({
          district: row.district,
          current_cases: Number(row.current) || 0,
          avg_4week: Number(row.avg_4week) || 0,
          forecast: Number(row.forecast) || 0,
          trend: row.trend,
          confidence: 'medium',
        }));
      },
    );
  }

  /**
   * Week-anchored forecast: treats the specified (year, weekNumber) as the
   * "current" week and looks back from there instead of always using the
   * latest data. Used by report generation so each report reflects the
   * epidemiological week it was requested for.
   */
  async getWeeklyForecastForWeek(year: number, weekNumber: number) {
    const manager = this.dataSource.manager;
    const data = await manager.query(
      `
      WITH recent AS (
        SELECT dc.district_id, d.name, dc.year, dc.week, dc.cases,
               ROW_NUMBER() OVER (PARTITION BY dc.district_id ORDER BY dc.year DESC, dc.week DESC) as rn
        FROM dengue_cases dc
        JOIN districts d ON d.id = dc.district_id
        WHERE (dc.year < $1) OR (dc.year = $1 AND dc.week <= $2)
      ),
      stats AS (
        SELECT district_id, name,
               AVG(cases) as avg_4week,
               MAX(CASE WHEN rn = 1 THEN cases END) as current,
               MAX(CASE WHEN rn = 2 THEN cases END) as prev1,
               MAX(CASE WHEN rn = 3 THEN cases END) as prev2
        FROM recent
        WHERE rn <= 4
        GROUP BY district_id, name
      )
      SELECT name as district,
             current,
             avg_4week,
             ROUND(avg_4week + (current - prev1) * 0.7) as forecast,
             CASE
               WHEN current > avg_4week * 1.3 THEN 'Rising'
               WHEN current < avg_4week * 0.7 THEN 'Falling'
               ELSE 'Stable'
             END as trend
      FROM stats
      WHERE current IS NOT NULL
      ORDER BY forecast DESC
      `,
      [year, weekNumber],
    );
    return data.map((row: any) => ({
      district: row.district,
      current_cases: Number(row.current) || 0,
      avg_4week: Number(row.avg_4week) || 0,
      forecast: Number(row.forecast) || 0,
      trend: row.trend,
      confidence: 'medium',
    }));
  }

  /**
   * Week-anchored outbreak alerts: anchors the "latest" week to the specified
   * (year, weekNumber) so historical reports reflect that week's alert state.
   */
  async getOutbreakAlertsForWeek(year: number, weekNumber: number) {
    const manager = this.dataSource.manager;
    const data = await manager.query(
      `
      WITH latest AS (
        SELECT dc.district_id, d.name, dc.cases, dc.year, dc.week,
               ROW_NUMBER() OVER (PARTITION BY dc.district_id ORDER BY dc.year DESC, dc.week DESC) as rn
        FROM dengue_cases dc
        JOIN districts d ON d.id = dc.district_id
        WHERE (dc.year < $1) OR (dc.year = $1 AND dc.week <= $2)
      ),
      prev_4weeks AS (
        SELECT ranked.district_id,
               AVG(ranked.cases) as avg_cases,
               MAX(ranked.cases) as max_cases
        FROM (
          SELECT dc.district_id, dc.cases,
                 ROW_NUMBER() OVER (
                   PARTITION BY dc.district_id
                   ORDER BY dc.year DESC, dc.week DESC
                 ) as rn
          FROM dengue_cases dc
          WHERE (dc.year < $1) OR (dc.year = $1 AND dc.week < $2)
        ) ranked
        WHERE ranked.rn <= 4
        GROUP BY ranked.district_id
      )
      SELECT l.name as district,
             l.cases as current_cases,
             p.avg_cases,
             CASE
               WHEN l.cases > p.avg_cases * 2 THEN 'Outbreak Alert'
               WHEN l.cases > p.avg_cases * 1.5 THEN 'Warning'
               WHEN l.cases >= 50 THEN 'High Cases'
               ELSE 'Normal'
             END as alert_level,
             CASE
               WHEN l.cases > p.avg_cases * 2 THEN 'Cases doubled compared to 4-week average'
               WHEN l.cases > p.avg_cases * 1.5 THEN 'Cases 50% above average'
               WHEN l.cases >= 50 THEN 'Elevated case count requiring surveillance'
               ELSE 'Within normal range'
             END as description
      FROM latest l
      LEFT JOIN prev_4weeks p ON p.district_id = l.district_id
      WHERE l.rn = 1 AND (l.cases > p.avg_cases * 1.5 OR l.cases >= 50)
      ORDER BY
        CASE
          WHEN l.cases > p.avg_cases * 2 THEN 1
          WHEN l.cases > p.avg_cases * 1.5 THEN 2
          ELSE 3
        END,
        l.cases DESC
      `,
      [year, weekNumber],
    );
    return data.map((row: any) => {
      const severity: 'critical' | 'high' | 'moderate' =
        row.alert_level === 'Outbreak Alert'
          ? 'critical'
          : row.alert_level === 'Warning'
            ? 'high'
            : 'moderate';

      const recommendation =
        severity === 'critical'
          ? 'Deploy rapid response teams and issue an immediate public health advisory.'
          : severity === 'high'
            ? 'Increase surveillance frequency and alert local health authorities.'
            : 'Continue routine surveillance and monitor for further increases.';

      return {
        district: row.district,
        current_cases: Number(row.current_cases) || 0,
        avg_cases: Number(row.avg_cases) || 0,
        alert_level: row.alert_level,
        message: row.description,
        recommendation,
        severity,
      };
    });
  }

  /**
   * Historical week data: returns the actual recorded cases from dengue_cases
   * for the exact week specified. Used for past-week reports so they reflect
   * what actually happened rather than a forecast based on that week's data.
   */
  async getActualWeekData(year: number, weekNumber: number) {
    const manager = this.dataSource.manager;
    const data = await manager.query(
      `
      WITH target_week AS (
        SELECT dc.district_id, d.name, dc.cases
        FROM dengue_cases dc
        JOIN districts d ON d.id = dc.district_id
        WHERE dc.year = $1 AND dc.week = $2
      ),
      prev_stats AS (
        SELECT ranked.district_id,
               AVG(ranked.cases) as avg_4week
        FROM (
          SELECT dc.district_id, dc.cases,
                 ROW_NUMBER() OVER (PARTITION BY dc.district_id ORDER BY dc.year DESC, dc.week DESC) as rn
          FROM dengue_cases dc
          WHERE (dc.year < $1) OR (dc.year = $1 AND dc.week < $2)
        ) ranked
        WHERE ranked.rn <= 4
        GROUP BY ranked.district_id
      )
      SELECT t.name as district,
             t.cases as actual_cases,
             COALESCE(p.avg_4week, t.cases) as avg_4week,
             CASE
               WHEN t.cases > COALESCE(p.avg_4week, t.cases) * 1.3 THEN 'Rising'
               WHEN t.cases < COALESCE(p.avg_4week, t.cases) * 0.7 THEN 'Falling'
               ELSE 'Stable'
             END as trend
      FROM target_week t
      LEFT JOIN prev_stats p ON p.district_id = t.district_id
      ORDER BY t.cases DESC
      `,
      [year, weekNumber],
    );
    return data.map((row: any) => ({
      district: row.district,
      // For historical: forecast = actual_cases (what actually happened)
      current_cases: Number(row.actual_cases) || 0,
      avg_4week: Number(row.avg_4week) || 0,
      forecast: Number(row.actual_cases) || 0,
      trend: row.trend,
      confidence: 'actual',
    }));
  }

  async getExplainableInsight(
    districtName: string,
    user: ValidatedServiceUser,
  ) {
    const manager = this.dataSource.manager;

    // Get the district entity
    const district = await manager
      .getRepository(District)
      .findOne({ where: { name: districtName } });
    if (!district) {
      return { error: 'District not found', district: districtName };
    }

    // Get latest 4 weeks of cases for this district (include created_at for freshness)
    const recentWeeks = await manager.query(
      `SELECT dc.year, dc.week, dc.cases, dc.created_at,
              w.temperature_2m_mean, w.precipitation_sum
       FROM dengue_cases dc
       LEFT JOIN weather_data w ON w.district_id = dc.district_id AND w.year = dc.year AND w.week = dc.week
       WHERE dc.district_id = $1
       ORDER BY dc.year DESC, dc.week DESC
       LIMIT 4`,
      [district.id],
    );

    if (recentWeeks.length === 0) {
      return { error: 'No data available', district: districtName };
    }

    const current = recentWeeks[0];
    const previous = recentWeeks.length > 1 ? recentWeeks[1] : null;

    const currentCases = Number(current.cases) || 0;
    const prevCases = previous ? Number(previous.cases) || 0 : 0;
    const wowChange =
      prevCases > 0 ? ((currentCases - prevCases) / prevCases) * 100 : 0;

    const rainfall7d = current.precipitation_sum
      ? Number(current.precipitation_sum)
      : null;
    const temperature7d = current.temperature_2m_mean
      ? Number(current.temperature_2m_mean)
      : null;

    // Enhancement 6: data_last_updated from the latest record's created_at
    const dataLastUpdated: string = current.created_at
      ? new Date(current.created_at).toISOString()
      : new Date().toISOString();

    // Try to read richer ML metadata from weekly_forecasts (Enhancement 6)
    // Falls back gracefully if the table doesn't exist yet.
    let mlRiskScore: number | null = null;
    let mlUncertaintyLower: number | null = null;
    let mlUncertaintyUpper: number | null = null;
    let featureImportances: Record<string, number> | null = null;

    try {
      const wfRows = await manager.query(
        `SELECT wf.model_risk_score, wf.uncertainty_lower, wf.uncertainty_upper,
                wf.feature_importances
         FROM weekly_forecasts wf
         WHERE wf.district_id = $1
         ORDER BY wf.year DESC, wf.week DESC
         LIMIT 1`,
        [district.id],
      );
      if (wfRows.length > 0) {
        const wf = wfRows[0];
        mlRiskScore =
          wf.model_risk_score != null ? Number(wf.model_risk_score) : null;
        mlUncertaintyLower =
          wf.uncertainty_lower != null ? Number(wf.uncertainty_lower) : null;
        mlUncertaintyUpper =
          wf.uncertainty_upper != null ? Number(wf.uncertainty_upper) : null;
        featureImportances =
          typeof wf.feature_importances === 'object' &&
          wf.feature_importances !== null
            ? wf.feature_importances
            : null;
      }
    } catch {
      // weekly_forecasts table may not exist on older deployments — ignore
    }

    // Fall back to heuristic risk score when ML table has no data
    const maxCasesRow = await manager.query(
      `SELECT MAX(cases) as max_cases FROM dengue_cases`,
    );
    const maxCases = Number(maxCasesRow[0]?.max_cases) || 200;
    const heuristicRisk = Math.min(currentCases / maxCases, 1.0);

    const riskScore = mlRiskScore ?? heuristicRisk;
    const uncertaintyLower =
      mlUncertaintyLower ?? Math.max(0, riskScore - 0.15);
    const uncertaintyUpper =
      mlUncertaintyUpper ?? Math.min(1, riskScore + 0.15);

    // Enhancement 5: populate neighboring_districts from the adjacency map
    const neighborNames = SL_ADJACENCY[districtName] ?? [];
    let neighboringDistricts: any[] = [];
    if (neighborNames.length > 0) {
      try {
        const neighborRows: any[] = await manager.query(
          `WITH ranked AS (
             SELECT d.name,
                    dc.cases,
                    ROW_NUMBER() OVER (PARTITION BY d.id ORDER BY dc.year DESC, dc.week DESC) AS rn
             FROM districts d
             JOIN dengue_cases dc ON dc.district_id = d.id
             WHERE d.name = ANY($1)
           )
           SELECT r1.name,
                  r1.cases AS current_cases,
                  r2.cases AS prev_cases
           FROM ranked r1
           LEFT JOIN ranked r2 ON r1.name = r2.name AND r2.rn = 2
           WHERE r1.rn = 1`,
          [neighborNames],
        );

        neighboringDistricts = neighborRows.map((row: any) => {
          const nc = Number(row.current_cases) || 0;
          const np = row.prev_cases != null ? Number(row.prev_cases) : 0;
          const wow = np > 0 ? ((nc - np) / np) * 100 : 0;
          const neighborRisk = Math.min(nc / maxCases, 1.0);
          return {
            district: row.name,
            recent_case_count: nc,
            wow_case_change_pct: Number(wow.toFixed(1)),
            model_risk_score: Number(neighborRisk.toFixed(3)),
            trend_direction:
              wow >= 10 ? 'rising' : wow <= -10 ? 'falling' : 'stable',
          };
        });
      } catch {
        // Non-critical — proceed without neighbor data
      }
    }

    const payload = {
      district: districtName,
      prediction_week: `${current.year}-W${String(current.week).padStart(2, '0')}`,
      structured_signals: {
        recent_case_count: currentCases,
        wow_case_change_pct: Number(wowChange.toFixed(1)),
        rainfall_mm_7d: rainfall7d,
        temperature_c_7d: temperature7d,
        model_risk_score: Number(riskScore.toFixed(3)),
        uncertainty_lower: Number(uncertaintyLower.toFixed(3)),
        uncertainty_upper: Number(uncertaintyUpper.toFixed(3)),
        historical_trend: recentWeeks.map((r: any) => Number(r.cases) || 0),
        // Enhancement 1: SHAP feature importances from weekly_forecasts
        feature_importances: featureImportances,
        // Enhancement 5: geographic neighbours for spillover detection
        neighboring_districts: neighboringDistricts,
        // Enhancement 6: data freshness for stale-data warning
        data_last_updated: dataLastUpdated,
      },
      rag_context: [],
    };

    const explainUrl =
      process.env.EXPLAIN_ANALYTICS_URL || 'http://localhost:8010';
    try {
      const resp = await axios.post(
        `${explainUrl}/v1/insights/explain`,
        payload,
        { headers: buildServiceHeaders(user) },
      );
      return resp.data;
    } catch (err: any) {
      // If the Python service is down, return a structured fallback
      const fallbackRiskLevel =
        riskScore >= 0.85
          ? 'critical'
          : riskScore >= 0.65
            ? 'high'
            : riskScore >= 0.4
              ? 'moderate'
              : 'low';
      const interval = uncertaintyUpper - uncertaintyLower;
      const predConfidence = Math.max(
        0,
        Math.min(100, Math.round(100 * (1 - interval / 0.5))),
      );
      return {
        district: districtName,
        risk_level: fallbackRiskLevel,
        summary: `${districtName} has ${currentCases} cases this week (${wowChange >= 0 ? '+' : ''}${wowChange.toFixed(1)}% WoW). Explainable AI service is currently unavailable.`,
        key_drivers: [
          wowChange >= 10
            ? `Cases increased ${wowChange.toFixed(1)}% week-over-week`
            : `Current case count: ${currentCases}`,
        ],
        recommendations: ['Increase surveillance in high-incidence areas'],
        caveats: [
          'AI explanation service unavailable — showing basic fallback',
        ],
        references: [],
        document_references: [],
        implementation_phase: 'phase-1-fallback',
        confidence_score: 30,
        data_completeness_score: 30,
        prediction_confidence: predConfidence,
        data_freshness_warning: false,
        trend_direction:
          wowChange >= 10 ? 'rising' : wowChange <= -10 ? 'falling' : 'stable',
        spillover_risk: false,
        _fallback: true,
        _error: err.message,
      };
    }
  }

  async askFollowUpQuestion(
    districtName: string,
    question: string,
    user: ValidatedServiceUser,
  ) {
    // Re-use getExplainableInsight logic but add user_question
    const manager = this.dataSource.manager;
    const district = await manager
      .getRepository(District)
      .findOne({ where: { name: districtName } });
    if (!district) {
      return { error: 'District not found', district: districtName };
    }

    const recentWeeks = await manager.query(
      `SELECT dc.year, dc.week, dc.cases, dc.created_at,
              w.temperature_2m_mean, w.precipitation_sum
       FROM dengue_cases dc
       LEFT JOIN weather_data w ON w.district_id = dc.district_id AND w.year = dc.year AND w.week = dc.week
       WHERE dc.district_id = $1
       ORDER BY dc.year DESC, dc.week DESC
       LIMIT 4`,
      [district.id],
    );

    if (recentWeeks.length === 0) {
      return { error: 'No data available', district: districtName };
    }

    const current = recentWeeks[0];
    const previous = recentWeeks.length > 1 ? recentWeeks[1] : null;
    const currentCases = Number(current.cases) || 0;
    const prevCases = previous ? Number(previous.cases) || 0 : 0;
    const wowChange =
      prevCases > 0 ? ((currentCases - prevCases) / prevCases) * 100 : 0;
    const maxCasesRow = await manager.query(
      `SELECT MAX(cases) as max_cases FROM dengue_cases`,
    );
    const maxCases = Number(maxCasesRow[0]?.max_cases) || 200;
    const riskScore = Math.min(currentCases / maxCases, 1.0);

    const dataLastUpdated: string = current.created_at
      ? new Date(current.created_at).toISOString()
      : new Date().toISOString();

    const payload = {
      district: districtName,
      prediction_week: `${current.year}-W${String(current.week).padStart(2, '0')}`,
      structured_signals: {
        recent_case_count: currentCases,
        wow_case_change_pct: Number(wowChange.toFixed(1)),
        rainfall_mm_7d: current.precipitation_sum
          ? Number(current.precipitation_sum)
          : null,
        temperature_c_7d: current.temperature_2m_mean
          ? Number(current.temperature_2m_mean)
          : null,
        model_risk_score: Number(riskScore.toFixed(3)),
        uncertainty_lower: Number(Math.max(0, riskScore - 0.15).toFixed(3)),
        uncertainty_upper: Number(Math.min(1, riskScore + 0.15).toFixed(3)),
        historical_trend: recentWeeks.map((r: any) => Number(r.cases) || 0),
        data_last_updated: dataLastUpdated,
      },
      rag_context: [],
      user_question: question,
    };

    const explainUrl =
      process.env.EXPLAIN_ANALYTICS_URL || 'http://localhost:8010';
    try {
      const resp = await axios.post(
        `${explainUrl}/v1/insights/explain`,
        payload,
        { headers: buildServiceHeaders(user) },
      );
      return resp.data;
    } catch (err: any) {
      return {
        error: 'AI service unavailable',
        follow_up_answer:
          'The AI explanation service is currently unavailable. Please try again later.',
        _fallback: true,
      };
    }
  }

  async chatWithAgent(
    districtName: string,
    message: string,
    sessionId?: string,
    user?: ValidatedServiceUser,
  ) {
    // Gather district signals for context
    const manager = this.dataSource.manager;
    const district = await manager
      .getRepository(District)
      .findOne({ where: { name: districtName } });

    let structuredSignals: any = null;
    if (district) {
      const recentWeeks = await manager.query(
        `SELECT dc.year, dc.week, dc.cases, dc.created_at,
                w.temperature_2m_mean, w.precipitation_sum
         FROM dengue_cases dc
         LEFT JOIN weather_data w ON w.district_id = dc.district_id AND w.year = dc.year AND w.week = dc.week
         WHERE dc.district_id = $1
         ORDER BY dc.year DESC, dc.week DESC
         LIMIT 4`,
        [district.id],
      );

      if (recentWeeks.length > 0) {
        const current = recentWeeks[0];
        const previous = recentWeeks.length > 1 ? recentWeeks[1] : null;
        const currentCases = Number(current.cases) || 0;
        const prevCases = previous ? Number(previous.cases) || 0 : 0;
        const wowChange =
          prevCases > 0 ? ((currentCases - prevCases) / prevCases) * 100 : 0;
        const maxCasesRow = await manager.query(
          `SELECT MAX(cases) as max_cases FROM dengue_cases`,
        );
        const maxCases = Number(maxCasesRow[0]?.max_cases) || 200;
        const riskScore = Math.min(currentCases / maxCases, 1.0);

        structuredSignals = {
          recent_case_count: currentCases,
          wow_case_change_pct: Number(wowChange.toFixed(1)),
          rainfall_mm_7d: current.precipitation_sum
            ? Number(current.precipitation_sum)
            : null,
          temperature_c_7d: current.temperature_2m_mean
            ? Number(current.temperature_2m_mean)
            : null,
          model_risk_score: Number(riskScore.toFixed(3)),
          historical_trend: recentWeeks.map((r: any) => Number(r.cases) || 0),
          data_last_updated: current.created_at
            ? new Date(current.created_at).toISOString()
            : new Date().toISOString(),
        };
      }
    }

    const explainUrl =
      process.env.EXPLAIN_ANALYTICS_URL || 'http://localhost:8010';

    try {
      // Enhancement 7: send only the new message + session_id.
      // Full history is managed server-side in the Python service via Redis.
      const resp = await axios.post(
        `${explainUrl}/v1/insights/chat`,
        {
          district: districtName,
          message,
          session_id: sessionId || undefined,
          structured_signals: structuredSignals,
        },
        {
          headers: buildServiceHeaders(user),
        },
      );
      return resp.data;
    } catch (err: any) {
      return {
        reply:
          'The AI agent service is currently unavailable. Please try again later.',
        tool_calls_used: [],
        session_id: sessionId || 'fallback',
        turn_count: 0,
        context_compressed: false,
      };
    }
  }

  // ── Enhancement 7: session history and management ──────────────────

  async getChatHistory(sessionId: string, user: ValidatedServiceUser) {
    const explainUrl =
      process.env.EXPLAIN_ANALYTICS_URL || 'http://localhost:8010';
    try {
      const resp = await axios.get(
        `${explainUrl}/v1/insights/chat/${encodeURIComponent(sessionId)}/history`,
        { headers: buildServiceHeaders(user) },
      );
      return resp.data;
    } catch {
      return {
        session_id: sessionId,
        messages: [],
        message_count: 0,
        turn_count: 0,
      };
    }
  }

  async deleteChatSession(sessionId: string, user: ValidatedServiceUser) {
    const explainUrl =
      process.env.EXPLAIN_ANALYTICS_URL || 'http://localhost:8010';
    try {
      const resp = await axios.delete(
        `${explainUrl}/v1/insights/chat/${encodeURIComponent(sessionId)}`,
        { headers: buildServiceHeaders(user) },
      );
      return resp.data;
    } catch {
      return {
        session_id: sessionId,
        deleted: false,
        message: 'Session service unavailable.',
      };
    }
  }

  // ── Enhancement 3: National Summary ────────────────────────────────

  async getNationalSummary(week?: string, user?: ValidatedServiceUser) {
    const explainUrl =
      process.env.EXPLAIN_ANALYTICS_URL || 'http://localhost:8010';
    try {
      const params = week ? `?week=${encodeURIComponent(week)}` : '';
      const resp = await axios.get(
        `${explainUrl}/v1/insights/national-summary${params}`,
        { headers: buildServiceHeaders(user) },
      );
      return resp.data;
    } catch (err: any) {
      return {
        situation_report:
          'National summary could not be generated. The AI analytics service is currently unavailable.',
        urgent_districts: [],
        district_highlights: [],
        total_districts_analysed: 0,
        total_national_cases: 0,
        by_risk_level: { critical: 0, high: 0, moderate: 0, low: 0 },
        prediction_week: week ?? null,
        generated_at: new Date().toISOString(),
        implementation_phase: 'unavailable',
        _error: err.message,
      };
    }
  }

  // ── Enhancement 3: Batch Explain ───────────────────────────────────

  async batchExplain(requests: any[], user: ValidatedServiceUser) {
    const explainUrl =
      process.env.EXPLAIN_ANALYTICS_URL || 'http://localhost:8010';
    try {
      const resp = await axios.post(
        `${explainUrl}/v1/insights/batch-explain`,
        { requests },
        {
          headers: buildServiceHeaders(user),
          timeout: 120000,
        }, // 2-minute timeout for batch operations
      );
      return resp.data;
    } catch (err: any) {
      return {
        error: 'Batch explain service unavailable',
        results: [],
        total: 0,
        urgent_districts: [],
        by_risk_level: { critical: 0, high: 0, moderate: 0, low: 0 },
        prediction_week: null,
        generated_at: new Date().toISOString(),
      };
    }
  }

  // ── Enhancement 2: RAG Corpus Management ───────────────────────────

  async getRagStatus() {
    const explainUrl =
      process.env.EXPLAIN_ANALYTICS_URL || 'http://localhost:8010';
    try {
      const resp = await axios.get(`${explainUrl}/v1/rag/status`, {
        headers: buildServiceHeaders(),
      });
      return resp.data;
    } catch (err: any) {
      return {
        rag_enabled: false,
        qdrant_url: null,
        qdrant_collection: null,
        embedding_model: null,
        retrieval_mode: null,
        top_k: 0,
        document_count: 0,
        _error: 'RAG status unavailable — AI service unreachable',
      };
    }
  }

  async ingestRagDocuments(documents: any[], user: ValidatedServiceUser) {
    const explainUrl =
      process.env.EXPLAIN_ANALYTICS_URL || 'http://localhost:8010';
    const resp = await axios.post(
      `${explainUrl}/v1/rag/ingest`,
      { documents },
      {
        headers: buildServiceHeaders(user),
        timeout: 300000,
      }, // 5-minute timeout — embedding can be slow for large batches
    );
    return resp.data;
  }

  async getEtlStatus() {
    const explainUrl =
      process.env.EXPLAIN_ANALYTICS_URL || 'http://localhost:8010';
    try {
      const resp = await axios.get(`${explainUrl}/v1/rag/etl/status`, {
        headers: buildServiceHeaders(),
      });
      return resp.data;
    } catch {
      return {
        etl_enabled: false,
        last_run_at: null,
        last_run_records: 0,
        last_run_status: 'never',
        last_run_error: null,
        next_run_at: null,
        is_running: false,
        _error: 'ETL status unavailable — AI service unreachable',
      };
    }
  }

  async triggerEtlRun(user: ValidatedServiceUser) {
    const explainUrl =
      process.env.EXPLAIN_ANALYTICS_URL || 'http://localhost:8010';
    const resp = await axios.post(
      `${explainUrl}/v1/rag/etl/run`,
      {},
      { headers: buildServiceHeaders(user), timeout: 600000 },
    );
    return resp.data;
  }

  // ── Enhancement 4: Direct tool endpoints ──────────────────────────

  private async _toolGet(path: string): Promise<any> {
    const explainUrl =
      process.env.EXPLAIN_ANALYTICS_URL || 'http://localhost:8010';
    try {
      const resp = await axios.get(`${explainUrl}${path}`, {
        headers: buildServiceHeaders(),
        timeout: 30000,
      });
      return resp.data;
    } catch (err: any) {
      return {
        error: err.response?.data?.detail || 'Tool endpoint unavailable',
      };
    }
  }

  async getSeasonalPattern(district: string, years?: number) {
    const q = years ? `?years=${years}` : '';
    return this._toolGet(
      `/v1/tools/seasonal-pattern/${encodeURIComponent(district)}${q}`,
    );
  }

  async getCrossDistrictSpillover(district: string) {
    return this._toolGet(`/v1/tools/spillover/${encodeURIComponent(district)}`);
  }

  async getInterventionHistory(district: string) {
    return this._toolGet(
      `/v1/tools/intervention-history/${encodeURIComponent(district)}`,
    );
  }

  async getModelPerformance(district: string) {
    return this._toolGet(
      `/v1/tools/model-performance/${encodeURIComponent(district)}`,
    );
  }

  async getDemographicHotspots(district: string) {
    return this._toolGet(
      `/v1/tools/demographic-hotspots/${encodeURIComponent(district)}`,
    );
  }

  // ── DS-Level Disaggregation — Colombo District ────────────────────

  /**
   * Disaggregate the latest (or a specific) Colombo district prediction
   * into 13 DS-division estimates using pre-computed composite weights.
   *
   * No ML model call is made — the district prediction is read from the
   * weekly_forecasts table and the breakdown is computed in-memory.
   */
  async getColombosDsBreakdown(year?: number, week?: number) {
    const cacheKey =
      year && week
        ? `analytics:colombo_ds_breakdown:${year}:${week}`
        : 'analytics:colombo_ds_breakdown:latest';

    return this.cacheHelper.getOrRefresh(
      cacheKey,
      1800000, // 30 minutes
      async () => {
        const manager = this.dataSource.manager;

        // Resolve year/week: use supplied values or fall back to latest
        let targetYear = year;
        let targetWeek = week;

        if (!targetYear || !targetWeek) {
          const latest = await manager.query(`
            SELECT wf.year, wf.week
            FROM weekly_forecasts wf
            JOIN districts d ON d.id = wf.district_id
            WHERE d.name = 'Colombo'
            ORDER BY wf.year DESC, wf.week DESC
            LIMIT 1
          `);

          if (latest.length === 0) {
            return { error: 'No forecast data available for Colombo' };
          }

          targetYear = Number(latest[0].year);
          targetWeek = Number(latest[0].week);
        }

        // Fetch Colombo district prediction for the resolved week
        const rows = await manager.query(
          `
          SELECT wf.predicted_cases, wf.uncertainty_lower, wf.uncertainty_upper
          FROM weekly_forecasts wf
          JOIN districts d ON d.id = wf.district_id
          WHERE d.name = 'Colombo'
            AND wf.year = $1
            AND wf.week = $2
          LIMIT 1
        `,
          [targetYear, targetWeek],
        );

        if (rows.length === 0) {
          return {
            error: `No forecast found for Colombo at year=${targetYear} week=${targetWeek}`,
          };
        }

        const districtCases = Number(rows[0].predicted_cases);

        // Derive CI bounds in case units.
        // uncertainty_lower/upper are stored as normalised risk scores (0–1,
        // where 1.0 = 120 cases). Reverse-normalize to get case counts,
        // falling back to ±30 % if the stored values look unreliable.
        const MAX_NORM = 120;
        const rawLower =
          rows[0].uncertainty_lower != null
            ? Number(rows[0].uncertainty_lower) * MAX_NORM
            : null;
        const rawUpper =
          rows[0].uncertainty_upper != null
            ? Number(rows[0].uncertainty_upper) * MAX_NORM
            : null;

        const ciLower =
          rawLower !== null && rawLower < districtCases
            ? Math.max(0, rawLower)
            : districtCases * 0.7;
        const ciUpper =
          rawUpper !== null && rawUpper > districtCases
            ? rawUpper
            : districtCases * 1.3;

        // Apply DS weights
        const dsBreakdown = COLOMBO_DS_WEIGHTS.map((ds) => {
          const dsCases = districtCases * ds.weight;
          return {
            ds_division: ds.name,
            predicted_cases: Math.round(dsCases),
            proportion: ds.weight,
            confidence_interval: {
              lower: Math.round(Math.max(0, ciLower * ds.weight)),
              upper: Math.round(ciUpper * ds.weight),
              confidence_level: 0.8,
            },
            risk_level: classifyDsRisk(dsCases),
          };
        });

        // Sort highest predicted cases first
        dsBreakdown.sort((a, b) => b.predicted_cases - a.predicted_cases);

        return {
          district: 'Colombo',
          year: targetYear,
          week: targetWeek,
          district_predicted_cases: districtCases,
          disaggregation_method: 'population_density_burden_weighted',
          ds_breakdown: dsBreakdown,
        };
      },
    );
  }

  /** Expose the raw DS weight table for academic transparency. */
  getColombosDsWeights() {
    return {
      district: 'Colombo',
      ds_division_count: COLOMBO_DS_WEIGHTS.length,
      weight_formula:
        '0.5 × population_proportion + 0.3 × density_score + 0.2 × burden_index',
      sources: [
        'Census of Population and Housing 2012, Department of Census and Statistics, Sri Lanka',
        'Administrative boundaries, Survey Department of Sri Lanka',
        'NCDS Annual Dengue Surveillance Reports 2015–2023',
      ],
      weights: COLOMBO_DS_WEIGHTS,
    };
  }
}
