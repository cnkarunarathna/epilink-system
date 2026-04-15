import {
  Body,
  Controller,
  Get,
  Param,
  ParseArrayPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TaskParticipantGuard } from './guards/task-participant.guard';
import { TaskMessagesService } from './task-messages.service';
import { CreateMessageDto } from './dto/create-message.dto';
import { GetMessagesQueryDto } from './dto/get-messages-query.dto';

@Controller('tasks')
@UseGuards(JwtAuthGuard)
export class TaskMessagesController {
  constructor(private readonly messagesService: TaskMessagesService) {}

  /** POST /tasks/:taskId/messages — send a message */
  @Post(':taskId/messages')
  @UseGuards(TaskParticipantGuard)
  sendMessage(
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Body() dto: CreateMessageDto,
    @Request() req,
  ) {
    return this.messagesService.sendMessage(taskId, req.user.id, dto);
  }

  /** GET /tasks/:taskId/messages — paginated message history */
  @Get(':taskId/messages')
  @UseGuards(TaskParticipantGuard)
  getMessages(
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Query() query: GetMessagesQueryDto,
  ) {
    return this.messagesService.getMessages(taskId, query);
  }

  /** PATCH /tasks/:taskId/messages/read — bulk mark messages as read */
  @Patch(':taskId/messages/read')
  @UseGuards(TaskParticipantGuard)
  markRead(
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Body('messageIds', new ParseArrayPipe({ items: String }))
    messageIds: string[],
    @Request() req,
  ) {
    return this.messagesService.markRead(taskId, req.user.id, messageIds);
  }

  /** GET /tasks/:taskId/messages/unread — unread count for calling user */
  @Get(':taskId/messages/unread')
  @UseGuards(TaskParticipantGuard)
  getUnreadCount(
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Request() req,
  ) {
    return this.messagesService
      .getUnreadCount(taskId, req.user.id)
      .then((count) => ({ count }));
  }

  /** POST /tasks/messages/unread-batch — batch unread counts for task list */
  @Post('messages/unread-batch')
  getUnreadBatch(
    @Body('taskIds', new ParseArrayPipe({ items: String })) taskIds: string[],
    @Request() req,
  ) {
    return this.messagesService.getUnreadCountsForUser(req.user.id, taskIds);
  }
}
