import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transporter: Transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.mailtrap.io',
      port: parseInt(process.env.SMTP_PORT || '587', 10),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }

  async sendPasswordResetEmail(
    to: string,
    resetLink: string,
    expiresInMinutes: number,
  ): Promise<void> {
    const fromAddress =
      process.env.SMTP_FROM || 'noreply@nftopia.app';

    try {
      await this.transporter.sendMail({
        from: fromAddress,
        to,
        subject: 'Reset your NFTopia password',
        text: [
          'You requested a password reset for your NFTopia account.',
          '',
          `Reset link (expires in ${expiresInMinutes} minutes):`,
          resetLink,
          '',
          'If you did not request this, you can safely ignore this email.',
        ].join('\n'),
        html: `
          <p>You requested a password reset for your NFTopia account.</p>
          <p>
            <a href="${resetLink}">Click here to reset your password</a>
            (expires in ${expiresInMinutes} minutes)
          </p>
          <p>If you did not request this, you can safely ignore this email.</p>
        `,
      });
    } catch (err) {
      this.logger.error(
        `Failed to send password reset email to ${to}: ${(err as Error).message}`,
      );
      // Swallow the error — the caller always returns a generic success response
      // to prevent email enumeration attacks.
    }
  }
}
