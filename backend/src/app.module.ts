import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from './database/database.module';
import { SeedModule } from './seed/seed.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { EventsModule } from './events/events.module';
import { TasksModule } from './tasks/tasks.module';
import { StorageModule } from './storage/storage.module';
import { ChatbotModule } from './chatbot/chatbot.module';
import { ReportsModule } from './reports/reports.module';
import { CacheHelperModule } from './cache/cache-helper.module';
import { NotificationsModule } from './notifications/notifications.module';
import { EmailModule } from './email/email.module';
import { AlertsModule } from './alerts/alerts.module';
import databaseConfig from './config/database.config';
import { ScheduleModule } from '@nestjs/schedule';
import { CacheModule } from '@nestjs/cache-manager';
import * as redisStore from 'cache-manager-redis-store';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [databaseConfig],
      envFilePath: '.env',
    }),
    CacheModule.registerAsync({
      isGlobal: true,
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        store: redisStore,
        host: configService.get('REDIS_HOST'),
        port: configService.get('REDIS_PORT'),
        username: configService.get('REDIS_USERNAME'),
        password: configService.get('REDIS_PASSWORD'),
        no_ready_check: true,
        // Fallback TTL in seconds (used only when CacheHelperService cannot reach Redis).
        // cache-manager-redis-store v2 interprets this as seconds, not milliseconds.
        ttl: 600,
      }),
      inject: [ConfigService],
    }),
    ScheduleModule.forRoot(),
    CacheHelperModule,
    NotificationsModule,
    EmailModule,
    AlertsModule,
    DatabaseModule,
    SeedModule,
    AuthModule,
    UsersModule,
    AnalyticsModule,
    EventsModule,
    TasksModule,
    StorageModule,
    ChatbotModule,
    ReportsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
