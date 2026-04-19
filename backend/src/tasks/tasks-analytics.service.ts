import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Task } from './entities/task.entity';
import { Evidence } from './entities/evidence.entity';
import { User, UserRole } from '../entities/user.entity';
import {
  NationalSummaryDto,
  DistrictTaskSummaryDto,
  StatusDistributionDto,
  TypeDistributionDto,
  PriorityDistributionDto,
  TaskTrendPointDto,
  SupervisorMetricsDto,
  PhiMetricsDto,
  OverdueTaskDto,
  EvidenceReviewSummaryDto,
  PhiProfileDto,
  PhiTasksPageDto,
} from './dto/task-analytics.dto';

@Injectable()
export class TasksAnalyticsService {
  constructor(
    @InjectRepository(Task)
    private readonly taskRepo: Repository<Task>,
    @InjectRepository(Evidence)
    private readonly evidenceRepo: Repository<Evidence>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  async getNationalSummary(districtId?: number): Promise<NationalSummaryDto> {
    const qb = this.taskRepo.createQueryBuilder('t');
    if (districtId) qb.where('t.district_id = :districtId', { districtId });

    const statusRows: { status: string; count: string }[] = await qb
      .clone()
      .select('t.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .groupBy('t.status')
      .getRawMany();

    const counts: Record<string, number> = {};
    for (const r of statusRows) counts[r.status] = parseInt(r.count, 10);

    const total = Object.values(counts).reduce((s, v) => s + v, 0);
    const completed = (counts['completed'] ?? 0) + (counts['verified'] ?? 0);
    const overduRow = await qb
      .clone()
      .select('COUNT(*)', 'cnt')
      .where(districtId ? 't.district_id = :districtId' : '1=1', districtId ? { districtId } : {})
      .andWhere('t.due_date < NOW()')
      .andWhere("t.status NOT IN ('completed', 'verified')")
      .getRawOne<{ cnt: string }>();

    const avgRow = await qb
      .clone()
      .select(
        "AVG(EXTRACT(EPOCH FROM (t.completed_at - t.assigned_at)) / 3600)",
        'avgHours',
      )
      .where(districtId ? 't.district_id = :districtId' : '1=1', districtId ? { districtId } : {})
      .andWhere('t.completed_at IS NOT NULL')
      .andWhere('t.assigned_at IS NOT NULL')
      .getRawOne<{ avgHours: string | null }>();

    const phiWhere: Record<string, unknown> = { role: UserRole.PHI, isActive: true };
    const supervisorWhere: Record<string, unknown> = { role: UserRole.SUPERVISOR, isActive: true };

    const [activePhi, activeSupervisors] = await Promise.all([
      this.userRepo.count({ where: phiWhere as any }),
      this.userRepo.count({ where: supervisorWhere as any }),
    ]);

    return {
      total,
      pending: counts['pending'] ?? 0,
      assigned: counts['assigned'] ?? 0,
      inProgress: counts['in_progress'] ?? 0,
      submitted: counts['submitted'] ?? 0,
      verified: counts['verified'] ?? 0,
      completed: counts['completed'] ?? 0,
      rejected: counts['rejected'] ?? 0,
      overdue: parseInt(overduRow?.cnt ?? '0', 10),
      completionRate: total > 0 ? Math.round((completed / total) * 100) : 0,
      avgCompletionHours: avgRow?.avgHours ? parseFloat(avgRow.avgHours) : null,
      activePhi,
      activeSupervisors,
    };
  }

  async getByDistrict(from?: string, to?: string): Promise<DistrictTaskSummaryDto[]> {
    const qb = this.taskRepo
      .createQueryBuilder('t')
      .innerJoin('t.district', 'd')
      .select('d.id', 'districtId')
      .addSelect('d.name', 'districtName')
      .addSelect('COUNT(t.id)', 'total')
      .addSelect("SUM(CASE WHEN t.status IN ('completed','verified') THEN 1 ELSE 0 END)", 'completed')
      .addSelect("SUM(CASE WHEN t.status = 'pending' THEN 1 ELSE 0 END)", 'pending')
      .addSelect("SUM(CASE WHEN t.status = 'assigned' THEN 1 ELSE 0 END)", 'assigned')
      .addSelect("SUM(CASE WHEN t.status = 'in_progress' THEN 1 ELSE 0 END)", 'inProgress')
      .addSelect("SUM(CASE WHEN t.status = 'submitted' THEN 1 ELSE 0 END)", 'submitted')
      .addSelect("SUM(CASE WHEN t.status = 'rejected' THEN 1 ELSE 0 END)", 'rejected')
      .addSelect(
        "SUM(CASE WHEN t.due_date < NOW() AND t.status NOT IN ('completed','verified') THEN 1 ELSE 0 END)",
        'overdue',
      )
      .groupBy('d.id')
      .addGroupBy('d.name')
      .orderBy('d.name', 'ASC');

    if (from) qb.andWhere('t.created_at >= :from', { from });
    if (to) qb.andWhere('t.created_at <= :to', { to });

    const rows = await qb.getRawMany();
    return rows.map((r) => {
      const total = parseInt(r.total, 10);
      const completed = parseInt(r.completed, 10);
      return {
        districtId: r.districtId,
        districtName: r.districtName,
        total,
        completed,
        pending: parseInt(r.pending, 10),
        assigned: parseInt(r.assigned, 10),
        inProgress: parseInt(r.inProgress, 10),
        submitted: parseInt(r.submitted, 10),
        rejected: parseInt(r.rejected, 10),
        overdue: parseInt(r.overdue, 10),
        completionRate: total > 0 ? Math.round((completed / total) * 100) : 0,
      };
    });
  }

  async getByStatus(districtId?: number): Promise<StatusDistributionDto[]> {
    const qb = this.taskRepo
      .createQueryBuilder('t')
      .select('t.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .groupBy('t.status');

    if (districtId) qb.where('t.district_id = :districtId', { districtId });

    const rows = await qb.getRawMany();
    return rows.map((r) => ({ status: r.status, count: parseInt(r.count, 10) }));
  }

  async getByType(districtId?: number): Promise<TypeDistributionDto[]> {
    const qb = this.taskRepo
      .createQueryBuilder('t')
      .select('t.type', 'type')
      .addSelect('COUNT(*)', 'count')
      .addSelect("SUM(CASE WHEN t.status IN ('completed','verified') THEN 1 ELSE 0 END)", 'completed')
      .groupBy('t.type');

    if (districtId) qb.where('t.district_id = :districtId', { districtId });

    const rows = await qb.getRawMany();
    return rows.map((r) => ({
      type: r.type,
      count: parseInt(r.count, 10),
      completed: parseInt(r.completed, 10),
    }));
  }

  async getByPriority(districtId?: number): Promise<PriorityDistributionDto[]> {
    const qb = this.taskRepo
      .createQueryBuilder('t')
      .select('t.priority', 'priority')
      .addSelect('COUNT(*)', 'count')
      .addSelect("SUM(CASE WHEN t.status IN ('completed','verified') THEN 1 ELSE 0 END)", 'completed')
      .groupBy('t.priority');

    if (districtId) qb.where('t.district_id = :districtId', { districtId });

    const rows = await qb.getRawMany();
    return rows.map((r) => ({
      priority: r.priority,
      count: parseInt(r.count, 10),
      completed: parseInt(r.completed, 10),
    }));
  }

  async getTrend(
    period: 'day' | 'week' | 'month' = 'day',
    from?: string,
    to?: string,
    districtId?: number,
  ): Promise<TaskTrendPointDto[]> {
    const trunc = period === 'month' ? 'month' : period === 'week' ? 'week' : 'day';

    const qb = this.taskRepo
      .createQueryBuilder('t')
      .select(`DATE_TRUNC('${trunc}', t.created_at)`, 'period')
      .addSelect('COUNT(*)', 'created')
      .addSelect('SUM(CASE WHEN t.completed_at IS NOT NULL THEN 1 ELSE 0 END)', 'completed')
      .groupBy(`DATE_TRUNC('${trunc}', t.created_at)`)
      .orderBy(`DATE_TRUNC('${trunc}', t.created_at)`, 'ASC');

    if (districtId) qb.andWhere('t.district_id = :districtId', { districtId });
    if (from) qb.andWhere('t.created_at >= :from', { from });
    if (to) qb.andWhere('t.created_at <= :to', { to });

    const rows = await qb.getRawMany();
    return rows.map((r) => ({
      period: (r.period as Date).toISOString(),
      created: parseInt(r.created, 10),
      completed: parseInt(r.completed, 10),
    }));
  }

  async getSupervisorMetrics(districtId?: number): Promise<SupervisorMetricsDto[]> {
    const qb = this.userRepo
      .createQueryBuilder('u')
      .leftJoin(Task, 't', 't.created_by_id = u.id')
      .select('u.id', 'supervisorId')
      .addSelect('u.name', 'name')
      .addSelect('u.district', 'district')
      .addSelect('COUNT(t.id)', 'tasksCreated')
      .addSelect("SUM(CASE WHEN t.status IN ('completed','verified') THEN 1 ELSE 0 END)", 'completed')
      .addSelect("SUM(CASE WHEN t.status = 'pending' THEN 1 ELSE 0 END)", 'pending')
      .addSelect("SUM(CASE WHEN t.status = 'rejected' THEN 1 ELSE 0 END)", 'rejected')
      .addSelect(
        "SUM(CASE WHEN t.due_date < NOW() AND t.status NOT IN ('completed','verified') THEN 1 ELSE 0 END)",
        'overdue',
      )
      .where('u.role = :role', { role: UserRole.SUPERVISOR })
      .andWhere('u.is_active = true')
      .groupBy('u.id')
      .addGroupBy('u.name')
      .addGroupBy('u.district')
      .orderBy('COUNT(t.id)', 'DESC');

    if (districtId) {
      // User.district is the district name string; join through tasks to filter by districtId
      qb.andWhere('t.district_id = :districtId', { districtId });
    }

    const rows = await qb.getRawMany();
    return rows.map((r) => {
      const tasksCreated = parseInt(r.tasksCreated, 10);
      const completed = parseInt(r.completed, 10);
      return {
        supervisorId: r.supervisorId,
        name: r.name,
        district: r.district ?? '',
        tasksCreated,
        completed,
        pending: parseInt(r.pending, 10),
        rejected: parseInt(r.rejected, 10),
        overdue: parseInt(r.overdue, 10),
        completionRate: tasksCreated > 0 ? Math.round((completed / tasksCreated) * 100) : 0,
      };
    });
  }

  async getPhiMetrics(districtId?: number): Promise<PhiMetricsDto[]> {
    const qb = this.userRepo
      .createQueryBuilder('u')
      .leftJoin(Task, 't', 't.assigned_phi_id = u.id')
      .select('u.id', 'phiId')
      .addSelect('u.name', 'name')
      .addSelect('u.district', 'district')
      .addSelect('u.is_active', 'isActive')
      .addSelect('COUNT(t.id)', 'assigned')
      .addSelect("SUM(CASE WHEN t.status IN ('completed','verified') THEN 1 ELSE 0 END)", 'completed')
      .addSelect("SUM(CASE WHEN t.status = 'rejected' THEN 1 ELSE 0 END)", 'rejected')
      .addSelect(
        "SUM(CASE WHEN t.due_date < NOW() AND t.status NOT IN ('completed','verified') THEN 1 ELSE 0 END)",
        'overdue',
      )
      .addSelect(
        "AVG(CASE WHEN t.completed_at IS NOT NULL AND t.assigned_at IS NOT NULL THEN EXTRACT(EPOCH FROM (t.completed_at - t.assigned_at)) / 3600 END)",
        'avgCompletionHours',
      )
      .where('u.role = :role', { role: UserRole.PHI })
      .groupBy('u.id')
      .addGroupBy('u.name')
      .addGroupBy('u.district')
      .addGroupBy('u.is_active')
      .orderBy('COUNT(t.id)', 'DESC');

    if (districtId) qb.andWhere('t.district_id = :districtId', { districtId });

    const rows = await qb.getRawMany();
    return rows.map((r) => {
      const assigned = parseInt(r.assigned, 10);
      const completed = parseInt(r.completed, 10);
      return {
        phiId: r.phiId,
        name: r.name,
        district: r.district ?? '',
        isActive: r.isActive === true || r.isActive === 'true',
        assigned,
        completed,
        rejected: parseInt(r.rejected, 10),
        overdue: parseInt(r.overdue, 10),
        completionRate: assigned > 0 ? Math.round((completed / assigned) * 100) : 0,
        avgCompletionHours: r.avgCompletionHours ? parseFloat(r.avgCompletionHours) : null,
      };
    });
  }

  async getOverdueTasks(districtId?: number): Promise<OverdueTaskDto[]> {
    const qb = this.taskRepo
      .createQueryBuilder('t')
      .innerJoin('t.district', 'd')
      .leftJoin('t.assignedPhi', 'phi')
      .select('t.id', 'id')
      .addSelect('t.title', 'title')
      .addSelect('t.type', 'type')
      .addSelect('t.priority', 'priority')
      .addSelect('t.status', 'status')
      .addSelect('t.due_date', 'dueDate')
      .addSelect('d.id', 'districtId')
      .addSelect('d.name', 'districtName')
      .addSelect('phi.id', 'phiId')
      .addSelect('phi.name', 'phiName')
      .addSelect("EXTRACT(EPOCH FROM (NOW() - t.due_date)) / 3600", 'hoursOverdue')
      .where('t.due_date < NOW()')
      .andWhere("t.status NOT IN ('completed', 'verified')")
      .orderBy('t.due_date', 'ASC');

    if (districtId) qb.andWhere('t.district_id = :districtId', { districtId });

    const rows = await qb.getRawMany();
    return rows.map((r) => {
      const hoursOverdue = parseFloat(r.hoursOverdue);
      return {
        id: r.id,
        title: r.title,
        type: r.type,
        priority: r.priority,
        status: r.status,
        dueDate: r.dueDate instanceof Date ? r.dueDate.toISOString() : r.dueDate,
        districtId: r.districtId,
        districtName: r.districtName,
        phiId: r.phiId ?? null,
        phiName: r.phiName ?? null,
        hoursOverdue: Math.round(hoursOverdue),
        severity: hoursOverdue < 24 ? 'warning' : 'critical',
      };
    });
  }

  async getEvidenceReview(districtId?: number): Promise<EvidenceReviewSummaryDto> {
    const qb = this.evidenceRepo
      .createQueryBuilder('e')
      .innerJoin('e.task', 't')
      .innerJoin('t.district', 'd')
      .select('d.id', 'districtId')
      .addSelect('d.name', 'districtName')
      .addSelect('COUNT(e.id)', 'total')
      .addSelect("SUM(CASE WHEN e.status = 'approved' THEN 1 ELSE 0 END)", 'approved')
      .addSelect("SUM(CASE WHEN e.status = 'rejected' THEN 1 ELSE 0 END)", 'rejected')
      .addSelect("SUM(CASE WHEN e.status = 'pending' THEN 1 ELSE 0 END)", 'pending')
      .groupBy('d.id')
      .addGroupBy('d.name')
      .orderBy('d.name', 'ASC');

    if (districtId) qb.andWhere('t.district_id = :districtId', { districtId });

    const rows = await qb.getRawMany();
    const byDistrict = rows.map((r) => {
      const total = parseInt(r.total, 10);
      const approved = parseInt(r.approved, 10);
      return {
        districtId: r.districtId,
        districtName: r.districtName,
        total,
        approved,
        rejected: parseInt(r.rejected, 10),
        pending: parseInt(r.pending, 10),
        approvalRate: total > 0 ? Math.round((approved / total) * 100) : 0,
      };
    });

    const national = byDistrict.reduce(
      (acc, d) => ({
        total: acc.total + d.total,
        approved: acc.approved + d.approved,
        rejected: acc.rejected + d.rejected,
        pending: acc.pending + d.pending,
        approvalRate: 0,
      }),
      { total: 0, approved: 0, rejected: 0, pending: 0, approvalRate: 0 },
    );
    national.approvalRate =
      national.total > 0 ? Math.round((national.approved / national.total) * 100) : 0;

    return { national, byDistrict };
  }

  async getPhiProfile(phiId: string): Promise<PhiProfileDto> {
    const user = await this.userRepo.findOne({ where: { id: phiId } });
    if (!user) throw new NotFoundException('PHI not found');

    const metricsRow = await this.taskRepo
      .createQueryBuilder('t')
      .select('COUNT(t.id)', 'assigned')
      .addSelect("SUM(CASE WHEN t.status IN ('completed','verified') THEN 1 ELSE 0 END)", 'completed')
      .addSelect("SUM(CASE WHEN t.status = 'rejected' THEN 1 ELSE 0 END)", 'rejected')
      .addSelect(
        "SUM(CASE WHEN t.due_date < NOW() AND t.status NOT IN ('completed','verified') THEN 1 ELSE 0 END)",
        'overdue',
      )
      .addSelect(
        "AVG(CASE WHEN t.completed_at IS NOT NULL AND t.assigned_at IS NOT NULL THEN EXTRACT(EPOCH FROM (t.completed_at - t.assigned_at)) / 3600 END)",
        'avgCompletionHours',
      )
      .where('t.assigned_phi_id = :phiId', { phiId })
      .getRawOne<Record<string, string | null>>();

    const statusRows = await this.taskRepo
      .createQueryBuilder('t')
      .select('t.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .where('t.assigned_phi_id = :phiId', { phiId })
      .groupBy('t.status')
      .getRawMany<{ status: string; count: string }>();

    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    const monthlyRows = await this.taskRepo
      .createQueryBuilder('t')
      .select("DATE_TRUNC('month', t.completed_at)", 'month')
      .addSelect('COUNT(*)', 'completed')
      .where('t.assigned_phi_id = :phiId', { phiId })
      .andWhere("t.status IN ('completed','verified')")
      .andWhere('t.completed_at IS NOT NULL')
      .andWhere('t.completed_at >= :from', { from: sixMonthsAgo })
      .groupBy("DATE_TRUNC('month', t.completed_at)")
      .orderBy("DATE_TRUNC('month', t.completed_at)", 'ASC')
      .getRawMany<{ month: Date; completed: string }>();

    const evidenceRow = await this.evidenceRepo
      .createQueryBuilder('e')
      .select('COUNT(e.id)', 'total')
      .addSelect("SUM(CASE WHEN e.status = 'approved' THEN 1 ELSE 0 END)", 'approved')
      .addSelect("SUM(CASE WHEN e.status = 'rejected' THEN 1 ELSE 0 END)", 'rejected')
      .addSelect("SUM(CASE WHEN e.status = 'pending' THEN 1 ELSE 0 END)", 'pending')
      .where('e.submitted_by_id = :phiId', { phiId })
      .getRawOne<Record<string, string>>();

    const assigned = parseInt(metricsRow?.assigned ?? '0', 10);
    const completed = parseInt(metricsRow?.completed ?? '0', 10);
    const evidenceTotal = parseInt(evidenceRow?.total ?? '0', 10);
    const evidenceApproved = parseInt(evidenceRow?.approved ?? '0', 10);

    return {
      phiId: user.id,
      name: user.name,
      district: user.district ?? '',
      isActive: user.isActive,
      memberSince: user.createdAt.toISOString(),
      assigned,
      completed,
      rejected: parseInt(metricsRow?.rejected ?? '0', 10),
      overdue: parseInt(metricsRow?.overdue ?? '0', 10),
      completionRate: assigned > 0 ? Math.round((completed / assigned) * 100) : 0,
      avgCompletionHours: metricsRow?.avgCompletionHours
        ? parseFloat(metricsRow.avgCompletionHours)
        : null,
      evidenceTotal,
      evidenceApproved,
      evidenceRejected: parseInt(evidenceRow?.rejected ?? '0', 10),
      evidencePending: parseInt(evidenceRow?.pending ?? '0', 10),
      evidenceApprovalRate:
        evidenceTotal > 0 ? Math.round((evidenceApproved / evidenceTotal) * 100) : 0,
      statusBreakdown: statusRows.map((r) => ({
        status: r.status,
        count: parseInt(r.count, 10),
      })),
      monthlyTrend: monthlyRows.map((r) => ({
        month: r.month instanceof Date ? r.month.toISOString() : String(r.month),
        completed: parseInt(r.completed, 10),
      })),
    };
  }

  async getPhiTasks(
    phiId: string,
    page: number = 1,
    limit: number = 20,
    status?: string,
    type?: string,
    from?: string,
    to?: string,
  ): Promise<PhiTasksPageDto> {
    const applyFilters = (qb: ReturnType<typeof this.taskRepo.createQueryBuilder>) => {
      qb.where('t.assigned_phi_id = :phiId', { phiId });
      if (status) qb.andWhere('t.status = :status', { status });
      if (type) qb.andWhere('t.type = :type', { type });
      if (from) qb.andWhere('t.created_at >= :from', { from });
      if (to) qb.andWhere('t.created_at <= :to', { to });
      return qb;
    };

    const total = await applyFilters(this.taskRepo.createQueryBuilder('t')).getCount();

    const dataQb = this.taskRepo
      .createQueryBuilder('t')
      .innerJoin('t.district', 'd')
      .select('t.id', 'id')
      .addSelect('t.title', 'title')
      .addSelect('t.type', 'type')
      .addSelect('t.priority', 'priority')
      .addSelect('t.status', 'status')
      .addSelect('t.assigned_at', 'assignedAt')
      .addSelect('t.completed_at', 'completedAt')
      .addSelect('t.due_date', 'dueDate')
      .addSelect('d.name', 'districtName')
      .orderBy('t.created_at', 'DESC')
      .offset((page - 1) * limit)
      .limit(limit);
    applyFilters(dataQb);

    const rows = await dataQb.getRawMany<Record<string, unknown>>();

    const toIso = (v: unknown): string | null => {
      if (!v) return null;
      return v instanceof Date ? v.toISOString() : String(v);
    };

    return {
      tasks: rows.map((r) => ({
        id: r.id as string,
        title: r.title as string,
        type: r.type as string,
        priority: r.priority as string,
        status: r.status as string,
        assignedAt: toIso(r.assignedAt),
        completedAt: toIso(r.completedAt),
        dueDate: toIso(r.dueDate),
        districtName: r.districtName as string,
      })),
      total,
      page,
      limit,
    };
  }
}
