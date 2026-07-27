import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { EmailService } from './email.service';
import { EmailTemplateService } from './email-template.service';
import { EmailQueueService } from './queue/email.queue.service';
import { EmailProcessor } from './queue/email.processor';
import { EmailProviderFactory } from './email.provider';
import { EmailLog } from './entities/email-log.entity';
import { PasswordResetToken } from './entities/password-reset-token.entity';
import { VerificationToken } from './entities/verification-token.entity';
import { User } from '../../users/user.entity';

/**
 * EmailModule
 *
 * Provides all email-related functionality:
 * - Transactional email sending (verification, password reset, notifications)
 * - Provider abstraction (SMTP, SendGrid, Resend)
 * - Queue-based delivery via BullMQ
 * - Email status tracking
 * - Handlebars template rendering
 */
@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([
      EmailLog,
      PasswordResetToken,
      VerificationToken,
      User,
    ]),
    BullModule.registerQueueAsync({
      name: 'email',
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        connection: {
          host: configService.get<string>('REDIS_HOST', 'localhost'),
          port: configService.get<number>('REDIS_PORT', 6379),
          password: configService.get<string>('REDIS_PASSWORD') || undefined,
          db: configService.get<number>('REDIS_DB', 0),
        },
        defaultJobOptions: {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 2000,
          },
          removeOnComplete: 100,
          removeOnFail: 500,
        },
      }),
      inject: [ConfigService],
    }),
  ],
  providers: [
    EmailProviderFactory,
    EmailTemplateService,
    EmailService,
    EmailQueueService,
    EmailProcessor,
  ],
  exports: [EmailService, EmailQueueService],
})
export class EmailModule {}
