import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConflictException, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { UsersService } from './users.service';
import { User, UserRole } from '../entities/user.entity';
import { NotificationPreference } from '../email/entities/notification-preference.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { EventsGateway } from '../events/events.gateway';
import { CacheHelperService } from '../cache/cache-helper.service';
import { EmailService } from '../email/email.service';
import { ConfigService } from '@nestjs/config';

// Mock bcrypt
jest.mock('bcrypt');

describe('UsersService', () => {
  let usersService: UsersService;
  let userRepository: jest.Mocked<Repository<User>>;
  let eventsGateway: jest.Mocked<EventsGateway>;

  const mockUser: Partial<User> = {
    id: 'test-uuid',
    email: 'test@example.com',
    password: 'hashedPassword123',
    name: 'Test User',
    role: UserRole.VIEWER,
    district: 'Colombo',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockUserRepository = {
    findOne: jest.fn(),
    find: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    remove: jest.fn(),
    count: jest.fn(),
    createQueryBuilder: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue([]),
    })),
  };

  const mockEventsGateway = {
    emitUserCreated: jest.fn(),
    emitUserUpdated: jest.fn(),
    emitUserDeleted: jest.fn(),
    emitUserStatusChanged: jest.fn(),
    emitAnalyticsUpdated: jest.fn(),
    emitNotification: jest.fn(),
    emitToUser: jest.fn(),
    getConnectedClients: jest.fn().mockReturnValue(0),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: getRepositoryToken(User),
          useValue: mockUserRepository,
        },
        {
          provide: getRepositoryToken(NotificationPreference),
          useValue: { findOne: jest.fn(), save: jest.fn(), create: jest.fn() },
        },
        {
          provide: EventsGateway,
          useValue: mockEventsGateway,
        },
        {
          provide: CacheHelperService,
          useValue: {
            get: jest.fn().mockResolvedValue(null),
            set: jest.fn().mockResolvedValue(undefined),
            del: jest.fn().mockResolvedValue(undefined),
            delByPattern: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: EmailService,
          useValue: { send: jest.fn().mockResolvedValue(undefined) },
        },
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue('http://localhost:3000'), getOrThrow: jest.fn().mockReturnValue('http://localhost:3000') },
        },
      ],
    }).compile();

    usersService = module.get<UsersService>(UsersService);
    userRepository = module.get(getRepositoryToken(User));
    eventsGateway = module.get(EventsGateway);
  });

  describe('create', () => {
    const createUserDto: CreateUserDto = {
      email: 'newuser@example.com',
      password: 'password123',
      name: 'New User',
      role: UserRole.VIEWER,
      district: 'Colombo',
    };

    it('should create a new user successfully', async () => {
      mockUserRepository.findOne.mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashedPassword');
      mockUserRepository.create.mockReturnValue({
        ...createUserDto,
        password: 'hashedPassword',
        id: 'new-uuid',
      });
      mockUserRepository.save.mockResolvedValue({
        ...createUserDto,
        password: 'hashedPassword',
        id: 'new-uuid',
      });

      const result = await usersService.create(createUserDto);

      expect(result).toHaveProperty('id');
      expect(result).not.toHaveProperty('password');
      expect(mockUserRepository.create).toHaveBeenCalled();
      expect(mockUserRepository.save).toHaveBeenCalled();
    });

    it('should hash password before saving', async () => {
      mockUserRepository.findOne.mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashedPassword');
      mockUserRepository.create.mockReturnValue({
        ...createUserDto,
        password: 'hashedPassword',
      });
      mockUserRepository.save.mockResolvedValue({
        ...createUserDto,
        password: 'hashedPassword',
        id: 'new-uuid',
      });

      await usersService.create(createUserDto);

      expect(bcrypt.hash).toHaveBeenCalledWith('password123', 10);
    });

    it('should throw ConflictException if email already exists', async () => {
      mockUserRepository.findOne.mockResolvedValue(mockUser);

      await expect(usersService.create(createUserDto)).rejects.toThrow(
        ConflictException,
      );
    });

    it('should emit WebSocket event after user creation', async () => {
      mockUserRepository.findOne.mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashedPassword');
      mockUserRepository.create.mockReturnValue({
        ...createUserDto,
        password: 'hashedPassword',
        id: 'new-uuid',
      });
      mockUserRepository.save.mockResolvedValue({
        ...createUserDto,
        password: 'hashedPassword',
        id: 'new-uuid',
      });

      await usersService.create(createUserDto);

      expect(mockEventsGateway.emitUserCreated).toHaveBeenCalled();
      expect(mockEventsGateway.emitUserCreated).toHaveBeenCalledWith(
        expect.not.objectContaining({ password: expect.any(String) }),
      );
    });
  });

  describe('findAll', () => {
    it('should return all users without passwords', async () => {
      const users = [mockUser, { ...mockUser, id: 'test-uuid-2' }];
      mockUserRepository.find.mockResolvedValue(users);

      const result = await usersService.findAll();

      expect(result).toHaveLength(2);
      result.forEach((user) => {
        expect(user).not.toHaveProperty('password');
      });
    });

    it('should return empty array when no users exist', async () => {
      mockUserRepository.find.mockResolvedValue([]);

      const result = await usersService.findAll();

      expect(result).toEqual([]);
    });
  });

  describe('findOne', () => {
    it('should return user by id without password', async () => {
      mockUserRepository.findOne.mockResolvedValue(mockUser);

      const result = await usersService.findOne('test-uuid');

      expect(result.id).toBe('test-uuid');
      expect(result).not.toHaveProperty('password');
    });

    it('should throw NotFoundException if user not found', async () => {
      mockUserRepository.findOne.mockResolvedValue(null);

      await expect(usersService.findOne('invalid-uuid')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    const updateUserDto: UpdateUserDto = {
      name: 'Updated Name',
    };

    it('should update user successfully', async () => {
      mockUserRepository.findOne.mockResolvedValue({ ...mockUser });
      mockUserRepository.save.mockResolvedValue({
        ...mockUser,
        name: 'Updated Name',
      });

      const result = await usersService.update('test-uuid', updateUserDto);

      expect(result.name).toBe('Updated Name');
      expect(result).not.toHaveProperty('password');
    });

    it('should throw NotFoundException if user not found', async () => {
      mockUserRepository.findOne.mockResolvedValue(null);

      await expect(
        usersService.update('invalid-uuid', updateUserDto),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException if email already exists', async () => {
      const updateWithEmail: UpdateUserDto = { email: 'existing@example.com' };
      mockUserRepository.findOne
        .mockResolvedValueOnce(mockUser) // First call: find user to update
        .mockResolvedValueOnce({ ...mockUser, id: 'other-uuid' }); // Second call: check email conflict

      await expect(
        usersService.update('test-uuid', updateWithEmail),
      ).rejects.toThrow(ConflictException);
    });

    it('should hash password when updating password', async () => {
      const updateWithPassword: UpdateUserDto = { password: 'newPassword123' };
      mockUserRepository.findOne.mockResolvedValue({ ...mockUser });
      (bcrypt.hash as jest.Mock).mockResolvedValue('newHashedPassword');
      mockUserRepository.save.mockResolvedValue({
        ...mockUser,
        password: 'newHashedPassword',
      });

      await usersService.update('test-uuid', updateWithPassword);

      expect(bcrypt.hash).toHaveBeenCalledWith('newPassword123', 10);
    });

    it('should emit WebSocket event after user update', async () => {
      mockUserRepository.findOne.mockResolvedValue({ ...mockUser });
      mockUserRepository.save.mockResolvedValue({
        ...mockUser,
        name: 'Updated Name',
      });

      await usersService.update('test-uuid', updateUserDto);

      expect(mockEventsGateway.emitUserUpdated).toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('should remove user successfully', async () => {
      mockUserRepository.findOne.mockResolvedValue(mockUser);
      mockUserRepository.remove.mockResolvedValue(mockUser);

      await usersService.remove('test-uuid');

      expect(mockUserRepository.remove).toHaveBeenCalledWith(mockUser);
    });

    it('should throw NotFoundException if user not found', async () => {
      mockUserRepository.findOne.mockResolvedValue(null);

      await expect(usersService.remove('invalid-uuid')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should emit WebSocket event after user deletion', async () => {
      mockUserRepository.findOne.mockResolvedValue(mockUser);
      mockUserRepository.remove.mockResolvedValue(mockUser);

      await usersService.remove('test-uuid');

      expect(mockEventsGateway.emitUserDeleted).toHaveBeenCalledWith(
        'test-uuid',
      );
    });
  });

  describe('toggleStatus', () => {
    it('should toggle active status from true to false', async () => {
      const activeUser = { ...mockUser, isActive: true };
      mockUserRepository.findOne.mockResolvedValue(activeUser);
      mockUserRepository.save.mockResolvedValue({
        ...activeUser,
        isActive: false,
      });

      const result = await usersService.toggleStatus('test-uuid');

      expect(result.isActive).toBe(false);
    });

    it('should toggle active status from false to true', async () => {
      const inactiveUser = { ...mockUser, isActive: false };
      mockUserRepository.findOne.mockResolvedValue(inactiveUser);
      mockUserRepository.save.mockResolvedValue({
        ...inactiveUser,
        isActive: true,
      });

      const result = await usersService.toggleStatus('test-uuid');

      expect(result.isActive).toBe(true);
    });

    it('should throw NotFoundException if user not found', async () => {
      mockUserRepository.findOne.mockResolvedValue(null);

      await expect(usersService.toggleStatus('invalid-uuid')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should emit WebSocket event after status change', async () => {
      const activeUser = { ...mockUser, isActive: true };
      mockUserRepository.findOne.mockResolvedValue(activeUser);
      mockUserRepository.save.mockResolvedValue({
        ...activeUser,
        isActive: false,
      });

      await usersService.toggleStatus('test-uuid');

      expect(mockEventsGateway.emitUserStatusChanged).toHaveBeenCalledWith(
        'test-uuid',
        false,
      );
    });
  });

  describe('getStats', () => {
    it('should return user statistics', async () => {
      mockUserRepository.count
        .mockResolvedValueOnce(10) // totalUsers
        .mockResolvedValueOnce(8); // activeUsers

      const mockQueryBuilder = {
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([
          { role: 'admin', count: '2' },
          { role: 'viewer', count: '8' },
        ]),
      };
      mockUserRepository.createQueryBuilder.mockReturnValue(
        mockQueryBuilder as any,
      );

      const result = await usersService.getStats();

      expect(result).toHaveProperty('totalUsers', 10);
      expect(result).toHaveProperty('activeUsers', 8);
      expect(result).toHaveProperty('inactiveUsers', 2);
      expect(result).toHaveProperty('usersByRole');
    });
  });
});
