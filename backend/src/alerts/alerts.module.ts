import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { DigestScheduler } from './digest.scheduler';
import { User } from '../entities/user.entity';
import { AnalyticsModule } from '../analytics/analytics.module';

@Module({
  imports: [TypeOrmModule.forFeature([User]), AnalyticsModule, ConfigModule],
  providers: [DigestScheduler],
})
export class AlertsModule {}
