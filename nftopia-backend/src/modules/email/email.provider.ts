import { Provider, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EmailProvider, EmailProviderType } from './email.interface';
import { SmtpProvider } from './providers/smtp.provider';
import { SendGridProvider } from './providers/sendgrid.provider';
import { ResendProvider } from './providers/resend.provider';

/** Injection token for the EmailProvider */
export const EMAIL_PROVIDER_TOKEN = 'EMAIL_PROVIDER';

/**
 * Factory provider that creates the appropriate email provider based on configuration
 */
export const EmailProviderFactory: Provider = {
  provide: EMAIL_PROVIDER_TOKEN,
  useFactory: (configService: ConfigService): EmailProvider => {
    const logger = new Logger('EmailProviderFactory');
    const providerType = (
      configService.get<string>('EMAIL_PROVIDER', EmailProviderType.SMTP)
    ).toLowerCase() as EmailProviderType;

    logger.log(`Initializing email provider: ${providerType}`);

    switch (providerType) {
      case EmailProviderType.SENDGRID: {
        const apiKey = configService.get<string>('SENDGRID_API_KEY', '');
        const from = configService.get<string>('SENDGRID_FROM', '');
        if (!apiKey) {
          logger.warn('SENDGRID_API_KEY is not set');
        }
        return new SendGridProvider(apiKey, from);
      }

      case EmailProviderType.RESEND: {
        const apiKey = configService.get<string>('RESEND_API_KEY', '');
        const from = configService.get<string>('RESEND_FROM', '');
        if (!apiKey) {
          logger.warn('RESEND_API_KEY is not set');
        }
        return new ResendProvider(apiKey, from);
      }

      case EmailProviderType.SMTP:
      default: {
        const host = configService.get<string>('SMTP_HOST', 'localhost');
        const port = configService.get<number>('SMTP_PORT', 587);
        const user = configService.get<string>('SMTP_USER', '');
        const pass = configService.get<string>('SMTP_PASS', '');
        const secure = port === 465;
        return new SmtpProvider(host, port, user, pass, secure);
      }
    }
  },
  inject: [ConfigService],
};
