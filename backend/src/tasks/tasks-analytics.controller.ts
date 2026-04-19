import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../entities/user.entity';
import { TasksAnalyticsService } from './tasks-analytics.service';

@Controller('tasks/analytics')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class TasksAnalyticsController {
  constructor(private readonly analyticsService: TasksAnalyticsService) {}

  @Get('national-summary')
  getNationalSummary(@Query('districtId') districtId?: string) {
    return this.analyticsService.getNationalSummary(
      districtId ? parseInt(districtId, 10) : undefined,
    );
  }

  @Get('by-district')
  getByDistrict(@Query('from') from?: string, @Query('to') to?: string) {
    return this.analyticsService.getByDistrict(from, to);
  }

  @Get('by-status')
  getByStatus(@Query('districtId') districtId?: string) {
    return this.analyticsService.getByStatus(
      districtId ? parseInt(districtId, 10) : undefined,
    );
  }

  @Get('by-type')
  getByType(@Query('districtId') districtId?: string) {
    return this.analyticsService.getByType(
      districtId ? parseInt(districtId, 10) : undefined,
    );
  }

  @Get('by-priority')
  getByPriority(@Query('districtId') districtId?: string) {
    return this.analyticsService.getByPriority(
      districtId ? parseInt(districtId, 10) : undefined,
    );
  }

  @Get('trend')
  getTrend(
    @Query('period') period?: 'day' | 'week' | 'month',
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('districtId') districtId?: string,
  ) {
    return this.analyticsService.getTrend(
      period ?? 'day',
      from,
      to,
      districtId ? parseInt(districtId, 10) : undefined,
    );
  }

  @Get('supervisors')
  getSupervisorMetrics(@Query('districtId') districtId?: string) {
    return this.analyticsService.getSupervisorMetrics(
      districtId ? parseInt(districtId, 10) : undefined,
    );
  }

  @Get('phis')
  getPhiMetrics(@Query('districtId') districtId?: string) {
    return this.analyticsService.getPhiMetrics(
      districtId ? parseInt(districtId, 10) : undefined,
    );
  }

  @Get('overdue')
  getOverdueTasks(@Query('districtId') districtId?: string) {
    return this.analyticsService.getOverdueTasks(
      districtId ? parseInt(districtId, 10) : undefined,
    );
  }

  @Get('evidence-review')
  getEvidenceReview(@Query('districtId') districtId?: string) {
    return this.analyticsService.getEvidenceReview(
      districtId ? parseInt(districtId, 10) : undefined,
    );
  }
}
