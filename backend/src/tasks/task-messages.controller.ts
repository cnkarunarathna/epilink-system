import {
  Body,
  Controller,
  Delete,
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
import { UserRole } from '../entities/user.entity';

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
    // req.task is attached by TaskParticipantGuard — avoids a duplicate DB fetch
    return this.messagesService.sendMessage(
      taskId,
      req.user.id,
      req.user.name ?? req.user.email,
      req.user.role,
      dto,
      req.task,
    );
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

  // ─── 6.2 Message Search ───────────────────────────────────────────────────

  /** GET /tasks/:taskId/messages/search?q=keyword */
  @Get(':taskId/messages/search')
  @UseGuards(TaskParticipantGuard)
  searchMessages(
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Query('q') q: string,
  ) {
    return this.messagesService.searchMessages(taskId, q ?? '');
  }

  // ─── 6.3 Message Reactions ────────────────────────────────────────────────

  /** POST /tasks/:taskId/messages/:messageId/reactions — toggle a reaction */
  @Post(':taskId/messages/:messageId/reactions')
  @UseGuards(TaskParticipantGuard)
  toggleReaction(
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Param('messageId', ParseUUIDPipe) messageId: string,
    @Body('emoji') emoji: string,
    @Request() req,
  ) {
    return this.messagesService.toggleReaction(
      taskId,
      messageId,
      req.user.id,
      emoji,
    );
  }

  // ─── 6.5 Supervisor Broadcast ─────────────────────────────────────────────

  /**
   * POST /tasks/messages/broadcast
   * Body: { districtName: string; content: string }
   * Supervisor/admin only — emits chat:broadcast to district:{districtName} socket room.
   */
  @Post('messages/broadcast')
  async broadcastToDistrict(
    @Body('districtName') districtName: string,
    @Body('content') content: string,
    @Request() req,
  ) {
    const role: UserRole = req.user.role;
    if (role !== UserRole.SUPERVISOR && role !== UserRole.ADMIN) {
      return { ok: false, reason: 'Supervisor or admin role required' };
    }
    await this.messagesService.broadcastToDistrict(
      districtName,
      content,
      req.user.name ?? req.user.email,
    );
    return { ok: true };
  }
}
