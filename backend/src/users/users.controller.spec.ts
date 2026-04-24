import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { UserRole } from '../entities/user.entity';

describe('UsersController', () => {
  let controller: UsersController;

  const mockUsersService = {
    create: jest.fn(),
    createPhiForSupervisor: jest.fn(),
    updatePhiForSupervisor: jest.fn(),
    deletePhiForSupervisor: jest.fn(),
    togglePhiStatusForSupervisor: jest.fn(),
    findAll: jest.fn(),
    getStats: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    toggleStatus: jest.fn(),
    remove: jest.fn(),
    getNotificationPreferences: jest.fn(),
    updateNotificationPreferences: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [{ provide: UsersService, useValue: mockUsersService }],
    }).compile();

    controller = module.get<UsersController>(UsersController);
  });

  // ── create (Admin) ────────────────────────────────────────────────────────

  describe('create', () => {
    it('should delegate to usersService.create', async () => {
      const dto = { name: 'Alice', email: 'alice@test.com', password: 'pw', role: UserRole.PHI };
      const created = { id: 'user-uuid', ...dto };
      mockUsersService.create.mockResolvedValue(created);

      const result = await controller.create(dto as any);

      expect(mockUsersService.create).toHaveBeenCalledWith(dto);
      expect(result).toEqual(created);
    });
  });

  // ── createPhi (Supervisor) ────────────────────────────────────────────────

  describe('createPhi', () => {
    it('should create PHI when supervisor has a district', async () => {
      const req = { user: { id: 'sup-uuid', role: UserRole.SUPERVISOR, district: 'Colombo' } };
      const phiData = { name: 'Bob', email: 'bob@test.com', password: 'pw' };
      const created = { id: 'phi-uuid', ...phiData };
      mockUsersService.createPhiForSupervisor.mockResolvedValue(created);

      const result = await controller.createPhi(req, phiData);

      expect(mockUsersService.createPhiForSupervisor).toHaveBeenCalledWith('Colombo', phiData);
      expect(result).toEqual(created);
    });

    it('should throw BadRequestException when supervisor has no district', async () => {
      const req = { user: { id: 'sup-uuid', role: UserRole.SUPERVISOR, district: null } };

      await expect(
        controller.createPhi(req, { name: 'Bob', email: 'bob@test.com', password: 'pw' }),
      ).rejects.toThrow(BadRequestException);

      expect(mockUsersService.createPhiForSupervisor).not.toHaveBeenCalled();
    });
  });

  // ── findAll ───────────────────────────────────────────────────────────────

  describe('findAll', () => {
    it('should return all users from usersService', async () => {
      const users = [{ id: 'u1' }, { id: 'u2' }];
      mockUsersService.findAll.mockResolvedValue(users);

      const result = await controller.findAll();

      expect(mockUsersService.findAll).toHaveBeenCalled();
      expect(result).toEqual(users);
    });
  });

  // ── getStats ──────────────────────────────────────────────────────────────

  describe('getStats', () => {
    it('should return stats from usersService', async () => {
      const stats = { total: 10, active: 8, byRole: {} };
      mockUsersService.getStats.mockResolvedValue(stats);

      const result = await controller.getStats();

      expect(result).toEqual(stats);
    });
  });

  // ── findOne ───────────────────────────────────────────────────────────────

  describe('findOne', () => {
    it('should return a user by id', async () => {
      const user = { id: 'user-uuid', email: 'user@test.com' };
      mockUsersService.findOne.mockResolvedValue(user);

      const result = await controller.findOne('user-uuid');

      expect(mockUsersService.findOne).toHaveBeenCalledWith('user-uuid');
      expect(result).toEqual(user);
    });

    it('should propagate NotFoundException when user does not exist', async () => {
      mockUsersService.findOne.mockRejectedValue(new NotFoundException());

      await expect(controller.findOne('bad-uuid')).rejects.toThrow(NotFoundException);
    });
  });

  // ── update ────────────────────────────────────────────────────────────────

  describe('update', () => {
    it('should delegate to usersService.update', async () => {
      const dto = { name: 'Updated Name' };
      const updated = { id: 'user-uuid', name: 'Updated Name' };
      mockUsersService.update.mockResolvedValue(updated);

      const result = await controller.update('user-uuid', dto as any);

      expect(mockUsersService.update).toHaveBeenCalledWith('user-uuid', dto);
      expect(result).toEqual(updated);
    });
  });

  // ── toggleStatus ──────────────────────────────────────────────────────────

  describe('toggleStatus', () => {
    it('should delegate to usersService.toggleStatus', async () => {
      mockUsersService.toggleStatus.mockResolvedValue({ id: 'user-uuid', isActive: false });

      const result = await controller.toggleStatus('user-uuid');

      expect(mockUsersService.toggleStatus).toHaveBeenCalledWith('user-uuid');
      expect(result).toEqual({ id: 'user-uuid', isActive: false });
    });
  });

  // ── remove ────────────────────────────────────────────────────────────────

  describe('remove', () => {
    it('should delegate to usersService.remove', async () => {
      mockUsersService.remove.mockResolvedValue(undefined);

      await controller.remove('user-uuid');

      expect(mockUsersService.remove).toHaveBeenCalledWith('user-uuid');
    });
  });

  // ── getNotificationPreferences ────────────────────────────────────────────

  describe('getNotificationPreferences', () => {
    it('should return preferences when user requests their own', async () => {
      const prefs = { taskAssigned: true, weeklyDigest: false };
      mockUsersService.getNotificationPreferences.mockResolvedValue(prefs);

      const req = { user: { id: 'user-uuid', role: UserRole.PHI } };
      const result = await controller.getNotificationPreferences('user-uuid', req);

      expect(result).toEqual(prefs);
    });

    it('should return preferences when admin requests any user', async () => {
      const prefs = { taskAssigned: true };
      mockUsersService.getNotificationPreferences.mockResolvedValue(prefs);

      const req = { user: { id: 'admin-uuid', role: UserRole.ADMIN } };
      const result = await controller.getNotificationPreferences('other-uuid', req);

      expect(result).toEqual(prefs);
    });

    it('should throw ForbiddenException when non-admin requests another user\'s preferences', async () => {
      const req = { user: { id: 'user-uuid', role: UserRole.PHI } };

      await expect(
        controller.getNotificationPreferences('other-uuid', req),
      ).rejects.toThrow(ForbiddenException);

      expect(mockUsersService.getNotificationPreferences).not.toHaveBeenCalled();
    });
  });

  // ── updateNotificationPreferences ─────────────────────────────────────────

  describe('updateNotificationPreferences', () => {
    it('should update preferences when user updates their own', async () => {
      const dto = { taskAssigned: false };
      const updated = { taskAssigned: false };
      mockUsersService.updateNotificationPreferences.mockResolvedValue(updated);

      const req = { user: { id: 'user-uuid', role: UserRole.PHI } };
      const result = await controller.updateNotificationPreferences('user-uuid', req, dto);

      expect(mockUsersService.updateNotificationPreferences).toHaveBeenCalledWith('user-uuid', dto);
      expect(result).toEqual(updated);
    });

    it('should throw ForbiddenException when non-admin updates another user\'s preferences', async () => {
      const req = { user: { id: 'user-uuid', role: UserRole.PHI } };

      await expect(
        controller.updateNotificationPreferences('other-uuid', req, {}),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
