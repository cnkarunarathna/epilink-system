import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { TaskMessagesService } from './task-messages.service';
import { TaskMessage } from './entities/task-message.entity';
import { MessageRead } from './entities/message-read.entity';
import { MessageReaction } from './entities/message-reaction.entity';
import { Task } from './entities/task.entity';
import { User } from '../entities/user.entity';
import { EventsGateway } from '../events/events.gateway';
import { CacheHelperService } from '../cache/cache-helper.service';
import { PushNotificationService } from '../notifications/push-notification.service';
import { createMockRepository, createMockQueryBuilder } from '../test/mocks/typeorm.mock';

describe('TaskMessagesService', () => {
  let service: TaskMessagesService;

  const mockMessageRepo = createMockRepository<TaskMessage>();
  const mockReadRepo = createMockRepository<MessageRead>();
  const mockReactionRepo = createMockRepository<MessageReaction>();
  const mockTaskRepo = createMockRepository<Task>();
  const mockUserRepo = createMockRepository<User>();

  const mockEventsGateway = {
    emitChatMessage: jest.fn(),
    emitChatRead: jest.fn(),
    emitChatReaction: jest.fn(),
    emitBroadcast: jest.fn(),
  };

  const mockCacheHelper = {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue(undefined),
    del: jest.fn().mockResolvedValue(undefined),
    incr: jest.fn().mockResolvedValue(undefined),
  };

  const mockPushNotification = {
    sendChatNotification: jest.fn().mockResolvedValue(undefined),
  };

  const mockTask = {
    id: 'task-uuid',
    title: 'Dengue Investigation',
    createdById: 'creator-uuid',
    assignedPhiId: 'phi-uuid',
  };

  const mockMessage = {
    id: 'msg-uuid',
    taskId: 'task-uuid',
    senderId: 'creator-uuid',
    content: 'Hello team',
    isSystemMessage: false,
    attachmentUrl: null,
    attachmentType: null,
    createdAt: new Date('2026-01-01T10:00:00Z'),
    sender: { id: 'creator-uuid', name: 'Creator', role: 'supervisor' },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    Object.assign(mockMessageRepo, createMockRepository<TaskMessage>());
    Object.assign(mockReadRepo, createMockRepository<MessageRead>());
    Object.assign(mockReactionRepo, createMockRepository<MessageReaction>());
    Object.assign(mockTaskRepo, createMockRepository<Task>());
    Object.assign(mockUserRepo, createMockRepository<User>());

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TaskMessagesService,
        { provide: getRepositoryToken(TaskMessage), useValue: mockMessageRepo },
        { provide: getRepositoryToken(MessageRead), useValue: mockReadRepo },
        { provide: getRepositoryToken(MessageReaction), useValue: mockReactionRepo },
        { provide: getRepositoryToken(Task), useValue: mockTaskRepo },
        { provide: getRepositoryToken(User), useValue: mockUserRepo },
        { provide: EventsGateway, useValue: mockEventsGateway },
        { provide: CacheHelperService, useValue: mockCacheHelper },
        { provide: PushNotificationService, useValue: mockPushNotification },
      ],
    }).compile();

    service = module.get<TaskMessagesService>(TaskMessagesService);
  });

  // ── sendMessage ───────────────────────────────────────────────────────────

  describe('sendMessage', () => {
    const dto = { content: 'Hello team', clientId: 'client-1' };

    it('should save message and broadcast to socket room', async () => {
      mockMessageRepo.create!.mockReturnValue(mockMessage as any);
      mockMessageRepo.save!.mockResolvedValue(mockMessage as any);
      mockReadRepo.create!.mockReturnValue({ messageId: 'msg-uuid', userId: 'creator-uuid' } as any);
      mockReadRepo.save!.mockResolvedValue({} as any);

      await service.sendMessage(
        'task-uuid',
        'creator-uuid',
        'Creator',
        'supervisor',
        dto as any,
        mockTask as any,
      );

      expect(mockMessageRepo.save).toHaveBeenCalled();
      expect(mockEventsGateway.emitChatMessage).toHaveBeenCalledWith(
        'task-uuid',
        expect.objectContaining({ id: 'msg-uuid', content: 'Hello team' }),
      );
    });

    it('should throw NotFoundException if task not found and no preloaded task', async () => {
      mockTaskRepo.findOne!.mockResolvedValue(null);

      await expect(
        service.sendMessage('bad-task', 'user-1', 'User', 'phi', dto as any),
      ).rejects.toThrow(NotFoundException);
    });

    it('should use preloaded task without DB query', async () => {
      mockMessageRepo.create!.mockReturnValue(mockMessage as any);
      mockMessageRepo.save!.mockResolvedValue(mockMessage as any);
      mockReadRepo.create!.mockReturnValue({} as any);
      mockReadRepo.save!.mockResolvedValue({} as any);

      await service.sendMessage(
        'task-uuid',
        'creator-uuid',
        'Creator',
        'supervisor',
        dto as any,
        mockTask as any,
      );

      // taskRepository.findOne should NOT be called when preloadedTask is provided
      expect(mockTaskRepo.findOne).not.toHaveBeenCalled();
    });

    it('should auto-read for the sender', async () => {
      mockMessageRepo.create!.mockReturnValue(mockMessage as any);
      mockMessageRepo.save!.mockResolvedValue(mockMessage as any);
      mockReadRepo.create!.mockReturnValue({ messageId: 'msg-uuid', userId: 'creator-uuid' } as any);
      mockReadRepo.save!.mockResolvedValue({} as any);

      await service.sendMessage(
        'task-uuid',
        'creator-uuid',
        'Creator',
        'supervisor',
        dto as any,
        mockTask as any,
      );

      expect(mockReadRepo.save).toHaveBeenCalled();
    });

    it('should return correct MessageResponseDto shape', async () => {
      mockMessageRepo.create!.mockReturnValue(mockMessage as any);
      mockMessageRepo.save!.mockResolvedValue(mockMessage as any);
      mockReadRepo.create!.mockReturnValue({} as any);
      mockReadRepo.save!.mockResolvedValue({} as any);

      const result = await service.sendMessage(
        'task-uuid',
        'creator-uuid',
        'Creator',
        'supervisor',
        dto as any,
        mockTask as any,
      );

      expect(result).toMatchObject({
        id: 'msg-uuid',
        taskId: 'task-uuid',
        content: 'Hello team',
        isSystemMessage: false,
        sender: { id: 'creator-uuid', name: 'Creator', role: 'supervisor' },
        clientId: 'client-1',
      });
    });
  });

  // ── sendSystemMessage ─────────────────────────────────────────────────────

  describe('sendSystemMessage', () => {
    it('should save a system message and broadcast it', async () => {
      const sysMsg = { ...mockMessage, isSystemMessage: true, content: 'Task started' };
      mockTaskRepo.findOne!.mockResolvedValue({ id: 'task-uuid' });
      mockMessageRepo.create!.mockReturnValue(sysMsg as any);
      mockMessageRepo.save!.mockResolvedValue(sysMsg as any);
      // findOneOrFail used by loadMessage
      mockMessageRepo.findOneOrFail = jest.fn().mockResolvedValue({
        ...sysMsg,
        sender: { id: 'actor-uuid', name: 'Actor', role: 'supervisor' },
      });

      await service.sendSystemMessage('task-uuid', 'Task started', 'actor-uuid');

      expect(mockMessageRepo.save).toHaveBeenCalled();
      expect(mockEventsGateway.emitChatMessage).toHaveBeenCalled();
    });

    it('should silently return if task no longer exists', async () => {
      mockTaskRepo.findOne!.mockResolvedValue(null);

      await expect(
        service.sendSystemMessage('missing-task', 'content', 'actor'),
      ).resolves.toBeUndefined();

      expect(mockMessageRepo.save).not.toHaveBeenCalled();
    });
  });

  // ── getMessages ───────────────────────────────────────────────────────────

  describe('getMessages', () => {
    it('should return empty array when no messages exist', async () => {
      const qb = createMockQueryBuilder<TaskMessage>();
      (qb.getMany as jest.Mock).mockResolvedValue([]);
      mockMessageRepo.createQueryBuilder!.mockReturnValue(qb as any);

      const result = await service.getMessages('task-uuid', { limit: 50 } as any);

      expect(result).toEqual([]);
    });

    it('should return messages in chronological order', async () => {
      const msgs = [
        { ...mockMessage, id: 'msg-2', createdAt: new Date('2026-01-01T11:00:00Z'), sender: { id: 'u', name: 'U', role: 'phi' } },
        { ...mockMessage, id: 'msg-1', createdAt: new Date('2026-01-01T10:00:00Z'), sender: { id: 'u', name: 'U', role: 'phi' } },
      ];
      const qb = createMockQueryBuilder<TaskMessage>();
      (qb.getMany as jest.Mock).mockResolvedValue(msgs);
      mockMessageRepo.createQueryBuilder!.mockReturnValue(qb as any);
      mockReadRepo.find!.mockResolvedValue([]);
      mockReactionRepo.find!.mockResolvedValue([]);

      const result = await service.getMessages('task-uuid', { limit: 50 } as any);

      // Reversed: oldest first
      expect(result[0].id).toBe('msg-1');
      expect(result[1].id).toBe('msg-2');
    });
  });

  // ── markRead ──────────────────────────────────────────────────────────────

  describe('markRead', () => {
    it('should do nothing when messageIds is empty', async () => {
      await service.markRead('task-uuid', 'user-uuid', []);

      expect(mockReadRepo.createQueryBuilder).not.toHaveBeenCalled();
    });

    it('should ignore non-UUID message IDs', async () => {
      const qb = createMockQueryBuilder<MessageRead>();
      (qb.execute as jest.Mock).mockResolvedValue({});
      // orIgnore chaining
      (qb as any).insert = jest.fn().mockReturnThis();
      (qb as any).into = jest.fn().mockReturnThis();
      (qb as any).values = jest.fn().mockReturnThis();
      (qb as any).orIgnore = jest.fn().mockReturnThis();
      mockReadRepo.createQueryBuilder!.mockReturnValue(qb as any);

      // Mix valid UUID + invalid string
      await service.markRead('task-uuid', 'user-uuid', [
        'not-a-uuid',
        '550e8400-e29b-41d4-a716-446655440000',
      ]);

      // Only one iteration (the valid UUID)
      expect(qb.execute).toHaveBeenCalledTimes(1);
    });

    it('should bust the unread cache and broadcast read receipt', async () => {
      const qb = createMockQueryBuilder<MessageRead>();
      (qb as any).insert = jest.fn().mockReturnThis();
      (qb as any).into = jest.fn().mockReturnThis();
      (qb as any).values = jest.fn().mockReturnThis();
      (qb as any).orIgnore = jest.fn().mockReturnThis();
      (qb.execute as jest.Mock).mockResolvedValue({});
      mockReadRepo.createQueryBuilder!.mockReturnValue(qb as any);

      await service.markRead('task-uuid', 'user-uuid', ['550e8400-e29b-41d4-a716-446655440000']);

      expect(mockCacheHelper.del).toHaveBeenCalledWith('unread:user-uuid:task-uuid');
      expect(mockEventsGateway.emitChatRead).toHaveBeenCalledWith(
        'task-uuid',
        'user-uuid',
        ['550e8400-e29b-41d4-a716-446655440000'],
      );
    });
  });

  // ── getUnreadCount ────────────────────────────────────────────────────────

  describe('getUnreadCount', () => {
    it('should return cached count on cache hit', async () => {
      mockCacheHelper.get.mockResolvedValueOnce(3);

      const result = await service.getUnreadCount('task-uuid', 'user-uuid');

      expect(result).toBe(3);
      expect(mockMessageRepo.createQueryBuilder).not.toHaveBeenCalled();
    });

    it('should query DB on cache miss and cache result', async () => {
      const qb = createMockQueryBuilder<TaskMessage>();
      (qb.getCount as jest.Mock).mockResolvedValue(5);
      (qb as any).leftJoin = jest.fn().mockReturnThis();
      mockMessageRepo.createQueryBuilder!.mockReturnValue(qb as any);

      const result = await service.getUnreadCount('task-uuid', 'user-uuid');

      expect(result).toBe(5);
      expect(mockCacheHelper.set).toHaveBeenCalledWith(
        'unread:user-uuid:task-uuid',
        5,
        expect.any(Number),
      );
    });
  });

  // ── toggleReaction ────────────────────────────────────────────────────────

  describe('toggleReaction', () => {
    it('should add reaction when none exists', async () => {
      mockMessageRepo.findOne!.mockResolvedValue({ id: 'msg-uuid', taskId: 'task-uuid' });
      mockReactionRepo.findOne!.mockResolvedValue(null); // no existing reaction
      mockReactionRepo.create!.mockReturnValue({ messageId: 'msg-uuid', userId: 'user', emoji: '👍' } as any);
      mockReactionRepo.save!.mockResolvedValue({} as any);
      mockReactionRepo.find!.mockResolvedValue([{ emoji: '👍', userId: 'user' }] as any);

      const result = await service.toggleReaction('task-uuid', 'msg-uuid', 'user', '👍');

      expect(result.action).toBe('added');
      expect(mockReactionRepo.save).toHaveBeenCalled();
    });

    it('should remove reaction when one already exists', async () => {
      const existing = { id: 'react-uuid', messageId: 'msg-uuid', userId: 'user', emoji: '👍' };
      mockMessageRepo.findOne!.mockResolvedValue({ id: 'msg-uuid', taskId: 'task-uuid' });
      mockReactionRepo.findOne!.mockResolvedValue(existing as any);
      mockReactionRepo.remove!.mockResolvedValue(existing as any);
      mockReactionRepo.find!.mockResolvedValue([]);

      const result = await service.toggleReaction('task-uuid', 'msg-uuid', 'user', '👍');

      expect(result.action).toBe('removed');
      expect(mockReactionRepo.remove).toHaveBeenCalledWith(existing);
    });

    it('should fallback to 👍 for unknown emoji', async () => {
      mockMessageRepo.findOne!.mockResolvedValue({ id: 'msg-uuid', taskId: 'task-uuid' });
      mockReactionRepo.findOne!.mockResolvedValue(null);
      mockReactionRepo.create!.mockReturnValue({ emoji: '👍' } as any);
      mockReactionRepo.save!.mockResolvedValue({} as any);
      mockReactionRepo.find!.mockResolvedValue([]);

      await service.toggleReaction('task-uuid', 'msg-uuid', 'user', '🚀');

      expect(mockReactionRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ emoji: '👍' }),
      );
    });

    it('should throw NotFoundException when message not found', async () => {
      mockMessageRepo.findOne!.mockResolvedValue(null);

      await expect(
        service.toggleReaction('task-uuid', 'bad-msg', 'user', '👍'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should broadcast reaction event', async () => {
      mockMessageRepo.findOne!.mockResolvedValue({ id: 'msg-uuid', taskId: 'task-uuid' });
      mockReactionRepo.findOne!.mockResolvedValue(null);
      mockReactionRepo.create!.mockReturnValue({} as any);
      mockReactionRepo.save!.mockResolvedValue({} as any);
      mockReactionRepo.find!.mockResolvedValue([{ emoji: '👍', userId: 'user' }] as any);

      await service.toggleReaction('task-uuid', 'msg-uuid', 'user', '👍');

      expect(mockEventsGateway.emitChatReaction).toHaveBeenCalled();
    });
  });

  // ── broadcastToDistrict ───────────────────────────────────────────────────

  describe('broadcastToDistrict', () => {
    it('should call emitBroadcast on the gateway', async () => {
      await service.broadcastToDistrict('Colombo', 'Alert message', 'Supervisor Name');

      expect(mockEventsGateway.emitBroadcast).toHaveBeenCalledWith(
        'Colombo',
        expect.objectContaining({
          content: 'Alert message',
          senderName: 'Supervisor Name',
          districtName: 'Colombo',
        }),
      );
    });
  });
});
