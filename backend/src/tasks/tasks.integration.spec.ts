import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule, getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource, Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { TasksService } from './tasks.service';
import { Task, TaskStatus, TaskType, TaskPriority } from './entities/task.entity';
import { Evidence } from './entities/evidence.entity';
import { User, UserRole } from '../entities/user.entity';
import { District } from '../entities/district.entity';
import { EventsGateway } from '../events/events.gateway';
import { StorageService } from '../storage/storage.service';
import { CacheHelperService } from '../cache/cache-helper.service';
import { TaskMessagesService } from './task-messages.service';
import { EmailService } from '../email/email.service';
import { ALL_ENTITIES } from '../../test/helpers/database.helper';

const HAS_DB = !!process.env.TEST_DATABASE_URL;
const DB_URL =
  process.env.TEST_DATABASE_URL ||
  'postgres://test:test@localhost:5432/epilink_test';

(HAS_DB ? describe : describe.skip)('TasksService Integration', () => {
  let module: TestingModule;
  let tasksService: TasksService;
  let taskRepo: Repository<Task>;
  let userRepo: Repository<User>;
  let dataSource: DataSource;

  let testUser: User;
  let testDistrict: District;

  const mockEventsGateway = {
    emitTaskCreated: jest.fn(),
    emitTaskUpdated: jest.fn(),
    emitTaskStatusChanged: jest.fn(),
    emitTaskAssigned: jest.fn(),
    emitTaskDeleted: jest.fn(),
    emitAnalyticsUpdated: jest.fn(),
  };

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'postgres',
          url: DB_URL,
          entities: ALL_ENTITIES,
          synchronize: true,
          dropSchema: true,
          logging: false,
        }),
        TypeOrmModule.forFeature([Task, Evidence, User]),
      ],
      providers: [
        TasksService,
        { provide: EventsGateway, useValue: mockEventsGateway },
        {
          provide: StorageService,
          useValue: {
            getSignedUrl: jest.fn().mockResolvedValue('https://signed-url'),
          },
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
          provide: TaskMessagesService,
          useValue: {
            sendSystemMessage: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: EmailService,
          useValue: { send: jest.fn().mockResolvedValue(undefined) },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue('http://localhost:3000'),
            getOrThrow: jest.fn().mockReturnValue('http://localhost:3000'),
          },
        },
      ],
    }).compile();

    tasksService = module.get<TasksService>(TasksService);
    taskRepo = module.get<Repository<Task>>(getRepositoryToken(Task));
    userRepo = module.get<Repository<User>>(getRepositoryToken(User));
    dataSource = module.get<DataSource>(DataSource);
  });

  afterAll(async () => {
    await module.close();
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    await dataSource.manager.query(
      'TRUNCATE TABLE "message_reactions", "message_reads", "task_messages", "evidence", "tasks", "users", "districts" RESTART IDENTITY CASCADE',
    );

    testDistrict = await dataSource
      .getRepository(District)
      .save({ name: 'Colombo', latitude: 6.9271, longitude: 79.8612 });

    const hashed = await bcrypt.hash('pass', 10);
    testUser = await userRepo.save(
      userRepo.create({
        email: 'sup@test.com',
        name: 'Supervisor',
        password: hashed,
        role: UserRole.SUPERVISOR,
        district: 'Colombo',
        isActive: true,
      }),
    );
  });

  function buildDto(
    overrides: Partial<{
      title: string;
      type: TaskType;
      priority: TaskPriority;
      districtId: number;
    }> = {},
  ) {
    return {
      title: overrides.title ?? 'Test Task',
      type: overrides.type ?? TaskType.INSPECTION,
      priority: overrides.priority ?? TaskPriority.MEDIUM,
      districtId: overrides.districtId ?? testDistrict.id,
    };
  }

  describe('create', () => {
    it('should persist the task and emit a creation event', async () => {
      const task = await tasksService.create(buildDto(), testUser.id);

      expect(task.id).toBeDefined();
      expect(task.title).toBe('Test Task');
      expect(task.status).toBe(TaskStatus.PENDING);
      expect(await taskRepo.findOneBy({ id: task.id })).not.toBeNull();
      expect(mockEventsGateway.emitTaskCreated).toHaveBeenCalledTimes(1);
    });
  });

  describe('findAll', () => {
    it('should return all persisted tasks', async () => {
      await tasksService.create(buildDto({ title: 'Task A' }), testUser.id);
      await tasksService.create(buildDto({ title: 'Task B' }), testUser.id);

      const result = await tasksService.findAll();
      expect(result.length).toBe(2);
    });

    it('should return only tasks matching the given status filter', async () => {
      const task = await tasksService.create(buildDto(), testUser.id);
      await taskRepo.update(task.id, { status: TaskStatus.ASSIGNED });

      const pending = await tasksService.findAll({ status: TaskStatus.PENDING });
      const assigned = await tasksService.findAll({ status: TaskStatus.ASSIGNED });

      expect(pending.length).toBe(0);
      expect(assigned.length).toBe(1);
    });

    it('should return only tasks belonging to the specified district', async () => {
      const otherDistrict = await dataSource
        .getRepository(District)
        .save({ name: 'Gampaha', latitude: 7.0917, longitude: 80.0 });

      await tasksService.create(buildDto({ districtId: testDistrict.id }), testUser.id);
      await tasksService.create(buildDto({ districtId: otherDistrict.id }), testUser.id);

      const result = await tasksService.findAll({ districtId: testDistrict.id });
      expect(result.length).toBe(1);
      expect(result[0].districtId).toBe(testDistrict.id);
    });
  });

  describe('findOne', () => {
    it('should return the task with district and creator relations loaded', async () => {
      const created = await tasksService.create(buildDto(), testUser.id);

      const found = await tasksService.findOne(created.id);

      expect(found.id).toBe(created.id);
      expect(found.district?.name).toBe('Colombo');
      expect(found.createdBy?.id).toBe(testUser.id);
    });

    it('should throw NotFoundException when the task does not exist', async () => {
      await expect(
        tasksService.findOne('00000000-0000-0000-0000-000000000000'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateStatus', () => {
    it('should persist the new status after a valid PENDING → ASSIGNED transition', async () => {
      const task = await tasksService.create(buildDto(), testUser.id);

      await tasksService.updateStatus(
        task.id,
        { status: TaskStatus.ASSIGNED },
        testUser.id,
      );

      const fromDb = await taskRepo.findOneBy({ id: task.id });
      expect(fromDb?.status).toBe(TaskStatus.ASSIGNED);
      expect(mockEventsGateway.emitTaskStatusChanged).toHaveBeenCalledTimes(1);
    });

    it('should throw BadRequestException for an invalid status transition', async () => {
      const task = await tasksService.create(buildDto(), testUser.id);

      await expect(
        tasksService.updateStatus(
          task.id,
          { status: TaskStatus.COMPLETED },
          testUser.id,
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('remove', () => {
    it('should delete the task and emit a deletion event', async () => {
      const task = await tasksService.create(buildDto(), testUser.id);

      await tasksService.remove(task.id);

      await expect(tasksService.findOne(task.id)).rejects.toThrow(NotFoundException);
      expect(mockEventsGateway.emitTaskDeleted).toHaveBeenCalledWith(
        task.id,
        'Colombo',
        undefined,
      );
    });
  });
});
