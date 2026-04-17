import { Injectable, Inject, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import { EMAIL_BULL_QUEUE } from './email.constants';
import { SendEmailOptions, EmailJobPayload } from './email.types';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly enabled: boolean;

  constructor(
    @Inject(EMAIL_BULL_QUEUE) private readonly emailQueue: Queue,
    private readonly configService: ConfigService,
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
}
