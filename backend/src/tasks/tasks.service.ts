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
import { CacheHelperService } from '../cache/cache-helper.service';
import { TaskMessagesService } from './task-messages.service';

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
    private cacheHelper: CacheHelperService,
    private taskMessagesService: TaskMessagesService,
  ) {}

  private async invalidateTaskCaches(): Promise<void> {
    await this.cacheHelper.delByPattern('tasks:*');
  }

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

    await this.invalidateTaskCaches();
    return taskWithRelations;
  }

  async findAll(filters?: TaskFilters): Promise<Task[]> {
    const filterKey = filters
      ? Object.entries(filters)
          .filter(([, v]) => v !== undefined)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([k, v]) => `${k}=${v}`)
          .join('&')
      : 'all';
    const cacheKey = `tasks:list:${filterKey}`;
    const cached = await this.cacheHelper.get<Task[]>(cacheKey);
    if (cached) return cached;

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

    const result = await query.getMany();
    await this.cacheHelper.set(cacheKey, result, 120000); // 2 minutes
    return result;
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
    const saved = await this.taskRepository.save(task);
    await this.invalidateTaskCaches();
    return saved;
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

    // 6.1 — System message audit trail
    const systemContent = this.buildStatusSystemMessage(dto.status, dto.rejectionReason);
    if (systemContent) {
      this.taskMessagesService
        .sendSystemMessage(id, systemContent, userId)
        .catch(() => {});
    }

    await this.invalidateTaskCaches();
    return taskWithRelations;
  }

  async assignTask(id: string, dto: AssignTaskDto, actorId?: string): Promise<Task> {
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

    // 6.1 — System message audit trail
    if (actorId) {
      this.taskMessagesService
        .sendSystemMessage(id, `Task assigned to ${phi.name}`, actorId)
        .catch(() => {});
    }

    await this.invalidateTaskCaches();
    return taskWithRelations;
  }

  private buildStatusSystemMessage(
    status: TaskStatus,
    rejectionReason?: string,
  ): string | null {
    switch (status) {
      case TaskStatus.IN_PROGRESS:
        return 'PHI started working on the task';
      case TaskStatus.SUBMITTED:
        return 'PHI submitted evidence for review';
      case TaskStatus.VERIFIED:
        return 'Evidence approved — task verified';
      case TaskStatus.COMPLETED:
        return 'Task marked as completed';
      case TaskStatus.REJECTED:
        return rejectionReason
          ? `Task rejected: ${rejectionReason}`
          : 'Task rejected';
      default:
        return null;
    }
  }

  async saveRouteOrder(
    orders: { taskId: string; order: number }[],
  ): Promise<void> {
    await Promise.all(
      orders.map(({ taskId, order }) =>
        this.taskRepository.update(taskId, { routeOrder: order }),
      ),
    );
    await this.invalidateTaskCaches();
  }

  async remove(id: string): Promise<void> {
    const task = await this.findOne(id);
    const districtName = task.district?.name;
    const taskId = task.id;
    const assignedPhiId = task.assignedPhiId ?? undefined;
    await this.taskRepository.remove(task);
    this.eventsGateway.emitTaskDeleted(taskId, districtName, assignedPhiId);
    await this.invalidateTaskCaches();
  }

  async getStats(districtId?: number): Promise<TaskStats> {
    const cacheKey = `tasks:stats:${districtId ?? 'all'}`;
    const cached = await this.cacheHelper.get<TaskStats>(cacheKey);
    if (cached) return cached;

    const query = this.taskRepository.createQueryBuilder('task');

    if (districtId) {
      query.where('task.districtId = :districtId', { districtId });
    }

    const tasks = await query.getMany();
    const now = new Date();

    const result: TaskStats = {
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

    await this.cacheHelper.set(cacheKey, result, 120000); // 2 minutes
    return result;
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
    const cacheKey = `tasks:phis:${districtName}`;
    const cached = await this.cacheHelper.get<User[]>(cacheKey);
    if (cached) return cached;

    const result = await this.userRepository.find({
      where: { district: districtName, role: UserRole.PHI },
      select: ['id', 'name', 'email', 'district', 'isActive'],
    });

    await this.cacheHelper.set(cacheKey, result, 300000); // 5 minutes
    return result;
  }
}
