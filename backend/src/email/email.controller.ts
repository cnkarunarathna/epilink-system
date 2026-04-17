import {
  Controller,
  Post,
  Body,
  UseGuards,
  ForbiddenException,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { EmailService } from './email.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../entities/user.entity';

@Controller('email')
@UseGuards(JwtAuthGuard, RolesGuard)
export class EmailController {
  constructor(private readonly emailService: EmailService) {}

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
}
