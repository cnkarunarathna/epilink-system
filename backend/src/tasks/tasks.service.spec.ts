import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TasksService } from './tasks.service';
import { Task, TaskStatus, TaskType, TaskPriority } from './entities/task.entity';
import { Evidence, EvidenceStatus } from './entities/evidence.entity';
import { User, UserRole } from '../entities/user.entity';
import { EventsGateway } from '../events/events.gateway';
import { StorageService } from '../storage/storage.service';
import { CacheHelperService } from '../cache/cache-helper.service';
import { TaskMessagesService } from './task-messages.service';
import { EmailService } from '../email/email.service';
import { createMockRepository, createMockQueryBuilder } from '../test/mocks/typeorm.mock';

describe('TasksService', () => {
  let service: TasksService;

  const mockTaskRepo = createMockRepository<Task>();
  const mockEvidenceRepo = createMockRepository<Evidence>();
  const mockUserRepo = createMockRepository<User>();

  const mockEventsGateway = {
    emitTaskCreated: jest.fn(),
    emitTaskStatusChanged: jest.fn(),
    emitTaskAssigned: jest.fn(),
    emitTaskDeleted: jest.fn(),
    emitAnalyticsUpdated: jest.fn(),
  };

  const mockStorageService = {
    getSignedUrl: jest.fn().mockResolvedValue('https://signed.example.com/url'),
    uploadEvidenceImage: jest.fn(),
  };

  const mockCacheHelper = {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue(undefined),
    del: jest.fn().mockResolvedValue(undefined),
    delByPattern: jest.fn().mockResolvedValue(undefined),
    incr: jest.fn().mockResolvedValue(undefined),
  };

  const mockTaskMessagesService = {
    sendSystemMessage: jest.fn().mockResolvedValue(undefined),
  };

  const mockEmailService = {
    send: jest.fn().mockResolvedValue(undefined),
    sendToRole: jest.fn().mockResolvedValue(undefined),
  };

  const mockConfigService = {
    get: jest.fn().mockReturnValue('http://localhost:3000'),
    getOrThrow: jest.fn().mockReturnValue('http://localhost:3000'),
  };

  const mockDistrict = { id: 1, name: 'Colombo' };
  const mockPhi: Partial<User> = {
    id: 'phi-uuid',
    email: 'phi@example.com',
    name: 'Test PHI',
    role: UserRole.PHI,
    district: 'Colombo',
    isActive: true,
  };
  const mockTask: Partial<Task> = {
    id: 'task-uuid',
    title: 'Test Task',
    type: TaskType.INVESTIGATION,
    priority: TaskPriority.MEDIUM,
    status: TaskStatus.PENDING,
    districtId: 1,
    district: mockDistrict as any,
    assignedPhiId: null,
    assignedPhi: null,
    createdById: 'creator-uuid',
    evidence: [],
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    // Reset repository mocks to fresh instances
    Object.assign(mockTaskRepo, createMockRepository<Task>());
    Object.assign(mockEvidenceRepo, createMockRepository<Evidence>());
    Object.assign(mockUserRepo, createMockRepository<User>());

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TasksService,
        { provide: getRepositoryToken(Task), useValue: mockTaskRepo },
        { provide: getRepositoryToken(Evidence), useValue: mockEvidenceRepo },
        { provide: getRepositoryToken(User), useValue: mockUserRepo },
        { provide: EventsGateway, useValue: mockEventsGateway },
        { provide: StorageService, useValue: mockStorageService },
        { provide: CacheHelperService, useValue: mockCacheHelper },
        { provide: TaskMessagesService, useValue: mockTaskMessagesService },
        { provide: EmailService, useValue: mockEmailService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<TasksService>(TasksService);
  });

  // ── create ────────────────────────────────────────────────────────────────

  describe('create', () => {
    const createDto = {
      title: 'New Task',
      type: TaskType.INVESTIGATION,
      priority: TaskPriority.HIGH,
      districtId: 1,
    };

    it('should save the task and return it with relations', async () => {
      const saved = { ...mockTask, id: 'new-uuid', ...createDto };
      mockTaskRepo.save!.mockResolvedValue(saved);
      mockTaskRepo.findOne!.mockResolvedValue(saved);

      const result = await service.create(createDto as any, 'creator-uuid');

      expect(mockTaskRepo.save).toHaveBeenCalled();
      expect(result.id).toBe('new-uuid');
    });

    it('should set status to PENDING when no PHI assigned', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let capturedTask: any = null;
      mockTaskRepo.save!.mockImplementation((t) => {
        capturedTask = t;
        return Promise.resolve({ ...t, id: 'new-uuid' });
      });
      mockTaskRepo.findOne!.mockResolvedValue({ ...mockTask, id: 'new-uuid' });

      await service.create(createDto as any, 'creator-uuid');

      expect(capturedTask?.status).toBe(TaskStatus.PENDING);
    });

    it('should set status to ASSIGNED when PHI id provided', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let capturedTask: any = null;
      mockTaskRepo.save!.mockImplementation((t) => {
        capturedTask = t;
        return Promise.resolve({ ...t, id: 'new-uuid' });
      });
      const assignedTask = { ...mockTask, id: 'new-uuid', assignedPhiId: 'phi-uuid', assignedPhi: mockPhi };
      mockTaskRepo.findOne!.mockResolvedValue(assignedTask);

      await service.create({ ...createDto, assignedPhiId: 'phi-uuid' } as any, 'creator-uuid');

      expect(capturedTask?.status).toBe(TaskStatus.ASSIGNED);
    });

    it('should emit socket event after creation', async () => {
      mockTaskRepo.save!.mockResolvedValue({ ...mockTask, id: 'new-uuid' });
      mockTaskRepo.findOne!.mockResolvedValue({ ...mockTask, id: 'new-uuid' });

      await service.create(createDto as any, 'creator-uuid');

      expect(mockEventsGateway.emitTaskCreated).toHaveBeenCalled();
    });

    it('should send assignment email when task is created with PHI', async () => {
      const taskWithPhi = { ...mockTask, id: 'new-uuid', assignedPhiId: 'phi-uuid', assignedPhi: mockPhi };
      mockTaskRepo.save!.mockResolvedValue(taskWithPhi);
      mockTaskRepo.findOne!.mockResolvedValue(taskWithPhi);

      await service.create({ ...createDto, assignedPhiId: 'phi-uuid' } as any, 'creator-uuid');

      // Email is fire-and-forget; give the microtask queue time to flush
      await Promise.resolve();
      expect(mockEmailService.send).toHaveBeenCalledWith(
        expect.objectContaining({ template: 'task-assigned' }),
      );
    });
  });

  // ── findAll ───────────────────────────────────────────────────────────────

  describe('findAll', () => {
    it('should return cached result without hitting the DB', async () => {
      const cachedTasks = [mockTask];
      mockCacheHelper.get.mockResolvedValueOnce(cachedTasks);

      const result = await service.findAll();

      expect(result).toEqual(cachedTasks);
      expect(mockTaskRepo.createQueryBuilder).not.toHaveBeenCalled();
    });

    it('should query DB on cache miss and cache the result', async () => {
      const tasks = [mockTask];
      const qb = createMockQueryBuilder<Task>();
      (qb.getMany as jest.Mock).mockResolvedValue(tasks);
      mockTaskRepo.createQueryBuilder!.mockReturnValue(qb as any);

      const result = await service.findAll();

      expect(result).toEqual(tasks);
      expect(mockCacheHelper.set).toHaveBeenCalled();
    });

    it('should apply status filter when provided', async () => {
      const qb = createMockQueryBuilder<Task>();
      (qb.getMany as jest.Mock).mockResolvedValue([]);
      mockTaskRepo.createQueryBuilder!.mockReturnValue(qb as any);

      await service.findAll({ status: TaskStatus.PENDING });

      expect(qb.andWhere).toHaveBeenCalledWith(
        'task.status = :status',
        expect.objectContaining({ status: TaskStatus.PENDING }),
      );
    });

    it('should apply districtId filter when provided', async () => {
      const qb = createMockQueryBuilder<Task>();
      (qb.getMany as jest.Mock).mockResolvedValue([]);
      mockTaskRepo.createQueryBuilder!.mockReturnValue(qb as any);

      await service.findAll({ districtId: 1 });

      expect(qb.andWhere).toHaveBeenCalledWith(
        'task.districtId = :districtId',
        expect.objectContaining({ districtId: 1 }),
      );
    });

    it('should apply assignedPhiId filter when provided', async () => {
      const qb = createMockQueryBuilder<Task>();
      (qb.getMany as jest.Mock).mockResolvedValue([]);
      mockTaskRepo.createQueryBuilder!.mockReturnValue(qb as any);

      await service.findAll({ assignedPhiId: 'phi-uuid' });

      expect(qb.andWhere).toHaveBeenCalledWith(
        'task.assignedPhiId = :assignedPhiId',
        expect.objectContaining({ assignedPhiId: 'phi-uuid' }),
      );
    });
  });

  // ── findOne ───────────────────────────────────────────────────────────────

  describe('findOne', () => {
    it('should return task when found', async () => {
      mockTaskRepo.findOne!.mockResolvedValue(mockTask);

      const result = await service.findOne('task-uuid');

      expect(result).toEqual(mockTask);
    });

    it('should throw NotFoundException when task not found', async () => {
      mockTaskRepo.findOne!.mockResolvedValue(null);

      await expect(service.findOne('bad-uuid')).rejects.toThrow(NotFoundException);
    });
  });

  // ── update ────────────────────────────────────────────────────────────────

  describe('update', () => {
    it('should merge fields and save', async () => {
      const existing = { ...mockTask };
      mockTaskRepo.findOne!.mockResolvedValue(existing);
      mockTaskRepo.save!.mockResolvedValue({ ...existing, title: 'Updated' });

      const result = await service.update('task-uuid', { title: 'Updated' } as any);

      expect(result.title).toBe('Updated');
      expect(mockTaskRepo.save).toHaveBeenCalled();
    });

    it('should throw NotFoundException when task not found', async () => {
      mockTaskRepo.findOne!.mockResolvedValue(null);

      await expect(service.update('bad-uuid', { title: 'X' } as any)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should invalidate caches after update', async () => {
      mockTaskRepo.findOne!.mockResolvedValue({ ...mockTask });
      mockTaskRepo.save!.mockResolvedValue(mockTask);

      await service.update('task-uuid', {} as any);

      expect(mockCacheHelper.delByPattern).toHaveBeenCalledWith('tasks:*');
      expect(mockCacheHelper.delByPattern).toHaveBeenCalledWith('analytics:*');
    });
  });

  // ── updateStatus ──────────────────────────────────────────────────────────

  describe('updateStatus', () => {
    it('should transition PENDING → ASSIGNED successfully', async () => {
      const task = { ...mockTask, status: TaskStatus.PENDING };
      const saved = { ...task, status: TaskStatus.ASSIGNED };
      mockTaskRepo.findOne!
        .mockResolvedValueOnce(task)   // findOne inside updateStatus
        .mockResolvedValueOnce(saved); // findOne inside second findOne call
      mockTaskRepo.save!.mockResolvedValue(saved);

      const result = await service.updateStatus(
        'task-uuid',
        { status: TaskStatus.ASSIGNED },
        'actor-uuid',
      );

      expect(result.status).toBe(TaskStatus.ASSIGNED);
    });

    it('should throw BadRequestException on invalid transition', async () => {
      const task = { ...mockTask, status: TaskStatus.PENDING };
      mockTaskRepo.findOne!.mockResolvedValue(task);

      await expect(
        service.updateStatus('task-uuid', { status: TaskStatus.COMPLETED }, 'actor'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should allow force-complete regardless of current status', async () => {
      const task = { ...mockTask, status: TaskStatus.IN_PROGRESS };
      const saved = { ...task, status: TaskStatus.COMPLETED };
      mockTaskRepo.findOne!
        .mockResolvedValueOnce(task)
        .mockResolvedValueOnce(saved);
      mockTaskRepo.save!.mockResolvedValue(saved);

      const result = await service.updateStatus(
        'task-uuid',
        { status: TaskStatus.COMPLETED, force: true },
        'actor-uuid',
      );

      expect(result.status).toBe(TaskStatus.COMPLETED);
    });

    it('should emit socket events after status change', async () => {
      const task = { ...mockTask, status: TaskStatus.ASSIGNED };
      const saved = { ...task, status: TaskStatus.IN_PROGRESS };
      mockTaskRepo.findOne!
        .mockResolvedValueOnce(task)
        .mockResolvedValueOnce(saved);
      mockTaskRepo.save!.mockResolvedValue(saved);

      await service.updateStatus(
        'task-uuid',
        { status: TaskStatus.IN_PROGRESS },
        'actor-uuid',
      );

      expect(mockEventsGateway.emitTaskStatusChanged).toHaveBeenCalled();
      expect(mockEventsGateway.emitAnalyticsUpdated).toHaveBeenCalled();
    });
  });

  // ── assignTask ────────────────────────────────────────────────────────────

  describe('assignTask', () => {
    it('should assign PHI and return updated task', async () => {
      const assigned = { ...mockTask, status: TaskStatus.ASSIGNED, assignedPhiId: 'phi-uuid', assignedPhi: mockPhi };
      mockTaskRepo.findOne!
        .mockResolvedValueOnce({ ...mockTask }) // findOne in assignTask
        .mockResolvedValueOnce(assigned);       // findOne after save
      mockUserRepo.findOne!.mockResolvedValue(mockPhi);
      mockTaskRepo.save!.mockResolvedValue(assigned);

      const result = await service.assignTask('task-uuid', { assignedPhiId: 'phi-uuid' }, 'actor');

      expect(result.assignedPhiId).toBe('phi-uuid');
      expect(result.status).toBe(TaskStatus.ASSIGNED);
    });

    it('should throw BadRequestException when PHI not found or inactive', async () => {
      mockTaskRepo.findOne!.mockResolvedValue({ ...mockTask });
      mockUserRepo.findOne!.mockResolvedValue(null);

      await expect(
        service.assignTask('task-uuid', { assignedPhiId: 'bad-phi' }, 'actor'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should emit task assigned event', async () => {
      const assigned = { ...mockTask, assignedPhiId: 'phi-uuid', assignedPhi: mockPhi };
      mockTaskRepo.findOne!
        .mockResolvedValueOnce({ ...mockTask })
        .mockResolvedValueOnce(assigned);
      mockUserRepo.findOne!.mockResolvedValue(mockPhi);
      mockTaskRepo.save!.mockResolvedValue(assigned);

      await service.assignTask('task-uuid', { assignedPhiId: 'phi-uuid' });

      expect(mockEventsGateway.emitTaskAssigned).toHaveBeenCalled();
    });
  });

  // ── remove ────────────────────────────────────────────────────────────────

  describe('remove', () => {
    it('should remove the task and emit deleted event', async () => {
      mockTaskRepo.findOne!.mockResolvedValue({ ...mockTask });
      mockTaskRepo.remove!.mockResolvedValue(mockTask as Task);

      await service.remove('task-uuid');

      expect(mockTaskRepo.remove).toHaveBeenCalled();
      expect(mockEventsGateway.emitTaskDeleted).toHaveBeenCalledWith(
        'task-uuid',
        'Colombo',
        undefined,
      );
    });

    it('should throw NotFoundException when task not found', async () => {
      mockTaskRepo.findOne!.mockResolvedValue(null);

      await expect(service.remove('bad-uuid')).rejects.toThrow(NotFoundException);
    });
  });

  // ── getStats ──────────────────────────────────────────────────────────────

  describe('getStats', () => {
    it('should return cached stats on cache hit', async () => {
      const cached = { total: 5, pending: 2, assigned: 1, inProgress: 1, submitted: 0, completed: 1, rejected: 0, overdueCount: 0 };
      mockCacheHelper.get.mockResolvedValueOnce(cached);

      const result = await service.getStats();

      expect(result).toEqual(cached);
      expect(mockTaskRepo.createQueryBuilder).not.toHaveBeenCalled();
    });

    it('should compute stats from tasks on cache miss', async () => {
      const tasks = [
        { status: TaskStatus.PENDING, dueDate: null },
        { status: TaskStatus.COMPLETED, dueDate: null },
        { status: TaskStatus.IN_PROGRESS, dueDate: new Date(Date.now() - 86400000) }, // overdue
      ];
      const qb = createMockQueryBuilder<Task>();
      (qb.getMany as jest.Mock).mockResolvedValue(tasks);
      mockTaskRepo.createQueryBuilder!.mockReturnValue(qb as any);

      const result = await service.getStats();

      expect(result.total).toBe(3);
      expect(result.pending).toBe(1);
      expect(result.completed).toBe(1);
      expect(result.overdueCount).toBe(1);
    });
  });

  // ── addEvidence ───────────────────────────────────────────────────────────

  describe('addEvidence', () => {
    it('should throw ForbiddenException if submitter is not assigned PHI', async () => {
      mockTaskRepo.findOne!.mockResolvedValue({ ...mockTask, assignedPhiId: 'other-phi' });

      await expect(
        service.addEvidence('task-uuid', {} as any, 'wrong-user'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should save evidence and return it', async () => {
      const task = { ...mockTask, assignedPhiId: 'phi-uuid', district: mockDistrict as any };
      const evidence = { id: 'ev-uuid', taskId: 'task-uuid', notes: 'Found' };
      mockTaskRepo.findOne!.mockResolvedValue(task);
      mockEvidenceRepo.create!.mockReturnValue(evidence as any);
      mockEvidenceRepo.save!.mockResolvedValue(evidence as any);
      mockUserRepo.findOne!.mockResolvedValue(null); // no supervisor

      const result = await service.addEvidence(
        'task-uuid',
        { notes: 'Found' } as any,
        'phi-uuid',
      );

      expect(result).toEqual(evidence);
      expect(mockEvidenceRepo.save).toHaveBeenCalled();
    });
  });

  // ── getPhisByDistrict ─────────────────────────────────────────────────────

  describe('getPhisByDistrict', () => {
    it('should return cached PHI list on cache hit', async () => {
      const cached = [mockPhi];
      mockCacheHelper.get.mockResolvedValueOnce(cached);

      const result = await service.getPhisByDistrict('Colombo');

      expect(result).toEqual(cached);
      expect(mockUserRepo.find).not.toHaveBeenCalled();
    });

    it('should query DB on cache miss and cache result', async () => {
      mockUserRepo.find!.mockResolvedValue([mockPhi] as any);

      const result = await service.getPhisByDistrict('Colombo');

      expect(result).toEqual([mockPhi]);
      expect(mockCacheHelper.set).toHaveBeenCalled();
    });
  });
});
