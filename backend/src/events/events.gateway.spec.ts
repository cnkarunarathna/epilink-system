import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import { EventsGateway, AuthenticatedSocket } from './events.gateway';
import { Task } from '../tasks/entities/task.entity';

describe('EventsGateway', () => {
  let eventsGateway: EventsGateway;
  let jwtService: jest.Mocked<JwtService>;
  let configService: jest.Mocked<ConfigService>;

  const mockJwtService = {
    verifyAsync: jest.fn(),
    sign: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn().mockReturnValue('test-secret'),
    getOrThrow: jest.fn().mockReturnValue('test-secret'),
  };

  const mockServer = {
    emit: jest.fn(),
    to: jest.fn().mockReturnThis(),
    sockets: {
      sockets: new Map([
        ['socket-1', {}],
        ['socket-2', {}],
      ]),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EventsGateway,
        {
          provide: JwtService,
          useValue: mockJwtService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: getRepositoryToken(Task),
          useValue: { findOne: jest.fn() },
        },
      ],
    }).compile();

    eventsGateway = module.get<EventsGateway>(EventsGateway);
    jwtService = module.get(JwtService);
    configService = module.get(ConfigService);

    // Inject mock server
    (eventsGateway as any).server = mockServer;
  });

  describe('afterInit', () => {
    it('should log initialization', () => {
      const logSpy = jest.spyOn((eventsGateway as any).logger, 'log');
      eventsGateway.afterInit();
      expect(logSpy).toHaveBeenCalledWith('WebSocket Gateway initialized');
    });
  });

  describe('handleConnection', () => {
    const mockSocket = {
      id: 'socket-123',
      handshake: {
        auth: { token: 'valid-token' },
        headers: {},
      },
      join: jest.fn(),
      disconnect: jest.fn(),
      user: undefined,
    } as unknown as AuthenticatedSocket;

    it('should authenticate user and join rooms on valid token', async () => {
      mockJwtService.verifyAsync.mockResolvedValue({
        sub: 'user-uuid',
        email: 'test@example.com',
        role: 'admin',
        district: 'Colombo',
      });

      await eventsGateway.handleConnection(mockSocket);

      expect(mockSocket.user).toEqual({
        id: 'user-uuid',
        email: 'test@example.com',
        role: 'admin',
        district: 'Colombo',
      });
      expect(mockSocket.join).toHaveBeenCalledWith('role:admin');
      expect(mockSocket.join).toHaveBeenCalledWith('district:Colombo');
      expect(mockSocket.join).toHaveBeenCalledWith('user:user-uuid');
    });

    it('should disconnect client with no token', async () => {
      const noTokenSocket = {
        id: 'socket-123',
        handshake: {
          auth: {},
          headers: {},
        },
        disconnect: jest.fn(),
      } as unknown as AuthenticatedSocket;

      await eventsGateway.handleConnection(noTokenSocket);

      expect(noTokenSocket.disconnect).toHaveBeenCalled();
    });

    it('should disconnect client with invalid token', async () => {
      mockJwtService.verifyAsync.mockRejectedValue(new Error('Invalid token'));

      await eventsGateway.handleConnection(mockSocket);

      expect(mockSocket.disconnect).toHaveBeenCalled();
    });
  });

  describe('handleDisconnect', () => {
    it('should log disconnection', () => {
      const logSpy = jest.spyOn((eventsGateway as any).logger, 'log');
      const mockSocket = {
        id: 'socket-123',
        user: { email: 'test@example.com' },
      } as unknown as AuthenticatedSocket;

      eventsGateway.handleDisconnect(mockSocket);

      expect(logSpy).toHaveBeenCalled();
    });
  });

  describe('emitUserCreated', () => {
    it('should emit user:created to admin and supervisor rooms', () => {
      const user = { id: 'user-1', email: 'test@example.com' };

      eventsGateway.emitUserCreated(user);

      expect(mockServer.to).toHaveBeenCalledWith('role:admin');
      expect(mockServer.to).toHaveBeenCalledWith('role:supervisor');
      expect(mockServer.emit).toHaveBeenCalledWith('user:created', user);
    });
  });

  describe('emitUserUpdated', () => {
    it('should emit user:updated to admin and supervisor rooms', () => {
      const user = { id: 'user-1', email: 'test@example.com' };

      eventsGateway.emitUserUpdated(user);

      expect(mockServer.to).toHaveBeenCalledWith('role:admin');
      expect(mockServer.to).toHaveBeenCalledWith('role:supervisor');
      expect(mockServer.emit).toHaveBeenCalledWith('user:updated', user);
    });
  });

  describe('emitUserDeleted', () => {
    it('should emit user:deleted to admin and supervisor rooms', () => {
      eventsGateway.emitUserDeleted('user-1');

      expect(mockServer.to).toHaveBeenCalledWith('role:admin');
      expect(mockServer.to).toHaveBeenCalledWith('role:supervisor');
      expect(mockServer.emit).toHaveBeenCalledWith('user:deleted', {
        id: 'user-1',
      });
    });
  });

  describe('emitUserStatusChanged', () => {
    it('should emit user:status-changed to admin and supervisor rooms', () => {
      eventsGateway.emitUserStatusChanged('user-1', false);

      expect(mockServer.to).toHaveBeenCalledWith('role:admin');
      expect(mockServer.to).toHaveBeenCalledWith('role:supervisor');
      expect(mockServer.emit).toHaveBeenCalledWith('user:status-changed', {
        id: 'user-1',
        isActive: false,
      });
    });
  });

  describe('emitAnalyticsUpdated', () => {
    it('should emit analytics:updated to all connected clients', () => {
      const data = { type: 'predictions', payload: { count: 25 } };

      eventsGateway.emitAnalyticsUpdated(data);

      expect(mockServer.emit).toHaveBeenCalledWith('analytics:updated', data);
    });
  });

  describe('emitNotification', () => {
    it('should emit to specific district when provided', () => {
      const notification = { title: 'Alert', message: 'Test' };

      eventsGateway.emitNotification(notification, undefined, 'Colombo');

      expect(mockServer.to).toHaveBeenCalledWith('district:Colombo');
      expect(mockServer.emit).toHaveBeenCalledWith(
        'notification',
        notification,
      );
    });

    it('should emit to specific roles when provided', () => {
      const notification = { title: 'Alert', message: 'Test' };

      eventsGateway.emitNotification(notification, ['admin', 'supervisor']);

      expect(mockServer.to).toHaveBeenCalledWith('role:admin');
      expect(mockServer.to).toHaveBeenCalledWith('role:supervisor');
    });

    it('should emit to all when no target specified', () => {
      const notification = { title: 'Alert', message: 'Test' };

      eventsGateway.emitNotification(notification);

      expect(mockServer.emit).toHaveBeenCalledWith(
        'notification',
        notification,
      );
    });
  });

  describe('emitToUser', () => {
    it('should emit to specific user room', () => {
      eventsGateway.emitToUser('user-1', 'custom-event', { data: 'test' });

      expect(mockServer.to).toHaveBeenCalledWith('user:user-1');
      expect(mockServer.emit).toHaveBeenCalledWith('custom-event', {
        data: 'test',
      });
    });
  });

  describe('getConnectedClients', () => {
    it('should return number of connected clients', () => {
      const count = eventsGateway.getConnectedClients();

      expect(count).toBe(2);
    });

    it('should return 0 when server not initialized', () => {
      (eventsGateway as any).server = null;

      const count = eventsGateway.getConnectedClients();

      expect(count).toBe(0);
    });
  });

  // ── Task emit helpers ─────────────────────────────────────────────────────

  describe('emitTaskCreated', () => {
    it('should emit to district, supervisor, admin rooms and assigned PHI', () => {
      const task = { id: 'task-1', assignedPhiId: 'phi-1' };

      eventsGateway.emitTaskCreated(task, 'Colombo');

      expect(mockServer.to).toHaveBeenCalledWith('district:Colombo');
      expect(mockServer.to).toHaveBeenCalledWith('role:supervisor');
      expect(mockServer.to).toHaveBeenCalledWith('role:admin');
      expect(mockServer.to).toHaveBeenCalledWith('user:phi-1');
      expect(mockServer.emit).toHaveBeenCalledWith('task:created', task);
    });

    it('should skip district and PHI rooms when not provided', () => {
      const task = { id: 'task-1', assignedPhiId: null };

      mockServer.to.mockClear();
      eventsGateway.emitTaskCreated(task);

      const calledRooms = mockServer.to.mock.calls.map(([r]: [string]) => r);
      expect(calledRooms).not.toContain(expect.stringContaining('district:'));
      expect(calledRooms).not.toContain(expect.stringContaining('user:'));
    });
  });

  describe('emitTaskUpdated', () => {
    it('should emit task:updated to district, roles, and assigned PHI', () => {
      const task = { id: 'task-1', assignedPhiId: 'phi-1' };

      eventsGateway.emitTaskUpdated(task, 'Gampaha');

      expect(mockServer.to).toHaveBeenCalledWith('district:Gampaha');
      expect(mockServer.emit).toHaveBeenCalledWith('task:updated', task);
    });
  });

  describe('emitTaskStatusChanged', () => {
    it('should emit task:status-changed with old and new status', () => {
      const task = { id: 'task-1', assignedPhiId: null };

      eventsGateway.emitTaskStatusChanged(task, 'pending', 'in_progress', 'Colombo');

      expect(mockServer.emit).toHaveBeenCalledWith(
        'task:status-changed',
        expect.objectContaining({ oldStatus: 'pending', newStatus: 'in_progress' }),
      );
    });
  });

  describe('emitTaskAssigned', () => {
    it('should emit task:assigned to district, roles, and the assigned PHI', () => {
      const task = { id: 'task-1' };

      eventsGateway.emitTaskAssigned(task, 'phi-1', 'Kalutara');

      expect(mockServer.to).toHaveBeenCalledWith('district:Kalutara');
      expect(mockServer.to).toHaveBeenCalledWith('user:phi-1');
      expect(mockServer.emit).toHaveBeenCalledWith('task:assigned', { task, phiId: 'phi-1' });
    });
  });

  describe('emitTaskDeleted', () => {
    it('should emit task:deleted with taskId payload', () => {
      eventsGateway.emitTaskDeleted('task-1', 'Colombo', 'phi-1');

      expect(mockServer.emit).toHaveBeenCalledWith('task:deleted', { taskId: 'task-1' });
    });
  });

  // ── Chat emit helpers ─────────────────────────────────────────────────────

  describe('emitChatMessage', () => {
    it('should emit chat:message to the task room', () => {
      const message = { id: 'msg-1', content: 'Hello' } as any;

      eventsGateway.emitChatMessage('task-1', message);

      expect(mockServer.to).toHaveBeenCalledWith('task:task-1');
      expect(mockServer.emit).toHaveBeenCalledWith('chat:message', message);
    });
  });

  describe('emitChatRead', () => {
    it('should emit chat:read with userId and messageIds', () => {
      eventsGateway.emitChatRead('task-1', 'user-1', ['msg-1', 'msg-2']);

      expect(mockServer.to).toHaveBeenCalledWith('task:task-1');
      expect(mockServer.emit).toHaveBeenCalledWith(
        'chat:read',
        expect.objectContaining({ taskId: 'task-1', userId: 'user-1', messageIds: ['msg-1', 'msg-2'] }),
      );
    });
  });

  describe('emitChatReaction', () => {
    it('should emit chat:reaction to the task room', () => {
      eventsGateway.emitChatReaction('task-1', 'msg-1', 'user-1', '👍', 'added', []);

      expect(mockServer.to).toHaveBeenCalledWith('task:task-1');
      expect(mockServer.emit).toHaveBeenCalledWith(
        'chat:reaction',
        expect.objectContaining({ action: 'added', emoji: '👍' }),
      );
    });
  });

  describe('emitBroadcast', () => {
    it('should emit chat:broadcast to the district room', () => {
      const payload = { content: 'Alert!', senderName: 'Admin', districtName: 'Colombo', sentAt: new Date() };

      eventsGateway.emitBroadcast('Colombo', payload);

      expect(mockServer.to).toHaveBeenCalledWith('district:Colombo');
      expect(mockServer.emit).toHaveBeenCalledWith('chat:broadcast', payload);
    });
  });

  // ── Chat socket handlers ──────────────────────────────────────────────────

  describe('handleChatJoin', () => {
    let mockTaskRepo: any;

    beforeEach(() => {
      mockTaskRepo = (eventsGateway as any).taskRepository;
      jest.clearAllMocks();
      (eventsGateway as any).server = mockServer;
    });

    it('should join task room when user is the creator', async () => {
      mockTaskRepo.findOne.mockResolvedValue({
        id: 'task-1',
        createdById: 'user-1',
        assignedPhiId: null,
      });

      const client = {
        user: { id: 'user-1', role: 'supervisor' },
        join: jest.fn().mockResolvedValue(undefined),
      } as unknown as AuthenticatedSocket;

      await eventsGateway.handleChatJoin({ taskId: 'task-1' }, client);

      expect(client.join).toHaveBeenCalledWith('task:task-1');
    });

    it('should join task room when user is an admin', async () => {
      mockTaskRepo.findOne.mockResolvedValue({
        id: 'task-1',
        createdById: 'sup-1',
        assignedPhiId: null,
      });

      const client = {
        user: { id: 'admin-1', role: 'admin' },
        join: jest.fn().mockResolvedValue(undefined),
      } as unknown as AuthenticatedSocket;

      await eventsGateway.handleChatJoin({ taskId: 'task-1' }, client);

      expect(client.join).toHaveBeenCalledWith('task:task-1');
    });

    it('should not join when user is not a participant', async () => {
      mockTaskRepo.findOne.mockResolvedValue({
        id: 'task-1',
        createdById: 'other-user',
        assignedPhiId: 'other-phi',
      });

      const client = {
        user: { id: 'stranger', role: 'phi' },
        join: jest.fn(),
      } as unknown as AuthenticatedSocket;

      await eventsGateway.handleChatJoin({ taskId: 'task-1' }, client);

      expect(client.join).not.toHaveBeenCalled();
    });

    it('should not join when client has no user attached', async () => {
      const client = {
        user: undefined,
        join: jest.fn(),
      } as unknown as AuthenticatedSocket;

      await eventsGateway.handleChatJoin({ taskId: 'task-1' }, client);

      expect(client.join).not.toHaveBeenCalled();
    });

    it('should not join when task is not found', async () => {
      mockTaskRepo.findOne.mockResolvedValue(null);

      const client = {
        user: { id: 'user-1', role: 'phi' },
        join: jest.fn(),
      } as unknown as AuthenticatedSocket;

      await eventsGateway.handleChatJoin({ taskId: 'missing-task' }, client);

      expect(client.join).not.toHaveBeenCalled();
    });
  });

  describe('handleChatLeave', () => {
    it('should leave the task room', async () => {
      const client = {
        user: { id: 'user-1' },
        leave: jest.fn().mockResolvedValue(undefined),
      } as unknown as AuthenticatedSocket;

      await eventsGateway.handleChatLeave({ taskId: 'task-1' }, client);

      expect(client.leave).toHaveBeenCalledWith('task:task-1');
    });

    it('should do nothing when taskId is absent', async () => {
      const client = {
        user: { id: 'user-1' },
        leave: jest.fn(),
      } as unknown as AuthenticatedSocket;

      await eventsGateway.handleChatLeave({} as any, client);

      expect(client.leave).not.toHaveBeenCalled();
    });
  });

  describe('handleChatTyping', () => {
    it('should broadcast typing status to the task room', () => {
      const mockTo = jest.fn().mockReturnValue({ emit: jest.fn() });
      const client = {
        user: { id: 'user-1', email: 'user@test.com' },
        to: mockTo,
      } as unknown as AuthenticatedSocket;

      eventsGateway.handleChatTyping({ taskId: 'task-1', isTyping: true }, client);

      expect(mockTo).toHaveBeenCalledWith('task:task-1');
    });

    it('should do nothing when client has no user', () => {
      const mockTo = jest.fn();
      const client = {
        user: undefined,
        to: mockTo,
      } as unknown as AuthenticatedSocket;

      eventsGateway.handleChatTyping({ taskId: 'task-1', isTyping: false }, client);

      expect(mockTo).not.toHaveBeenCalled();
    });
  });
});
