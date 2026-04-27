import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { AnalyticsModule } from '../analytics/analytics.module';
import { TasksModule } from '../tasks/tasks.module';
import { UsersModule } from '../users/users.module';
import { CacheHelperModule } from '../cache/cache-helper.module';

@Module({
  imports: [AnalyticsModule, TasksModule, UsersModule, CacheHelperModule],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
