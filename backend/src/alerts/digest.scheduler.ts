import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { InjectDataSource } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { User, UserRole } from '../entities/user.entity';
import { EmailService } from '../email/email.service';
import { AnalyticsService } from '../analytics/analytics.service';

interface TaskStats {
  total: number;
  pending: number;
  assigned: number;
  inProgress: number;
  submitted: number;
  completed: number;
  rejected: number;
  overdue: number;
}

interface PhiActivity {
  name: string;
  completed: number;
  pending: number;
}

@Injectable()
export class DigestScheduler {
  private readonly logger = new Logger(DigestScheduler.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly analyticsService: AnalyticsService,
    private readonly emailService: EmailService,
    private readonly configService: ConfigService,
  ) {}

  private dashboardUrl(): string {
    return this.configService.get<string>(
      'NEXT_FRONTEND_URL',
      'http://localhost:3000',
    );
  }

  private getCurrentISOWeek(): { year: number; weekNumber: number } {
    const now = new Date();
    const jan4 = new Date(now.getFullYear(), 0, 4);
    const dayOfWeek = jan4.getDay() || 7;
    const weekOneMonday = new Date(jan4);
    weekOneMonday.setDate(jan4.getDate() - dayOfWeek + 1);
    const diff = now.getTime() - weekOneMonday.getTime();
    const weekNumber = Math.max(
      1,
      Math.floor(diff / (7 * 24 * 60 * 60 * 1000)) + 1,
    );
    return { year: now.getFullYear(), weekNumber };
  }

  private async getDistrictTaskStats(districtName: string): Promise<TaskStats> {
    const rows: Array<{ status: string; cnt: string }> =
      await this.dataSource.manager.query(
        `SELECT t.status, COUNT(*) as cnt
         FROM tasks t
         JOIN districts d ON d.id = t.district_id
         WHERE d.name = $1
         GROUP BY t.status`,
        [districtName],
      );

    const map: Record<string, number> = {};
    let total = 0;
    for (const r of rows) {
      map[r.status] = Number(r.cnt);
      total += Number(r.cnt);
    }

    const overdueRows: Array<{ cnt: string }> = await this.dataSource.manager.query(
      `SELECT COUNT(*) as cnt
       FROM tasks t
       JOIN districts d ON d.id = t.district_id
       WHERE d.name = $1
         AND t.due_date < NOW()
         AND t.status NOT IN ('completed', 'verified', 'rejected')`,
      [districtName],
    );

    return {
      total,
      pending: map['pending'] ?? 0,
      assigned: map['assigned'] ?? 0,
      inProgress: map['in_progress'] ?? 0,
      submitted: map['submitted'] ?? 0,
      completed: (map['completed'] ?? 0) + (map['verified'] ?? 0),
      rejected: map['rejected'] ?? 0,
      overdue: Number(overdueRows[0]?.cnt ?? 0),
    };
  }

  private async getPhiActivity(districtName: string): Promise<PhiActivity[]> {
    const rows: Array<{
      name: string;
      completed: string;
      pending: string;
    }> = await this.dataSource.manager.query(
      `SELECT u.name,
              COALESCE(SUM(CASE WHEN t.status IN ('completed', 'verified') THEN 1 ELSE 0 END), 0) AS completed,
              COALESCE(SUM(CASE WHEN t.status IN ('assigned', 'in_progress', 'submitted') THEN 1 ELSE 0 END), 0) AS pending
       FROM users u
       LEFT JOIN tasks t ON t.assigned_phi_id = u.id
       WHERE u.district = $1 AND u.role = 'phi' AND u.is_active = true
       GROUP BY u.id, u.name
       ORDER BY u.name`,
      [districtName],
    );
    return rows.map((r) => ({
      name: r.name,
      completed: Number(r.completed),
      pending: Number(r.pending),
    }));
  }

  private async getDistrictEvidencePending(
    districtName: string,
  ): Promise<number> {
    const rows: Array<{ cnt: string }> = await this.dataSource.manager.query(
      `SELECT COUNT(*) as cnt
       FROM evidence e
       JOIN tasks t ON t.id = e.task_id
       JOIN districts d ON d.id = t.district_id
       WHERE d.name = $1 AND e.status = 'pending'`,
      [districtName],
    );
    return Number(rows[0]?.cnt ?? 0);
  }

  private async getDistrictCasesThisWeek(
    districtName: string,
    year: number,
    weekNumber: number,
  ): Promise<number> {
    const rows: Array<{ cases: string }> = await this.dataSource.manager.query(
      `SELECT COALESCE(SUM(dc.cases), 0) as cases
       FROM dengue_cases dc
       JOIN districts d ON d.id = dc.district_id
       WHERE d.name = $1 AND dc.year = $2 AND dc.week = $3`,
      [districtName, year, weekNumber],
    );
    return Number(rows[0]?.cases ?? 0);
  }

  private async getSystemTaskStats(): Promise<TaskStats> {
    const rows: Array<{ status: string; cnt: string }> =
      await this.dataSource.manager.query(
        `SELECT status, COUNT(*) as cnt FROM tasks GROUP BY status`,
      );

    const map: Record<string, number> = {};
    let total = 0;
    for (const r of rows) {
      map[r.status] = Number(r.cnt);
      total += Number(r.cnt);
    }

    const overdueRows: Array<{ cnt: string }> = await this.dataSource.manager.query(
      `SELECT COUNT(*) as cnt FROM tasks
       WHERE due_date < NOW()
         AND status NOT IN ('completed', 'verified', 'rejected')`,
    );

    return {
      total,
      pending: map['pending'] ?? 0,
      assigned: map['assigned'] ?? 0,
      inProgress: map['in_progress'] ?? 0,
      submitted: map['submitted'] ?? 0,
      completed: (map['completed'] ?? 0) + (map['verified'] ?? 0),
      rejected: map['rejected'] ?? 0,
      overdue: Number(overdueRows[0]?.cnt ?? 0),
    };
  }

  private async getTopDistricts(
    limit = 3,
  ): Promise<Array<{ name: string; taskCount: number }>> {
    const rows: Array<{ name: string; task_count: string }> =
      await this.dataSource.manager.query(
        `SELECT d.name, COUNT(t.id) as task_count
         FROM districts d
         LEFT JOIN tasks t ON t.district_id = d.id
         GROUP BY d.id, d.name
         ORDER BY task_count DESC
         LIMIT $1`,
        [limit],
      );
    return rows.map((r) => ({ name: r.name, taskCount: Number(r.task_count) }));
  }

  private async getReportStats(): Promise<{
    generated: number;
    approved: number;
  }> {
    const rows: Array<{ status: string; cnt: string }> =
      await this.dataSource.manager.query(
        `SELECT status, COUNT(*) as cnt FROM weekly_reports GROUP BY status`,
      );
    const map: Record<string, number> = {};
    for (const r of rows) map[r.status] = Number(r.cnt);
    return {
      generated: (map['pending'] ?? 0) + (map['approved'] ?? 0),
      approved: map['approved'] ?? 0,
    };
  }

  /** Every Monday at 7:00 AM — send weekly digest to supervisors and admins. */
  @Cron('0 7 * * 1')
  async sendWeeklyDigests(): Promise<void> {
    this.logger.log('Running weekly digest job');
    const { year, weekNumber } = this.getCurrentISOWeek();
    const dashboardUrl = this.dashboardUrl();

    // ── Supervisor digests ──────────────────────────────────────────────
    const supervisors = await this.userRepository.find({
      where: { role: UserRole.SUPERVISOR, isActive: true },
    });

    for (const supervisor of supervisors) {
      if (!supervisor.district) continue;
      try {
        const [taskStats, phiActivity, evidencePending, districtCases] =
          await Promise.all([
            this.getDistrictTaskStats(supervisor.district),
            this.getPhiActivity(supervisor.district),
            this.getDistrictEvidencePending(supervisor.district),
            this.getDistrictCasesThisWeek(
              supervisor.district,
              year,
              weekNumber,
            ),
          ]);

        await this.emailService.send({
          to: supervisor.email,
          subject: `Weekly Summary — ${supervisor.district}, Week ${weekNumber}, ${year}`,
          template: 'weekly-digest',
          context: {
            recipientName: supervisor.name,
            isAdmin: false,
            district: supervisor.district,
            weekNumber,
            year,
            taskStats,
            phiActivity,
            evidencePending,
            evidencePendingPlural: evidencePending > 1,
            districtCases,
            dashboardUrl,
          },
          notificationCategory: 'weeklyDigest',
          relatedEntityType: 'digest',
        });
      } catch (err) {
        this.logger.error(
          `Digest failed for supervisor ${supervisor.email}: ${err instanceof Error ? err.message : err}`,
        );
      }
    }

    // ── Admin digests ───────────────────────────────────────────────────
    const admins = await this.userRepository.find({
      where: { role: UserRole.ADMIN, isActive: true },
    });

    let systemStats:
      | Awaited<ReturnType<typeof this.getSystemTaskStats>>
      | undefined;
    let topDistricts:
      | Awaited<ReturnType<typeof this.getTopDistricts>>
      | undefined;
    let reportStats:
      | Awaited<ReturnType<typeof this.getReportStats>>
      | undefined;
    let activeUsers = 0;
    let activeAlerts = 0;

    if (admins.length > 0) {
      try {
        let alerts: any[] = [];
        [systemStats, topDistricts, reportStats] = await Promise.all([
          this.getSystemTaskStats(),
          this.getTopDistricts(),
          this.getReportStats(),
        ]);

        const [activeUsersRows, alertsRaw] = await Promise.all([
          this.dataSource.manager.query<Array<{ cnt: string }>>(
            `SELECT COUNT(*) as cnt FROM users WHERE is_active = true`,
          ),
          this.analyticsService.getOutbreakAlerts().catch(() => []),
        ]);

        activeUsers = Number(activeUsersRows[0]?.cnt ?? 0);
        alerts = Array.isArray(alertsRaw) ? alertsRaw : [];
        activeAlerts = alerts.filter(
          (a: any) => a.severity === 'critical' || a.severity === 'warning',
        ).length;
      } catch (err) {
        this.logger.error(
          `Failed to gather admin digest stats: ${err instanceof Error ? err.message : err}`,
        );
      }
    }

    for (const admin of admins) {
      await this.emailService
        .send({
          to: admin.email,
          subject: `System Weekly Summary — Week ${weekNumber}, ${year}`,
          template: 'weekly-digest',
          context: {
            recipientName: admin.name,
            isAdmin: true,
            weekNumber,
            year,
            taskStats: systemStats ?? {
              total: 0,
              pending: 0,
              assigned: 0,
              inProgress: 0,
              submitted: 0,
              completed: 0,
              rejected: 0,
              overdue: 0,
            },
            topDistricts: topDistricts ?? [],
            activeUsers,
            reportsGenerated: reportStats?.generated ?? 0,
            reportsApproved: reportStats?.approved ?? 0,
            activeAlerts,
            dashboardUrl,
          },
          notificationCategory: 'weeklyDigest',
          relatedEntityType: 'digest',
        })
        .catch((err) =>
          this.logger.error(
            `Admin digest failed for ${admin.email}: ${err instanceof Error ? err.message : err}`,
          ),
        );
    }

    this.logger.log(
      `Weekly digest sent to ${supervisors.length} supervisor(s) and ${admins.length} admin(s)`,
    );
  }

  /** Every day at 10:00 AM — check for high-risk districts and send risk alerts. */
  @Cron('0 10 * * *')
  async sendRiskAlerts(): Promise<void> {
    this.logger.log('Running dengue risk alert check');

    const threshold = this.configService.get<number>(
      'DENGUE_RISK_ALERT_THRESHOLD',
      50,
    );
    const { year, weekNumber } = this.getCurrentISOWeek();
    const dashboardUrl = this.dashboardUrl();

    let alerts: any[];
    try {
      const raw = await this.analyticsService.getOutbreakAlerts();
      alerts = Array.isArray(raw) ? raw : [];
    } catch (err) {
      this.logger.error(
        `Failed to fetch outbreak alerts: ${err instanceof Error ? err.message : err}`,
      );
      return;
    }

    const triggered = alerts.filter(
      (a) =>
        (a.severity === 'critical' || a.severity === 'warning') &&
        a.current_cases >= threshold,
    );

    if (triggered.length === 0) {
      this.logger.log('No risk alerts to send');
      return;
    }

    this.logger.log(`Sending risk alerts for ${triggered.length} district(s)`);

    const admins = await this.userRepository.find({
      where: { role: UserRole.ADMIN, isActive: true },
    });

    for (const alert of triggered) {
      const emailContext = {
        district: alert.district,
        alertLevel: alert.alert_level,
        description: alert.description,
        currentCases: alert.current_cases,
        avgCases: Math.round(alert.avg_cases ?? 0),
        weekNumber,
        year,
        dashboardUrl,
      };
      const subject = `ALERT: High Dengue Risk Detected — ${alert.district}`;

      // Notify district supervisor
      const supervisor = await this.userRepository
        .findOne({
          where: {
            district: alert.district,
            role: UserRole.SUPERVISOR,
            isActive: true,
          },
        })
        .catch(() => null);

      if (supervisor) {
        await this.emailService
          .send({
            to: supervisor.email,
            subject,
            template: 'risk-alert',
            context: { ...emailContext, recipientName: supervisor.name },
            notificationCategory: 'riskAlerts',
            relatedEntityType: 'analytics',
          })
          .catch((err) =>
            this.logger.error(
              `Risk alert email failed for supervisor ${supervisor.email}: ${err instanceof Error ? err.message : err}`,
            ),
          );
      }

      // Notify all admins
      for (const admin of admins) {
        await this.emailService
          .send({
            to: admin.email,
            subject,
            template: 'risk-alert',
            context: { ...emailContext, recipientName: admin.name },
            notificationCategory: 'riskAlerts',
            relatedEntityType: 'analytics',
          })
          .catch((err) =>
            this.logger.error(
              `Risk alert email failed for admin ${admin.email}: ${err instanceof Error ? err.message : err}`,
            ),
          );
      }
    }
  }
}
