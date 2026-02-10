import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';
import { GeocodingService } from './geocoding.service';
import { Task } from './entities/task.entity';
import { Evidence } from './entities/evidence.entity';
import { User } from '../entities/user.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Task, Evidence, User])],
  controllers: [TasksController],
  providers: [TasksService, GeocodingService],
  exports: [TasksService, GeocodingService],
})
export class TasksModule {}
