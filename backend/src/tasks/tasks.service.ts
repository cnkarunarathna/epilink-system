import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  Task,
  TaskStatus,
  TaskType,
  TaskPriority,
} from './entities/task.entity';
import { Evidence, EvidenceStatus } from './entities/evidence.entity';
import { CreateTaskDto } from './dto/create-task.dto';
import {
  UpdateTaskDto,
  UpdateTaskStatusDto,
  AssignTaskDto,
} from './dto/update-task.dto';
import { CreateEvidenceDto } from './dto/create-evidence.dto';
import { User, UserRole } from '../entities/user.entity';

export interface TaskFilters {
  districtId?: number;
  status?: TaskStatus;
  type?: TaskType;
  priority?: TaskPriority;
  assignedPhiId?: string;
  createdById?: string;
}

export interface TaskStats {
  total: number;
  pending: number;
  assigned: number;
  inProgress: number;
  submitted: number;
  completed: number;
  rejected: number;
  overdueCount: number;
}

@Injectable()
export class TasksService {
  constructor(
    @InjectRepository(Task)
    private taskRepository: Repository<Task>,
    @InjectRepository(Evidence)
    private evidenceRepository: Repository<Evidence>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {}

  async create(
    createTaskDto: CreateTaskDto,
    createdById: string,
  ): Promise<Task> {
    const task = new Task();
    task.title = createTaskDto.title;
    task.type = createTaskDto.type;
    task.priority = createTaskDto.priority ?? TaskPriority.MEDIUM;
    task.description = createTaskDto.description ?? null;
    task.address = createTaskDto.address ?? null;
    task.latitude = createTaskDto.latitude ?? null;
    task.longitude = createTaskDto.longitude ?? null;
    task.districtId = createTaskDto.districtId;
    task.notes = createTaskDto.notes ?? null;
    task.createdById = createdById;
    task.dueDate = createTaskDto.dueDate
      ? new Date(createTaskDto.dueDate)
      : null;
    task.status = createTaskDto.assignedPhiId
      ? TaskStatus.ASSIGNED
      : TaskStatus.PENDING;
    task.assignedPhiId = createTaskDto.assignedPhiId ?? null;
    task.assignedAt = createTaskDto.assignedPhiId ? new Date() : null;

    return this.taskRepository.save(task);
  }

  async findAll(filters?: TaskFilters): Promise<Task[]> {
    const query = this.taskRepository
      .createQueryBuilder('task')
      .leftJoinAndSelect('task.district', 'district')
      .leftJoinAndSelect('task.assignedPhi', 'assignedPhi')
      .leftJoinAndSelect('task.createdBy', 'createdBy')
      .orderBy('task.createdAt', 'DESC');

    if (filters?.districtId) {
      query.andWhere('task.districtId = :districtId', {
        districtId: filters.districtId,
      });
    }
    if (filters?.status) {
      query.andWhere('task.status = :status', { status: filters.status });
    }
    if (filters?.type) {
      query.andWhere('task.type = :type', { type: filters.type });
    }
    if (filters?.priority) {
      query.andWhere('task.priority = :priority', {
        priority: filters.priority,
      });
    }
    if (filters?.assignedPhiId) {
      query.andWhere('task.assignedPhiId = :assignedPhiId', {
        assignedPhiId: filters.assignedPhiId,
      });
    }
    if (filters?.createdById) {
      query.andWhere('task.createdById = :createdById', {
        createdById: filters.createdById,
      });
    }

    return query.getMany();
  }

  async findOne(id: string): Promise<Task> {
    const task = await this.taskRepository.findOne({
      where: { id },
      relations: ['district', 'assignedPhi', 'createdBy', 'evidence'],
    });

    if (!task) {
      throw new NotFoundException(`Task with ID ${id} not found`);
    }

    return task;
  }

  async update(id: string, updateTaskDto: UpdateTaskDto): Promise<Task> {
    const task = await this.findOne(id);

    if (updateTaskDto.dueDate) {
      updateTaskDto.dueDate = new Date(updateTaskDto.dueDate).toISOString();
    }

    Object.assign(task, updateTaskDto);
    return this.taskRepository.save(task);
  }

  async updateStatus(
    id: string,
    dto: UpdateTaskStatusDto,
    userId: string,
  ): Promise<Task> {
    const task = await this.findOne(id);

    // Validate status transitions
    const validTransitions: Record<TaskStatus, TaskStatus[]> = {
      [TaskStatus.PENDING]: [TaskStatus.ASSIGNED],
      [TaskStatus.ASSIGNED]: [TaskStatus.IN_PROGRESS, TaskStatus.PENDING],
      [TaskStatus.IN_PROGRESS]: [TaskStatus.SUBMITTED],
      [TaskStatus.SUBMITTED]: [TaskStatus.VERIFIED, TaskStatus.REJECTED],
      [TaskStatus.VERIFIED]: [TaskStatus.COMPLETED],
      [TaskStatus.COMPLETED]: [],
      [TaskStatus.REJECTED]: [TaskStatus.IN_PROGRESS],
    };

    if (!validTransitions[task.status]?.includes(dto.status)) {
      throw new BadRequestException(
        `Cannot transition from ${task.status} to ${dto.status}`,
      );
    }

    task.status = dto.status;

    if (dto.status === TaskStatus.REJECTED && dto.rejectionReason) {
      task.rejectionReason = dto.rejectionReason;
    }

    if (dto.status === TaskStatus.COMPLETED) {
      task.completedAt = new Date();
    }

    if (dto.status === TaskStatus.SUBMITTED) {
      task.submittedAt = new Date();
    }

    return this.taskRepository.save(task);
  }

  async assignTask(id: string, dto: AssignTaskDto): Promise<Task> {
    const task = await this.findOne(id);

    // Verify PHI exists and is active
    const phi = await this.userRepository.findOne({
      where: { id: dto.assignedPhiId, role: UserRole.PHI, isActive: true },
    });

    if (!phi) {
      throw new BadRequestException('Invalid PHI ID or PHI is not active');
    }

    task.assignedPhiId = dto.assignedPhiId;
    task.assignedAt = new Date();
    task.status = TaskStatus.ASSIGNED;

    return this.taskRepository.save(task);
  }

  async remove(id: string): Promise<void> {
    const task = await this.findOne(id);
    await this.taskRepository.remove(task);
  }

  async getStats(districtId?: number): Promise<TaskStats> {
    const query = this.taskRepository.createQueryBuilder('task');

    if (districtId) {
      query.where('task.districtId = :districtId', { districtId });
    }

    const tasks = await query.getMany();
    const now = new Date();

    return {
      total: tasks.length,
      pending: tasks.filter((t) => t.status === TaskStatus.PENDING).length,
      assigned: tasks.filter((t) => t.status === TaskStatus.ASSIGNED).length,
      inProgress: tasks.filter((t) => t.status === TaskStatus.IN_PROGRESS)
        .length,
      submitted: tasks.filter((t) => t.status === TaskStatus.SUBMITTED).length,
      completed: tasks.filter((t) => t.status === TaskStatus.COMPLETED).length,
      rejected: tasks.filter((t) => t.status === TaskStatus.REJECTED).length,
      overdueCount: tasks.filter(
        (t) =>
          t.dueDate &&
          new Date(t.dueDate) < now &&
          ![TaskStatus.COMPLETED, TaskStatus.REJECTED].includes(t.status),
      ).length,
    };
  }

  // Evidence methods
  async addEvidence(
    taskId: string,
    dto: CreateEvidenceDto,
    submittedById: string,
  ): Promise<Evidence> {
    const task = await this.findOne(taskId);

    // Only PHI assigned to task can submit evidence
    if (task.assignedPhiId !== submittedById) {
      throw new ForbiddenException('Only assigned PHI can submit evidence');
    }

    const evidence = this.evidenceRepository.create({
      ...dto,
      taskId,
      submittedById,
    });

    return this.evidenceRepository.save(evidence);
  }

  async getEvidence(taskId: string): Promise<Evidence[]> {
    return this.evidenceRepository.find({
      where: { taskId },
      relations: ['submittedBy', 'verifiedBy'],
      order: { submittedAt: 'DESC' },
    });
  }

  async verifyEvidence(
    evidenceId: string,
    approved: boolean,
    verifiedById: string,
    rejectionReason?: string,
  ): Promise<Evidence> {
    const evidence = await this.evidenceRepository.findOne({
      where: { id: evidenceId },
    });

    if (!evidence) {
      throw new NotFoundException(`Evidence with ID ${evidenceId} not found`);
    }

    evidence.status = approved
      ? EvidenceStatus.APPROVED
      : EvidenceStatus.REJECTED;
    evidence.verifiedById = verifiedById;
    evidence.verifiedAt = new Date();

    if (!approved && rejectionReason) {
      evidence.rejectionReason = rejectionReason;
    }

    return this.evidenceRepository.save(evidence);
  }

  // Get PHIs by district for supervisor
  async getPhisByDistrict(districtName: string): Promise<User[]> {
    return this.userRepository.find({
      where: { district: districtName, role: UserRole.PHI, isActive: true },
      select: ['id', 'name', 'email', 'district', 'isActive'],
    });
  }
}
