import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule, getRepositoryToken } from '@nestjs/typeorm';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource, Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { UsersService } from './users.service';
import { User, UserRole } from '../entities/user.entity';
import { NotificationPreference } from '../email/entities/notification-preference.entity';
import { EventsGateway } from '../events/events.gateway';
import { CacheHelperService } from '../cache/cache-helper.service';
import { EmailService } from '../email/email.service';
import { ALL_ENTITIES } from '../../test/helpers/database.helper';

const HAS_DB = !!process.env.TEST_DATABASE_URL;
const DB_URL =
  process.env.TEST_DATABASE_URL ||
  'postgres://test:test@localhost:5432/epilink_test';

(HAS_DB ? describe : describe.skip)('UsersService Integration', () => {
  let module: TestingModule;
  let usersService: UsersService;
  let userRepo: Repository<User>;
  let dataSource: DataSource;

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
        TypeOrmModule.forFeature([User, NotificationPreference]),
      ],
      providers: [
        UsersService,
        {
          provide: EventsGateway,
          useValue: {
            emitUserCreated: jest.fn(),
            emitUserUpdated: jest.fn(),
            emitUserDeleted: jest.fn(),
            emitUserStatusChanged: jest.fn(),
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

    usersService = module.get<UsersService>(UsersService);
    userRepo = module.get<Repository<User>>(getRepositoryToken(User));
    dataSource = module.get<DataSource>(DataSource);
  });

  afterAll(async () => {
    await module.close();
  });

  beforeEach(async () => {
    await dataSource.manager.query(
      'TRUNCATE TABLE "notification_preferences", "users" RESTART IDENTITY CASCADE',
    );
  });

  async function seedUser(
    overrides: Partial<{
      email: string;
      name: string;
      role: UserRole;
      district: string;
      isActive: boolean;
    }> = {},
  ): Promise<User> {
    const hashed = await bcrypt.hash('password123', 10);
    return userRepo.save(
      userRepo.create({
        email: overrides.email ?? 'user@test.com',
        name: overrides.name ?? 'Test User',
        password: hashed,
        role: overrides.role ?? UserRole.PHI,
        district: overrides.district ?? 'Colombo',
        isActive: overrides.isActive ?? true,
      }),
    );
  }

  describe('create', () => {
    it('should persist the user and return it without the password field', async () => {
      const result = await usersService.create({
        email: 'new@test.com',
        name: 'New User',
        password: 'plain123',
        role: UserRole.PHI,
        district: 'Colombo',
      });

      expect(result.id).toBeDefined();
      expect(result.email).toBe('new@test.com');
      expect(result).not.toHaveProperty('password');

      const fromDb = await userRepo.findOneBy({ id: result.id });
      expect(fromDb).not.toBeNull();
      const valid = await bcrypt.compare('plain123', fromDb!.password);
      expect(valid).toBe(true);
    });

    it('should throw ConflictException when a user with the same email already exists', async () => {
      await seedUser({ email: 'dup@test.com' });

      await expect(
        usersService.create({
          email: 'dup@test.com',
          name: 'Another',
          password: 'p',
          role: UserRole.VIEWER,
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('findAll', () => {
    it('should return all users without password fields', async () => {
      await seedUser({ email: 'a@test.com' });
      await seedUser({ email: 'b@test.com' });

      const result = await usersService.findAll();

      expect(result.length).toBe(2);
      result.forEach((u) => expect(u).not.toHaveProperty('password'));
    });
  });

  describe('findOne', () => {
    it('should return the user when found', async () => {
      const user = await seedUser();

      const result = await usersService.findOne(user.id);

      expect(result.id).toBe(user.id);
      expect(result.email).toBe('user@test.com');
      expect(result).not.toHaveProperty('password');
    });

    it('should throw NotFoundException when the user does not exist', async () => {
      await expect(
        usersService.findOne('00000000-0000-0000-0000-000000000000'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should persist the updated email in the database', async () => {
      const user = await seedUser();

      await usersService.update(user.id, { email: 'updated@test.com' });

      const fromDb = await userRepo.findOneBy({ id: user.id });
      expect(fromDb?.email).toBe('updated@test.com');
    });
  });

  describe('remove', () => {
    it('should delete the user so that a subsequent findOne throws NotFoundException', async () => {
      const user = await seedUser();

      await usersService.remove(user.id);

      await expect(usersService.findOne(user.id)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getNotificationPreferences', () => {
    it('should create default all-enabled preferences on first access', async () => {
      const user = await seedUser();

      const prefs = await usersService.getNotificationPreferences(user.id);

      expect(prefs.userId).toBe(user.id);
      expect(prefs.taskAssigned).toBe(true);
      expect(prefs.riskAlerts).toBe(true);
    });

    it('should return the same record on a second call without creating a duplicate', async () => {
      const user = await seedUser();

      const first = await usersService.getNotificationPreferences(user.id);
      const second = await usersService.getNotificationPreferences(user.id);

      expect(second.id).toBe(first.id);
    });
  });
});
