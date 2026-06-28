import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import * as Handlebars from 'handlebars';
import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';

interface SendMailOptions {
  to: string;
  subject: string;
  html: string;
}

@Injectable()
export class EmailService implements OnModuleInit {
  private readonly logger = new Logger(EmailService.name);
  private readonly provider: string;
  private readonly fromAddress: string;
  private readonly fromName: string;
  private readonly appUrl: string;
  private readonly maxRetries = 3;
  private readonly retryBaseDelayMs = 500;
  private transporter: nodemailer.Transporter | null = null;

  private verificationTemplate!: Handlebars.TemplateDelegate;
  private passwordResetTemplate!: Handlebars.TemplateDelegate;
  private bidNotificationTemplate!: Handlebars.TemplateDelegate;
  private auctionWonTemplate!: Handlebars.TemplateDelegate;

  constructor(private readonly config: ConfigService) {
    this.provider = config.get<string>('EMAIL_PROVIDER') ?? 'smtp';
    this.fromAddress =
      config.get<string>('EMAIL_FROM_ADDRESS') ?? 'noreply@nftopia.io';
    this.fromName = config.get<string>('EMAIL_FROM_NAME') ?? 'NFTopia';
    this.appUrl = config.get<string>('APP_URL') ?? 'http://localhost:3000';
  }

  onModuleInit(): void {
    this.initTransporter();
    this.loadTemplates();
  }

  async sendVerificationEmail(
    to: string,
    token: string,
    username?: string,
  ): Promise<void> {
    const verificationUrl = `${this.appUrl}/auth/verify-email?token=${token}`;
    const html = this.verificationTemplate({
      username,
      verificationUrl,
      year: new Date().getFullYear(),
    });
    await this.sendWithRetry({ to, subject: 'Verify your NFTopia account', html });
  }

  async sendPasswordResetEmail(
    to: string,
    token: string,
    username?: string,
  ): Promise<void> {
    const resetUrl = `${this.appUrl}/auth/reset-password?token=${token}`;
    const html = this.passwordResetTemplate({
      username,
      resetUrl,
      year: new Date().getFullYear(),
    });
    await this.sendWithRetry({ to, subject: 'Reset your NFTopia password', html });
  }

  async sendBidNotificationEmail(
    to: string,
    auctionId: string,
    amount: number,
    username?: string,
  ): Promise<void> {
    const auctionUrl = `${this.appUrl}/auctions/${auctionId}`;
    const html = this.bidNotificationTemplate({
      username,
      auctionId,
      amount,
      auctionUrl,
      year: new Date().getFullYear(),
    });
    await this.sendWithRetry({ to, subject: 'New bid on your NFT auction', html });
  }

  async sendAuctionWonEmail(
    to: string,
    auctionId: string,
    nftName: string,
    username?: string,
  ): Promise<void> {
    const auctionUrl = `${this.appUrl}/auctions/${auctionId}`;
    const html = this.auctionWonTemplate({
      username,
      auctionId,
      nftName,
      auctionUrl,
      year: new Date().getFullYear(),
    });
    await this.sendWithRetry({
      to,
      subject: `Congratulations! You won the auction for ${nftName}`,
      html,
    });
  }

  sendAsync(fn: () => Promise<void>): void {
    fn().catch((err) =>
      this.logger.error('Async email delivery failed', err instanceof Error ? err.stack : String(err)),
    );
  }

  private initTransporter(): void {
    if (this.provider === 'smtp') {
      this.transporter = nodemailer.createTransport({
        host: this.config.get<string>('SMTP_HOST') ?? 'localhost',
        port: parseInt(this.config.get<string>('SMTP_PORT') ?? '587', 10),
        secure: this.config.get<string>('SMTP_SECURE') === 'true',
        auth: this.config.get<string>('SMTP_USER')
          ? {
              user: this.config.get<string>('SMTP_USER') ?? '',
              pass: this.config.get<string>('SMTP_PASS') ?? '',
            }
          : undefined,
      });
      this.logger.log('Email provider: SMTP');
    } else if (this.provider === 'sendgrid') {
      this.transporter = nodemailer.createTransport({
        host: 'smtp.sendgrid.net',
        port: 587,
        auth: {
          user: 'apikey',
          pass: this.config.get<string>('SENDGRID_API_KEY') ?? '',
        },
      });
      this.logger.log('Email provider: SendGrid (SMTP)');
    } else if (this.provider === 'resend') {
      this.logger.log('Email provider: Resend (HTTP API)');
    } else {
      this.logger.warn(`Unknown EMAIL_PROVIDER "${this.provider}". Email sending is disabled.`);
    }
  }

  private loadTemplates(): void {
    const templateDir = path.join(__dirname, 'templates');
    this.verificationTemplate = this.compileTemplate(
      path.join(templateDir, 'verification.hbs'),
    );
    this.passwordResetTemplate = this.compileTemplate(
      path.join(templateDir, 'password-reset.hbs'),
    );
    this.bidNotificationTemplate = this.compileTemplate(
      path.join(templateDir, 'bid-notification.hbs'),
    );
    this.auctionWonTemplate = this.compileTemplate(
      path.join(templateDir, 'auction-won.hbs'),
    );
    this.logger.debug('Email templates loaded');
  }

  private compileTemplate(filePath: string): Handlebars.TemplateDelegate {
    const source = fs.readFileSync(filePath, 'utf8');
    return Handlebars.compile(source);
  }

  private async sendWithRetry(
    options: SendMailOptions,
    attempt = 1,
  ): Promise<void> {
    try {
      await this.doSend(options);
      this.logger.log(`Email sent to ${options.to}: "${options.subject}"`);
    } catch (err) {
      if (attempt < this.maxRetries) {
        const delay = this.retryBaseDelayMs * Math.pow(2, attempt - 1);
        this.logger.warn(
          `Email send failed (attempt ${attempt}/${this.maxRetries}), retrying in ${delay}ms — ${String(err)}`,
        );
        await new Promise<void>((resolve) => setTimeout(resolve, delay));
        return this.sendWithRetry(options, attempt + 1);
      }
      this.logger.error(
        `Email delivery failed after ${this.maxRetries} attempts to ${options.to}`,
        err instanceof Error ? err.stack : String(err),
      );
      throw err;
    }
  }

  private async doSend(options: SendMailOptions): Promise<void> {
    if (this.provider === 'resend') {
      return this.sendViaResend(options);
    }
    if (!this.transporter) {
      throw new Error(`Email transporter not configured (provider: ${this.provider})`);
    }
    await this.transporter.sendMail({
      from: `"${this.fromName}" <${this.fromAddress}>`,
      to: options.to,
      subject: options.subject,
      html: options.html,
    });
  }

  private sendViaResend(options: SendMailOptions): Promise<void> {
    const apiKey = this.config.get<string>('RESEND_API_KEY') ?? '';
    const from =
      this.config.get<string>('RESEND_FROM') ??
      `${this.fromName} <${this.fromAddress}>`;

    const body = JSON.stringify({
      from,
      to: [options.to],
      subject: options.subject,
      html: options.html,
    });

    return new Promise<void>((resolve, reject) => {
      const req = https.request(
        {
          hostname: 'api.resend.com',
          path: '/emails',
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(body),
          },
        },
        (res) => {
          let data = '';
          res.on('data', (chunk: Buffer) => (data += chunk.toString()));
          res.on('end', () => {
            if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
              resolve();
            } else {
              reject(
                new Error(`Resend API error ${res.statusCode}: ${data}`),
              );
            }
          });
        },
      );
      req.on('error', reject);
      req.write(body);
      req.end();
    });
  }
}
