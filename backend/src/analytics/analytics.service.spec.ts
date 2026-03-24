import { Test, TestingModule } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { AnalyticsService } from './analytics.service';
import { EventsGateway } from '../events/events.gateway';
import axios from 'axios';

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('AnalyticsService', () => {
  let analyticsService: AnalyticsService;
  let dataSource: jest.Mocked<DataSource>;
  let eventsGateway: jest.Mocked<EventsGateway>;

  const mockManager = {
    query: jest.fn(),
    getRepository: jest.fn(),
  };

  const mockDataSource = {
    manager: mockManager,
  };

  const mockEventsGateway = {
    emitAnalyticsUpdated: jest.fn(),
    emitUserCreated: jest.fn(),
    emitUserUpdated: jest.fn(),
    emitUserDeleted: jest.fn(),
    emitUserStatusChanged: jest.fn(),
    emitNotification: jest.fn(),
    emitToUser: jest.fn(),
    getConnectedClients: jest.fn().mockReturnValue(0),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnalyticsService,
        {
          provide: getDataSourceToken(),
          useValue: mockDataSource,
        },
        {
          provide: EventsGateway,
          useValue: mockEventsGateway,
        },
      ],
    }).compile();

    analyticsService = module.get<AnalyticsService>(AnalyticsService);
    dataSource = module.get(getDataSourceToken());
    eventsGateway = module.get(EventsGateway);
  });

  describe('getLatestWeekPerDistrict', () => {
    it('should return latest week data per district', async () => {
      const mockData = [
        {
          name: 'Colombo',
          cases: 100,
          year: 2026,
          week: 1,
          latitude: '6.9271',
          longitude: '79.8612',
          temperature_2m_mean: '28.5',
          precipitation_sum: '15.2',
        },
        {
          name: 'Gampaha',
          cases: 80,
          year: 2026,
          week: 1,
          latitude: '7.0917',
          longitude: '79.9978',
          temperature_2m_mean: '27.8',
          precipitation_sum: '12.0',
        },
      ];
      mockManager.query.mockResolvedValue(mockData);

      const result = await analyticsService.getLatestWeekPerDistrict();

      expect(result).toHaveLength(2);
      expect(result[0]).toHaveProperty('district', 'Colombo');
      expect(result[0]).toHaveProperty('predicted_cases', 100);
      expect(result[0]).toHaveProperty('latitude');
      expect(result[0]).toHaveProperty('longitude');
    });
  });

  describe('getTimeSeries', () => {
    it('should return time series for a district', async () => {
      mockManager.getRepository.mockReturnValue({
        findOne: jest.fn().mockResolvedValue({ id: 'district-1' }),
      });
      mockManager.query.mockResolvedValue([
        {
          year: 2026,
          week: 1,
          cases: 50,
          temperature_2m_mean: '28.0',
          precipitation_sum: '10.0',
        },
      ]);

      const result = await analyticsService.getTimeSeries('Colombo');

      expect(result).toHaveLength(1);
      expect(result[0]).toHaveProperty('year', 2026);
      expect(result[0]).toHaveProperty('week', 1);
      expect(result[0]).toHaveProperty('cases', 50);
    });

    it('should return empty array for non-existent district', async () => {
      mockManager.getRepository.mockReturnValue({
        findOne: jest.fn().mockResolvedValue(null),
      });

      const result = await analyticsService.getTimeSeries('NonExistent');

      expect(result).toEqual([]);
    });
  });

  describe('getDashboardSummary', () => {
    it('should return dashboard summary data', async () => {
      mockManager.query.mockResolvedValue([
        {
          year: 2026,
          week: 1,
          total_cases: '500',
          district_count: '25',
          previous_total: '450',
          change_percent: '11.11',
          high_risk_districts: '8',
          avg_temp: '28.5',
        },
      ]);

      const result = await analyticsService.getDashboardSummary();

      expect(result).toHaveProperty('current_week');
      expect(result.current_week).toEqual({ year: 2026, week: 1 });
      expect(result).toHaveProperty('total_cases', 500);
      expect(result).toHaveProperty('high_risk_districts', 8);
      expect(result).toHaveProperty('avg_temperature', 28.5);
    });

    it('should return default values when no data', async () => {
      mockManager.query.mockResolvedValue([]);

      const result = await analyticsService.getDashboardSummary();

      expect(result.total_cases).toBe(0);
      expect(result.current_week.year).toBeNull();
    });
  });

  describe('getTrends', () => {
    it('should return trend data for specified weeks', async () => {
      mockManager.query.mockResolvedValue([
        {
          year: 2026,
          week: 1,
          total_cases: '500',
          avg_temp: '28.0',
          avg_precip: '15.0',
        },
        {
          year: 2025,
          week: 52,
          total_cases: '480',
          avg_temp: '27.5',
          avg_precip: '12.0',
        },
      ]);

      const result = await analyticsService.getTrends(2);

      expect(result).toHaveLength(2);
      // Results should be reversed (oldest first)
      expect(result[0].week).toBe(52);
      expect(result[1].week).toBe(1);
    });
  });

  describe('predictBulkFromML', () => {
    it('should call ML service and emit WebSocket event', async () => {
      mockManager.query.mockResolvedValue([
        {
          district: 'Colombo',
          lag1: 100,
          lag2: 90,
          lag3: 85,
          mean4: 91.25,
          temperature_2m_mean: 28.5,
          precipitation_sum: 15.0,
        },
      ]);

      mockedAxios.post.mockResolvedValue({
        data: [{ district: 'Colombo', predicted_cases: 105 }],
      });

      const result = await analyticsService.predictBulkFromML();

      expect(mockedAxios.post).toHaveBeenCalledWith(
        expect.stringContaining('/predict/bulk'),
        expect.any(Object),
      );
      expect(mockEventsGateway.emitAnalyticsUpdated).toHaveBeenCalledWith({
        type: 'predictions',
        payload: { count: 1 },
      });
      expect(result).toHaveLength(1);
    });
  });

  describe('getGrowthRate', () => {
    it('should return growth rate data for all districts', async () => {
      mockManager.query.mockResolvedValue([
        {
          district: 'Colombo',
          avg_growth_rate: '15.5',
          current_cases: '120',
          prev_cases: '100',
        },
        {
          district: 'Gampaha',
          avg_growth_rate: '-5.0',
          current_cases: '80',
          prev_cases: '85',
        },
      ]);

      const result = await analyticsService.getGrowthRate(4);

      expect(result).toHaveLength(2);
      expect(result[0].trend).toBe('increasing');
      expect(result[1].trend).toBe('stable');
    });
  });

  describe('getHotspots', () => {
    it('should return hotspot districts', async () => {
      mockManager.query.mockResolvedValue([
        {
          district: 'Colombo',
          current_cases: '150',
          previous_cases: '100',
          growth_rate: '50',
          latitude: '6.9271',
          longitude: '79.8612',
          severity: 'critical',
        },
      ]);

      const result = await analyticsService.getHotspots();

      expect(result).toHaveLength(1);
      expect(result[0].severity).toBe('critical');
      expect(result[0].current_cases).toBe(150);
    });
  });

  describe('getOutbreakAlerts', () => {
    it('should return outbreak alerts', async () => {
      mockManager.query.mockResolvedValue([
        {
          district: 'Colombo',
          current_cases: '200',
          avg_cases: '80',
          alert_level: 'Outbreak Alert',
          description: 'Cases doubled compared to 4-week average',
        },
      ]);

      const result = await analyticsService.getOutbreakAlerts();

      expect(result).toHaveLength(1);
      expect(result[0].alert_level).toBe('Outbreak Alert');
      expect(result[0].severity).toBe('critical');
    });
  });

  describe('getWeatherCorrelation', () => {
    it('should return weather correlation data', async () => {
      mockManager.query.mockResolvedValue([
        {
          district: 'Colombo',
          temp_correlation: '0.75',
          precip_correlation: '0.45',
          avg_cases: '100',
          avg_temp: '28.5',
          avg_precip: '15.0',
          data_points: '52',
        },
      ]);

      const result = await analyticsService.getWeatherCorrelation();

      expect(result).toHaveLength(1);
      expect(result[0].temp_correlation).toBe(0.75);
      expect(result[0].precip_correlation).toBe(0.45);
    });
  });

  describe('getWeeklyForecast', () => {
    it('should return weekly forecast data', async () => {
      mockManager.query.mockResolvedValue([
        {
          district: 'Colombo',
          current: '100',
          avg_4week: '90',
          forecast: '110',
          trend: 'Rising',
        },
      ]);

      const result = await analyticsService.getWeeklyForecast();

      expect(result).toHaveLength(1);
      expect(result[0].forecast).toBe(110);
      expect(result[0].trend).toBe('Rising');
      expect(result[0].confidence).toBe('medium');
    });
  });

  describe('getExplainableInsight', () => {
    it('should return error for non-existent district', async () => {
      mockManager.getRepository.mockReturnValue({
        findOne: jest.fn().mockResolvedValue(null),
      });

      const result = await analyticsService.getExplainableInsight(
        'NonExistent',
      );

      expect(result).toHaveProperty('error', 'District not found');
      expect(result).toHaveProperty('district', 'NonExistent');
    });

    it('should call explain-analytics service and return insight', async () => {
      mockManager.getRepository.mockReturnValue({
        findOne: jest.fn().mockResolvedValue({ id: 'district-1' }),
      });
      mockManager.query
        .mockResolvedValueOnce([
          {
            year: 2026,
            week: 12,
            cases: 100,
            temperature_2m_mean: '28.5',
            precipitation_sum: '85.0',
          },
          {
            year: 2026,
            week: 11,
            cases: 80,
            temperature_2m_mean: '27.0',
            precipitation_sum: '60.0',
          },
        ])
        .mockResolvedValueOnce([{ max_cases: '200' }]);

      const mockResponse = {
        data: {
          district: 'Colombo',
          risk_level: 'high',
          summary: 'Colombo is high risk.',
          key_drivers: ['Cases increased 25.0% WoW'],
          recommendations: ['Deploy fogging teams'],
          caveats: ['Phase 1 data only'],
          references: [],
          implementation_phase: 'phase-1-structured-data-to-text',
        },
      };
      mockedAxios.post.mockResolvedValue(mockResponse);

      const result = await analyticsService.getExplainableInsight('Colombo');

      expect(mockedAxios.post).toHaveBeenCalledWith(
        expect.stringContaining('/v1/insights/explain'),
        expect.objectContaining({
          district: 'Colombo',
          structured_signals: expect.objectContaining({
            recent_case_count: 100,
          }),
        }),
      );
      expect(result).toHaveProperty('risk_level', 'high');
      expect(result).toHaveProperty('district', 'Colombo');
    });

    it('should return fallback when explain-analytics service is down', async () => {
      mockManager.getRepository.mockReturnValue({
        findOne: jest.fn().mockResolvedValue({ id: 'district-1' }),
      });
      mockManager.query
        .mockResolvedValueOnce([
          {
            year: 2026,
            week: 12,
            cases: 50,
            temperature_2m_mean: '28.0',
            precipitation_sum: '40.0',
          },
        ])
        .mockResolvedValueOnce([{ max_cases: '200' }]);

      mockedAxios.post.mockRejectedValue(
        new Error('connect ECONNREFUSED 127.0.0.1:8010'),
      );

      const result = await analyticsService.getExplainableInsight('Gampaha');

      expect(result).toHaveProperty('district', 'Gampaha');
      expect(result).toHaveProperty('_fallback', true);
      expect(result).toHaveProperty('implementation_phase', 'phase-1-fallback');
      expect(result).toHaveProperty('summary');
    });
  });
});
