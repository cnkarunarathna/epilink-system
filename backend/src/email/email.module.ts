import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import * as nodemailer from 'nodemailer';
import { EmailService } from './email.service';
import { EmailProcessor } from './email.processor';
import { EmailController } from './email.controller';
import { EmailLog } from './entities/email-log.entity';
import {
  EMAIL_BULL_QUEUE,
  EMAIL_QUEUE,
  MAIL_TRANSPORT,
} from './email.constants';

@Global()
@Module({
  imports: [ConfigModule, TypeOrmModule.forFeature([EmailLog])],
  controllers: [EmailController],
  providers: [
    // BullMQ Queue instance (used by EmailService to enqueue jobs)
    {
      provide: EMAIL_BULL_QUEUE,
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        return new Queue(EMAIL_QUEUE, {
          connection: {
            host: configService.get<string>('REDIS_HOST', 'localhost'),
            port: parseInt(
              configService.get<string>('REDIS_PORT', '6379'),
              10,
            ),
            username:
              configService.get<string>('REDIS_USERNAME') || undefined,
            password:
              configService.get<string>('REDIS_PASSWORD') || undefined,
          },
        });
      },
    },

    // Nodemailer transporter (null when EMAIL_ENABLED=false)
    {
      provide: MAIL_TRANSPORT,
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const enabled =
          configService.get<string>('EMAIL_ENABLED') !== 'false';
        if (!enabled) return null;

        const user = configService.get<string>('ZOHO_SMTP_USER');
        const pass = configService.get<string>('ZOHO_SMTP_PASS');

        if (!user || !pass) {
          console.warn(
            '[EmailModule] ZOHO_SMTP_USER or ZOHO_SMTP_PASS not set — email sending disabled',
          );
          return null;
        }

        return nodemailer.createTransport({
          host: configService.get<string>('ZOHO_SMTP_HOST', 'smtp.zoho.com'),
          port: parseInt(
            configService.get<string>('ZOHO_SMTP_PORT', '465'),
            10,
          ),
          secure:
            configService.get<string>('ZOHO_SMTP_SECURE', 'true') !== 'false',
          auth: { user, pass },
        });
      },
    },

    EmailService,
    EmailProcessor,
  ],
  exports: [EmailService],
})
export class EmailModule {}
