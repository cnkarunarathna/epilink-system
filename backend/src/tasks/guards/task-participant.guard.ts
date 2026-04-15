import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Task } from '../entities/task.entity';
import { UserRole } from '../../entities/user.entity';

@Injectable()
export class TaskParticipantGuard implements CanActivate {
  constructor(
    @InjectRepository(Task)
    private readonly taskRepository: Repository<Task>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user as { id: string; role: UserRole };
    const taskId: string | undefined = request.params.taskId;

    if (!taskId) return true;

    // Admins always have access
    if (user.role === UserRole.ADMIN) return true;

    const task = await this.taskRepository.findOne({
      where: { id: taskId },
      select: ['id', 'createdById', 'assignedPhiId'],
    });

    if (!task) {
      throw new NotFoundException(`Task ${taskId} not found`);
    }

    const isParticipant =
      user.id === task.createdById || user.id === task.assignedPhiId;

    if (!isParticipant) {
      throw new ForbiddenException('You are not a participant of this task');
    }

    return true;
  }
}
