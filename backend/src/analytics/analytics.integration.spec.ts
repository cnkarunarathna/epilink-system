import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { AnalyticsService } from './analytics.service';
import { District } from '../entities/district.entity';
import { DengueCase } from '../entities/dengue_case.entity';
import { EventsGateway } from '../events/events.gateway';
import { CacheHelperService } from '../cache/cache-helper.service';
import { ALL_ENTITIES } from '../../test/helpers/database.helper';

jest.mock('axios');
import axios from 'axios';
const mockedAxios = axios as jest.Mocked<typeof axios>;

const HAS_DB = !!process.env.TEST_DATABASE_URL;
const DB_URL =
  process.env.TEST_DATABASE_URL ||
  'postgres://test:test@localhost:5432/epilink_test';

(HAS_DB ? describe : describe.skip)('AnalyticsService Integration', () => {
  let module: TestingModule;
  let analyticsService: AnalyticsService;
  let dataSource: DataSource;

  beforeAll(async () => {
    mockedAxios.post = jest.fn().mockRejectedValue(new Error('ML service unavailable'));
    mockedAxios.get = jest.fn().mockRejectedValue(new Error('ML service unavailable'));

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
      ],
      providers: [
        AnalyticsService,
        {
          provide: EventsGateway,
          useValue: { emitAnalyticsUpdated: jest.fn() },
        },
        {
          provide: CacheHelperService,
          useValue: {
            get: jest.fn().mockResolvedValue(null),
            set: jest.fn().mockResolvedValue(undefined),
            del: jest.fn().mockResolvedValue(undefined),
            delByPattern: jest.fn().mockResolvedValue(undefined),
            getOrRefresh: jest
              .fn()
              .mockImplementation((_key: string, _ttl: number, fn: () => unknown) =>
                fn(),
              ),
          },
        },
      ],
    }).compile();

    analyticsService = module.get<AnalyticsService>(AnalyticsService);
    dataSource = module.get<DataSource>(DataSource);
  });

  afterAll(async () => {
    await module.close();
  });

  beforeEach(async () => {
    await dataSource.manager.query(
      'TRUNCATE TABLE "dengue_cases", "weather_data", "districts" RESTART IDENTITY CASCADE',
    );
  });

  describe('getLatestWeekPerDistrict', () => {
    it('should return an empty array when the dengue_cases table is empty', async () => {
      const result = await analyticsService.getLatestWeekPerDistrict();
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(0);
    });

    it('should return one row per district with the most recent week when data is seeded', async () => {
      const districtRepo = dataSource.getRepository(District);
      const caseRepo = dataSource.getRepository(DengueCase);

      const district = await districtRepo.save({
        name: 'Colombo',
        latitude: 6.9271,
        longitude: 79.8612,
      });

      await caseRepo.save([
        { district, year: 2024, week: 10, cases: 15 },
        { district, year: 2024, week: 11, cases: 22 },
      ]);

      const result = await analyticsService.getLatestWeekPerDistrict();

      expect(result.length).toBe(1);
      expect(result[0].district).toBe('Colombo');
      expect(result[0].week).toBe(11);
      expect(result[0].predicted_cases).toBe(22);
    });
  });

  describe('getTimeSeries', () => {
    it('should return an empty array for a district that does not exist', async () => {
      const result = await analyticsService.getTimeSeries('UnknownDistrict');
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(0);
    });

    it('should return ordered rows for a seeded district', async () => {
      const districtRepo = dataSource.getRepository(District);
      const caseRepo = dataSource.getRepository(DengueCase);

      const district = await districtRepo.save({
        name: 'Kandy',
        latitude: 7.2906,
        longitude: 80.6337,
      });

      await caseRepo.save([
        { district, year: 2024, week: 5, cases: 8 },
        { district, year: 2024, week: 6, cases: 12 },
      ]);

      const result = await analyticsService.getTimeSeries('Kandy');

      expect(result.length).toBe(2);
      expect(result[0].week).toBe(5);
      expect(result[0].cases).toBe(8);
      expect(result[1].week).toBe(6);
      expect(result[1].cases).toBe(12);
    });
  });
});
