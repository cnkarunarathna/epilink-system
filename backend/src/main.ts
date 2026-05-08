import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import * as dotenv from 'dotenv';
import * as cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { SeedService } from './seed/seed.service';
import { RedisIoAdapter } from './events/redis-io.adapter';

dotenv.config();

const requiredEnvVars = [
  'JWT_SECRET',
  'CHATBOT_SERVICE_URL',
  'ROUTE_OPTIMIZER_URL',
  'EXPLAIN_ANALYTICS_URL',
  'NEXT_FRONTEND_URL',
];

for (const key of requiredEnvVars) {
  if (!process.env[key]) {
    throw new Error(`Missing required env var: ${key}`);
  }
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.use(cookieParser());

  // Set global API prefix
  app.setGlobalPrefix('api');

  // Enable validation globally
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Enable CORS for frontend and mobile
  app.enableCors({
    origin:
      process.env.NODE_ENV === 'production'
        ? process.env.NEXT_FRONTEND_URL
        : true, // Allow all origins in development for mobile testing
    credentials: true,
  });

  // Wire Redis adapter for Socket.io cross-instance pub/sub.
  const redisIoAdapter = new RedisIoAdapter(app);
  await redisIoAdapter.connectToRedis();
  app.useWebSocketAdapter(redisIoAdapter);

  // Run database seed
  const seedService = app.get(SeedService);
  await seedService.seedDefaultUsers();

  await app.listen(process.env.PORT ?? 3001, '0.0.0.0');
  console.log(`Application is running on: ${await app.getUrl()}`);
}
bootstrap();
