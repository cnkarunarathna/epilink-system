import {
  Injectable,
  Logger,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOptionsWhere } from 'typeorm';
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
import { EmailService } from '../email/email.service';
import { UserRole } from '../entities/user.entity';

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
    private readonly emailService: EmailService,
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

  async listReports(filters?: {
    status?: string;
    type?: string;
    year?: number;
  }): Promise<WeeklyReport[]> {
    const where: FindOptionsWhere<WeeklyReport> = {};
    if (filters?.status) where.status = filters.status as any;
    if (filters?.type) where.reportType = filters.type as any;
    if (filters?.year) where.year = filters.year;

    return this.repo.find({
      where: Object.keys(where).length ? where : undefined,
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
    // Normalise forecast rows saved before the ENH-01 field rename so older
    // reports surface the same shape (reported_cases / predicted_cases) as new ones.
    if (Array.isArray(report.reportData?.forecast)) {
      report.reportData.forecast = this.normaliseForecastRows(
        report.reportData.forecast,
        report.reportType,
      );
    }
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
      prevWeek = this.getLastISOWeek(prevYear); // correctly handles 52- and 53-week years
    }

    const [forecast, alerts, hotspots, summary, nationalSummary, prevWeekData] =
      await Promise.all([
        // Always read stored cases for the target week — no formula re-computation
        this.analyticsService.getActualWeekData(dto.year, dto.weekNumber),
        this.analyticsService.getOutbreakAlertsForWeek(dto.year, dto.weekNumber),
        this.analyticsService.getHotspots(dto.year, dto.weekNumber),
        this.analyticsService.getDashboardSummary(dto.year, dto.weekNumber),
        this.analyticsService.getNationalSummary(weekLabel, user),
        // Always fetch previous week data — used for per-district current_cases
        // enrichment (both historical and predicted) and totalCurrentCases stat
        this.analyticsService.getActualWeekData(prevYear, prevWeek),
      ]);

    // Raw rows from the target week: forecast = actual_cases (same as current_cases)
    const rawForecastArr = Array.isArray(forecast) ? forecast : [];
    const alertsArr = Array.isArray(alerts) ? alerts : [];

    // Compute totals from raw values before per-district enrichment
    const totalPredictedCases = rawForecastArr.reduce(
      (sum: number, d: any) => sum + (Number(d.forecast) || 0),
      0,
    );
    const prevWeekArr = Array.isArray(prevWeekData) ? prevWeekData : [];
    // For predicted reports: sum the previous week's actual cases so the UI
    // can display "Current Week (Actual)" vs "Predicted (Next Week)"
    const totalCurrentCases = isHistorical
      ? undefined
      : prevWeekArr.reduce(
          (sum: number, d: any) => sum + (Number(d.current_cases) || 0),
          0,
        );

    // Build per-district rows with stable, type-specific field names so every
    // consumer reads the same field for the same concept regardless of reportType.
    //
    // Historical:  reported_cases = this week's actual | prior_cases = prior week actual
    // Predicted:   reported_cases = prior week actual  | predicted_cases = model output
    const prevByDistrict = new Map<string, number>(
      prevWeekArr.map((r: any) => [r.district as string, Number(r.current_cases) || 0]),
    );
    const forecastArr = rawForecastArr.map((row: any) => {
      const priorActual = prevByDistrict.get(row.district) ?? null;
      if (isHistorical) {
        return {
          district:       row.district,
          reported_cases: Number(row.current_cases) || 0,
          prior_cases:    priorActual,
          avg_4week:      row.avg_4week,
          trend:          row.trend,
          confidence:     'actual' as const,
        };
      }
      return {
        district:        row.district,
        reported_cases:  priorActual,
        predicted_cases: Number(row.forecast) || 0,
        avg_4week:       row.avg_4week,
        trend:           row.trend,
        confidence:      'medium' as const,
      };
    });
    const totalDistricts = forecastArr.length;
    // Rising trend: cases > prior 4-week avg × 1.3 — matches the anchored
    // high_risk CTE in getDashboardSummary so both numbers agree in reports.
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
      reportType,
      totalPredictedCases,
      totalActualCases:   isHistorical ? totalPredictedCases : null,
      totalForecastCases: isHistorical ? null : totalPredictedCases,
      totalCurrentCases: totalCurrentCases ?? null,
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
      totalActualCases:   isHistorical ? totalPredictedCases : undefined,
      totalForecastCases: isHistorical ? undefined : totalPredictedCases,
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

    // Email admins and supervisors — report ready for review
    const reportEmailContext = {
      reportTitle: final.title,
      weekNumber: dto.weekNumber,
      year: dto.year,
      reportType: final.reportType,
      totalPredictedCases: final.totalPredictedCases,
      totalActualCases: final.totalActualCases,
      totalForecastCases: final.totalForecastCases,
      totalCurrentCases: final.totalCurrentCases,
      highRiskDistricts: final.highRiskDistricts,
      totalDistricts: final.totalDistricts,
      reportUrl: signedUrl,
    };
    const reportEmailSubject = `Weekly Epidemiological Report Ready — Week ${dto.weekNumber}, ${dto.year}`;

    this.emailService
      .sendToRole(UserRole.ADMIN, {
        subject: reportEmailSubject,
        template: 'report-generated',
        context: reportEmailContext,
        notificationCategory: 'reportReady',
        relatedEntityType: 'report',
        relatedEntityId: final.id,
        triggeredByUserId: user.id,
      })
      .catch(() => {});

    this.emailService
      .sendToRole(UserRole.SUPERVISOR, {
        subject: reportEmailSubject,
        template: 'report-generated',
        context: reportEmailContext,
        notificationCategory: 'reportReady',
        relatedEntityType: 'report',
        relatedEntityId: final.id,
        triggeredByUserId: user.id,
      })
      .catch(() => {});

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
    const saved = await this.repo.save(report);

    // Get a fresh signed download URL (7-day expiry from StorageService)
    let downloadUrl = '';
    if (saved.s3Key) {
      try {
        downloadUrl = await this.storageService.getSignedUrl(saved.s3Key);
      } catch {
        // non-fatal — email still goes out without the link
      }
    }

    const approvedAtFormatted = new Date(saved.approvedAt!).toLocaleDateString(
      'en-US',
      { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' },
    );
    const approvalContext = {
      reportTitle: saved.title,
      weekNumber: saved.weekNumber,
      year: saved.year,
      approvedBy: user.name ?? user.email,
      approvedAt: approvedAtFormatted,
      highRiskDistricts: saved.highRiskDistricts,
      totalDistricts: saved.totalDistricts,
      downloadUrl,
    };
    const approvalSubject = `Weekly Report Approved — Week ${saved.weekNumber}, ${saved.year}`;

    // Notify report creator
    if (saved.createdBy?.email) {
      this.emailService
        .send({
          to: saved.createdBy.email,
          subject: approvalSubject,
          template: 'report-approved',
          context: { ...approvalContext, recipientName: saved.createdBy.name ?? 'Admin' },
          notificationCategory: 'reportReady',
          relatedEntityType: 'report',
          relatedEntityId: saved.id,
          triggeredByUserId: user.id,
        })
        .catch(() => {});
    }

    // Notify all supervisors
    this.emailService
      .sendToRole(UserRole.SUPERVISOR, {
        subject: approvalSubject,
        template: 'report-approved',
        context: { ...approvalContext, recipientName: 'Supervisor' },
        notificationCategory: 'reportReady',
        relatedEntityType: 'report',
        relatedEntityId: saved.id,
        triggeredByUserId: user.id,
      })
      .catch(() => {});

    return saved;
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

  /** Maps legacy forecast row field names to the ENH-01 stable shape. */
  private normaliseForecastRows(rows: any[], reportType: string): any[] {
    return rows.map((r) => {
      if ('reported_cases' in r) return r;
      if (reportType === 'historical') {
        return {
          district:       r.district,
          reported_cases: r.current_cases ?? 0,
          prior_cases:    r.forecast ?? null,
          avg_4week:      r.avg_4week,
          trend:          r.trend,
          confidence:     'actual',
        };
      }
      return {
        district:        r.district,
        reported_cases:  r.current_cases ?? null,
        predicted_cases: r.forecast ?? 0,
        avg_4week:       r.avg_4week,
        trend:           r.trend,
        confidence:      'medium',
      };
    });
  }

  /** Returns the ISO 8601 week number for the given date. */
  private getCurrentISOWeek(date: Date): number {
    const jan4 = new Date(date.getFullYear(), 0, 4);
    const dayOfWeek = jan4.getDay() || 7;
    const weekOneMonday = new Date(jan4);
    weekOneMonday.setDate(jan4.getDate() - dayOfWeek + 1);
    const diff = date.getTime() - weekOneMonday.getTime();
    return Math.max(1, Math.floor(diff / (7 * 24 * 60 * 60 * 1000)) + 1);
  }

  /**
   * Returns the last ISO 8601 week number of the given year (52 or 53).
   * Dec 28 is always in the last ISO week of any year.
   */
  private getLastISOWeek(year: number): number {
    return this.getCurrentISOWeek(new Date(year, 11, 28));
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
