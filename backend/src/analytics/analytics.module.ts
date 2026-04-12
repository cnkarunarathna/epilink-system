import { Module } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { AnalyticsController } from './analytics.controller';
import { PublicAnalyticsController } from './public-analytics.controller';
import { EventsModule } from '../events/events.module';
import { RolesGuard } from '../auth/guards/roles.guard';

@Module({
  imports: [EventsModule],
  providers: [AnalyticsService, RolesGuard],
  controllers: [AnalyticsController, PublicAnalyticsController],
})
export class AnalyticsModule {}
