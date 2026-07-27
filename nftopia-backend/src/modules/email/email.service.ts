import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, LessThan, Repository } from 'typeorm';
import * as crypto from 'crypto';
import { promisify } from 'util';
import { EmailProvider, EmailStatus, TemplateData } from './email.interface';
import { EMAIL_PROVIDER_TOKEN } from './email.provider';
import { EmailTemplateService } from './email-template.service';
import { EmailLog } from './entities/email-log.entity';
import { PasswordResetToken } from './entities/password-reset-token.entity';
import { VerificationToken } from './entities/verification-token.entity';
import { User } from '../../users/user.entity';

const scryptAsync = promisify(crypto.scrypt);

/**
 * Core Email Service
 * Handles all email operations including template rendering, provider selection,
 * verification, password reset, and notification emails.
 */
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  private readonly fromAddress: string;
  private readonly fromName: string;
  private readonly frontendUrl: string;
  private readonly verificationTokenExpiryHours: number;
  private readonly passwordResetTokenExpiryHours: number;

  constructor(
    @Inject(EMAIL_PROVIDER_TOKEN)
    private readonly emailProvider: EmailProvider,
    private readonly templateService: EmailTemplateService,
    private readonly configService: ConfigService,
    @InjectRepository(EmailLog)
    private readonly emailLogRepository: Repository<EmailLog>,
    @InjectRepository(PasswordResetToken)
    private readonly passwordResetTokenRepository: Repository<PasswordResetToken>,
    @InjectRepository(VerificationToken)
    private readonly verificationTokenRepository: Repository<VerificationToken>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {
    this.fromAddress = this.configService.get<string>(
      'EMAIL_FROM_ADDRESS',
      'noreply@nftopia.com',
    );
    this.fromName = this.configService.get<string>(
      'EMAIL_FROM_NAME',
      'NFTopia',
    );
    this.frontendUrl = this.configService.get<string>(
      'FRONTEND_URL',
      'http://localhost:3001',
    );
    this.verificationTokenExpiryHours = this.configService.get<number>(
      'EMAIL_VERIFICATION_EXPIRY_HOURS',
      24,
    );
    this.passwordResetTokenExpiryHours = this.configService.get<number>(
      'EMAIL_PASSWORD_RESET_EXPIRY_HOURS',
      1,
    );
  }

  /**
   * Send a verification email to a newly registered user
   * @param userId User's ID
   * @param email User's email address
   * @param username User's display name
   */
  async sendVerificationEmail(
    userId: string,
    email: string,
    username: string,
  ): Promise<void> {
    this.logger.log(`Sending verification email to ${email}`);

    // Invalidate existing verification tokens for this user
    await this.verificationTokenRepository.delete({ userId });

    const token = this.generateSecureToken();
    const tokenHash = await this.hashToken(token);

    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + this.verificationTokenExpiryHours);

    await this.verificationTokenRepository.save(
      this.verificationTokenRepository.create({
        userId,
        tokenHash,
        email,
        expiresAt,
      }),
    );

    const verificationUrl = `${this.frontendUrl}/verify-email?token=${token}`;

    await this.sendTemplatedEmail(
      email,
      'verification',
      'Verify Your NFTopia Email',
      {
        username: username || email,
        verificationUrl,
        expiryHours: this.verificationTokenExpiryHours,
      },
    );
  }

  /**
   * Verify an email using the provided token
   * @param token Verification token
   */
  async verifyEmail(token: string): Promise<void> {
    const tokenHash = await this.hashToken(token);

    const verificationToken = await this.verificationTokenRepository.findOne({
      where: { tokenHash },
    });

    if (!verificationToken) {
      throw new BadRequestException('Invalid verification token');
    }

    if (verificationToken.verifiedAt) {
      throw new ConflictException('Email is already verified');
    }

    if (verificationToken.expiresAt < new Date()) {
      throw new BadRequestException('Verification token has expired');
    }

    // Mark token as used
    verificationToken.verifiedAt = new Date();
    await this.verificationTokenRepository.save(verificationToken);

    // Update user's email verification status
    await this.userRepository.update(
      { id: verificationToken.userId },
      { isEmailVerified: true },
    );

    this.logger.log(
      `Email verified for userId=${verificationToken.userId}`,
    );
  }

  /**
   * Request a password reset for a user
   * @param email User's email address
   * @param ipAddress Request IP (for audit)
   */
  async requestPasswordReset(email: string, ipAddress?: string): Promise<void> {
    const normalizedEmail = email.trim().toLowerCase();
    const user = await this.userRepository.findOne({
      where: { email: normalizedEmail },
    });

    if (!user) {
      // Return without error to prevent email enumeration
      this.logger.warn(
        `Password reset requested for non-existent email: ${normalizedEmail}`,
      );
      return;
    }

    if (!user.passwordHash) {
      // Wallet-only accounts don't have passwords
      this.logger.warn(
        `Password reset requested for wallet-only account: ${normalizedEmail}`,
      );
      return;
    }

    // Invalidate existing tokens for this user
    await this.passwordResetTokenRepository.delete({ userId: user.id });

    const token = this.generateSecureToken();
    const tokenHash = await this.hashToken(token);

    const expiresAt = new Date();
    expiresAt.setHours(
      expiresAt.getHours() + this.passwordResetTokenExpiryHours,
    );

    await this.passwordResetTokenRepository.save(
      this.passwordResetTokenRepository.create({
        userId: user.id,
        tokenHash,
        expiresAt,
        ipAddress,
      }),
    );

    const resetUrl = `${this.frontendUrl}/reset-password?token=${token}`;

    await this.sendPasswordResetEmail(
      normalizedEmail,
      user.username || normalizedEmail,
      resetUrl,
    );

    this.logger.log(
      `Password reset email sent for userId=${user.id}`,
    );
  }

  /**
   * Reset a user's password using the provided token
   * @param token Reset token
   * @param newPassword New password
   */
  async resetPassword(token: string, newPassword: string): Promise<void> {
    const tokenHash = await this.hashToken(token);

    const resetToken = await this.passwordResetTokenRepository.findOne({
      where: { tokenHash },
    });

    if (!resetToken) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    if (resetToken.usedAt) {
      throw new BadRequestException('Reset token has already been used');
    }

    if (resetToken.expiresAt < new Date()) {
      throw new BadRequestException('Reset token has expired');
    }

    const user = await this.userRepository.findOne({
      where: { id: resetToken.userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Hash new password
    const passwordHash = await this.hashPassword(newPassword);

    // Update user password
    await this.userRepository.update(
      { id: user.id },
      { passwordHash },
    );

    // Invalidate the token
    resetToken.usedAt = new Date();
    await this.passwordResetTokenRepository.save(resetToken);

    this.logger.log(`Password reset successfully for userId=${user.id}`);
  }

  /**
   * Send a password reset email
   * @param email Recipient email
   * @param username Recipient name
   * @param resetUrl Reset URL
   */
  async sendPasswordResetEmail(
    email: string,
    username: string,
    resetUrl: string,
  ): Promise<void> {
    this.logger.log(`Sending password reset email to ${email}`);

    await this.sendTemplatedEmail(
      email,
      'password-reset',
      'Reset Your NFTopia Password',
      {
        username: username || email,
        resetUrl,
        expiryHours: this.passwordResetTokenExpiryHours,
      },
    );
  }

  /**
   * Send a bid notification email to the NFT owner
   * @param email Owner's email
   * @param username Owner's display name
   * @param nftName NFT name
   * @param bidderName Bidder's display name
   * @param bidAmount Bid amount in XLM
   * @param auctionUrl URL to the auction
   * @param collectionName Optional collection name
   * @param auctionEndTime Optional auction end time
   */
  async sendBidNotificationEmail(
    email: string,
    username: string,
    nftName: string,
    bidderName: string,
    bidAmount: string,
    auctionUrl: string,
    collectionName?: string,
    auctionEndTime?: string,
  ): Promise<void> {
    this.logger.log(
      `Sending bid notification email to ${email} for NFT: ${nftName}`,
    );

    await this.sendTemplatedEmail(
      email,
      'bid-notification',
      `New Bid on ${nftName}`,
      {
        username: username || email,
        nftName,
        bidderName,
        bidAmount,
        auctionUrl,
        collectionName,
        auctionEndTime,
      },
    );
  }

  /**
   * Send an auction won email to the winner
   * @param email Winner's email
   * @param username Winner's display name
   * @param nftName NFT name
   * @param sellerName Seller's display name
   * @param winningAmount Winning bid amount in XLM
   * @param nftUrl URL to view the NFT
   * @param collectionName Optional collection name
   */
  async sendAuctionWonEmail(
    email: string,
    username: string,
    nftName: string,
    sellerName: string,
    winningAmount: string,
    nftUrl: string,
    collectionName?: string,
  ): Promise<void> {
    this.logger.log(
      `Sending auction won email to ${email} for NFT: ${nftName}`,
    );

    await this.sendTemplatedEmail(
      email,
      'auction-won',
      `Congratulations! You Won ${nftName}`,
      {
        username: username || email,
        nftName,
        sellerName,
        winningAmount,
        nftUrl,
        collectionName,
      },
    );
  }

  /**
   * Low-level send without creating an EmailLog record.
   * Used by the EmailProcessor which manages its own log entry.
   */
  async sendRaw(
    to: string | string[],
    templateName: string,
    subject: string,
    data: TemplateData,
  ): Promise<void> {
    const providerType = this.configService.get<string>('EMAIL_PROVIDER', 'smtp');
    const toStr = Array.isArray(to) ? to.join(', ') : to;

    const html = await this.templateService.render(templateName, data);
    const text = this.templateService.htmlToText(html);

    await this.emailProvider.send({
      to,
      from: `"${this.fromName}" <${this.fromAddress}>`,
      subject,
      html,
      text,
    });

    this.logger.log(
      `[raw] Email sent [provider=${providerType}] [template=${templateName}] [to=${toStr}]`,
    );
  }

  /**
   * Render and send a templated email via the configured provider.
   * Writes an EmailLog entry for observability.
   *
   * Called both directly (e.g. immediate password-reset send) and
   * from the EmailProcessor when processing a queued job.
   */
  async sendTemplatedEmail(
    to: string | string[],
    templateName: string,
    subject: string,
    data: TemplateData,
  ): Promise<void> {
    const providerType = this.configService.get<string>('EMAIL_PROVIDER', 'smtp');
    const toStr = Array.isArray(to) ? to.join(', ') : to;

    this.logger.log(
      `Sending email [provider=${providerType}] [template=${templateName}] [to=${toStr}]`,
    );

    const emailLog = await this.emailLogRepository.save(
      this.emailLogRepository.create({
        to: toStr,
        subject,
        template: templateName,
        provider: providerType,
        status: EmailStatus.PROCESSING,
        attemptCount: 1,
      }),
    );

    try {
      const html = await this.templateService.render(templateName, data);
      const text = this.templateService.htmlToText(html);

      await this.emailProvider.send({
        to,
        from: `"${this.fromName}" <${this.fromAddress}>`,
        subject,
        html,
        text,
      });

      emailLog.status = EmailStatus.SENT;
      emailLog.sentAt = new Date();
      emailLog.errorMessage = null;
      await this.emailLogRepository.save(emailLog);

      this.logger.log(
        `Email sent [provider=${providerType}] [template=${templateName}] [to=${toStr}]`,
      );
    } catch (error) {
      emailLog.status = EmailStatus.FAILED;
      emailLog.errorMessage = (error as Error).message;
      await this.emailLogRepository.save(emailLog);

      this.logger.error(
        `Email failed [provider=${providerType}] [template=${templateName}] [to=${toStr}]: ${(error as Error).message}`,
      );
      throw error;
    }
  }

  /**
   * Resend verification email
   * @param email User's email
   */
  async resendVerificationEmail(email: string): Promise<void> {
    const normalizedEmail = email.trim().toLowerCase();
    const user = await this.userRepository.findOne({
      where: { email: normalizedEmail },
    });

    if (!user) {
      // Don't leak information about whether user exists
      return;
    }

    if (user.isEmailVerified) {
      throw new ConflictException('Email is already verified');
    }

    await this.sendVerificationEmail(
      user.id,
      normalizedEmail,
      user.username || normalizedEmail,
    );
  }

  /**
   * Clean up expired tokens
   */
  async cleanExpiredTokens(): Promise<void> {
    const now = new Date();

    const deletedVerification = await this.verificationTokenRepository.delete({
      expiresAt: LessThan(now),
      verifiedAt: IsNull(),
    });

    const deletedReset = await this.passwordResetTokenRepository.delete({
      expiresAt: LessThan(now),
      usedAt: IsNull(),
    });

    this.logger.log(
      `Cleaned up ${deletedVerification.affected ?? 0} expired verification tokens and ${deletedReset.affected ?? 0} expired reset tokens`,
    );
  }

  // ── Private Helpers ─────────────────────────────────────────────────────────

  /**
   * Generate a cryptographically secure random token
   */
  private generateSecureToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Hash a token using SHA-256 for secure storage
   */
  private async hashToken(token: string): Promise<string> {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  /**
   * Hash a password using scrypt
   */
  private async hashPassword(password: string): Promise<string> {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = (await scryptAsync(password, salt, 64)) as Buffer;
    return `${salt}:${hash.toString('hex')}`;
  }
}
