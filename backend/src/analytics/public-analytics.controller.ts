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

  @Get('advanced/weather-correlation')
  async weatherCorrelation() {
    return this.analyticsService.getWeatherCorrelation();
  }

  @Get('advanced/growth-rate')
  async growthRate(@Query('weeks') weeks?: string) {
    const weekCount = weeks ? parseInt(weeks) : 4;
    return this.analyticsService.getGrowthRate(weekCount);
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
