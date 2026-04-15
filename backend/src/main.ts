import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import * as dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import { createAdapter } from '@socket.io/redis-adapter';
import Redis from 'ioredis';
import { AppModule } from './app.module';
import { SeedService } from './seed/seed.service';
import { EventsGateway } from './events/events.gateway';

dotenv.config();

const requiredEnvVars = [
  'JWT_SECRET',
  'CHATBOT_SERVICE_URL',
  'ML_SERVICE_URL',
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
  // Uses the same Redis credentials already in the project.
  // Transparent to all existing socket code — just enables horizontal scaling.
  const redisOptions = {
    host: process.env.REDIS_HOST ?? 'localhost',
    port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
    ...(process.env.REDIS_PASSWORD && { password: process.env.REDIS_PASSWORD }),
    ...(process.env.REDIS_USERNAME && { username: process.env.REDIS_USERNAME }),
  };
  const pubClient = new Redis(redisOptions);
  const subClient = pubClient.duplicate();

  pubClient.on('error', (err) =>
    console.error('[Redis pub] connection error:', err.message),
  );
  subClient.on('error', (err) =>
    console.error('[Redis sub] connection error:', err.message),
  );

  const eventsGateway = app.get(EventsGateway);
  eventsGateway.server.adapter(createAdapter(pubClient, subClient));

  // Run database seed
  const seedService = app.get(SeedService);
  await seedService.seedDefaultUsers();

  await app.listen(process.env.PORT ?? 3001, '0.0.0.0');
  console.log(`Application is running on: ${await app.getUrl()}`);
}
bootstrap();
