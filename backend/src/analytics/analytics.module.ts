import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AnalyticsService } from './analytics.service';
import { AnalyticsController } from './analytics.controller';
import { PublicAnalyticsController } from './public-analytics.controller';
import { PublicDashboardGuard } from './guards/public-dashboard.guard';
import { EventsModule } from '../events/events.module';
import { RolesGuard } from '../auth/guards/roles.guard';
import { SystemSettings } from '../entities/system-settings.entity';

@Module({
  imports: [EventsModule, TypeOrmModule.forFeature([SystemSettings])],
  providers: [AnalyticsService, RolesGuard, PublicDashboardGuard],
  controllers: [AnalyticsController, PublicAnalyticsController],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
