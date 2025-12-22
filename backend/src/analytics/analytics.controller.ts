import { Controller, Get, Param, Query } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';

@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('districts/latest')
  async latest() {
    return this.analyticsService.getLatestWeekPerDistrict();
  }

  @Get('districts/:name/timeseries')
  async timeseries(@Param('name') name: string) {
    return this.analyticsService.getTimeSeries(name);
  }

  @Get('predict/bulk')
  async bulkPredict() {
    return this.analyticsService.predictBulkFromML();
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

  @Get('historical/yearly-summary')
  async yearlySummary(@Query('year') year?: string) {
    return this.analyticsService.getYearlySummary(
      year ? parseInt(year) : undefined,
    );
  }
}
