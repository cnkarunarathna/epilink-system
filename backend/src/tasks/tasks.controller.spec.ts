import { Test, TestingModule } from '@nestjs/testing';
import { TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';
import { GeocodingService } from './geocoding.service';
import { RouteService } from './route.service';
import { TaskStatus, TaskType, TaskPriority } from './entities/task.entity';
import { UserRole } from '../entities/user.entity';

describe('TasksController', () => {
  let controller: TasksController;

  const mockTasksService = {
    create: jest.fn(),
    findAll: jest.fn(),
    getStats: jest.fn(),
    getPhisByDistrict: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    updateStatus: jest.fn(),
    assignTask: jest.fn(),
    remove: jest.fn(),
    saveRouteOrder: jest.fn(),
    getEvidence: jest.fn(),
    addEvidence: jest.fn(),
    verifyEvidence: jest.fn(),
  };

  const mockGeocodingService = {
    geocodeAddress: jest.fn(),
    reverseGeocode: jest.fn(),
    searchAddresses: jest.fn(),
  };

  const mockRouteService = {
    optimizeRoute: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [TasksController],
      providers: [
        { provide: TasksService, useValue: mockTasksService },
        { provide: GeocodingService, useValue: mockGeocodingService },
        { provide: RouteService, useValue: mockRouteService },
      ],
    }).compile();

    controller = module.get<TasksController>(TasksController);
  });

  // ── create ────────────────────────────────────────────────────────────────

  describe('create', () => {
    it('should delegate to tasksService.create with user id', async () => {
      const dto = { title: 'New Task', description: 'Desc', districtId: 1 };
      const created = { id: 'task-uuid', ...dto };
      mockTasksService.create.mockResolvedValue(created);

      const req = { user: { id: 'creator-uuid' } };
      const result = await controller.create(dto as any, req);

      expect(mockTasksService.create).toHaveBeenCalledWith(dto, 'creator-uuid');
      expect(result).toEqual(created);
    });
  });

  // ── findAll ───────────────────────────────────────────────────────────────

  describe('findAll', () => {
    it('should pass undefined filters when no query params provided', async () => {
      mockTasksService.findAll.mockResolvedValue([]);

      await controller.findAll();

      expect(mockTasksService.findAll).toHaveBeenCalledWith({
        districtId: undefined,
        status: undefined,
        type: undefined,
        priority: undefined,
        assignedPhiId: undefined,
      });
    });

    it('should parse districtId as integer', async () => {
      mockTasksService.findAll.mockResolvedValue([]);

      await controller.findAll('5', TaskStatus.PENDING);

      expect(mockTasksService.findAll).toHaveBeenCalledWith(
        expect.objectContaining({ districtId: 5, status: TaskStatus.PENDING }),
      );
    });

    it('should apply all provided filters', async () => {
      mockTasksService.findAll.mockResolvedValue([]);

      await controller.findAll('3', TaskStatus.IN_PROGRESS, TaskType.FOGGING, TaskPriority.HIGH, 'phi-uuid');

      expect(mockTasksService.findAll).toHaveBeenCalledWith({
        districtId: 3,
        status: TaskStatus.IN_PROGRESS,
        type: TaskType.FOGGING,
        priority: TaskPriority.HIGH,
        assignedPhiId: 'phi-uuid',
      });
    });
  });

  // ── getStats ──────────────────────────────────────────────────────────────

  describe('getStats', () => {
    it('should pass undefined districtId when no query param', async () => {
      mockTasksService.getStats.mockResolvedValue({ total: 10 });

      await controller.getStats();

      expect(mockTasksService.getStats).toHaveBeenCalledWith(undefined);
    });

    it('should parse districtId as integer', async () => {
      mockTasksService.getStats.mockResolvedValue({ total: 3 });

      await controller.getStats('7');

      expect(mockTasksService.getStats).toHaveBeenCalledWith(7);
    });
  });

  // ── getPhisByDistrict ─────────────────────────────────────────────────────

  describe('getPhisByDistrict', () => {
    it('should delegate to tasksService.getPhisByDistrict', async () => {
      const phis = [{ id: 'phi-1' }];
      mockTasksService.getPhisByDistrict.mockResolvedValue(phis);

      const result = await controller.getPhisByDistrict('Colombo');

      expect(mockTasksService.getPhisByDistrict).toHaveBeenCalledWith('Colombo');
      expect(result).toEqual(phis);
    });
  });

  // ── findOne ───────────────────────────────────────────────────────────────

  describe('findOne', () => {
    it('should call tasksService.findOne with relations flag true', async () => {
      const task = { id: 'task-uuid', title: 'Task' };
      mockTasksService.findOne.mockResolvedValue(task);

      const result = await controller.findOne('task-uuid');

      expect(mockTasksService.findOne).toHaveBeenCalledWith('task-uuid', true);
      expect(result).toEqual(task);
    });
  });

  // ── update ────────────────────────────────────────────────────────────────

  describe('update', () => {
    it('should delegate to tasksService.update', async () => {
      const dto = { title: 'Updated Title' };
      const updated = { id: 'task-uuid', title: 'Updated Title' };
      mockTasksService.update.mockResolvedValue(updated);

      const result = await controller.update('task-uuid', dto as any);

      expect(mockTasksService.update).toHaveBeenCalledWith('task-uuid', dto);
      expect(result).toEqual(updated);
    });
  });

  // ── updateStatus ──────────────────────────────────────────────────────────

  describe('updateStatus', () => {
    it('should call tasksService.updateStatus with user id', async () => {
      const dto = { status: TaskStatus.IN_PROGRESS };
      mockTasksService.updateStatus.mockResolvedValue({ id: 'task-uuid', status: TaskStatus.IN_PROGRESS });

      const req = { user: { id: 'user-uuid', role: UserRole.PHI } };
      await controller.updateStatus('task-uuid', dto as any, req);

      expect(mockTasksService.updateStatus).toHaveBeenCalledWith('task-uuid', dto, 'user-uuid');
    });

    it('should strip force flag for PHI users', async () => {
      const dto: any = { status: TaskStatus.VERIFIED, force: true };
      mockTasksService.updateStatus.mockResolvedValue({});

      const req = { user: { id: 'phi-uuid', role: UserRole.PHI } };
      await controller.updateStatus('task-uuid', dto, req);

      expect(dto.force).toBe(false);
    });

    it('should allow force flag for supervisors', async () => {
      const dto: any = { status: TaskStatus.VERIFIED, force: true };
      mockTasksService.updateStatus.mockResolvedValue({});

      const req = { user: { id: 'sup-uuid', role: UserRole.SUPERVISOR } };
      await controller.updateStatus('task-uuid', dto, req);

      expect(dto.force).toBe(true);
    });

    it('should allow force flag for admins', async () => {
      const dto: any = { status: TaskStatus.VERIFIED, force: true };
      mockTasksService.updateStatus.mockResolvedValue({});

      const req = { user: { id: 'admin-uuid', role: UserRole.ADMIN } };
      await controller.updateStatus('task-uuid', dto, req);

      expect(dto.force).toBe(true);
    });
  });

  // ── assignTask ────────────────────────────────────────────────────────────

  describe('assignTask', () => {
    it('should call tasksService.assignTask with user id', async () => {
      const dto = { phiId: 'phi-uuid' };
      mockTasksService.assignTask.mockResolvedValue({ id: 'task-uuid', assignedPhiId: 'phi-uuid' });

      const req = { user: { id: 'assigner-uuid' } };
      const result = await controller.assignTask('task-uuid', dto as any, req);

      expect(mockTasksService.assignTask).toHaveBeenCalledWith('task-uuid', dto, 'assigner-uuid');
      expect(result).toHaveProperty('assignedPhiId', 'phi-uuid');
    });
  });

  // ── remove ────────────────────────────────────────────────────────────────

  describe('remove', () => {
    it('should delegate to tasksService.remove', async () => {
      mockTasksService.remove.mockResolvedValue(undefined);

      await controller.remove('task-uuid');

      expect(mockTasksService.remove).toHaveBeenCalledWith('task-uuid');
    });
  });

  // ── addEvidence ───────────────────────────────────────────────────────────

  describe('addEvidence', () => {
    it('should call tasksService.addEvidence with task id and user id', async () => {
      const dto = { description: 'Photo taken', photoUrl: 'http://s3/photo.jpg' };
      const evidence = { id: 'ev-uuid', ...dto };
      mockTasksService.addEvidence.mockResolvedValue(evidence);

      const req = { user: { id: 'phi-uuid' } };
      const result = await controller.addEvidence('task-uuid', dto as any, req);

      expect(mockTasksService.addEvidence).toHaveBeenCalledWith('task-uuid', dto, 'phi-uuid');
      expect(result).toEqual(evidence);
    });
  });

  // ── getEvidence ───────────────────────────────────────────────────────────

  describe('getEvidence', () => {
    it('should delegate to tasksService.getEvidence', async () => {
      const evidence = [{ id: 'ev-uuid' }];
      mockTasksService.getEvidence.mockResolvedValue(evidence);

      const result = await controller.getEvidence('task-uuid');

      expect(mockTasksService.getEvidence).toHaveBeenCalledWith('task-uuid');
      expect(result).toEqual(evidence);
    });
  });
});
