import { Injectable, Logger } from '@nestjs/common';
import * as sgMail from '@sendgrid/mail';
import { EmailOptions, EmailProvider } from '../email.interface';

/**
 * SendGrid Email Provider
 */
@Injectable()
export class SendGridProvider implements EmailProvider {
  private readonly logger = new Logger(SendGridProvider.name);

  constructor(
    private readonly apiKey: string,
    private readonly fromEmail: string,
  ) {
    sgMail.setApiKey(this.apiKey);
  }

  async send(options: EmailOptions): Promise<void> {
    try {
      const msg = {
        to: options.to,
        from: options.from || this.fromEmail,
        subject: options.subject,
        html: options.html,
        text: options.text,
        attachments: options.attachments?.map((att) => ({
          content: Buffer.isBuffer(att.content)
            ? att.content.toString('base64')
            : att.content,
          filename: att.filename,
          type: att.contentType,
          disposition: 'attachment',
        })),
      };

      await sgMail.send(msg);
      this.logger.log(`Email sent via SendGrid to ${options.to}`);
    } catch (error) {
      this.logger.error(`Failed to send email via SendGrid: ${error.message}`);
      throw error;
    }
  }

  async verify(): Promise<boolean> {
    try {
      // SendGrid doesn't have a direct verify method, but we can check if API key is set
      if (!this.apiKey || this.apiKey.length === 0) {
        this.logger.error('SendGrid API key is not configured');
        return false;
      }
      this.logger.log('SendGrid configuration verified');
      return true;
    } catch (error) {
      this.logger.error(`SendGrid verification failed: ${error.message}`);
      return false;
    }
  }
}
