import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { DengueCase } from '../entities/dengue_case.entity';
import { WeatherData } from '../entities/weather_data.entity';
import { District } from '../entities/district.entity';
import { EventsGateway } from '../events/events.gateway';
import axios from 'axios';

@Injectable()
export class AnalyticsService {
  constructor(
    @InjectDataSource() private dataSource: DataSource,
    private readonly eventsGateway: EventsGateway,
  ) {}

  async getLatestWeekPerDistrict() {
    const manager = this.dataSource.manager;

    // Get latest year/week per district from dengue_cases using ROW_NUMBER
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
      predicted_cases: row.cases, // placeholder: using real latest cases
      year: row.year,
      week: row.week,
      latitude: Number(row.latitude),
      longitude: Number(row.longitude),
      temperature:
        row.temperature_2m_mean !== null
          ? Number(row.temperature_2m_mean)
          : null,
      precipitation:
        row.precipitation_sum !== null ? Number(row.precipitation_sum) : null,
    }));
  }

  async getTimeSeries(districtName: string) {
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
        r.temperature_2m_mean !== null ? Number(r.temperature_2m_mean) : null,
      precipitation:
        r.precipitation_sum !== null ? Number(r.precipitation_sum) : null,
    }));
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
    const manager = this.dataSource.manager;
    // Compute lags and 4-week mean per district from dengue_cases; use latest weather
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
  }

  async predictBulkFromML() {
    const features = await this.getDistrictFeaturesForBulk();
    const mlUrl = process.env.ML_SERVICE_URL || 'http://localhost:8000';
    const resp = await axios.post(`${mlUrl}/predict/bulk`, {
      districts: features,
    });

    // Emit real-time update to connected clients
    this.eventsGateway.emitAnalyticsUpdated({
      type: 'predictions',
      payload: { count: resp.data?.length || 0 },
    });

    return resp.data;
  }

  async getDashboardSummary() {
    const manager = this.dataSource.manager;

    // Get current week total and comparison with previous week
    const summary = await manager.query(`
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
  }

  async getTrends(weeks: number = 12) {
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
  }

  async compareDistricts(districts: string[]) {
    const manager = this.dataSource.manager;

    if (districts.length === 0) {
      // Return all districts if none specified
      const allDistricts = await manager.query(`
        SELECT DISTINCT d.name FROM districts d ORDER BY d.name
      `);
      districts = allDistricts.map((d: any) => d.name);
    }

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
  }

  async getWeatherCorrelation() {
    const manager = this.dataSource.manager;

    // Calculate correlation between weather and dengue cases
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
      temp_correlation: row.temp_correlation ? Number(row.temp_correlation) : 0,
      precip_correlation: row.precip_correlation
        ? Number(row.precip_correlation)
        : 0,
      avg_cases: Number(row.avg_cases) || 0,
      avg_temp: Number(row.avg_temp) || 0,
      avg_precip: Number(row.avg_precip) || 0,
      data_points: Number(row.data_points) || 0,
    }));
  }

  async getGrowthRate(weeks: number = 4) {
    const manager = this.dataSource.manager;

    // Calculate week-over-week growth rate per district
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
  }

  async getHotspots() {
    const manager = this.dataSource.manager;

    // Identify hotspots based on cases, growth rate, and density
    const data = await manager.query(`
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

    return data.map((row: any) => ({
      district: row.district,
      current_cases: Number(row.current_cases) || 0,
      previous_cases: Number(row.previous_cases) || 0,
      growth_rate: Number(row.growth_rate) || 0,
      latitude: Number(row.latitude),
      longitude: Number(row.longitude),
      severity: row.severity,
    }));
  }

  async getOutbreakAlerts() {
    const manager = this.dataSource.manager;

    // Generate alerts based on thresholds and trends
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
  }

  async getWeeklyForecast() {
    const manager = this.dataSource.manager;

    // Simple forecast based on moving average and trend
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
  }
}
