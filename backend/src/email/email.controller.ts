import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  UseGuards,
  ForbiddenException,
  HttpCode,
  HttpStatus,
  ParseIntPipe,
  DefaultValuePipe,
  ParseUUIDPipe,
} from '@nestjs/common';
import { EmailService } from './email.service';
import { EmailLogService } from './email-log.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../entities/user.entity';
import { EmailStatus } from './entities/email-log.entity';

@Controller('email')
@UseGuards(JwtAuthGuard, RolesGuard)
export class EmailController {
  constructor(
    private readonly emailService: EmailService,
    private readonly emailLogService: EmailLogService,
  ) {}

  // ── Dev test endpoint ─────────────────────────────────────────────────────

  /**
   * Send a test email to verify Zoho SMTP configuration.
   * Admin-only. Disabled in production.
   */
  @Post('test')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  async sendTest(@Body() body: { to: string }) {
    if (process.env.NODE_ENV === 'production') {
      throw new ForbiddenException('Test endpoint is disabled in production');
    }

    await this.emailService.send({
      to: body.to,
      subject: 'Epilink Email System — Test',
      template: 'test',
      context: {
        recipientEmail: body.to,
        sentAt: new Date().toLocaleString('en-US', { timeZone: 'Asia/Colombo' }),
        env: process.env.NODE_ENV ?? 'development',
      },
    });

    return { message: 'Test email queued successfully', recipient: body.to };
  }

  // ── Audit log endpoints ───────────────────────────────────────────────────

  /**
   * Paginated, filtered list of email logs.
   * Admin only.
   *
   * Query params:
   *   status          — sent | failed | pending | skipped
   *   template        — exact template name
   *   recipientEmail  — partial match (ILIKE)
   *   relatedEntityType — task | user | report | evidence
   *   from            — ISO date string (start of range)
   *   to              — ISO date string (end of range)
   *   page            — page number (default: 1)
   *   limit           — page size (default: 20, max: 100)
   */
  @Get('logs')
  @Roles(UserRole.ADMIN)
  async getLogs(
    @Query('status') status?: string,
    @Query('template') template?: string,
    @Query('recipientEmail') recipientEmail?: string,
    @Query('relatedEntityType') relatedEntityType?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page = 1,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit = 20,
  ) {
    return this.emailLogService.findAll({
      status: status as EmailStatus | undefined,
      template,
      recipientEmail,
      relatedEntityType,
      from,
      to,
      page,
      limit,
    });
  }

  /**
   * Aggregate email stats for the last N days (default: 7).
   * Admin only.
   *
   * Query params:
   *   days — number of days to include (default: 7)
   *
   * NOTE: This route must be declared before GET /logs/:id so that
   * the literal path segment "stats" is matched before the :id wildcard.
   */
  @Get('logs/stats')
  @Roles(UserRole.ADMIN)
  async getStats(
    @Query('days', new DefaultValuePipe(7), ParseIntPipe) days = 7,
  ) {
    return this.emailLogService.getStats(days);
  }

  /**
   * Single email log entry by ID.
   * Admin only.
   */
  @Get('logs/:id')
  @Roles(UserRole.ADMIN)
  async getLog(@Param('id', ParseUUIDPipe) id: string) {
    return this.emailLogService.findOne(id);
  }

  /**
   * Re-enqueue a previous email job by its log ID.
   * Useful for retrying failed deliveries.
   * Admin only.
   */
  @Post('logs/:id/resend')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  async resend(@Param('id', ParseUUIDPipe) id: string) {
    return this.emailLogService.resend(id);
  }
}
