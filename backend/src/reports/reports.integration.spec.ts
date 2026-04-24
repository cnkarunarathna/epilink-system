import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule, getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource, Repository } from 'typeorm';
import { ReportsService } from './reports.service';
import { WeeklyReport, ReportStatus } from './entities/weekly-report.entity';
import { AnalyticsService } from '../analytics/analytics.service';
import { StorageService } from '../storage/storage.service';
import { ReportPdfGenerator } from './pdf/report-pdf.generator';
import { EmailService } from '../email/email.service';
import { ALL_ENTITIES } from '../../test/helpers/database.helper';

const HAS_DB = !!process.env.TEST_DATABASE_URL;
const DB_URL =
  process.env.TEST_DATABASE_URL ||
  'postgres://test:test@localhost:5432/epilink_test';

(HAS_DB ? describe : describe.skip)('ReportsService Integration', () => {
  let module: TestingModule;
  let reportsService: ReportsService;
  let reportRepo: Repository<WeeklyReport>;
  let dataSource: DataSource;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'postgres',
          url: DB_URL,
          entities: ALL_ENTITIES,
          synchronize: true,
          dropSchema: true,
          logging: false,
        }),
        TypeOrmModule.forFeature([WeeklyReport]),
      ],
      providers: [
        ReportsService,
        {
          provide: AnalyticsService,
          useValue: {
            getStoredWeekData: jest.fn().mockResolvedValue([]),
            getOutbreakAlertsForWeek: jest.fn().mockResolvedValue([]),
            getHotspots: jest.fn().mockResolvedValue([]),
            getDashboardSummary: jest.fn().mockResolvedValue({}),
            getNationalSummary: jest.fn().mockResolvedValue(''),
          },
        },
        {
          provide: StorageService,
          useValue: {
            uploadBuffer: jest.fn().mockResolvedValue('s3/key/report.pdf'),
            getSignedUrl: jest.fn().mockResolvedValue('https://signed-url'),
          },
        },
        {
          provide: ReportPdfGenerator,
          useValue: {
            generate: jest.fn().mockResolvedValue(Buffer.from('pdf')),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue('us-east-1'),
            getOrThrow: jest.fn((key: string) => {
              const values: Record<string, string> = {
                AWS_REGION: 'us-east-1',
                AWS_ACCESS_KEY_ID: 'test-key-id',
                AWS_SECRET: 'test-secret',
                AWS_S3_BUCKET: 'test-bucket',
              };
              return values[key] ?? 'test-value';
            }),
          },
        },
        {
          provide: EmailService,
          useValue: { send: jest.fn().mockResolvedValue(undefined) },
        },
      ],
    }).compile();

    reportsService = module.get<ReportsService>(ReportsService);
    reportRepo = module.get<Repository<WeeklyReport>>(
      getRepositoryToken(WeeklyReport),
    );
    dataSource = module.get<DataSource>(DataSource);
  });

  afterAll(async () => {
    await module.close();
  });

  beforeEach(async () => {
    await dataSource.manager.query(
      'TRUNCATE TABLE "weekly_reports" RESTART IDENTITY CASCADE',
    );
  });

  function buildReport(
    overrides: Partial<{
      year: number;
      weekNumber: number;
      status: ReportStatus;
    }> = {},
  ): Partial<WeeklyReport> {
    return {
      year: overrides.year ?? 2024,
      weekNumber: overrides.weekNumber ?? 10,
      startDate: '2024-03-04',
      endDate: '2024-03-10',
      title: `Test Report W${overrides.weekNumber ?? 10} ${overrides.year ?? 2024}`,
      status: overrides.status ?? ReportStatus.PENDING,
      reportType: 'predicted',
      totalPredictedCases: 50,
      totalDistricts: 5,
      highRiskDistricts: 1,
      reportData: { forecast: [], alerts: [] },
    };
  }

  describe('listReports', () => {
    it('should return an empty array when no reports exist', async () => {
      const result = await reportsService.listReports();
      expect(result).toEqual([]);
    });

    it('should return all seeded reports ordered by year and week descending', async () => {
      await reportRepo.save([
        reportRepo.create(buildReport({ year: 2024, weekNumber: 8 })),
        reportRepo.create(buildReport({ year: 2024, weekNumber: 10 })),
        reportRepo.create(buildReport({ year: 2024, weekNumber: 9 })),
      ]);

      const result = await reportsService.listReports();

      expect(result.length).toBe(3);
      expect(result[0].weekNumber).toBe(10);
      expect(result[1].weekNumber).toBe(9);
      expect(result[2].weekNumber).toBe(8);
    });

    it('should filter by status when provided', async () => {
      await reportRepo.save([
        reportRepo.create(buildReport({ weekNumber: 1, status: ReportStatus.PENDING })),
        reportRepo.create(buildReport({ weekNumber: 2, status: ReportStatus.APPROVED })),
        reportRepo.create(buildReport({ weekNumber: 3, status: ReportStatus.PENDING })),
      ]);

      const result = await reportsService.listReports({ status: 'pending' });
      expect(result.length).toBe(2);
      result.forEach((r) => expect(r.status).toBe(ReportStatus.PENDING));
    });
  });

  describe('getReport', () => {
    it('should throw NotFoundException when the report does not exist', async () => {
      await expect(
        reportsService.getReport('00000000-0000-0000-0000-000000000000'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should return the report when it exists in the database', async () => {
      const saved = await reportRepo.save(
        reportRepo.create(buildReport()),
      );

      const result = await reportsService.getReport(saved.id);

      expect(result.id).toBe(saved.id);
      expect(result.weekNumber).toBe(10);
      expect(result.year).toBe(2024);
    });
  });
});
