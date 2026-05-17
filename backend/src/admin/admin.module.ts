import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminController } from './admin.controller';
import { PublicSettingsController } from './public-settings.controller';
import { AdminService } from './admin.service';
import { AnalyticsModule } from '../analytics/analytics.module';
import { TasksModule } from '../tasks/tasks.module';
import { UsersModule } from '../users/users.module';
import { CacheHelperModule } from '../cache/cache-helper.module';
import { SystemSettings } from '../entities/system-settings.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([SystemSettings]),
    AnalyticsModule,
    TasksModule,
    UsersModule,
    CacheHelperModule,
  ],
  controllers: [AdminController, PublicSettingsController],
  providers: [AdminService],
  exports: [AdminService],
})
export class AdminModule {}
