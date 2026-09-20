import {
  ConflictException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, LessThanOrEqual, Repository } from 'typeorm';
import { randomBytes, createHash } from 'crypto';
import { User } from './user.entity';
import { UserWallet } from '../auth/entities/user-wallet.entity';
import { WalletSession } from '../auth/entities/wallet-session.entity';
import { UserFollow } from './user-follow.entity';
import { Listing } from '../modules/listing/entities/listing.entity';
import { Offer } from '../modules/offer/entities/offer.entity';
import { OfferStatus } from '../modules/offer/interfaces/offer.interface';
import { AccountDeletionRequest } from './entities/account-deletion-request.entity';
import { GdprAuditService, GdprAuditContext } from './gdpr-audit.service';
import { EmailService } from '../modules/email/email.service';
import {
  DELETION_GRACE_PERIOD_MS,
  DELETION_RATE_LIMIT_MAX,
  DELETION_RATE_LIMIT_WINDOW_MS,
  DELETION_VERIFICATION_TTL_MS,
  DeletionRequestStatus,
  GdprAuditAction,
} from './gdpr.constants';

const ACTIVE_STATUSES = [
  DeletionRequestStatus.PENDING_VERIFICATION,
  DeletionRequestStatus.SCHEDULED,
];

export interface DeletionStatusView {
  id: string;
  status: DeletionRequestStatus;
  requestedAt: Date;
  scheduledFor: Date | null;
  cancelledAt: Date | null;
  completedAt: Date | null;
}

/**
 * Owns the right-to-erasure workflow:
 *
 *   1. `requestDeletion` records the request and emails a confirmation token.
 *   2. `verifyDeletion` proves email control and starts the 30-day grace clock.
 *   3. `cancelDeletion` lets the user back out before the clock expires.
 *   4. `completeDeletion` anonymizes the user and cascades PII-bearing rows.
 */
@Injectable()
export class AccountDeletionService {
  constructor(
    @InjectRepository(AccountDeletionRequest)
    private readonly requestRepo: Repository<AccountDeletionRequest>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(UserWallet)
    private readonly walletRepo: Repository<UserWallet>,
    @InjectRepository(WalletSession)
    private readonly sessionRepo: Repository<WalletSession>,
    @InjectRepository(UserFollow)
    private readonly followRepo: Repository<UserFollow>,
    @InjectRepository(Listing)
    private readonly listingRepo: Repository<Listing>,
    @InjectRepository(Offer)
    private readonly offerRepo: Repository<Offer>,
    private readonly audit: GdprAuditService,
    private readonly email: EmailService,
  ) {}

  async requestDeletion(
    userId: string,
    options: { token?: string; reason?: string },
    context: Partial<GdprAuditContext> = {},
  ): Promise<
    DeletionStatusView & { message: string; verificationRequired: boolean }
  > {
    if (options.token) {
      const scheduled = await this.verifyDeletion(
        userId,
        options.token,
        context,
      );
      return {
        ...scheduled,
        message:
          'Account deletion verified. Your account is scheduled for anonymization.',
        verificationRequired: false,
      };
    }

    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const active = await this.findActiveRequest(userId);
    if (active) {
      throw new ConflictException(
        'A deletion request is already in progress. Cancel it before creating a new one.',
      );
    }

    const since = new Date(Date.now() - DELETION_RATE_LIMIT_WINDOW_MS);
    const recent = await this.audit.countActions(
      userId,
      GdprAuditAction.ACCOUNT_DELETION_REQUESTED,
      since,
    );
    if (recent >= DELETION_RATE_LIMIT_MAX) {
      throw new HttpException(
        'Deletion rate limit exceeded. Only one deletion request is allowed every 30 days.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const token = randomBytes(32).toString('hex');
    const request = await this.requestRepo.save(
      this.requestRepo.create({
        userId,
        status: DeletionRequestStatus.PENDING_VERIFICATION,
        reason: options.reason ?? null,
        verificationTokenHash: hashToken(token),
        verificationExpiresAt: new Date(
          Date.now() + DELETION_VERIFICATION_TTL_MS,
        ),
      }),
    );

    await this.audit.log(GdprAuditAction.ACCOUNT_DELETION_REQUESTED, {
      userId,
      entityType: 'account_deletion_request',
      entityId: request.id,
      metadata: { reason: options.reason ?? null },
      ...context,
    });

    if (user.email) {
      await this.email.sendAccountDeletionEmail(
        user.email,
        token,
        user.username ?? undefined,
      );
    }

    await this.audit.log(GdprAuditAction.ACCOUNT_DELETION_VERIFICATION_SENT, {
      userId,
      entityType: 'account_deletion_request',
      entityId: request.id,
      ...context,
    });

    return {
      ...this.toView(request),
      message:
        'A verification email has been sent. Confirm to schedule account deletion.',
      verificationRequired: true,
    };
  }

  async verifyDeletion(
    userId: string,
    token: string,
    context: Partial<GdprAuditContext> = {},
  ): Promise<DeletionStatusView> {
    const request = await this.requestRepo.findOne({
      where: {
        userId,
        verificationTokenHash: hashToken(token),
        status: DeletionRequestStatus.PENDING_VERIFICATION,
      },
      order: { createdAt: 'DESC' },
    });

    if (!request) {
      throw new UnauthorizedException(
        'Invalid or expired deletion verification token',
      );
    }

    if (
      request.verificationExpiresAt &&
      request.verificationExpiresAt.getTime() < Date.now()
    ) {
      throw new UnauthorizedException(
        'Invalid or expired deletion verification token',
      );
    }

    request.status = DeletionRequestStatus.SCHEDULED;
    request.verifiedAt = new Date();
    request.scheduledFor = new Date(Date.now() + DELETION_GRACE_PERIOD_MS);
    request.verificationTokenHash = null;
    request.verificationExpiresAt = null;
    const saved = await this.requestRepo.save(request);

    await this.audit.log(GdprAuditAction.ACCOUNT_DELETION_SCHEDULED, {
      userId,
      entityType: 'account_deletion_request',
      entityId: saved.id,
      metadata: { scheduledFor: saved.scheduledFor },
      ...context,
    });

    return this.toView(saved);
  }

  async cancelDeletion(
    userId: string,
    context: Partial<GdprAuditContext> = {},
  ): Promise<DeletionStatusView> {
    const active = await this.findActiveRequest(userId);
    if (!active) {
      throw new NotFoundException('No active deletion request to cancel');
    }

    active.status = DeletionRequestStatus.CANCELLED;
    active.cancelledAt = new Date();
    const saved = await this.requestRepo.save(active);

    await this.audit.log(GdprAuditAction.ACCOUNT_DELETION_CANCELLED, {
      userId,
      entityType: 'account_deletion_request',
      entityId: saved.id,
      ...context,
    });

    return this.toView(saved);
  }

  async getStatus(userId: string): Promise<DeletionStatusView | null> {
    const request = await this.requestRepo.findOne({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
    return request ? this.toView(request) : null;
  }

  /** Executes every scheduled request whose grace period has elapsed. */
  async completeDueDeletions(): Promise<number> {
    const due = await this.requestRepo.find({
      where: {
        status: DeletionRequestStatus.SCHEDULED,
        scheduledFor: LessThanOrEqual(new Date()),
      },
    });

    let completed = 0;
    for (const request of due) {
      await this.completeDeletion(request);
      completed += 1;
    }
    return completed;
  }

  /** Anonymizes the user and cascades their PII-bearing related rows. */
  async completeDeletion(
    request: AccountDeletionRequest,
  ): Promise<AccountDeletionRequest> {
    const userId = request.userId;

    await this.walletRepo.delete({ userId });
    await this.sessionRepo.delete({ userId });
    await this.followRepo.delete({ followerId: userId });
    await this.followRepo.delete({ followingId: userId });
    await this.listingRepo.update(
      { sellerId: userId, status: 'ACTIVE' },
      { status: 'CANCELLED' },
    );
    await this.offerRepo.update(
      { bidderId: userId, status: OfferStatus.PENDING },
      { status: OfferStatus.CANCELLED },
    );

    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (user && !user.isAnonymized) {
      user.email = null;
      user.username = `deleted_${userId.slice(0, 8)}`;
      user.address = null;
      user.walletAddress = null;
      user.walletPublicKey = null;
      user.walletProvider = null;
      user.avatarUrl = null;
      user.bannerUrl = null;
      user.bio = null;
      user.twitterHandle = null;
      user.instagramHandle = null;
      user.website = null;
      user.passwordHash = null;
      user.twoFactorSecret = null;
      user.twoFactorBackupCodes = [];
      user.twoFactorEnabled = false;
      user.isEmailVerified = false;
      user.deletedAt = new Date();
      user.isAnonymized = true;
      await this.userRepo.save(user);
    }

    request.status = DeletionRequestStatus.COMPLETED;
    request.completedAt = new Date();
    request.verificationTokenHash = null;
    const saved = await this.requestRepo.save(request);

    await this.audit.log(GdprAuditAction.ACCOUNT_DELETION_COMPLETED, {
      userId,
      entityType: 'account_deletion_request',
      entityId: saved.id,
    });

    return saved;
  }

  private findActiveRequest(
    userId: string,
  ): Promise<AccountDeletionRequest | null> {
    return this.requestRepo.findOne({
      where: { userId, status: In(ACTIVE_STATUSES) },
      order: { createdAt: 'DESC' },
    });
  }

  private toView(request: AccountDeletionRequest): DeletionStatusView {
    return {
      id: request.id,
      status: request.status,
      requestedAt: request.createdAt,
      scheduledFor: request.scheduledFor ?? null,
      cancelledAt: request.cancelledAt ?? null,
      completedAt: request.completedAt ?? null,
    };
  }
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
