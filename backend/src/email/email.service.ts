import { Injectable, Inject, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import { EMAIL_BULL_QUEUE } from './email.constants';
import { SendEmailOptions, EmailJobPayload } from './email.types';
import { User, UserRole } from '../entities/user.entity';
import { NotificationPreference } from './entities/notification-preference.entity';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly enabled: boolean;

  constructor(
    @Inject(EMAIL_BULL_QUEUE) private readonly emailQueue: Queue,
    private readonly configService: ConfigService,
    @InjectRepository(User) private readonly userRepository: Repository<User>,
    @InjectRepository(NotificationPreference)
    private readonly notifPrefRepo: Repository<NotificationPreference>,
  ) {
    this.enabled = this.configService.get<string>('EMAIL_ENABLED') !== 'false';
  }

  /**
   * Enqueue one email job per recipient.
   * Always fire-and-forget — never throws to callers.
   */
  async send(options: SendEmailOptions): Promise<void> {
    if (!this.enabled) {
      this.logger.debug(
        `Email skipped (EMAIL_ENABLED=false): "${options.subject}"`,
      );
      return;
    }

    const recipients = Array.isArray(options.to) ? options.to : [options.to];

    for (const recipient of recipients) {
      // Opt-out check — only when a notification category is specified
      if (options.notificationCategory) {
        const skipped = await this.isOptedOut(
          recipient,
          options.notificationCategory,
        );
        if (skipped) continue;
      }

      const payload: EmailJobPayload = { ...options, to: recipient };
      try {
        await this.emailQueue.add('send', payload, {
          attempts: 3,
          backoff: { type: 'exponential', delay: 5_000 },
          removeOnComplete: 100,
          removeOnFail: 200,
        });
      } catch (err) {
        this.logger.error(
          `Failed to enqueue email "${options.subject}" → ${recipient}: ${err instanceof Error ? err.message : err}`,
        );
      }
    }
  }

  /**
   * Returns true if the recipient has opted out of the given notification category.
   * Non-fatal: if the DB lookup fails the caller proceeds normally.
   */
  private async isOptedOut(
    email: string,
    category: string,
  ): Promise<boolean> {
    try {
      const user = await this.userRepository.findOne({
        where: { email },
        select: ['id'],
      });
      if (!user) return false;

      const pref = await this.notifPrefRepo.findOne({
        where: { userId: user.id },
      });
      if (!pref) return false;

      const catKey = category as keyof NotificationPreference;
      if (typeof pref[catKey] === 'boolean' && pref[catKey] === false) {
        this.logger.debug(
          `Email skipped (user opted out of "${category}"): ${email}`,
        );
        return true;
      }
    } catch (err) {
      this.logger.warn(
        `Preference check failed for ${email}: ${err instanceof Error ? err.message : err}`,
      );
    }
    return false;
  }

  /**
   * Broadcast an email to all active users with the given role.
   * Fetches recipients from the database and enqueues one job per user.
   * Always fire-and-forget — never throws to callers.
   */
  async sendToRole(
    role: UserRole,
    options: Omit<SendEmailOptions, 'to'>,
  ): Promise<void> {
    if (!this.enabled) {
      this.logger.debug(
        `Email skipped (EMAIL_ENABLED=false): "${options.subject}" to role ${role}`,
      );
      return;
    }

    let users: User[];
    try {
      users = await this.userRepository.find({
        where: { role, isActive: true },
        select: ['id', 'email', 'name'],
      });
    } catch (err) {
      this.logger.error(
        `sendToRole(${role}): failed to fetch users — ${err instanceof Error ? err.message : err}`,
      );
      return;
    }

    for (const user of users) {
      await this.send({ ...options, to: user.email });
    }
  }
}
