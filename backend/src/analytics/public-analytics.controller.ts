import { Controller, Get, Param, Query } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';

@Controller('public/analytics')
export class PublicAnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('districts/latest')
  async latest() {
    return this.analyticsService.getLatestWeekPerDistrict();
  }

  @Get('districts/:name/timeseries')
  async timeseries(@Param('name') name: string) {
    return this.analyticsService.getTimeSeries(name);
  }

  @Get('summary')
  async summary() {
    return this.analyticsService.getDashboardSummary();
  }

  @Get('trends')
  async trends(@Query('weeks') weeks?: string) {
    const weekCount = weeks ? parseInt(weeks) : 12;
    return this.analyticsService.getTrends(weekCount);
  }

  @Get('historical/yearly-summary')
  async yearlySummary(@Query('year') year?: string) {
    return this.analyticsService.getYearlySummary(
      year ? parseInt(year) : undefined,
    );
  }

  @Get('historical/range')
  async historicalRange(
    @Query('startYear') startYear?: string,
    @Query('startWeek') startWeek?: string,
    @Query('endYear') endYear?: string,
    @Query('endWeek') endWeek?: string,
  ) {
    return this.analyticsService.getHistoricalRange(
      startYear ? parseInt(startYear) : undefined,
      startWeek ? parseInt(startWeek) : undefined,
      endYear ? parseInt(endYear) : undefined,
      endWeek ? parseInt(endWeek) : undefined,
    );
  }

  @Get('historical/districts/compare')
  async compareDistricts(@Query('districts') districts?: string) {
    const districtList = districts ? districts.split(',') : [];
    return this.analyticsService.compareDistricts(districtList);
  }

  @Get('advanced/weather-correlation')
  async weatherCorrelation() {
    return this.analyticsService.getWeatherCorrelation();
  }

  @Get('advanced/growth-rate')
  async growthRate(@Query('weeks') weeks?: string) {
    const weekCount = weeks ? parseInt(weeks) : 4;
    return this.analyticsService.getGrowthRate(weekCount);
  }

  @Get('advanced/weekly-forecast')
  async weeklyForecast() {
    return this.analyticsService.getWeeklyForecast();
  }

  @Get('advanced/hotspots')
  async hotspots() {
    return this.analyticsService.getHotspots();
  }

  @Get('advanced/outbreak-alerts')
  async outbreakAlerts() {
    return this.analyticsService.getOutbreakAlerts();
  }

  // ── DS-Level Disaggregation — Colombo District ────────────────────

  @Get('colombo/ds-breakdown')
  async colomboDsBreakdown(
    @Query('year') year?: string,
    @Query('week') week?: string,
  ) {
    return this.analyticsService.getColombosDsBreakdown(
      year ? parseInt(year) : undefined,
      week ? parseInt(week) : undefined,
    );
  }

  @Get('colombo/ds-breakdown/weights')
  async colomboDsWeights() {
    return this.analyticsService.getColombosDsWeights();
  }
}
