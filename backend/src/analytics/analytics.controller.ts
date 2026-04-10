import { Body, Controller, Delete, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('analytics')
@UseGuards(JwtAuthGuard)
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

  @Get('advanced/weekly-forecast')
  async weeklyForecast() {
    return this.analyticsService.getWeeklyForecast();
  }

  @Get('explain/:district')
  async explainInsight(@Param('district') district: string) {
    return this.analyticsService.getExplainableInsight(district);
  }

  @Get('explain/:district/ask')
  async askFollowUp(
    @Param('district') district: string,
    @Query('question') question: string,
  ) {
    return this.analyticsService.askFollowUpQuestion(district, question);
  }

  @Post('explain/:district/chat')
  async chatWithAgent(
    @Param('district') district: string,
    @Body() body: { message: string; sessionId?: string },
  ) {
    return this.analyticsService.chatWithAgent(district, body.message, body.sessionId);
  }

  // ── Enhancement 7: session history and management ─────────────────

  @Get('chat/:sessionId/history')
  async getChatHistory(@Param('sessionId') sessionId: string) {
    return this.analyticsService.getChatHistory(sessionId);
  }

  @Delete('chat/:sessionId')
  async deleteChatSession(@Param('sessionId') sessionId: string) {
    return this.analyticsService.deleteChatSession(sessionId);
  }

  // ── Enhancement 3: National Summary & Batch Explain ───────────────

  @Get('national-summary')
  async nationalSummary(@Query('week') week?: string) {
    return this.analyticsService.getNationalSummary(week);
  }

  @Post('batch-explain')
  async batchExplain(@Body() body: { requests: any[] }) {
    return this.analyticsService.batchExplain(body.requests ?? []);
  }

  // ── Enhancement 2: RAG Corpus Management ──────────────────────────

  @Get('rag/status')
  async ragStatus() {
    return this.analyticsService.getRagStatus();
  }

  @Post('rag/ingest')
  async ragIngest(@Body() body: { documents: any[] }) {
    return this.analyticsService.ingestRagDocuments(body.documents ?? []);
  }

  @Get('rag/etl/status')
  async etlStatus() {
    return this.analyticsService.getEtlStatus();
  }

  @Post('rag/etl/run')
  async etlRun() {
    return this.analyticsService.triggerEtlRun();
  }

  // ── Enhancement 4: Direct tool endpoints ──────────────────────────

  @Get('tools/seasonal-pattern/:district')
  async seasonalPattern(
    @Param('district') district: string,
    @Query('years') years?: string,
  ) {
    return this.analyticsService.getSeasonalPattern(
      district,
      years ? parseInt(years) : undefined,
    );
  }

  @Get('tools/spillover/:district')
  async spillover(@Param('district') district: string) {
    return this.analyticsService.getCrossDistrictSpillover(district);
  }

  @Get('tools/intervention-history/:district')
  async interventionHistory(@Param('district') district: string) {
    return this.analyticsService.getInterventionHistory(district);
  }

  @Get('tools/model-performance/:district')
  async modelPerformance(@Param('district') district: string) {
    return this.analyticsService.getModelPerformance(district);
  }

  @Get('tools/demographic-hotspots/:district')
  async demographicHotspots(@Param('district') district: string) {
    return this.analyticsService.getDemographicHotspots(district);
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
