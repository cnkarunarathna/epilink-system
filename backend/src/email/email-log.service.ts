import {
  Injectable,
  Inject,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Queue } from 'bullmq';
import { EmailLog, EmailStatus } from './entities/email-log.entity';
import { EMAIL_BULL_QUEUE } from './email.constants';
import { EmailJobPayload } from './email.types';

export interface EmailLogFilters {
  status?: EmailStatus;
  template?: string;
  recipientEmail?: string;
  relatedEntityType?: string;
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
}

export interface PaginatedEmailLogs {
  data: EmailLog[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface TemplateStats {
  template: string;
  sent: number;
  failed: number;
  skipped: number;
  pending: number;
}

export interface EmailStats {
  period: string;
  totalSent: number;
  totalFailed: number;
  totalSkipped: number;
  totalPending: number;
  byTemplate: TemplateStats[];
  failureRate: string;
}

@Injectable()
export class EmailLogService {
  private readonly logger = new Logger(EmailLogService.name);

  constructor(
    @InjectRepository(EmailLog)
    private readonly repo: Repository<EmailLog>,
    @Inject(EMAIL_BULL_QUEUE)
    private readonly emailQueue: Queue,
  ) {}

  /**
   * Paginated, filtered list of email logs.
   * All filters are optional; unset filters are ignored.
   */
  async findAll(filters: EmailLogFilters = {}): Promise<PaginatedEmailLogs> {
    const {
      page = 1,
      limit = 20,
      status,
      template,
      recipientEmail,
      relatedEntityType,
      from,
      to,
    } = filters;

    const safePage = Math.max(1, page);
    const safeLimit = Math.min(100, Math.max(1, limit));

    const qb = this.repo
      .createQueryBuilder('log')
      .orderBy('log.createdAt', 'DESC')
      .skip((safePage - 1) * safeLimit)
      .take(safeLimit);

    if (status) qb.andWhere('log.status = :status', { status });
    if (template) qb.andWhere('log.templateName = :template', { template });
    if (recipientEmail)
      qb.andWhere('log.recipientEmail ILIKE :email', {
        email: `%${recipientEmail}%`,
      });
    if (relatedEntityType)
      qb.andWhere('log.relatedEntityType = :relatedEntityType', {
        relatedEntityType,
      });
    if (from)
      qb.andWhere('log.createdAt >= :from', { from: new Date(from) });
    if (to)
      qb.andWhere('log.createdAt <= :to', { to: new Date(to) });

    const [data, total] = await qb.getManyAndCount();

    return {
      data,
      total,
      page: safePage,
      limit: safeLimit,
      totalPages: Math.ceil(total / safeLimit),
    };
  }

  /**
   * Single email log entry by ID.
   */
  async findOne(id: string): Promise<EmailLog> {
    const log = await this.repo.findOne({ where: { id } });
    if (!log) throw new NotFoundException(`Email log ${id} not found`);
    return log;
  }

  /**
   * Re-enqueue an email job from an existing log entry.
   * Reuses the original template, recipient, subject, and context.
   * A fresh EmailLog entry is created by the EmailProcessor when the job runs.
   */
  async resend(id: string): Promise<{ message: string; jobId?: string }> {
    const log = await this.findOne(id);

    const payload: EmailJobPayload = {
      to: log.recipientEmail,
      subject: log.subject,
      template: log.templateName,
      context: log.templateData ?? {},
      relatedEntityType: log.relatedEntityType,
      relatedEntityId: log.relatedEntityId,
      triggeredByUserId: log.triggeredByUserId,
    };

    try {
      const job = await this.emailQueue.add('send', payload, {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5_000 },
        removeOnComplete: 100,
        removeOnFail: 200,
      });

      this.logger.log(
        `Requeued email log ${id} → job ${job.id} for ${log.recipientEmail}`,
      );

      return { message: 'Email requeued successfully', jobId: String(job.id) };
    } catch (err) {
      this.logger.error(
        `Failed to requeue email log ${id}: ${err instanceof Error ? err.message : err}`,
      );
      throw err;
    }
  }

  /**
   * Aggregate stats for the last N days (default: 7).
   * Returns totals and a per-template breakdown.
   */
  async getStats(days = 7): Promise<EmailStats> {
    const from = new Date();
    from.setDate(from.getDate() - days);

    const rows: Array<{ template: string; status: string; count: string }> =
      await this.repo
        .createQueryBuilder('log')
        .select('log.templateName', 'template')
        .addSelect('log.status', 'status')
        .addSelect('COUNT(*)', 'count')
        .where('log.createdAt >= :from', { from })
        .groupBy('log.templateName')
        .addGroupBy('log.status')
        .getRawMany();

    const byTemplate = new Map<
      string,
      { sent: number; failed: number; skipped: number; pending: number }
    >();

    let totalSent = 0;
    let totalFailed = 0;
    let totalSkipped = 0;
    let totalPending = 0;

    for (const row of rows) {
      const n = parseInt(row.count, 10);
      if (!byTemplate.has(row.template)) {
        byTemplate.set(row.template, {
          sent: 0,
          failed: 0,
          skipped: 0,
          pending: 0,
        });
      }
      const t = byTemplate.get(row.template)!;

      switch (row.status) {
        case 'sent':
          t.sent += n;
          totalSent += n;
          break;
        case 'failed':
          t.failed += n;
          totalFailed += n;
          break;
        case 'skipped':
          t.skipped += n;
          totalSkipped += n;
          break;
        case 'pending':
          t.pending += n;
          totalPending += n;
          break;
      }
    }

    const totalAttempted = totalSent + totalFailed;
    const failureRate =
      totalAttempted > 0
        ? `${((totalFailed / totalAttempted) * 100).toFixed(1)}%`
        : '0.0%';

    const byTemplateArr: TemplateStats[] = Array.from(byTemplate.entries())
      .map(([template, counts]) => ({ template, ...counts }))
      .sort(
        (a, b) => b.sent + b.failed - (a.sent + a.failed),
      );

    return {
      period: `last_${days}_days`,
      totalSent,
      totalFailed,
      totalSkipped,
      totalPending,
      byTemplate: byTemplateArr,
      failureRate,
    };
  }
}
