import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';
import { GeocodingService } from './geocoding.service';
import { RouteService } from './route.service';
import { Task } from './entities/task.entity';
import { Evidence } from './entities/evidence.entity';
import { TaskMessage } from './entities/task-message.entity';
import { MessageRead } from './entities/message-read.entity';
import { User } from '../entities/user.entity';
import { StorageModule } from '../storage/storage.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Task, Evidence, TaskMessage, MessageRead, User]),
    StorageModule,
  ],
  controllers: [TasksController],
  providers: [TasksService, GeocodingService, RouteService],
  exports: [TasksService, GeocodingService, RouteService],
})
export class TasksModule {}
