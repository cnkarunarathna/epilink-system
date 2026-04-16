import {
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { TaskMessage } from './entities/task-message.entity';
import { MessageRead } from './entities/message-read.entity';
import { MessageReaction } from './entities/message-reaction.entity';
import { Task } from './entities/task.entity';
import { User } from '../entities/user.entity';
import { CreateMessageDto } from './dto/create-message.dto';
import { GetMessagesQueryDto } from './dto/get-messages-query.dto';
import { MessageResponseDto } from './dto/message-response.dto';
import { EventsGateway } from '../events/events.gateway';
import { CacheHelperService } from '../cache/cache-helper.service';
import { PushNotificationService } from '../notifications/push-notification.service';

/** TTL for unread count cache keys: 7 days (invalidated on markRead anyway) */
const UNREAD_CACHE_TTL_MS = 7 * 24 * 3600 * 1000;

/** Emojis allowed as reactions */
const ALLOWED_EMOJIS = new Set(['👍', '✅', '👀', '❤️', '😊', '🙏']);

@Injectable()
export class TaskMessagesService {
  private readonly logger = new Logger(TaskMessagesService.name);

  constructor(
    @InjectRepository(TaskMessage)
    private readonly messageRepository: Repository<TaskMessage>,
    @InjectRepository(MessageRead)
    private readonly readRepository: Repository<MessageRead>,
    @InjectRepository(MessageReaction)
    private readonly reactionRepository: Repository<MessageReaction>,
    @InjectRepository(Task)
    private readonly taskRepository: Repository<Task>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly eventsGateway: EventsGateway,
    private readonly cacheHelper: CacheHelperService,
    private readonly pushNotification: PushNotificationService,
  ) {}

  // ─── Public API ──────────────────────────────────────────────────────────

  /**
   * Send a user message.
   *
   * Performance notes:
   *  - `preloadedTask` comes from TaskParticipantGuard (already fetched for
   *    authorization), so we never issue a second DB query for the same row.
   *  - Message save + auto-read insert + unread cache increments all happen in
   *    a single parallel round-trip after the message is persisted.
   *  - The DTO is built from in-memory data; there is no second "reload" query.
   *  - Push notifications are fire-and-forget and never block the response.
   */
  async sendMessage(
    taskId: string,
    senderId: string,
    senderName: string,
    senderRole: string,
    dto: CreateMessageDto,
    preloadedTask?: Pick<Task, 'id' | 'createdById' | 'assignedPhiId' | 'title'>,
  ): Promise<MessageResponseDto> {
    // Use the guard-provided task when available; only fall back to DB if needed
    // (e.g. when called programmatically without a request context).
    const task = preloadedTask ?? await this.taskRepository.findOne({
      where: { id: taskId },
      select: ['id', 'createdById', 'assignedPhiId', 'title'],
    });

    if (!task) {
      throw new NotFoundException(`Task ${taskId} not found`);
    }

    // Persist the message
    const message = await this.messageRepository.save(
      this.messageRepository.create({
        taskId,
        senderId,
        content: dto.content,
        attachmentUrl: dto.attachmentUrl ?? null,
        attachmentType: (dto.attachmentType as string | null) ?? null,
      }),
    );

    // Recipients = every participant except the sender
    const recipients = [task.createdById, task.assignedPhiId].filter(
      (id): id is string => !!id && id !== senderId,
    );

    // Parallel: auto-read for sender + atomic unread increments for recipients
    await Promise.all([
      this.readRepository.save(
        this.readRepository.create({ messageId: message.id, userId: senderId }),
      ),
      ...recipients.map((recipientId) =>
        this.incrUnreadCount(recipientId, taskId),
      ),
    ]);

    // Build DTO from already-available data — no second DB round-trip
    const response: MessageResponseDto = {
      id: message.id,
      taskId: message.taskId,
      content: message.content,
      attachmentUrl: message.attachmentUrl ?? null,
      attachmentType: message.attachmentType ?? null,
      sender: { id: senderId, name: senderName, role: senderRole },
      isSystemMessage: false,
      createdAt: message.createdAt,
      readBy: [{ userId: senderId, readAt: new Date() }],
      reactions: [],
      clientId: dto.clientId,
    };

    // Broadcast to the task socket room
    this.eventsGateway.emitChatMessage(taskId, response);

    // Push notifications — fire-and-forget, never blocks the response
    this.sendPushToRecipients(recipients, senderName, dto.content, taskId, task.title ?? 'Task').catch(() => {});

    return response;
  }

  /**
   * 6.1 — Insert an automated system message on status changes.
   * Uses actorId as senderId so the FK constraint is satisfied;
   * isSystemMessage=true means the frontend renders it as a centred pill.
   */
  async sendSystemMessage(
    taskId: string,
    content: string,
    actorId: string,
  ): Promise<void> {
    const task = await this.taskRepository.findOne({
      where: { id: taskId },
      select: ['id'],
    });
    if (!task) return; // task may have been deleted race-condition-safe

    const message = this.messageRepository.create({
      taskId,
      senderId: actorId,
      content,
      isSystemMessage: true,
    });
    await this.messageRepository.save(message);

    const populated = await this.loadMessage(message.id);
    this.eventsGateway.emitChatMessage(taskId, this.toDto(populated));
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

    // Load read receipts and reactions for all returned messages
    const messageIds = messages.map((m) => m.id);
    const [reads, reactions] =
      messageIds.length > 0
        ? await Promise.all([
            this.readRepository.find({ where: { messageId: In(messageIds) } }),
            this.reactionRepository.find({ where: { messageId: In(messageIds) } }),
          ])
        : [[], []];

    const readsByMessageId = this.groupBy(reads, (r) => r.messageId);
    const reactionsByMessageId = this.groupBy(reactions, (r) => r.messageId);

    // Return chronological order (oldest first)
    return messages
      .reverse()
      .map((msg) =>
        this.toDto(
          msg,
          readsByMessageId.get(msg.id) ?? [],
          reactionsByMessageId.get(msg.id) ?? [],
        ),
      );
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

  // ─── 6.2 Message Search ───────────────────────────────────────────────────

  async searchMessages(
    taskId: string,
    q: string,
  ): Promise<MessageResponseDto[]> {
    if (!q || q.trim().length === 0) return [];

    const messages = await this.messageRepository
      .createQueryBuilder('msg')
      .leftJoinAndSelect('msg.sender', 'sender')
      .where('msg.task_id = :taskId', { taskId })
      .andWhere('msg.is_system_message = false')
      .andWhere('msg.content ILIKE :q', { q: `%${q.trim()}%` })
      .orderBy('msg.created_at', 'DESC')
      .limit(50)
      .getMany();

    if (messages.length === 0) return [];

    const messageIds = messages.map((m) => m.id);
    const [reads, reactions] = await Promise.all([
      this.readRepository.find({ where: { messageId: In(messageIds) } }),
      this.reactionRepository.find({ where: { messageId: In(messageIds) } }),
    ]);

    const readsByMessageId = this.groupBy(reads, (r) => r.messageId);
    const reactionsByMessageId = this.groupBy(reactions, (r) => r.messageId);

    return messages
      .reverse()
      .map((msg) =>
        this.toDto(
          msg,
          readsByMessageId.get(msg.id) ?? [],
          reactionsByMessageId.get(msg.id) ?? [],
        ),
      );
  }

  // ─── 6.3 Message Reactions ────────────────────────────────────────────────

  async toggleReaction(
    taskId: string,
    messageId: string,
    userId: string,
    emoji: string,
  ): Promise<{ action: 'added' | 'removed'; reactions: MessageResponseDto['reactions'] }> {
    if (!ALLOWED_EMOJIS.has(emoji)) {
      emoji = '👍'; // fallback to thumbs-up for unknown emoji
    }

    const message = await this.messageRepository.findOne({
      where: { id: messageId, taskId },
      select: ['id', 'taskId'],
    });
    if (!message) throw new NotFoundException(`Message ${messageId} not found`);

    const existing = await this.reactionRepository.findOne({
      where: { messageId, userId, emoji },
    });

    let action: 'added' | 'removed';
    if (existing) {
      await this.reactionRepository.remove(existing);
      action = 'removed';
    } else {
      await this.reactionRepository.save(
        this.reactionRepository.create({ messageId, userId, emoji }),
      );
      action = 'added';
    }

    // Reload all reactions for this message to broadcast the full updated set
    const allReactions = await this.reactionRepository.find({
      where: { messageId },
    });
    const reactionDtos = allReactions.map((r) => ({ emoji: r.emoji, userId: r.userId }));

    this.eventsGateway.emitChatReaction(taskId, messageId, userId, emoji, action, reactionDtos);

    return { action, reactions: reactionDtos };
  }

  // ─── 6.5 Supervisor Broadcast ─────────────────────────────────────────────

  async broadcastToDistrict(
    districtName: string,
    content: string,
    senderName: string,
  ): Promise<void> {
    this.eventsGateway.emitBroadcast(districtName, {
      content,
      senderName,
      districtName,
      sentAt: new Date(),
    });
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
      await this.cacheHelper.incr(`unread:${userId}:${taskId}`, UNREAD_CACHE_TTL_MS);
    } catch (err) {
      this.logger.warn(
        `Failed to increment unread count for user ${userId}, task ${taskId}: ${err instanceof Error ? err.message : err}`,
      );
    }
  }

  private async sendPushToRecipients(
    recipientIds: string[],
    senderName: string,
    content: string,
    taskId: string,
    taskTitle: string,
  ): Promise<void> {
    if (recipientIds.length === 0) return;

    const users = await this.userRepository.find({
      where: { id: In(recipientIds) },
      select: ['id', 'fcmToken'],
    });

    await Promise.all(
      users
        .filter((u): u is typeof u & { fcmToken: string } => !!u.fcmToken)
        .map((u) =>
          this.pushNotification.sendChatNotification({
            fcmToken: u.fcmToken,
            senderName,
            content,
            taskId,
            taskTitle,
          }),
        ),
    );
  }

  private async loadMessage(id: string): Promise<TaskMessage> {
    return this.messageRepository.findOneOrFail({
      where: { id },
      relations: ['sender'],
    });
  }

  private groupBy<T>(
    items: T[],
    keyFn: (item: T) => string,
  ): Map<string, T[]> {
    const map = new Map<string, T[]>();
    for (const item of items) {
      const key = keyFn(item);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(item);
    }
    return map;
  }

  private toDto(
    message: TaskMessage,
    reads: MessageRead[] = [],
    reactions: MessageReaction[] = [],
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
      reactions: reactions.map((r) => ({ emoji: r.emoji, userId: r.userId })),
    };
  }
}
