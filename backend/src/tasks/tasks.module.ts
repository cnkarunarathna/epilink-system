import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';
import { GeocodingService } from './geocoding.service';
import { RouteService } from './route.service';
import { TaskMessagesController } from './task-messages.controller';
import { TaskMessagesService } from './task-messages.service';
import { TaskParticipantGuard } from './guards/task-participant.guard';
import { Task } from './entities/task.entity';
import { Evidence } from './entities/evidence.entity';
import { TaskMessage } from './entities/task-message.entity';
import { MessageRead } from './entities/message-read.entity';
import { MessageReaction } from './entities/message-reaction.entity';
import { User } from '../entities/user.entity';
import { StorageModule } from '../storage/storage.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Task,
      Evidence,
      TaskMessage,
      MessageRead,
      MessageReaction,
      User,
    ]),
    StorageModule,
  ],
  controllers: [TasksController, TaskMessagesController],
  providers: [
    TasksService,
    GeocodingService,
    RouteService,
    TaskMessagesService,
    TaskParticipantGuard,
  ],
  exports: [TasksService, TaskMessagesService, GeocodingService, RouteService],
})
export class TasksModule {}
