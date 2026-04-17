import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
  Inject,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { Worker, Job } from 'bullmq';
import * as nodemailer from 'nodemailer';
import * as Handlebars from 'handlebars';
import * as fs from 'fs';
import * as path from 'path';
import { EmailLog } from './entities/email-log.entity';
import { EmailJobPayload } from './email.types';
import { MAIL_TRANSPORT, EMAIL_QUEUE } from './email.constants';

/** Threshold above which the failure rate triggers an error-level log. */
const FAILURE_RATE_THRESHOLD = 0.1; // 10 %
/** Minimum sample size before the failure rate check fires. */
const FAILURE_RATE_MIN_SAMPLE = 10;

@Injectable()
export class EmailProcessor implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EmailProcessor.name);
  private worker: Worker | null = null;

  /**
   * In-memory hourly counters for failure-rate monitoring.
   * Key format: "YYYY-M-D-H" (UTC).  Entries older than 2 hours are pruned.
   */
  private readonly hourlyCounts = new Map<
    string,
    { sent: number; failed: number }
  >();

  constructor(
    @Inject(MAIL_TRANSPORT)
    private readonly transporter: nodemailer.Transporter | null,
    @InjectRepository(EmailLog)
    private readonly emailLogRepo: Repository<EmailLog>,
    private readonly configService: ConfigService,
  ) {}

  onModuleInit() {
    this.registerHandlebarsHelpers();
    this.registerPartials();

    const connection = {
      host: this.configService.get<string>('REDIS_HOST', 'localhost'),
      port: parseInt(this.configService.get<string>('REDIS_PORT', '6379'), 10),
      username: this.configService.get<string>('REDIS_USERNAME') || undefined,
      password: this.configService.get<string>('REDIS_PASSWORD') || undefined,
    };

    const concurrency = parseInt(
      this.configService.get<string>('EMAIL_QUEUE_CONCURRENCY', '5'),
      10,
    );

    this.worker = new Worker(
      EMAIL_QUEUE,
      async (job: Job<EmailJobPayload>) => this.handleJob(job),
      { connection, concurrency },
    );

    this.worker.on('failed', (job, err) => {
      this.logger.error(
        `Job ${job?.id} failed (attempt ${job?.attemptsMade}): ${err.message}`,
      );
    });

    this.logger.log('Email worker started');
  }

  async onModuleDestroy() {
    if (this.worker) {
      await this.worker.close();
      this.logger.log('Email worker closed');
    }
  }

  // ── Job handler ────────────────────────────────────────────────────────────

  private async handleJob(job: Job<EmailJobPayload>): Promise<void> {
    const {
      to,
      subject,
      template,
      context,
      relatedEntityType,
      relatedEntityId,
      triggeredByUserId,
    } = job.data;

    const log = this.emailLogRepo.create({
      recipientEmail: to,
      subject,
      templateName: template,
      templateData: context,
      status: 'pending',
      relatedEntityType,
      relatedEntityId,
      triggeredByUserId,
    });

    try {
      if (!this.transporter) {
        log.status = 'skipped';
        log.errorMessage = 'Transporter not configured (EMAIL_ENABLED=false)';
        await this.saveLog(log);
        return;
      }

      const html = this.renderTemplate(template, context);
      const fromName = this.configService.get<string>(
        'ZOHO_FROM_NAME',
        'Epilink System',
      );
      const fromEmail = this.configService.get<string>('ZOHO_FROM_EMAIL');

      const info = await this.transporter.sendMail({
        from: `"${fromName}" <${fromEmail}>`,
        to,
        subject,
        html,
      });

      log.status = 'sent';
      log.messageId = info.messageId;
      log.sentAt = new Date();
      this.logger.log(`Sent to ${to}: "${subject}" [${info.messageId}]`);
      this.recordOutcome('sent');
    } catch (err) {
      log.status = 'failed';
      log.errorMessage = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `Failed to send to ${to}: ${err instanceof Error ? err.message : err}`,
      );
      this.recordOutcome('failed');
      await this.saveLog(log);
      throw err; // re-throw so BullMQ applies retry logic
    }

    await this.saveLog(log);
  }

  // ── Template rendering ─────────────────────────────────────────────────────

  private renderTemplate(
    templateName: string,
    context: Record<string, any>,
  ): string {
    const templateDir = path.join(__dirname, 'templates');
    const templatePath = path.join(templateDir, `${templateName}.hbs`);

    if (!fs.existsSync(templatePath)) {
      throw new Error(`Email template not found: ${templateName}`);
    }

    const source = fs.readFileSync(templatePath, 'utf8');
    const contentFn = Handlebars.compile(source);
    const content = contentFn(context);

    // Wrap in base layout if available
    const basePath = path.join(templateDir, 'base.hbs');
    if (fs.existsSync(basePath)) {
      const baseFn = Handlebars.compile(fs.readFileSync(basePath, 'utf8'));
      return baseFn({ ...context, content });
    }

    return content;
  }

  private registerPartials() {
    const partialsDir = path.join(__dirname, 'templates', 'partials');
    if (!fs.existsSync(partialsDir)) return;

    for (const file of fs.readdirSync(partialsDir)) {
      if (!file.endsWith('.hbs')) continue;
      const name = path.basename(file, '.hbs');
      const content = fs.readFileSync(path.join(partialsDir, file), 'utf8');
      Handlebars.registerPartial(name, content);
    }
  }

  private registerHandlebarsHelpers() {
    Handlebars.registerHelper('currentYear', () => new Date().getFullYear());
    Handlebars.registerHelper(
      'uppercase',
      (str: string) => str?.toUpperCase() ?? '',
    );
    Handlebars.registerHelper(
      'formatDate',
      (date: string | Date) =>
        new Date(date).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        }),
    );
  }

  // ── Failure-rate monitoring ────────────────────────────────────────────────

  private currentHourKey(): string {
    const now = new Date();
    return `${now.getUTCFullYear()}-${now.getUTCMonth()}-${now.getUTCDate()}-${now.getUTCHours()}`;
  }

  private recordOutcome(outcome: 'sent' | 'failed'): void {
    const key = this.currentHourKey();
    const counts = this.hourlyCounts.get(key) ?? { sent: 0, failed: 0 };
    counts[outcome]++;
    this.hourlyCounts.set(key, counts);

    // Prune buckets older than 2 hours to prevent unbounded growth
    const cutoff = new Date(Date.now() - 2 * 60 * 60 * 1000);
    const cutoffKey = `${cutoff.getUTCFullYear()}-${cutoff.getUTCMonth()}-${cutoff.getUTCDate()}-${cutoff.getUTCHours()}`;
    for (const k of this.hourlyCounts.keys()) {
      if (k < cutoffKey) this.hourlyCounts.delete(k);
    }

    // Check failure rate in the current hour window
    const { sent, failed } = counts;
    const total = sent + failed;
    if (total >= FAILURE_RATE_MIN_SAMPLE) {
      const rate = failed / total;
      if (rate > FAILURE_RATE_THRESHOLD) {
        this.logger.error(
          `High email failure rate in current hour: ${failed}/${total} (${(rate * 100).toFixed(1)}%) — exceeds ${FAILURE_RATE_THRESHOLD * 100}% threshold`,
        );
      }
    }
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  private async saveLog(log: EmailLog): Promise<void> {
    try {
      await this.emailLogRepo.save(log);
    } catch (err) {
      this.logger.warn(
        `Could not save email log for ${log.recipientEmail}: ${err instanceof Error ? err.message : err}`,
      );
    }
  }
}
