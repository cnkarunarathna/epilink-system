import { ConfigService } from '@nestjs/config';

const TEST_CONFIG: Record<string, any> = {
  // Auth
  JWT_SECRET: 'test-jwt-secret-32-chars-minimum!!',
  JWT_EXPIRATION: '1d',

  // Database
  PGHOST: 'localhost',
  PGPORT: 5432,
  PGUSER: 'test',
  PGPASSWORD: 'test',
  PGDATABASE: 'epilink_test',
  PGSSL: 'false',

  // Redis
  REDIS_HOST: 'localhost',
  REDIS_PORT: 6379,
  REDIS_USERNAME: '',
  REDIS_PASSWORD: '',

  // AWS S3
  AWS_REGION: 'us-east-1',
  AWS_ACCESS_KEY_ID: 'AKIAIOSFODNN7EXAMPLE',
  AWS_SECRET_ACCESS_KEY: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
  AWS_S3_BUCKET_NAME: 'epilink-test-bucket',

  // Email (SMTP)
  SMTP_HOST: 'smtp.test.example',
  SMTP_PORT: 587,
  SMTP_USER: 'noreply@test.example',
  SMTP_PASS: 'test-smtp-password',
  SMTP_FROM: 'EpiLink Test <noreply@test.example>',

  // External services
  FRONTEND_URL: 'http://localhost:3000',
  CHATBOT_SERVICE_URL: 'http://localhost:5001',
  ML_PREDICTION_URL: 'http://localhost:8000',
  ROUTE_OPTIMIZER_URL: 'http://localhost:5002',

  // App
  NODE_ENV: 'test',
  PORT: 3001,
};

export function createMockConfigService(
  overrides: Record<string, any> = {},
): jest.Mocked<ConfigService> {
  const config = { ...TEST_CONFIG, ...overrides };
  return {
    get: jest.fn(<T>(key: string, defaultValue?: T) => config[key] ?? defaultValue ?? null),
    getOrThrow: jest.fn(<T>(key: string): T => {
      const value = config[key];
      if (value === undefined || value === null) {
        throw new Error(`Config key "${key}" is not defined in test config`);
      }
      return value as T;
    }),
  } as unknown as jest.Mocked<ConfigService>;
}
