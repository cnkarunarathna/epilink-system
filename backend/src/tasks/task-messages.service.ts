import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { TaskMessage } from './entities/task-message.entity';
import { MessageRead } from './entities/message-read.entity';
import { MessageReaction } from './entities/message-reaction.entity';
import { Task } from './entities/task.entity';
import { User, UserRole } from '../entities/user.entity';
import { CreateMessageDto } from './dto/create-message.dto';
import { GetMessagesQueryDto } from './dto/get-messages-query.dto';
import { MessageResponseDto } from './dto/message-response.dto';
import {
  ChatSummaryItemDto,
  ChatSummaryQueryDto,
  ChatSummaryResponseDto,
} from './dto/chat-summary.dto';
import { EventsGateway } from '../events/events.gateway';
import { CacheHelperService } from '../cache/cache-helper.service';
import { PushNotificationService } from '../notifications/push-notification.service';

/** TTL for unread count cache keys: 7 days (invalidated on markRead anyway) */
const UNREAD_CACHE_TTL_MS = 7 * 24 * 3600 * 1000;

/** Emojis allowed as reactions */
const ALLOWED_EMOJIS = new Set(['👍', '✅', '👀', '❤️', '😊', '🙏']);
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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
    preloadedTask?: Pick<
      Task,
      'id' | 'createdById' | 'assignedPhiId' | 'title'
    >,
  ): Promise<MessageResponseDto> {
    // Use the guard-provided task when available; only fall back to DB if needed
    // (e.g. when called programmatically without a request context).
    const task =
      preloadedTask ??
      (await this.taskRepository.findOne({
        where: { id: taskId },
        select: ['id', 'createdById', 'assignedPhiId', 'title'],
      }));

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
        // Use client-provided createdAt if available to ensure UI consistency.
        // If not provided, TypeORM's @CreateDateColumn will generate a server timestamp.
        ...(dto.createdAt && { createdAt: new Date(dto.createdAt) }),
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
    this.sendPushToRecipients(
      recipients,
      senderName,
      dto.content,
      taskId,
      task.title ?? 'Task',
    ).catch(() => {});

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
            this.reactionRepository.find({
              where: { messageId: In(messageIds) },
            }),
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

    // Defensive guard: ignore any non-UUID IDs (e.g. optimistic client IDs)
    // so this endpoint never throws Postgres uuid cast errors.
    const validMessageIds = messageIds.filter((id) => UUID_REGEX.test(id));
    if (validMessageIds.length === 0) return;
    if (validMessageIds.length !== messageIds.length) {
      this.logger.warn(
        `markRead ignored ${messageIds.length - validMessageIds.length} invalid message IDs for task ${taskId}`,
      );
    }

    // Upsert read records (ignore duplicates via unique constraint)
    for (const messageId of validMessageIds) {
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
    this.eventsGateway.emitChatRead(taskId, userId, validMessageIds);
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

      const dbCounts = new Map(
        rows.map((r) => [r.taskId, parseInt(r.count, 10)]),
      );

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
  ): Promise<{
    action: 'added' | 'removed';
    reactions: MessageResponseDto['reactions'];
  }> {
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
    const reactionDtos = allReactions.map((r) => ({
      emoji: r.emoji,
      userId: r.userId,
    }));

    this.eventsGateway.emitChatReaction(
      taskId,
      messageId,
      userId,
      emoji,
      action,
      reactionDtos,
    );

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

  // ─── Chat summary ────────────────────────────────────────────────────────

  /**
   * Returns tasks with chat activity for the calling user, ordered by
   * unread count DESC then last-message timestamp DESC.
   * Supervisors see tasks they created; PHIs see tasks assigned to them;
   * admins see all tasks.
   */
  async getChatSummary(
    userId: string,
    role: UserRole,
    query: ChatSummaryQueryDto,
  ): Promise<ChatSummaryResponseDto> {
    const limit = query.limit ?? 30;
    const offset = query.offset ?? 0;

    // ── 1. Fetch tasks the user participates in ──────────────────────────────
    const taskQb = this.taskRepository
      .createQueryBuilder('t')
      .leftJoinAndSelect('t.district', 'd')
      .leftJoinAndSelect('t.assignedPhi', 'phi')
      .leftJoinAndSelect('t.createdBy', 'creator');

    if (role === UserRole.PHI) {
      taskQb.where('t.assigned_phi_id = :userId', { userId });
    } else if (role === UserRole.SUPERVISOR) {
      taskQb.where('t.created_by_id = :userId', { userId });
    }
    // ADMIN — no where clause, sees all tasks

    if (query.search?.trim()) {
      taskQb.andWhere('t.title ILIKE :search', {
        search: `%${query.search.trim()}%`,
      });
    }

    if (query.status?.trim()) {
      const statuses = query.status
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      if (statuses.length > 0) {
        taskQb.andWhere('t.status IN (:...statuses)', { statuses });
      }
    }

    const allTasks = await taskQb.getMany();

    if (allTasks.length === 0) {
      return { items: [], total: 0 };
    }

    const taskIds = allTasks.map((t) => t.id);

    // ── 2. Last message per task via DISTINCT ON (single round-trip) ─────────
    type LastMsgRow = {
      task_id: string;
      content: string;
      is_system_message: boolean;
      created_at: Date;
      sender_name: string;
    };

    const lastMsgRows: LastMsgRow[] =
      await this.messageRepository.manager.query(
        `SELECT DISTINCT ON (tm.task_id)
           tm.task_id,
           tm.content,
           tm.is_system_message,
           tm.created_at,
           u.name AS sender_name
         FROM task_messages tm
         LEFT JOIN users u ON u.id = tm.sender_id
         WHERE tm.task_id = ANY($1)
         ORDER BY tm.task_id, tm.created_at DESC`,
        [taskIds],
      );

    const lastMsgMap = new Map(lastMsgRows.map((r) => [r.task_id, r]));

    // ── 3. Unread counts via Redis-backed batch fetch ─────────────────────────
    const taskIdsWithMessages = lastMsgRows.map((r) => r.task_id);
    const unreadCounts =
      taskIdsWithMessages.length > 0
        ? await this.getUnreadCountsForUser(userId, taskIdsWithMessages)
        : {};

    // ── 4. Build items — only tasks that have at least one message ────────────
    const items: ChatSummaryItemDto[] = allTasks
      .filter((t) => lastMsgMap.has(t.id))
      .map((t) => {
        const lm = lastMsgMap.get(t.id)!;
        const rawContent = lm.content ?? '';
        return {
          taskId: t.id,
          title: t.title,
          status: t.status,
          priority: t.priority,
          type: t.type,
          district: t.district?.name ?? '',
          assignedPhi: t.assignedPhi
            ? { id: t.assignedPhi.id, name: t.assignedPhi.name }
            : null,
          createdBy: { id: t.createdBy.id, name: t.createdBy.name },
          lastMessage: {
            content:
              rawContent.length > 120
                ? rawContent.slice(0, 120) + '…'
                : rawContent,
            senderName: lm.sender_name ?? 'System',
            sentAt:
              lm.created_at instanceof Date
                ? lm.created_at.toISOString()
                : String(lm.created_at),
            isSystemMessage: lm.is_system_message,
          },
          unreadCount: unreadCounts[t.id] ?? 0,
          hasMessages: true,
        };
      });

    // ── 5. Sort: highest unread first, then most-recent message first ─────────
    items.sort((a, b) => {
      if (b.unreadCount !== a.unreadCount) return b.unreadCount - a.unreadCount;
      const aTime = a.lastMessage
        ? new Date(a.lastMessage.sentAt).getTime()
        : 0;
      const bTime = b.lastMessage
        ? new Date(b.lastMessage.sentAt).getTime()
        : 0;
      return bTime - aTime;
    });

    const total = items.length;
    return { items: items.slice(offset, offset + limit), total };
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

  private async incrUnreadCount(userId: string, taskId: string): Promise<void> {
    try {
      await this.cacheHelper.incr(
        `unread:${userId}:${taskId}`,
        UNREAD_CACHE_TTL_MS,
      );
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

  private groupBy<T>(items: T[], keyFn: (item: T) => string): Map<string, T[]> {
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
