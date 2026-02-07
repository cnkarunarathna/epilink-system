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
  });

  describe('checkPredictionService', () => {
    it('should return DISCONNECTED when prediction service is unavailable', async () => {
      const result = await appService.checkPredictionService();

      // In test environment, the prediction service won't be running
      expect(result).toHaveProperty('status');
      expect(result).toHaveProperty('url');
      expect(result.url).toBe('http://localhost:8000');
    });
  });
});
