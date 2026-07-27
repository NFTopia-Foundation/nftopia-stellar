import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { EmailOptions, EmailProvider } from '../email.interface';

/**
 * SMTP Email Provider using Nodemailer
 */
@Injectable()
export class SmtpProvider implements EmailProvider {
  private readonly logger = new Logger(SmtpProvider.name);
  private transporter: Transporter;

  constructor(
    private readonly host: string,
    private readonly port: number,
    private readonly user: string,
    private readonly pass: string,
    private readonly secure: boolean = false,
  ) {
    this.transporter = nodemailer.createTransport({
      host: this.host,
      port: this.port,
      secure: this.secure,
      auth: {
        user: this.user,
        pass: this.pass,
      },
    });
  }

  async send(options: EmailOptions): Promise<void> {
    try {
      const result = await this.transporter.sendMail({
        from: options.from,
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text,
        attachments: options.attachments,
      });

      this.logger.log(
        `Email sent via SMTP to ${options.to}, messageId: ${result.messageId}`,
      );
    } catch (error) {
      this.logger.error(`Failed to send email via SMTP: ${error.message}`);
      throw error;
    }
  }

  async verify(): Promise<boolean> {
    try {
      await this.transporter.verify();
      this.logger.log('SMTP configuration verified successfully');
      return true;
    } catch (error) {
      this.logger.error(`SMTP verification failed: ${error.message}`);
      return false;
    }
  }
}
