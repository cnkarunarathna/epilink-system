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
import { EventsGateway } from '../events/events.gateway';
import { StorageService } from '../storage/storage.service';

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
    private eventsGateway: EventsGateway,
    private storageService: StorageService,
  ) {}

  /** Replace stored S3 keys (or legacy full URLs) with fresh pre-signed URLs. */
  private async signEvidenceUrls(evidence: Evidence[]): Promise<Evidence[]> {
    return Promise.all(
      evidence.map(async (e) => {
        if (e.imageUrl) {
          try {
            e.imageUrl = await this.storageService.getSignedUrl(e.imageUrl);
          } catch {
            // Leave as-is if signing fails (e.g. invalid key)
          }
        }
        return e;
      }),
    );
  }

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

    const savedTask = await this.taskRepository.save(task);

    // Fetch with relations for WebSocket
    const taskWithRelations = await this.findOne(savedTask.id);
    this.eventsGateway.emitTaskCreated(
      taskWithRelations,
      taskWithRelations.district?.name,
    );

    return taskWithRelations;
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

  async findOne(id: string, signUrls = false): Promise<Task> {
    const task = await this.taskRepository.findOne({
      where: { id },
      relations: ['district', 'assignedPhi', 'createdBy', 'evidence'],
    });

    if (!task) {
      throw new NotFoundException(`Task with ID ${id} not found`);
    }

    if (signUrls && task.evidence?.length) {
      task.evidence = await this.signEvidenceUrls(task.evidence);
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
    const oldStatus = task.status;

    // Validate status transitions
    const validTransitions: Record<TaskStatus, TaskStatus[]> = {
      [TaskStatus.PENDING]: [TaskStatus.ASSIGNED],
      [TaskStatus.ASSIGNED]: [TaskStatus.IN_PROGRESS, TaskStatus.PENDING],
      [TaskStatus.IN_PROGRESS]: [TaskStatus.SUBMITTED],
      [TaskStatus.SUBMITTED]: [
        TaskStatus.VERIFIED,
        TaskStatus.COMPLETED,
        TaskStatus.REJECTED,
      ],
      [TaskStatus.VERIFIED]: [TaskStatus.COMPLETED],
      [TaskStatus.COMPLETED]: [],
      [TaskStatus.REJECTED]: [TaskStatus.IN_PROGRESS],
    };

    const isForceComplete =
      dto.force === true && dto.status === TaskStatus.COMPLETED;

    if (
      !isForceComplete &&
      !validTransitions[task.status]?.includes(dto.status)
    ) {
      throw new BadRequestException(
        `Cannot transition from ${task.status} to ${dto.status}`,
      );
    }

    task.status = dto.status;

    if (dto.status === TaskStatus.REJECTED && dto.rejectionReason) {
      task.rejectionReason = dto.rejectionReason;
    }

    if (
      dto.status === TaskStatus.COMPLETED ||
      dto.status === TaskStatus.VERIFIED
    ) {
      task.completedAt = new Date();
    }

    if (dto.status === TaskStatus.SUBMITTED) {
      task.submittedAt = new Date();
    }

    const savedTask = await this.taskRepository.save(task);
    const taskWithRelations = await this.findOne(savedTask.id);

    this.eventsGateway.emitTaskStatusChanged(
      taskWithRelations,
      oldStatus,
      dto.status,
      taskWithRelations.district?.name,
    );

    return taskWithRelations;
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

    const savedTask = await this.taskRepository.save(task);
    const taskWithRelations = await this.findOne(savedTask.id);

    this.eventsGateway.emitTaskAssigned(
      taskWithRelations,
      dto.assignedPhiId,
      taskWithRelations.district?.name,
    );

    return taskWithRelations;
  }

  async remove(id: string): Promise<void> {
    const task = await this.findOne(id);
    const districtName = task.district?.name;
    const taskId = task.id;
    const assignedPhiId = task.assignedPhiId ?? undefined;
    await this.taskRepository.remove(task);
    this.eventsGateway.emitTaskDeleted(taskId, districtName, assignedPhiId);
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
    const evidence = await this.evidenceRepository.find({
      where: { taskId },
      relations: ['submittedBy', 'verifiedBy'],
      order: { submittedAt: 'DESC' },
    });
    return this.signEvidenceUrls(evidence);
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

  // Get PHIs by district for supervisor (including suspended)
  async getPhisByDistrict(districtName: string): Promise<User[]> {
    return this.userRepository.find({
      where: { district: districtName, role: UserRole.PHI },
      select: ['id', 'name', 'email', 'district', 'isActive'],
    });
  }
}
