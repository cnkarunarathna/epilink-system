import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';
import { GeocodingService } from './geocoding.service';
import { Task } from './entities/task.entity';
import { Evidence } from './entities/evidence.entity';
import { User } from '../entities/user.entity';
import { StorageModule } from '../storage/storage.module';

@Module({
  imports: [TypeOrmModule.forFeature([Task, Evidence, User]), StorageModule],
  controllers: [TasksController],
  providers: [TasksService, GeocodingService],
  exports: [TasksService, GeocodingService],
})
export class TasksModule {}
