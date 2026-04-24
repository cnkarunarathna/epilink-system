import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule, getRepositoryToken } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { UnauthorizedException } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { User, UserRole } from '../entities/user.entity';
import { ALL_ENTITIES } from '../../test/helpers/database.helper';

const HAS_DB = !!process.env.TEST_DATABASE_URL;
const DB_URL =
  process.env.TEST_DATABASE_URL ||
  'postgres://test:test@localhost:5432/epilink_test';

(HAS_DB ? describe : describe.skip)('AuthService Integration', () => {
  let module: TestingModule;
  let authService: AuthService;
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
        TypeOrmModule.forFeature([User]),
        JwtModule.register({
          secret: 'test-secret',
          signOptions: { expiresIn: '1h' },
        }),
      ],
      providers: [AuthService],
    }).compile();

    authService = module.get<AuthService>(AuthService);
    userRepo = module.get<Repository<User>>(getRepositoryToken(User));
    dataSource = module.get<DataSource>(DataSource);
  });

  afterAll(async () => {
    await module.close();
  });

  beforeEach(async () => {
    await dataSource.manager.query(
      'TRUNCATE TABLE "users" RESTART IDENTITY CASCADE',
    );
  });

  async function seedUser(
    overrides: Partial<{
      email: string;
      name: string;
      rawPassword: string;
      role: UserRole;
      isActive: boolean;
    }> = {},
  ): Promise<User> {
    const hashed = await bcrypt.hash(overrides.rawPassword ?? 'password123', 10);
    return userRepo.save(
      userRepo.create({
        email: overrides.email ?? 'user@test.com',
        name: overrides.name ?? 'Test User',
        password: hashed,
        role: overrides.role ?? UserRole.PHI,
        isActive: overrides.isActive ?? true,
      }),
    );
  }

  describe('login', () => {
    it('should return an access token and user DTO on valid credentials', async () => {
      await seedUser();

      const result = await authService.login({
        email: 'user@test.com',
        password: 'password123',
      });

      expect(typeof result.accessToken).toBe('string');
      expect(result.accessToken.split('.').length).toBe(3); // valid JWT
      expect(result.user.email).toBe('user@test.com');
      expect(result.user).not.toHaveProperty('password');
    });

    it('should throw UnauthorizedException when the password is wrong', async () => {
      await seedUser();

      await expect(
        authService.login({ email: 'user@test.com', password: 'wrongpass' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException when the user does not exist', async () => {
      await expect(
        authService.login({ email: 'nobody@test.com', password: 'any' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException when the account is deactivated', async () => {
      await seedUser({ isActive: false });

      await expect(
        authService.login({ email: 'user@test.com', password: 'password123' }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('getCurrentUser', () => {
    it('should return the user DTO when the user exists in the DB', async () => {
      const user = await seedUser();

      const result = await authService.getCurrentUser(user.id);

      expect(result.id).toBe(user.id);
      expect(result.email).toBe('user@test.com');
      expect(result).not.toHaveProperty('password');
    });

    it('should throw UnauthorizedException when no user matches the ID', async () => {
      await expect(
        authService.getCurrentUser('00000000-0000-0000-0000-000000000000'),
      ).rejects.toThrow(UnauthorizedException);
    });
  });
});
