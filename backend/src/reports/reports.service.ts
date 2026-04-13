import {
  Injectable,
  Logger,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WeeklyReport, ReportStatus } from './entities/weekly-report.entity';
import { CreateReportDto } from './dto/create-report.dto';
import { AnalyticsService } from '../analytics/analytics.service';
import { StorageService } from '../storage/storage.service';
import { ReportPdfGenerator } from './pdf/report-pdf.generator';
import { ValidatedServiceUser } from '../common/service-headers.util';
import {
  DeleteObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);
  private readonly s3: S3Client;
  private readonly bucket: string;

  constructor(
    @InjectRepository(WeeklyReport)
    private readonly repo: Repository<WeeklyReport>,
    private readonly analyticsService: AnalyticsService,
    private readonly storageService: StorageService,
    private readonly pdfGenerator: ReportPdfGenerator,
    private readonly configService: ConfigService,
  ) {
    this.s3 = new S3Client({
      region: this.configService.getOrThrow<string>('AWS_REGION'),
      credentials: {
        accessKeyId: this.configService.getOrThrow<string>('AWS_ACCESS_KEY_ID'),
        secretAccessKey: this.configService.getOrThrow<string>('AWS_SECRET'),
      },
    });
    this.bucket = this.configService.getOrThrow<string>('AWS_S3_BUCKET');
  }

  async listReports(): Promise<WeeklyReport[]> {
    return this.repo.find({
      order: { year: 'DESC', weekNumber: 'DESC' },
      relations: ['approvedBy', 'createdBy'],
    });
  }

  async getReport(id: string): Promise<WeeklyReport> {
    const report = await this.repo.findOne({
      where: { id },
      relations: ['approvedBy', 'createdBy'],
    });
    if (!report) throw new NotFoundException(`Report ${id} not found`);
    return report;
  }

  async generateReport(
    dto: CreateReportDto,
    user: ValidatedServiceUser,
  ): Promise<WeeklyReport & { downloadUrl: string }> {
    // Guard: no duplicate
    const existing = await this.repo.findOne({
      where: { year: dto.year, weekNumber: dto.weekNumber },
    });
    if (existing) {
      throw new ConflictException(
        `A report for Week ${dto.weekNumber}, ${dto.year} already exists (id: ${existing.id}).`,
      );
    }

    // Compute ISO week date range (Monday–Sunday)
    const { startDate, endDate } = this.isoWeekDateRange(
      dto.year,
      dto.weekNumber,
    );

    // Determine if this is a historical (past) or predicted (current/future) report
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentWeek = this.getCurrentISOWeek(now);
    const isHistorical =
      dto.year < currentYear ||
      (dto.year === currentYear && dto.weekNumber < currentWeek);
    const reportType: 'historical' | 'predicted' = isHistorical
      ? 'historical'
      : 'predicted';

    const title = isHistorical
      ? `Weekly Dengue Historical Report — Week ${dto.weekNumber}, ${dto.year}`
      : `Weekly Dengue Surveillance & Prediction Report — Week ${dto.weekNumber}, ${dto.year}`;

    // Collect analytics data from the database for the requested week.
    // Both historical and predicted reports read directly from dengue_cases
    // for the specified (year, weekNumber) — the DB already holds actual
    // historical records for past weeks AND pre-computed predictions for
    // future weeks. No on-the-fly formula computation is needed.
    this.logger.log(
      `Generating ${reportType} report for Week ${dto.weekNumber} ${dto.year}`,
    );
    const weekLabel = `${dto.year}-W${String(dto.weekNumber).padStart(2, '0')}`;

    // For predicted reports, also fetch the previous week's actual totals so
    // we can show "Current Week (Actual)" alongside "Predicted (Next Week)".
    let prevYear = dto.year;
    let prevWeek = dto.weekNumber - 1;
    if (prevWeek === 0) {
      prevYear -= 1;
      prevWeek = 52; // safe fallback; 53-week years are rare
    }

    const [forecast, alerts, hotspots, summary, nationalSummary, prevWeekData] =
      await Promise.all([
        // Always read stored cases for the target week — no formula re-computation
        this.analyticsService.getActualWeekData(dto.year, dto.weekNumber),
        this.analyticsService.getOutbreakAlertsForWeek(dto.year, dto.weekNumber),
        this.analyticsService.getHotspots(),
        this.analyticsService.getDashboardSummary(),
        this.analyticsService.getNationalSummary(weekLabel, user),
        // Previous week data (used for totalCurrentCases in predicted reports)
        isHistorical
          ? Promise.resolve([])
          : this.analyticsService.getActualWeekData(prevYear, prevWeek),
      ]);

    const forecastArr = Array.isArray(forecast) ? forecast : [];
    const alertsArr = Array.isArray(alerts) ? alerts : [];

    // Sum stored cases for the target week
    const totalPredictedCases = forecastArr.reduce(
      (sum: number, d: any) => sum + (Number(d.forecast) || 0),
      0,
    );
    // For predicted reports: sum the previous week's actual cases so the UI
    // can display "Current Week (Actual)" vs "Predicted (Next Week)"
    const prevWeekArr = Array.isArray(prevWeekData) ? prevWeekData : [];
    const totalCurrentCases = isHistorical
      ? undefined
      : prevWeekArr.reduce(
          (sum: number, d: any) => sum + (Number(d.current_cases) || 0),
          0,
        );
    const totalDistricts = forecastArr.length;
    const highRiskDistricts = forecastArr.filter(
      (d: any) => d.trend === 'Rising',
    ).length;

    // Save initial record (no s3_key yet)
    const report = this.repo.create({
      year: dto.year,
      weekNumber: dto.weekNumber,
      startDate,
      endDate,
      title,
      status: ReportStatus.PENDING,
      totalPredictedCases,
      totalDistricts,
      highRiskDistricts,
      reportData: {
        reportType,
        totalCurrentCases,
        forecast: forecastArr,
        alerts: alertsArr,
        hotspots,
        summary,
        nationalSummary,
      },
      createdById: user.id,
    });

    const saved = await this.repo.save(report);

    // Generate PDF
    this.logger.log(`Building PDF for report ${saved.id}`);
    const nationalText =
      typeof nationalSummary === 'string'
        ? nationalSummary
        : (nationalSummary as any)?.situation_report ?? '';

    const pdfBuffer = await this.pdfGenerator.generate({
      title,
      year: dto.year,
      weekNumber: dto.weekNumber,
      startDate,
      endDate,
      reportType,
      totalPredictedCases,
      totalCurrentCases,
      totalDistricts,
      highRiskDistricts,
      generatedAt: saved.generatedAt.toISOString(),
      forecast: forecastArr,
      alerts: alertsArr,
      nationalSummary: nationalText,
    });

    // Upload to S3
    const filename = `week-${dto.year}-W${String(dto.weekNumber).padStart(2, '0')}.pdf`;
    const { key, signedUrl } = await this.storageService.uploadReportPdf(
      pdfBuffer,
      filename,
    );

    // Persist the S3 key
    saved.s3Key = key;
    const final = await this.repo.save(saved);

    return { ...final, downloadUrl: signedUrl };
  }

  async approveReport(
    id: string,
    user: ValidatedServiceUser,
  ): Promise<WeeklyReport> {
    const report = await this.getReport(id);
    report.status = ReportStatus.APPROVED;
    report.approvedById = user.id;
    report.approvedAt = new Date();
    return this.repo.save(report);
  }

  async getDownloadUrl(id: string): Promise<{ url: string }> {
    const report = await this.getReport(id);
    if (!report.s3Key) {
      throw new NotFoundException(`PDF not yet generated for report ${id}`);
    }
    const url = await this.storageService.getSignedUrl(report.s3Key);
    return { url };
  }

  async deleteReport(id: string): Promise<void> {
    const report = await this.getReport(id);

    // Remove S3 object if present
    if (report.s3Key) {
      try {
        await this.s3.send(
          new DeleteObjectCommand({ Bucket: this.bucket, Key: report.s3Key }),
        );
      } catch (err) {
        this.logger.warn(`Failed to delete S3 object ${report.s3Key}: ${err}`);
      }
    }

    await this.repo.delete(id);
  }

  // ── Helpers ──────────────────────────────────────────────────────────

  /** Returns the ISO 8601 week number for the given date. */
  private getCurrentISOWeek(date: Date): number {
    const jan4 = new Date(date.getFullYear(), 0, 4);
    const dayOfWeek = jan4.getDay() || 7;
    const weekOneMonday = new Date(jan4);
    weekOneMonday.setDate(jan4.getDate() - dayOfWeek + 1);
    const diff = date.getTime() - weekOneMonday.getTime();
    return Math.max(1, Math.floor(diff / (7 * 24 * 60 * 60 * 1000)) + 1);
  }

  private isoWeekDateRange(
    year: number,
    week: number,
  ): { startDate: string; endDate: string } {
    // ISO 8601: Week 1 is the week containing the first Thursday of January.
    // Monday = day 1 of the week.
    const jan4 = new Date(year, 0, 4); // Jan 4 is always in week 1
    const dayOfWeek = jan4.getDay() || 7; // 1=Mon … 7=Sun
    const monday = new Date(jan4);
    monday.setDate(jan4.getDate() - dayOfWeek + 1 + (week - 1) * 7);

    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);

    return {
      startDate: this.formatDate(monday),
      endDate: this.formatDate(sunday),
    };
  }

  private formatDate(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }
}
