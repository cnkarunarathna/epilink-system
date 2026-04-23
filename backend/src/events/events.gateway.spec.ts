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
});
