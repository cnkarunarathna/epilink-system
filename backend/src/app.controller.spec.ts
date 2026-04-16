import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DataSource } from 'typeorm';

// Mock DataSource
const mockDataSource = {
  isInitialized: true,
  options: {
    database: 'test_db',
  },
};

describe('AppController', () => {
  let appController: AppController;
  let appService: AppService;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        AppService,
        {
          provide: DataSource,
          useValue: mockDataSource,
        },
      ],
    }).compile();

    appController = app.get<AppController>(AppController);
    appService = app.get<AppService>(AppService);
  });

  describe('getHello', () => {
    it('should return "Hello World!"', () => {
      expect(appController.getHello()).toBe('Hello World!');
    });
  });

  describe('checkHealth', () => {
    it('should return health status with database info', async () => {
      const result = await appController.checkHealth();

      expect(result).toHaveProperty('status');
      expect(result).toHaveProperty('timestamp');
      expect(result).toHaveProperty('database');
      expect(result).toHaveProperty('predictionService');
      expect(result.database).toHaveProperty('connected');
    });

    it('should return OK status when database is connected', async () => {
      const result = await appController.checkHealth();
      expect(result.database.status).toBe('OK');
      expect(result.database.connected).toBe(true);
    });
  });
});

describe('AppService', () => {
  let appService: AppService;
  const originalFetch = global.fetch;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AppService,
        {
          provide: DataSource,
          useValue: mockDataSource,
        },
      ],
    }).compile();

    appService = module.get<AppService>(AppService);
  });

  afterEach(() => {
    global.fetch = originalFetch;
    delete process.env.ML_SERVICE_URL;
    jest.clearAllMocks();
  });

  describe('getHello', () => {
    it('should return "Hello World!"', () => {
      expect(appService.getHello()).toBe('Hello World!');
    });
  });

  describe('checkDatabaseConnection', () => {
    it('should return OK status when connected', async () => {
      const result = await appService.checkDatabaseConnection();

      expect(result.status).toBe('OK');
      expect(result.connected).toBe(true);
      expect(result.database).toBe('test_db');
    });

    it('should return DISCONNECTED status when not initialized', async () => {
      const moduleWithDisconnected: TestingModule =
        await Test.createTestingModule({
          providers: [
            AppService,
            {
              provide: DataSource,
              useValue: {
                isInitialized: false,
                options: { database: 'test_db' },
              },
            },
          ],
        }).compile();

      const disconnectedService =
        moduleWithDisconnected.get<AppService>(AppService);
      const result = await disconnectedService.checkDatabaseConnection();

      expect(result.status).toBe('DISCONNECTED');
      expect(result.connected).toBe(false);
    });

    it('should return ERROR status when datasource throws unexpectedly', async () => {
      const throwingDataSource = {
        get isInitialized() {
          throw new Error('boom');
        },
        options: {},
      };

      const moduleWithError: TestingModule = await Test.createTestingModule({
        providers: [
          AppService,
          {
            provide: DataSource,
            useValue: throwingDataSource,
          },
        ],
      }).compile();

      const service = moduleWithError.get<AppService>(AppService);
      const result = await service.checkDatabaseConnection();

      expect(result).toEqual({
        status: 'ERROR',
        database: 'unknown',
        connected: false,
      });
    });
  });

  describe('checkPredictionService', () => {
    it('should return OK when ML service health endpoint is healthy', async () => {
      process.env.ML_SERVICE_URL = 'http://ml-service:8000';
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({
          status: 'healthy',
          service: 'ml-model',
          version: '1.0.0',
          model_loaded: true,
        }),
      } as unknown as Response);

      const result = await appService.checkPredictionService();

      expect(result.status).toBe('OK');
      expect(result.connected).toBe(true);
      expect(result.url).toBe('http://ml-service:8000');
      expect(result.service).toBe('ml-model');
      expect(result.version).toBe('1.0.0');
      expect(result.modelLoaded).toBe(true);
    });

    it('should return ERROR for non-200 health response', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
      } as unknown as Response);

      const result = await appService.checkPredictionService();

      expect(result.status).toBe('ERROR');
      expect(result.connected).toBe(false);
    });

    it('should return DISCONNECTED when prediction service is unavailable', async () => {
      const setTimeoutSpy = jest
        .spyOn(global, 'setTimeout')
        .mockImplementation((callback: (...args: any[]) => void) => {
          callback();
          return 1 as unknown as NodeJS.Timeout;
        });

      global.fetch = jest
        .fn()
        .mockRejectedValue(new Error('connect ECONNREFUSED'));

      const result = await appService.checkPredictionService();

      expect(result.status).toBe('DISCONNECTED');
      expect(result.url).toBe('http://localhost:8000');

      setTimeoutSpy.mockRestore();
    });
  });
});
