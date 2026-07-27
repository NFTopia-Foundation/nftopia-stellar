import { Injectable, Logger } from '@nestjs/common';
import { Resend } from 'resend';
import { EmailOptions, EmailProvider } from '../email.interface';

/**
 * Resend Email Provider
 */
@Injectable()
export class ResendProvider implements EmailProvider {
  private readonly logger = new Logger(ResendProvider.name);
  private readonly client: Resend;

  constructor(
    private readonly apiKey: string,
    private readonly fromEmail: string,
  ) {
    this.client = new Resend(this.apiKey);
  }

  async send(options: EmailOptions): Promise<void> {
    try {
      const result = await this.client.emails.send({
        from: options.from || this.fromEmail,
        to: Array.isArray(options.to) ? options.to : [options.to],
        subject: options.subject,
        html: options.html,
        text: options.text,
        attachments: options.attachments?.map((att) => ({
          content: Buffer.isBuffer(att.content)
            ? att.content.toString('base64')
            : att.content,
          filename: att.filename,
        })),
      });

      this.logger.log(`Email sent via Resend to ${options.to}, id: ${result.data?.id}`);
    } catch (error) {
      this.logger.error(`Failed to send email via Resend: ${error.message}`);
      throw error;
    }
  }

  async verify(): Promise<boolean> {
    try {
      if (!this.apiKey || this.apiKey.length === 0) {
        this.logger.error('Resend API key is not configured');
        return false;
      }
      this.logger.log('Resend configuration verified');
      return true;
    } catch (error) {
      this.logger.error(`Resend verification failed: ${error.message}`);
      return false;
    }
  }
}
