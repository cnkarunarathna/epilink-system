import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan, Not, In } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { Task, TaskStatus } from './entities/task.entity';
import { User, UserRole } from '../entities/user.entity';
import { EmailService } from '../email/email.service';

const ACTIVE_STATUSES: TaskStatus[] = [
  TaskStatus.ASSIGNED,
  TaskStatus.IN_PROGRESS,
  TaskStatus.SUBMITTED,
];

const TERMINAL_STATUSES: TaskStatus[] = [
  TaskStatus.COMPLETED,
  TaskStatus.VERIFIED,
  TaskStatus.REJECTED,
];

@Injectable()
export class TaskReminderScheduler {
  private readonly logger = new Logger(TaskReminderScheduler.name);

  constructor(
    @InjectRepository(Task)
    private readonly taskRepository: Repository<Task>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly emailService: EmailService,
    private readonly configService: ConfigService,
  ) {}

  private taskUrl(taskId: string): string {
    const base = this.configService.get<string>(
      'NEXT_FRONTEND_URL',
      'http://localhost:3000',
    );
    return `${base}/dashboard/tasks/${taskId}`;
  }

  private formatDate(date: Date): string {
    return new Date(date).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }

  /** 8:00 AM daily — remind PHIs of tasks due tomorrow */
  @Cron('0 8 * * *')
  async sendDueTomorrowReminders(): Promise<void> {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);

    const dayAfter = new Date(tomorrow);
    dayAfter.setDate(dayAfter.getDate() + 1);

    this.logger.log('Running due-tomorrow reminder job');

    const tasks = await this.taskRepository
      .createQueryBuilder('task')
      .leftJoinAndSelect('task.assignedPhi', 'phi')
      .leftJoinAndSelect('task.district', 'district')
      .where('task.dueDate >= :tomorrow', { tomorrow })
      .andWhere('task.dueDate < :dayAfter', { dayAfter })
      .andWhere('task.status IN (:...statuses)', { statuses: ACTIVE_STATUSES })
      .andWhere('task.assignedPhiId IS NOT NULL')
      .getMany();

    this.logger.log(`Found ${tasks.length} task(s) due tomorrow`);

    for (const task of tasks) {
      if (!task.assignedPhi) continue;
      await this.emailService
        .send({
          to: task.assignedPhi.email,
          subject: `Reminder: Task Due Tomorrow — ${task.title}`,
          template: 'task-reminder',
          context: {
            phiName: task.assignedPhi.name,
            taskTitle: task.title,
            taskType: task.type,
            priority: task.priority,
            status: task.status,
            address: task.address,
            district: task.district?.name,
            dueDate: this.formatDate(task.dueDate!),
            taskUrl: this.taskUrl(task.id),
          },
          relatedEntityType: 'task',
          relatedEntityId: task.id,
        })
        .catch((err) => this.logger.error(`Reminder email failed for task ${task.id}`, err));
    }
  }

  /** 9:00 AM daily — alert PHIs and supervisors of overdue tasks */
  @Cron('0 9 * * *')
  async sendOverdueAlerts(): Promise<void> {
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    this.logger.log('Running overdue task alert job');

    const tasks = await this.taskRepository
      .createQueryBuilder('task')
      .leftJoinAndSelect('task.assignedPhi', 'phi')
      .leftJoinAndSelect('task.district', 'district')
      .where('task.dueDate < :now', { now })
      .andWhere('task.status NOT IN (:...statuses)', {
        statuses: TERMINAL_STATUSES,
      })
      .andWhere('task.assignedPhiId IS NOT NULL')
      .getMany();

    this.logger.log(`Found ${tasks.length} overdue task(s)`);

    for (const task of tasks) {
      if (!task.assignedPhi) continue;

      const daysOverdue = Math.floor(
        (Date.now() - new Date(task.dueDate!).getTime()) / 86_400_000,
      );

      const districtName = task.district?.name ?? '';

      // Find supervisor for this district
      const supervisor = await this.userRepository.findOne({
        where: {
          district: districtName,
          role: UserRole.SUPERVISOR,
          isActive: true,
        },
      });

      const emailContext = {
        phiName: task.assignedPhi.name,
        taskTitle: task.title,
        taskType: task.type,
        priority: task.priority,
        status: task.status,
        address: task.address,
        district: districtName,
        dueDate: this.formatDate(task.dueDate!),
        daysOverdue,
        multipleDays: daysOverdue > 1,
        taskUrl: this.taskUrl(task.id),
      };

      // Email PHI
      await this.emailService
        .send({
          to: task.assignedPhi.email,
          subject: `Overdue Task: ${task.title}`,
          template: 'task-overdue',
          context: emailContext,
          relatedEntityType: 'task',
          relatedEntityId: task.id,
        })
        .catch((err) =>
          this.logger.error(`Overdue PHI email failed for task ${task.id}`, err),
        );

      // CC supervisor
      if (supervisor) {
        await this.emailService
          .send({
            to: supervisor.email,
            subject: `[Overdue Alert] ${task.title} — ${task.assignedPhi.name}`,
            template: 'task-overdue',
            context: {
              ...emailContext,
              phiName: `${task.assignedPhi.name} (PHI)`,
            },
            relatedEntityType: 'task',
            relatedEntityId: task.id,
          })
          .catch((err) =>
            this.logger.error(
              `Overdue supervisor email failed for task ${task.id}`,
              err,
            ),
          );
      }
    }
  }
}
