import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { AnalyticsService } from './analytics.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../entities/user.entity';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ValidatedServiceUser } from '../common/service-headers.util';

@Controller('analytics')
@UseGuards(JwtAuthGuard, RolesGuard)
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
  @Roles(UserRole.ADMIN)
  async explainInsight(
    @Param('district') district: string,
    @CurrentUser() user: ValidatedServiceUser,
  ) {
    return this.analyticsService.getExplainableInsight(district, user);
  }

  @Get('explain/:district/ask')
  @Roles(UserRole.ADMIN)
  async askFollowUp(
    @Param('district') district: string,
    @Query('question') question: string,
    @CurrentUser() user: ValidatedServiceUser,
  ) {
    return this.analyticsService.askFollowUpQuestion(district, question, user);
  }

  @Post('explain/:district/chat')
  @Roles(UserRole.ADMIN)
  async chatWithAgent(
    @Param('district') district: string,
    @Body() body: { message: string; sessionId?: string },
    @CurrentUser() user: ValidatedServiceUser,
  ) {
    return this.analyticsService.chatWithAgent(
      district,
      body.message,
      body.sessionId,
      user,
    );
  }

  // ── Enhancement 7: session history and management ─────────────────

  @Get('chat/sessions')
  @Roles(UserRole.ADMIN)
  async getUserSessions(
    @CurrentUser() user: ValidatedServiceUser,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('district') district?: string,
    @Query('search') search?: string,
  ) {
    return this.analyticsService.getUserSessions(
      user,
      page ? parseInt(page) : 1,
      limit ? parseInt(limit) : 20,
      district,
      search,
    );
  }

  @Get('chat/:sessionId/export')
  @Roles(UserRole.ADMIN)
  async exportSession(
    @Param('sessionId') sessionId: string,
    @Query('format') format: string = 'json',
    @CurrentUser() user: ValidatedServiceUser,
    @Res() res: Response,
  ) {
    const result = await this.analyticsService.exportSession(sessionId, format, user);
    res.setHeader('Content-Type', result.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
    res.send(result.content);
  }

  @Get('chat/:sessionId/history')
  @Roles(UserRole.ADMIN)
  async getChatHistory(
    @Param('sessionId') sessionId: string,
    @CurrentUser() user: ValidatedServiceUser,
  ) {
    return this.analyticsService.getChatHistory(sessionId, user);
  }

  @Patch('chat/:sessionId/title')
  @Roles(UserRole.ADMIN)
  async renameSession(
    @Param('sessionId') sessionId: string,
    @Body() body: { title: string },
    @CurrentUser() user: ValidatedServiceUser,
  ) {
    return this.analyticsService.renameSession(sessionId, body.title, user);
  }

  @Patch('chat/:sessionId/archive')
  @Roles(UserRole.ADMIN)
  async archiveSession(
    @Param('sessionId') sessionId: string,
    @CurrentUser() user: ValidatedServiceUser,
  ) {
    return this.analyticsService.archiveSession(sessionId, user);
  }

  @Delete('chat/:sessionId')
  @Roles(UserRole.ADMIN)
  async deleteChatSession(
    @Param('sessionId') sessionId: string,
    @CurrentUser() user: ValidatedServiceUser,
  ) {
    return this.analyticsService.deleteChatSession(sessionId, user);
  }

  // ── Enhancement 3: National Summary & Batch Explain ───────────────

  @Get('national-summary')
  @Roles(UserRole.ADMIN)
  async nationalSummary(
    @Query('week') week?: string,
    @CurrentUser() user?: ValidatedServiceUser,
  ) {
    return this.analyticsService.getNationalSummary(week, user);
  }

  @Post('batch-explain')
  @Roles(UserRole.ADMIN)
  async batchExplain(
    @Body() body: { requests: any[] },
    @CurrentUser() user: ValidatedServiceUser,
  ) {
    return this.analyticsService.batchExplain(body.requests ?? [], user);
  }

  // ── Enhancement 2: RAG Corpus Management ──────────────────────────

  @Get('rag/status')
  async ragStatus() {
    return this.analyticsService.getRagStatus();
  }

  @Post('rag/ingest')
  @Roles(UserRole.ADMIN)
  async ragIngest(
    @Body() body: { documents: any[] },
    @CurrentUser() user: ValidatedServiceUser,
  ) {
    return this.analyticsService.ingestRagDocuments(body.documents ?? [], user);
  }

  @Get('rag/etl/status')
  async etlStatus() {
    return this.analyticsService.getEtlStatus();
  }

  @Post('rag/etl/run')
  @Roles(UserRole.ADMIN)
  async etlRun(@CurrentUser() user: ValidatedServiceUser) {
    return this.analyticsService.triggerEtlRun(user);
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
