import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { EmailService } from './email.service';
import { EMAIL_BULL_QUEUE } from './email.constants';
import { User, UserRole } from '../entities/user.entity';
import { NotificationPreference } from './entities/notification-preference.entity';

describe('EmailService', () => {
  let service: EmailService;

  const mockQueue = {
    add: jest.fn().mockResolvedValue({}),
  };

  const mockUserRepo = {
    findOne: jest.fn(),
    find: jest.fn(),
  };

  const mockNotifPrefRepo = {
    findOne: jest.fn(),
  };

  function buildModule(emailEnabled: string) {
    return Test.createTestingModule({
      providers: [
        EmailService,
        { provide: EMAIL_BULL_QUEUE, useValue: mockQueue },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockImplementation((key: string) => {
              if (key === 'EMAIL_ENABLED') return emailEnabled;
              return undefined;
            }),
          },
        },
        { provide: getRepositoryToken(User), useValue: mockUserRepo },
        { provide: getRepositoryToken(NotificationPreference), useValue: mockNotifPrefRepo },
      ],
    }).compile();
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ── send — disabled ───────────────────────────────────────────────────────

  describe('send — EMAIL_ENABLED=false', () => {
    beforeEach(async () => {
      const module: TestingModule = await buildModule('false');
      service = module.get<EmailService>(EmailService);
    });

    it('should skip without enqueueing when email is disabled', async () => {
      await service.send({ to: 'user@test.com', subject: 'Test', template: 'welcome', context: {} });

      expect(mockQueue.add).not.toHaveBeenCalled();
    });
  });

  // ── send — enabled ────────────────────────────────────────────────────────

  describe('send — EMAIL_ENABLED=true', () => {
    beforeEach(async () => {
      const module: TestingModule = await buildModule('true');
      service = module.get<EmailService>(EmailService);
    });

    it('should enqueue a job for a single recipient', async () => {
      mockUserRepo.findOne.mockResolvedValue(null); // no opt-out check short-circuit
      mockNotifPrefRepo.findOne.mockResolvedValue(null);

      await service.send({ to: 'user@test.com', subject: 'Hello', template: 'welcome', context: {} });

      expect(mockQueue.add).toHaveBeenCalledTimes(1);
      expect(mockQueue.add).toHaveBeenCalledWith(
        'send',
        expect.objectContaining({ to: 'user@test.com', subject: 'Hello' }),
        expect.objectContaining({ attempts: 3 }),
      );
    });

    it('should enqueue a job per recipient for an array of recipients', async () => {
      mockUserRepo.findOne.mockResolvedValue(null);

      await service.send({
        to: ['a@test.com', 'b@test.com'],
        subject: 'Bulk',
        template: 'welcome',
        context: {},
      });

      expect(mockQueue.add).toHaveBeenCalledTimes(2);
    });

    it('should skip recipient who has opted out of notification category', async () => {
      const user = { id: 'user-uuid' };
      const pref = { userId: 'user-uuid', taskAssigned: false };
      mockUserRepo.findOne.mockResolvedValue(user);
      mockNotifPrefRepo.findOne.mockResolvedValue(pref);

      await service.send({
        to: 'user@test.com',
        subject: 'Task',
        template: 'task-assigned',
        context: {},
        notificationCategory: 'taskAssigned',
      });

      expect(mockQueue.add).not.toHaveBeenCalled();
    });

    it('should send when notification preference is true', async () => {
      const user = { id: 'user-uuid' };
      const pref = { userId: 'user-uuid', taskAssigned: true };
      mockUserRepo.findOne.mockResolvedValue(user);
      mockNotifPrefRepo.findOne.mockResolvedValue(pref);

      await service.send({
        to: 'user@test.com',
        subject: 'Task',
        template: 'task-assigned',
        context: {},
        notificationCategory: 'taskAssigned',
      });

      expect(mockQueue.add).toHaveBeenCalledTimes(1);
    });

    it('should skip opt-out check when no notificationCategory provided', async () => {
      await service.send({
        to: 'user@test.com',
        subject: 'Generic',
        template: 'generic',
        context: {},
      });

      expect(mockUserRepo.findOne).not.toHaveBeenCalled();
      expect(mockQueue.add).toHaveBeenCalledTimes(1);
    });

    it('should not throw if queue.add fails', async () => {
      mockQueue.add.mockRejectedValue(new Error('Queue error'));

      await expect(
        service.send({ to: 'user@test.com', subject: 'Test', template: 'welcome', context: {} }),
      ).resolves.toBeUndefined();
    });
  });

  // ── sendToRole ────────────────────────────────────────────────────────────

  describe('sendToRole', () => {
    beforeEach(async () => {
      const module: TestingModule = await buildModule('true');
      service = module.get<EmailService>(EmailService);
    });

    it('should fetch active users with role and enqueue one job each', async () => {
      const users = [
        { id: 'u1', email: 'admin1@test.com', name: 'Admin 1' },
        { id: 'u2', email: 'admin2@test.com', name: 'Admin 2' },
      ];
      mockUserRepo.find.mockResolvedValue(users);
      mockUserRepo.findOne.mockResolvedValue(null); // no opt-out

      await service.sendToRole(UserRole.ADMIN, {
        subject: 'Report Ready',
        template: 'report-generated',
        context: {},
      });

      expect(mockUserRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({ where: { role: UserRole.ADMIN, isActive: true } }),
      );
      expect(mockQueue.add).toHaveBeenCalledTimes(2);
    });

    it('should skip if EMAIL_ENABLED is false', async () => {
      const module = await buildModule('false');
      service = module.get<EmailService>(EmailService);

      await service.sendToRole(UserRole.ADMIN, { subject: 'X', template: 'x', context: {} });

      expect(mockUserRepo.find).not.toHaveBeenCalled();
      expect(mockQueue.add).not.toHaveBeenCalled();
    });

    it('should not throw when DB query for users fails', async () => {
      mockUserRepo.find.mockRejectedValue(new Error('DB down'));

      await expect(
        service.sendToRole(UserRole.ADMIN, { subject: 'X', template: 'x', context: {} }),
      ).resolves.toBeUndefined();
    });
  });
});
