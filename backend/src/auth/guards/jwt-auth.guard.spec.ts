import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { JwtAuthGuard } from './jwt-auth.guard';

describe('JwtAuthGuard', () => {
  let guard: JwtAuthGuard;

  beforeEach(() => {
    guard = new JwtAuthGuard();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should be defined', () => {
    expect(guard).toBeDefined();
  });

  it('should return true when the parent AuthGuard resolves successfully', async () => {
    const parentProto = Object.getPrototypeOf(JwtAuthGuard.prototype);
    jest.spyOn(parentProto, 'canActivate').mockResolvedValue(true);

    const mockContext = {} as ExecutionContext;
    const result = await guard.canActivate(mockContext);

    expect(result).toBe(true);
  });

  it('should propagate UnauthorizedException when token is missing', async () => {
    const parentProto = Object.getPrototypeOf(JwtAuthGuard.prototype);
    jest.spyOn(parentProto, 'canActivate').mockRejectedValue(new UnauthorizedException('No token'));

    const mockContext = {} as ExecutionContext;
    await expect(guard.canActivate(mockContext)).rejects.toThrow(UnauthorizedException);
  });

  it('should propagate UnauthorizedException when token is expired', async () => {
    const parentProto = Object.getPrototypeOf(JwtAuthGuard.prototype);
    jest.spyOn(parentProto, 'canActivate').mockRejectedValue(new UnauthorizedException('Expired'));

    const mockContext = {} as ExecutionContext;
    await expect(guard.canActivate(mockContext)).rejects.toThrow(UnauthorizedException);
  });
});
