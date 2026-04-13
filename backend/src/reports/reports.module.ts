import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WeeklyReport } from './entities/weekly-report.entity';
import { ReportsService } from './reports.service';
import { ReportsController } from './reports.controller';
import { ReportPdfGenerator } from './pdf/report-pdf.generator';
import { AnalyticsModule } from '../analytics/analytics.module';
import { StorageModule } from '../storage/storage.module';
import { RolesGuard } from '../auth/guards/roles.guard';

@Module({
  imports: [
    TypeOrmModule.forFeature([WeeklyReport]),
    AnalyticsModule,
    StorageModule,
  ],
  providers: [ReportsService, ReportPdfGenerator, RolesGuard],
  controllers: [ReportsController],
})
export class ReportsModule {}
