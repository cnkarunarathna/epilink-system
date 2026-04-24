import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';
import { UserRole } from '../../entities/user.entity';

function buildContext(user: { role: UserRole }): ExecutionContext {
  return {
    getHandler: jest.fn(),
    getClass: jest.fn(),
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
  } as unknown as ExecutionContext;
}

describe('RolesGuard', () => {
  let guard: RolesGuard;
  let reflector: jest.Mocked<Reflector>;

  beforeEach(() => {
    reflector = { getAllAndOverride: jest.fn() } as unknown as jest.Mocked<Reflector>;
    guard = new RolesGuard(reflector);
  });

  it('should be defined', () => {
    expect(guard).toBeDefined();
  });

  it('should allow access when no roles metadata is defined', () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);

    const context = buildContext({ role: UserRole.PHI });
    const result = guard.canActivate(context);

    expect(result).toBe(true);
  });

  it('should allow access when user has a required role', () => {
    reflector.getAllAndOverride.mockReturnValue([UserRole.ADMIN, UserRole.SUPERVISOR]);

    const context = buildContext({ role: UserRole.ADMIN });
    const result = guard.canActivate(context);

    expect(result).toBe(true);
  });

  it('should deny access when user lacks any required role', () => {
    reflector.getAllAndOverride.mockReturnValue([UserRole.ADMIN]);

    const context = buildContext({ role: UserRole.PHI });
    const result = guard.canActivate(context);

    expect(result).toBe(false);
  });

  it('should check both handler and class metadata via getAllAndOverride', () => {
    reflector.getAllAndOverride.mockReturnValue([UserRole.SUPERVISOR]);

    const context = buildContext({ role: UserRole.SUPERVISOR });
    guard.canActivate(context);

    expect(reflector.getAllAndOverride).toHaveBeenCalledWith(
      'roles',
      [context.getHandler(), context.getClass()],
    );
  });
});
