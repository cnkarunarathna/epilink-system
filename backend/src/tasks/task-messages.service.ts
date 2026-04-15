import {
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { TaskMessage } from './entities/task-message.entity';
import { MessageRead } from './entities/message-read.entity';
import { Task } from './entities/task.entity';
import { CreateMessageDto } from './dto/create-message.dto';
import { GetMessagesQueryDto } from './dto/get-messages-query.dto';
import { MessageResponseDto } from './dto/message-response.dto';
import { EventsGateway } from '../events/events.gateway';
import { CacheHelperService } from '../cache/cache-helper.service';

/** TTL for unread count cache keys: 7 days (invalidated on markRead anyway) */
const UNREAD_CACHE_TTL_MS = 7 * 24 * 3600 * 1000;

@Injectable()
export class TaskMessagesService {
  private readonly logger = new Logger(TaskMessagesService.name);

  constructor(
    @InjectRepository(TaskMessage)
    private readonly messageRepository: Repository<TaskMessage>,
    @InjectRepository(MessageRead)
    private readonly readRepository: Repository<MessageRead>,
    @InjectRepository(Task)
    private readonly taskRepository: Repository<Task>,
    private readonly eventsGateway: EventsGateway,
    private readonly cacheHelper: CacheHelperService,
  ) {}

  // ─── Public API ──────────────────────────────────────────────────────────

  async sendMessage(
    taskId: string,
    senderId: string,
    dto: CreateMessageDto,
  ): Promise<MessageResponseDto> {
    const task = await this.taskRepository.findOne({
      where: { id: taskId },
      select: ['id', 'createdById', 'assignedPhiId'],
    });

    if (!task) {
      throw new NotFoundException(`Task ${taskId} not found`);
    }

    // Persist the message
    const message = this.messageRepository.create({
      taskId,
      senderId,
      content: dto.content,
      attachmentUrl: dto.attachmentUrl ?? null,
      attachmentType: (dto.attachmentType as string | null) ?? null,
    });
    await this.messageRepository.save(message);

    // Auto-mark as read for the sender
    await this.readRepository.save(
      this.readRepository.create({ messageId: message.id, userId: senderId }),
    );

    // Increment unread count cache for each recipient (everyone except sender)
    const recipients = [task.createdById, task.assignedPhiId].filter(
      (id): id is string => !!id && id !== senderId,
    );
    await Promise.all(
      recipients.map((recipientId) =>
        this.incrUnreadCount(recipientId, taskId),
      ),
    );

    // Reload with sender relation for the response
    const populated = await this.loadMessage(message.id);
    const response = this.toDto(populated);

    // Broadcast to the task socket room
    this.eventsGateway.emitChatMessage(taskId, response);

    return response;
  }

  async getMessages(
    taskId: string,
    query: GetMessagesQueryDto,
  ): Promise<MessageResponseDto[]> {
    const limit = query.limit ?? 50;

    const qb = this.messageRepository
      .createQueryBuilder('msg')
      .leftJoinAndSelect('msg.sender', 'sender')
      .where('msg.task_id = :taskId', { taskId })
      .orderBy('msg.created_at', 'DESC')
      .limit(limit);

    if (query.before) {
      // Cursor: fetch messages older than the given message id
      const cursor = await this.messageRepository.findOne({
        where: { id: query.before },
        select: ['createdAt'],
      });
      if (cursor) {
        qb.andWhere('msg.created_at < :cursorDate', {
          cursorDate: cursor.createdAt,
        });
      }
    }

    const messages = await qb.getMany();

    // Load read receipts for all returned messages
    const messageIds = messages.map((m) => m.id);
    const reads =
      messageIds.length > 0
        ? await this.readRepository.find({
            where: { messageId: In(messageIds) },
          })
        : [];

    const readsByMessageId = new Map<string, MessageRead[]>();
    for (const read of reads) {
      if (!readsByMessageId.has(read.messageId)) {
        readsByMessageId.set(read.messageId, []);
      }
      readsByMessageId.get(read.messageId)!.push(read);
    }

    // Return chronological order (oldest first)
    return messages
      .reverse()
      .map((msg) => this.toDto(msg, readsByMessageId.get(msg.id) ?? []));
  }

  async markRead(
    taskId: string,
    userId: string,
    messageIds: string[],
  ): Promise<void> {
    if (messageIds.length === 0) return;

    // Upsert read records (ignore duplicates via unique constraint)
    for (const messageId of messageIds) {
      await this.readRepository
        .createQueryBuilder()
        .insert()
        .into(MessageRead)
        .values({ messageId, userId })
        .orIgnore()
        .execute();
    }

    // Bust unread count cache for this user + task
    await this.cacheHelper.del(`unread:${userId}:${taskId}`);

    // Broadcast read receipt to the room
    this.eventsGateway.emitChatRead(taskId, userId, messageIds);
  }

  async getUnreadCount(taskId: string, userId: string): Promise<number> {
    const key = `unread:${userId}:${taskId}`;
    const cached = await this.cacheHelper.get<number>(key);
    if (cached !== null) return cached;

    const count = await this.queryUnreadFromDb(taskId, userId);
    await this.cacheHelper.set(key, count, UNREAD_CACHE_TTL_MS);
    return count;
  }

  async getUnreadCountsForUser(
    userId: string,
    taskIds: string[],
  ): Promise<Record<string, number>> {
    if (taskIds.length === 0) return {};

    const result: Record<string, number> = {};
    const missedTaskIds: string[] = [];

    // Check cache for each taskId
    await Promise.all(
      taskIds.map(async (taskId) => {
        const cached = await this.cacheHelper.get<number>(
          `unread:${userId}:${taskId}`,
        );
        if (cached !== null) {
          result[taskId] = cached;
        } else {
          missedTaskIds.push(taskId);
        }
      }),
    );

    // Batch DB query for cache misses
    if (missedTaskIds.length > 0) {
      const rows = await this.messageRepository
        .createQueryBuilder('tm')
        .select('tm.task_id', 'taskId')
        .addSelect('COUNT(*)', 'count')
        .leftJoin(
          'message_reads',
          'mr',
          'mr.message_id = tm.id AND mr.user_id = :userId',
          { userId },
        )
        .where('tm.task_id IN (:...taskIds)', { taskIds: missedTaskIds })
        .andWhere('tm.sender_id != :userId', { userId })
        .andWhere('mr.id IS NULL')
        .groupBy('tm.task_id')
        .getRawMany<{ taskId: string; count: string }>();

      const dbCounts = new Map(rows.map((r) => [r.taskId, parseInt(r.count, 10)]));

      // Backfill cache and populate result
      await Promise.all(
        missedTaskIds.map(async (taskId) => {
          const count = dbCounts.get(taskId) ?? 0;
          result[taskId] = count;
          await this.cacheHelper.set(
            `unread:${userId}:${taskId}`,
            count,
            UNREAD_CACHE_TTL_MS,
          );
        }),
      );
    }

    return result;
  }

  // ─── Private helpers ─────────────────────────────────────────────────────

  private async queryUnreadFromDb(
    taskId: string,
    userId: string,
  ): Promise<number> {
    const result = await this.messageRepository
      .createQueryBuilder('tm')
      .leftJoin(
        'message_reads',
        'mr',
        'mr.message_id = tm.id AND mr.user_id = :userId',
        { userId },
      )
      .where('tm.task_id = :taskId', { taskId })
      .andWhere('tm.sender_id != :userId', { userId })
      .andWhere('mr.id IS NULL')
      .getCount();
    return result;
  }

  private async incrUnreadCount(
    userId: string,
    taskId: string,
  ): Promise<void> {
    try {
      const key = `unread:${userId}:${taskId}`;
      const current = (await this.cacheHelper.get<number>(key)) ?? 0;
      await this.cacheHelper.set(key, current + 1, UNREAD_CACHE_TTL_MS);
    } catch (err) {
      // Non-fatal: cache update failure should never break message send
      this.logger.warn(
        `Failed to increment unread count for user ${userId}, task ${taskId}: ${err instanceof Error ? err.message : err}`,
      );
    }
  }

  private async loadMessage(id: string): Promise<TaskMessage> {
    return this.messageRepository.findOneOrFail({
      where: { id },
      relations: ['sender'],
    });
  }

  private toDto(
    message: TaskMessage,
    reads: MessageRead[] = [],
  ): MessageResponseDto {
    return {
      id: message.id,
      taskId: message.taskId,
      content: message.content,
      attachmentUrl: message.attachmentUrl ?? null,
      attachmentType: message.attachmentType ?? null,
      sender: {
        id: message.sender.id,
        name: message.sender.name,
        role: message.sender.role,
      },
      isSystemMessage: message.isSystemMessage,
      createdAt: message.createdAt,
      readBy: reads.map((r) => ({ userId: r.userId, readAt: r.readAt })),
    };
  }
}
