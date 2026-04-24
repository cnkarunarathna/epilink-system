import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

describe('AuthController', () => {
  let controller: AuthController;

  const mockAuthService = {
    login: jest.fn(),
    getCurrentUser: jest.fn(),
  };

  const mockRes = {
    cookie: jest.fn(),
    clearCookie: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: mockAuthService }],
    }).compile();

    controller = module.get<AuthController>(AuthController);
  });

  // ── login ─────────────────────────────────────────────────────────────────

  describe('login', () => {
    it('should call authService.login and return token + user', async () => {
      const serviceResult = {
        accessToken: 'jwt-token',
        user: { id: 'user-uuid', email: 'user@test.com' },
      };
      mockAuthService.login.mockResolvedValue(serviceResult);

      const result = await controller.login(
        { email: 'user@test.com', password: 'pass123' },
        mockRes as any,
      );

      expect(mockAuthService.login).toHaveBeenCalledWith({
        email: 'user@test.com',
        password: 'pass123',
      });
      expect(result).toEqual({
        accessToken: 'jwt-token',
        user: { id: 'user-uuid', email: 'user@test.com' },
      });
    });

    it('should set an httpOnly cookie with the access token', async () => {
      mockAuthService.login.mockResolvedValue({
        accessToken: 'jwt-token',
        user: { id: 'user-uuid' },
      });

      await controller.login({ email: 'a@b.com', password: 'pw' }, mockRes as any);

      expect(mockRes.cookie).toHaveBeenCalledWith(
        'access_token',
        'jwt-token',
        expect.objectContaining({ httpOnly: true, path: '/' }),
      );
    });

    it('should propagate UnauthorizedException when credentials are invalid', async () => {
      mockAuthService.login.mockRejectedValue(new UnauthorizedException());

      await expect(
        controller.login({ email: 'x@y.com', password: 'wrong' }, mockRes as any),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  // ── getCurrentUser ────────────────────────────────────────────────────────

  describe('getCurrentUser', () => {
    it('should return the user returned by authService.getCurrentUser', async () => {
      const user = { id: 'user-uuid', email: 'user@test.com', role: 'admin' };
      mockAuthService.getCurrentUser.mockResolvedValue(user);

      const req = { user: { id: 'user-uuid' } };
      const result = await controller.getCurrentUser(req);

      expect(mockAuthService.getCurrentUser).toHaveBeenCalledWith('user-uuid');
      expect(result).toEqual(user);
    });

    it('should propagate UnauthorizedException when user is deactivated', async () => {
      mockAuthService.getCurrentUser.mockRejectedValue(new UnauthorizedException());

      const req = { user: { id: 'dead-uuid' } };
      await expect(controller.getCurrentUser(req)).rejects.toThrow(UnauthorizedException);
    });
  });

  // ── logout ────────────────────────────────────────────────────────────────

  describe('logout', () => {
    it('should clear the access_token cookie and return a success message', async () => {
      const result = await controller.logout(mockRes as any);

      expect(mockRes.clearCookie).toHaveBeenCalledWith('access_token', { path: '/' });
      expect(result).toEqual({ message: 'Logged out successfully' });
    });
  });
});
