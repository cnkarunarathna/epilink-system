import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ReportsService } from './reports.service';
import { WeeklyReport, ReportStatus } from './entities/weekly-report.entity';
import { AnalyticsService } from '../analytics/analytics.service';
import { StorageService } from '../storage/storage.service';
import { ReportPdfGenerator } from './pdf/report-pdf.generator';
import { EmailService } from '../email/email.service';

// Prevent the S3Client constructor from throwing on missing env vars
jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn().mockImplementation(() => ({ send: jest.fn().mockResolvedValue({}) })),
  DeleteObjectCommand: jest.fn().mockImplementation((input) => ({ input })),
}));

describe('ReportsService', () => {
  let service: ReportsService;

  const mockRepo = {
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    delete: jest.fn(),
  };

  const mockAnalyticsService = {
    getStoredWeekData: jest.fn().mockResolvedValue([]),
    getOutbreakAlertsForWeek: jest.fn().mockResolvedValue([]),
    getHotspots: jest.fn().mockResolvedValue([]),
    getDashboardSummary: jest.fn().mockResolvedValue({}),
    getNationalSummary: jest.fn().mockResolvedValue('situation report text'),
  };

  const mockStorageService = {
    uploadReportPdf: jest.fn().mockResolvedValue({ key: 'reports/week.pdf', signedUrl: 'https://signed.url/week.pdf' }),
    getSignedUrl: jest.fn().mockResolvedValue('https://signed.url/week.pdf'),
  };

  const mockPdfGenerator = {
    generate: jest.fn().mockResolvedValue(Buffer.from('pdf-content')),
  };

  const mockEmailService = {
    send: jest.fn().mockResolvedValue(undefined),
    sendToRole: jest.fn().mockResolvedValue(undefined),
  };

  const mockConfigService = {
    get: jest.fn(),
    getOrThrow: jest.fn().mockImplementation((key: string) => {
      const map: Record<string, string> = {
        AWS_REGION: 'ap-south-1',
        AWS_ACCESS_KEY_ID: 'key',
        AWS_SECRET: 'secret',
        AWS_S3_BUCKET: 'epilink-bucket',
      };
      return map[key] ?? 'mock-value';
    }),
  };

  const mockReport: Partial<WeeklyReport> = {
    id: 'report-uuid',
    year: 2026,
    weekNumber: 5,
    title: 'Weekly Report — Week 5, 2026',
    status: ReportStatus.PENDING,
    reportType: 'predicted',
    s3Key: 'reports/week-2026-W05.pdf',
    generatedAt: new Date('2026-02-01'),
    totalPredictedCases: 120,
    totalActualCases: null,
    totalForecastCases: 120,
    totalCurrentCases: null,
    totalDistricts: 25,
    highRiskDistricts: 3,
    reportData: { forecast: [], alerts: [] },
    createdById: 'creator-uuid',
    approvedById: null,
    approvedAt: null,
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReportsService,
        { provide: getRepositoryToken(WeeklyReport), useValue: mockRepo },
        { provide: AnalyticsService, useValue: mockAnalyticsService },
        { provide: StorageService, useValue: mockStorageService },
        { provide: ReportPdfGenerator, useValue: mockPdfGenerator },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: EmailService, useValue: mockEmailService },
      ],
    }).compile();

    service = module.get<ReportsService>(ReportsService);
  });

  // ── listReports ───────────────────────────────────────────────────────────

  describe('listReports', () => {
    it('should return all reports when no filters applied', async () => {
      mockRepo.find.mockResolvedValue([mockReport]);

      const result = await service.listReports();

      expect(result).toHaveLength(1);
      expect(mockRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({ order: { year: 'DESC', weekNumber: 'DESC' } }),
      );
    });

    it('should apply status filter', async () => {
      mockRepo.find.mockResolvedValue([]);

      await service.listReports({ status: 'approved' });

      expect(mockRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ status: 'approved' }) }),
      );
    });

    it('should apply year filter', async () => {
      mockRepo.find.mockResolvedValue([]);

      await service.listReports({ year: 2026 });

      expect(mockRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ year: 2026 }) }),
      );
    });
  });

  // ── getReport ─────────────────────────────────────────────────────────────

  describe('getReport', () => {
    it('should return the report when found', async () => {
      mockRepo.findOne.mockResolvedValue(mockReport);

      const result = await service.getReport('report-uuid');

      expect(result.id).toBe('report-uuid');
    });

    it('should throw NotFoundException when report not found', async () => {
      mockRepo.findOne.mockResolvedValue(null);

      await expect(service.getReport('bad-uuid')).rejects.toThrow(NotFoundException);
    });

    it('should normalise legacy forecast rows', async () => {
      const legacyReport = {
        ...mockReport,
        reportData: {
          forecast: [
            { district: 'Colombo', current_cases: 10, forecast: 5, avg_4week: 8, trend: 'Stable' },
          ],
        },
      };
      mockRepo.findOne.mockResolvedValue(legacyReport);

      const result = await service.getReport('report-uuid');

      expect(result.reportData.forecast[0]).toHaveProperty('reported_cases');
    });
  });

  // ── generateReport ────────────────────────────────────────────────────────

  describe('generateReport', () => {
    const dto = { year: 2025, weekNumber: 1 };
    const user = { id: 'creator-uuid', email: 'admin@test.com', name: 'Admin' };

    it('should throw ConflictException when report already exists', async () => {
      mockRepo.findOne.mockResolvedValue(mockReport); // duplicate

      await expect(service.generateReport(dto, user as any)).rejects.toThrow(ConflictException);
    });

    it('should generate PDF, upload to S3 and return report with downloadUrl', async () => {
      const savedFirst = { ...mockReport, id: 'new-uuid', s3Key: null, generatedAt: new Date() };
      const savedFinal = { ...savedFirst, s3Key: 'reports/week-2025-W01.pdf' };

      mockRepo.findOne.mockResolvedValue(null); // no duplicate
      mockRepo.create.mockReturnValue(savedFirst);
      mockRepo.save
        .mockResolvedValueOnce(savedFirst)  // initial save
        .mockResolvedValueOnce(savedFinal); // save after S3 upload

      const result = await service.generateReport(dto, user as any);

      expect(mockPdfGenerator.generate).toHaveBeenCalled();
      expect(mockStorageService.uploadReportPdf).toHaveBeenCalled();
      expect(result).toHaveProperty('downloadUrl');
    });

    it('should email admins and supervisors after generation', async () => {
      const saved = { ...mockReport, id: 'new-uuid', s3Key: null, generatedAt: new Date() };
      const final = { ...saved, s3Key: 'reports/file.pdf' };

      mockRepo.findOne.mockResolvedValue(null);
      mockRepo.create.mockReturnValue(saved);
      mockRepo.save.mockResolvedValueOnce(saved).mockResolvedValueOnce(final);

      await service.generateReport(dto, user as any);

      // Fire-and-forget; give microtask queue time to flush
      await Promise.resolve();
      expect(mockEmailService.sendToRole).toHaveBeenCalledTimes(2);
    });
  });

  // ── approveReport ─────────────────────────────────────────────────────────

  describe('approveReport', () => {
    const user = { id: 'approver-uuid', email: 'admin@test.com', name: 'Admin' };

    it('should set status to APPROVED and persist', async () => {
      const approved = { ...mockReport, status: ReportStatus.APPROVED, approvedAt: new Date() };
      mockRepo.findOne.mockResolvedValue({ ...mockReport }); // getReport
      mockRepo.save.mockResolvedValue(approved);
      mockStorageService.getSignedUrl.mockResolvedValue('https://signed.url/week.pdf');

      const result = await service.approveReport('report-uuid', user as any);

      expect(result.status).toBe(ReportStatus.APPROVED);
      expect(mockRepo.save).toHaveBeenCalled();
    });

    it('should throw NotFoundException if report not found', async () => {
      mockRepo.findOne.mockResolvedValue(null);

      await expect(service.approveReport('bad-uuid', user as any)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should notify supervisors after approval', async () => {
      const approved = { ...mockReport, status: ReportStatus.APPROVED, approvedAt: new Date() };
      mockRepo.findOne.mockResolvedValue({ ...mockReport });
      mockRepo.save.mockResolvedValue(approved);

      await service.approveReport('report-uuid', user as any);

      await Promise.resolve();
      expect(mockEmailService.sendToRole).toHaveBeenCalled();
    });
  });

  // ── getDownloadUrl ────────────────────────────────────────────────────────

  describe('getDownloadUrl', () => {
    it('should return signed URL for existing S3 key', async () => {
      mockRepo.findOne.mockResolvedValue(mockReport);

      const result = await service.getDownloadUrl('report-uuid');

      expect(result).toEqual({ url: 'https://signed.url/week.pdf' });
    });

    it('should throw NotFoundException when s3Key is null', async () => {
      mockRepo.findOne.mockResolvedValue({ ...mockReport, s3Key: null });

      await expect(service.getDownloadUrl('report-uuid')).rejects.toThrow(NotFoundException);
    });
  });

  // ── deleteReport ──────────────────────────────────────────────────────────

  describe('deleteReport', () => {
    it('should delete the report from DB', async () => {
      mockRepo.findOne.mockResolvedValue({ ...mockReport, s3Key: null });
      mockRepo.delete.mockResolvedValue({ affected: 1 });

      await service.deleteReport('report-uuid');

      expect(mockRepo.delete).toHaveBeenCalledWith('report-uuid');
    });

    it('should throw NotFoundException when report not found', async () => {
      mockRepo.findOne.mockResolvedValue(null);

      await expect(service.deleteReport('bad-uuid')).rejects.toThrow(NotFoundException);
    });
  });
});
