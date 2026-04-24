import { ExecutionContext, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { TaskParticipantGuard } from './task-participant.guard';
import { Task } from '../entities/task.entity';
import { UserRole } from '../../entities/user.entity';

function buildContext(user: { id: string; role: UserRole }, taskId?: string): ExecutionContext {
  const request: any = { user, params: {}, task: undefined };
  if (taskId !== undefined) {
    request.params.taskId = taskId;
  }
  return {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

describe('TaskParticipantGuard', () => {
  let guard: TaskParticipantGuard;

  const mockTaskRepo = {
    findOne: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TaskParticipantGuard,
        { provide: getRepositoryToken(Task), useValue: mockTaskRepo },
      ],
    }).compile();

    guard = module.get<TaskParticipantGuard>(TaskParticipantGuard);
  });

  it('should be defined', () => {
    expect(guard).toBeDefined();
  });

  it('should return true when taskId is absent from params', async () => {
    const context = buildContext({ id: 'user-uuid', role: UserRole.PHI });
    const result = await guard.canActivate(context);

    expect(result).toBe(true);
    expect(mockTaskRepo.findOne).not.toHaveBeenCalled();
  });

  it('should return true immediately for ADMIN users without querying the DB', async () => {
    const context = buildContext({ id: 'admin-uuid', role: UserRole.ADMIN }, 'task-uuid');
    const result = await guard.canActivate(context);

    expect(result).toBe(true);
    expect(mockTaskRepo.findOne).not.toHaveBeenCalled();
  });

  it('should return true and attach task when user is the task creator', async () => {
    const task = { id: 'task-uuid', createdById: 'user-uuid', assignedPhiId: null, title: 'T' };
    mockTaskRepo.findOne.mockResolvedValue(task);

    const ctx = buildContext({ id: 'user-uuid', role: UserRole.SUPERVISOR }, 'task-uuid');
    const req = ctx.switchToHttp().getRequest();

    const result = await guard.canActivate(ctx);

    expect(result).toBe(true);
    expect(req.task).toEqual(task);
  });

  it('should return true when user is the assigned PHI', async () => {
    const task = { id: 'task-uuid', createdById: 'sup-uuid', assignedPhiId: 'phi-uuid', title: 'T' };
    mockTaskRepo.findOne.mockResolvedValue(task);

    const ctx = buildContext({ id: 'phi-uuid', role: UserRole.PHI }, 'task-uuid');
    const result = await guard.canActivate(ctx);

    expect(result).toBe(true);
  });

  it('should throw ForbiddenException when user is not a participant', async () => {
    const task = { id: 'task-uuid', createdById: 'other-uuid', assignedPhiId: 'other-phi', title: 'T' };
    mockTaskRepo.findOne.mockResolvedValue(task);

    const context = buildContext({ id: 'stranger-uuid', role: UserRole.PHI }, 'task-uuid');
    await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
  });

  it('should throw NotFoundException when task does not exist', async () => {
    mockTaskRepo.findOne.mockResolvedValue(null);

    const context = buildContext({ id: 'user-uuid', role: UserRole.PHI }, 'missing-uuid');
    await expect(guard.canActivate(context)).rejects.toThrow(NotFoundException);
  });
});
