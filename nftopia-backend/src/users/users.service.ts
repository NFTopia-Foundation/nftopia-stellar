import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import type { Queue } from 'bull';
import { Inject } from '@nestjs/common';
import * as crypto from 'crypto';
// archiver's real CJS export is a callable factory function (archiver.Archiver
// is attached to it as a property); its types don't model that shape, and a
// namespace import (`import * as archiver`) wraps the module instead of
// binding directly to that export, breaking the call below at runtime. The
// import-equals form is required here to get the raw export.
// eslint-disable-next-line @typescript-eslint/no-require-imports
import archiver = require('archiver');
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { User } from './user.entity';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UserWallet } from '../auth/entities/user-wallet.entity';
import { UserFollow } from './user-follow.entity';
import { EmailService } from '../modules/email/email.service';
import {
  BUILD_USER_EXPORT_JOB,
  FINALIZE_ACCOUNT_DELETION_JOB,
  USER_PRIVACY_QUEUE,
  type BuildUserExportJob,
  type PreparedUserExport,
  type UserExportFormat,
} from './privacy-jobs';

const DELETION_GRACE_PERIOD_MS = 30 * 24 * 60 * 60 * 1000;
const DELETION_VERIFICATION_TTL_MS = 15 * 60 * 1000;
const DELETION_COOLDOWN_MS = 30 * 24 * 60 * 60 * 1000;
const EXPORTS_PER_DAY_LIMIT = 3;
const ASYNC_EXPORT_THRESHOLD = 500;

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    @InjectRepository(User)
    private repo: Repository<User>,
    @InjectRepository(UserWallet)
    private readonly walletRepo: Repository<UserWallet>,
    @InjectRepository(UserFollow)
    private readonly followRepo: Repository<UserFollow>,
    private readonly eventEmitter: EventEmitter2,
    private readonly dataSource: DataSource,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
    @InjectQueue(USER_PRIVACY_QUEUE)
    private readonly privacyQueue: Queue,
    private readonly emailService: EmailService,
  ) {}

  findById(id: string) {
    return this.repo.findOne({ where: { id } });
  }

  async exportUserData(userId: string) {
    const user = await this.repo.findOne({ where: { id: userId } });
    if (!user || user.anonymizedAt)
      throw new NotFoundException('User not found');

    const [
      wallets,
      walletSessions,
      follows,
      socialFollows,
      activities,
      verificationRequests,
      listings,
      auctions,
      bids,
      offers,
      orders,
      transactions,
      chatSessions,
      chatMessages,
      aiUsageRecords,
      aiToolCallLogs,
      stellarNfts,
      transferEvents,
    ] = await Promise.all([
      this.walletRepo.find({ where: { userId } }),
      this.dataSource.query<Record<string, unknown>[]>(
        'SELECT id, wallet_address, wallet_provider, nonce_expires_at, consumed_at, ip_address, created_at FROM wallet_sessions WHERE user_id = $1',
        [userId],
      ),
      this.followRepo.find({
        where: [{ followerId: userId }, { followingId: userId }],
      }),
      this.dataSource.query<Record<string, unknown>[]>(
        'SELECT * FROM follows WHERE "followerId" = $1 OR "followingId" = $1',
        [userId],
      ),
      this.dataSource.query<Record<string, unknown>[]>(
        'SELECT * FROM activities WHERE "actorId" = $1',
        [userId],
      ),
      this.dataSource.query<Record<string, unknown>[]>(
        'SELECT * FROM verification_requests WHERE requester_id = $1 OR reviewed_by = $1',
        [userId],
      ),
      this.dataSource.query<Record<string, unknown>[]>(
        'SELECT * FROM listings WHERE seller_id = $1',
        [userId],
      ),
      this.dataSource.query<Record<string, unknown>[]>(
        'SELECT * FROM auctions WHERE seller_id = $1 OR winner_id = $1',
        [userId],
      ),
      this.dataSource.query<Record<string, unknown>[]>(
        'SELECT * FROM bids WHERE bidder_id = $1',
        [userId],
      ),
      this.dataSource.query<Record<string, unknown>[]>(
        'SELECT * FROM offers WHERE bidder_id = $1 OR owner_id = $1',
        [userId],
      ),
      this.dataSource.query<Record<string, unknown>[]>(
        'SELECT * FROM "orders" WHERE buyer_id = $1 OR seller_id = $1',
        [userId],
      ),
      this.dataSource.query<Record<string, unknown>[]>(
        'SELECT * FROM transactions WHERE buyer_id = $1 OR seller_id = $1',
        [userId],
      ),
      this.dataSource.query<Record<string, unknown>[]>(
        'SELECT id, created_at, updated_at FROM chat_sessions WHERE user_id = $1',
        [userId],
      ),
      this.dataSource.query<Record<string, unknown>[]>(
        'SELECT m.* FROM chat_messages m INNER JOIN chat_sessions s ON s.id = m.session_id WHERE s.user_id = $1',
        [userId],
      ),
      this.dataSource.query<Record<string, unknown>[]>(
        'SELECT * FROM ai_usage_records WHERE user_id = $1',
        [userId],
      ),
      this.dataSource.query<Record<string, unknown>[]>(
        'SELECT * FROM ai_tool_call_logs WHERE user_id = $1',
        [userId],
      ),
      this.dataSource.query<Record<string, unknown>[]>(
        `SELECT * FROM stellar_nfts WHERE owner IN (
          SELECT wallet_address FROM user_wallets WHERE user_id = $1
          UNION SELECT wallet_address FROM users WHERE id = $1 AND wallet_address IS NOT NULL
          UNION SELECT address FROM users WHERE id = $1 AND address IS NOT NULL
        )`,
        [userId],
      ),
      this.dataSource.query<Record<string, unknown>[]>(
        `SELECT * FROM nft_transfer_events WHERE from_address IN (
          SELECT wallet_address FROM user_wallets WHERE user_id = $1
          UNION SELECT wallet_address FROM users WHERE id = $1 AND wallet_address IS NOT NULL
          UNION SELECT address FROM users WHERE id = $1 AND address IS NOT NULL
        ) OR to_address IN (
          SELECT wallet_address FROM user_wallets WHERE user_id = $1
          UNION SELECT wallet_address FROM users WHERE id = $1 AND wallet_address IS NOT NULL
          UNION SELECT address FROM users WHERE id = $1 AND address IS NOT NULL
        )`,
        [userId],
      ),
    ]);

    return {
      exportedAt: new Date().toISOString(),
      profile: {
        id: user.id,
        email: user.email ?? null,
        username: user.username ?? null,
        address: user.address ?? null,
        walletAddress: user.walletAddress ?? null,
        walletProvider: user.walletProvider ?? null,
        bio: user.bio ?? null,
        avatarUrl: user.avatarUrl ?? null,
        bannerUrl: user.bannerUrl ?? null,
        twitterHandle: user.twitterHandle ?? null,
        instagramHandle: user.instagramHandle ?? null,
        website: user.website ?? null,
        createdAt: user.createdAt,
        lastLoginAt: user.lastLoginAt ?? null,
      },
      settings: {
        isEmailVerified: user.isEmailVerified,
        twoFactorEnabled: user.twoFactorEnabled,
        role: user.role,
        deletionRequestedAt: user.deletionRequestedAt ?? null,
      },
      wallets,
      walletSessions,
      follows: {
        following: follows.filter((follow) => follow.followerId === userId),
        followers: follows.filter((follow) => follow.followingId === userId),
      },
      activity: {
        socialFollows,
        activities,
        verificationRequests,
        listings,
        auctions,
        bids,
        offers,
        orders,
        transactions,
        chatSessions,
        chatMessages,
        aiUsageRecords,
        aiToolCallLogs,
        stellarNfts,
        transferEvents,
      },
    };
  }

  async createExportJob(userId: string, format: UserExportFormat) {
    const user = await this.repo.findOne({ where: { id: userId } });
    if (!user || user.anonymizedAt)
      throw new NotFoundException('User not found');
    await this.consumeExportQuota(userId);
    const job = await this.privacyQueue.add(
      BUILD_USER_EXPORT_JOB,
      { userId, format },
      {
        attempts: 2,
        removeOnComplete: { age: 24 * 60 * 60, count: 100 },
        removeOnFail: { age: 24 * 60 * 60, count: 100 },
      },
    );
    return { jobId: String(job.id), status: 'queued' as const };
  }

  async requestExportFile(userId: string, format: UserExportFormat) {
    await this.consumeExportQuota(userId);
    return this.prepareExportFile(userId, format);
  }

  async isLargeExport(userId: string): Promise<boolean> {
    const result = await this.dataSource.query<
      Array<{ row_count: number | string }>
    >(
      `SELECT
        (SELECT COUNT(*) FROM (SELECT 1 FROM transactions WHERE buyer_id = $1 OR seller_id = $1 LIMIT $2) tx) +
        (SELECT COUNT(*) FROM (SELECT 1 FROM "orders" WHERE buyer_id = $1 OR seller_id = $1 LIMIT $2) ord) +
        (SELECT COUNT(*) FROM (SELECT 1 FROM listings WHERE seller_id = $1 LIMIT $2) listing_rows) +
        (SELECT COUNT(*) FROM (SELECT 1 FROM auctions WHERE seller_id = $1 OR winner_id = $1 LIMIT $2) auction_rows) +
        (SELECT COUNT(*) FROM (SELECT 1 FROM bids WHERE bidder_id = $1 LIMIT $2) bid_rows) +
        (SELECT COUNT(*) FROM (SELECT 1 FROM offers WHERE bidder_id = $1 OR owner_id = $1 LIMIT $2) offer_rows) AS row_count`,
      [userId, ASYNC_EXPORT_THRESHOLD + 1],
    );
    return Number(result[0]?.row_count ?? 0) > ASYNC_EXPORT_THRESHOLD;
  }

  async getExportJob(userId: string, jobId: string) {
    const job = await this.privacyQueue.getJob(jobId);
    const jobData = job?.data as BuildUserExportJob | undefined;
    if (!job || jobData?.userId !== userId) {
      throw new NotFoundException('Export job not found');
    }
    const state = await job.getState();
    if (state === 'completed') {
      return {
        status: 'completed' as const,
        file: job.returnvalue as PreparedUserExport,
      };
    }
    if (state === 'failed') return { status: 'failed' as const };
    return { status: 'processing' as const };
  }

  async prepareExportFile(
    userId: string,
    format: UserExportFormat,
  ): Promise<PreparedUserExport> {
    const data = await this.exportUserData(userId);
    const baseName = `nftopia-data-${userId}`;
    if (format === 'json') {
      return {
        fileName: `${baseName}.json`,
        contentType: 'application/json',
        contentBase64: Buffer.from(JSON.stringify(data, null, 2)).toString(
          'base64',
        ),
      };
    }

    const csv = this.exportAsCsv(data);
    if (format === 'csv') {
      return {
        fileName: `${baseName}.csv`,
        contentType: 'text/csv; charset=utf-8',
        contentBase64: Buffer.from(csv).toString('base64'),
      };
    }

    const createArchive = archiver as unknown as (
      format: string,
      options: { zlib: { level: number } },
    ) => archiver.Archiver;
    const archive = createArchive('zip', { zlib: { level: 9 } });
    const chunks: Buffer[] = [];
    const finished = new Promise<Buffer>((resolve, reject) => {
      archive.on('data', (chunk: Buffer) => chunks.push(Buffer.from(chunk)));
      archive.on('end', () => resolve(Buffer.concat(chunks)));
      archive.on('error', reject);
    });
    archive.append(JSON.stringify(data, null, 2), { name: 'data.json' });
    archive.append(csv, { name: 'data.csv' });
    await archive.finalize();
    const content = await finished;
    return {
      fileName: `${baseName}.zip`,
      contentType: 'application/zip',
      contentBase64: content.toString('base64'),
    };
  }

  async requestAccountDeletion(
    userId: string,
    confirmed: boolean,
    ipAddress?: string,
  ) {
    if (!confirmed) {
      await this.writeDeletionAudit(userId, 'request', ipAddress, false, {
        reason: 'confirmation_required',
      });
      throw new BadRequestException('Pass confirm=true to request deletion');
    }

    const user = await this.repo.findOne({ where: { id: userId } });
    if (!user || user.anonymizedAt)
      throw new NotFoundException('User not found');
    if (!user.email || !user.isEmailVerified) {
      await this.writeDeletionAudit(userId, 'request', ipAddress, false, {
        reason: 'verified_email_required',
      });
      throw new BadRequestException(
        'A verified email address is required to delete this account',
      );
    }

    const now = new Date();
    if (
      user.deletionLastRequestedAt &&
      now.getTime() - user.deletionLastRequestedAt.getTime() <
        DELETION_COOLDOWN_MS
    ) {
      await this.writeDeletionAudit(userId, 'request', ipAddress, false, {
        reason: 'rate_limited',
      });
      throw new HttpException(
        'Only one account deletion request is allowed every 30 days',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const token = crypto.randomBytes(32).toString('hex');
    await this.cacheManager.set(
      `account-deletion:${this.hashToken(token)}`,
      { userId },
      DELETION_VERIFICATION_TTL_MS,
    );
    user.deletionLastRequestedAt = now;
    await this.repo.save(user);
    await this.emailService.sendAccountDeletionVerificationEmail(
      user.email,
      token,
      user.username,
    );
    await this.writeDeletionAudit(userId, 'request', ipAddress, true);
    return { success: true, verificationRequired: true };
  }

  async verifyAccountDeletion(token: string, ipAddress?: string) {
    const key = `account-deletion:${this.hashToken(token)}`;
    const cached = await this.cacheManager.get<{ userId: string }>(key);
    if (!cached) {
      await this.writeDeletionAudit(null, 'verification', ipAddress, false, {
        reason: 'invalid_or_expired_token',
      });
      throw new UnauthorizedException('Invalid or expired deletion token');
    }
    const userId = cached.userId;

    const user = await this.repo.findOne({ where: { id: userId } });
    if (!user || user.anonymizedAt || !user.email || !user.isEmailVerified) {
      await this.cacheManager.del(key);
      await this.writeDeletionAudit(userId, 'verification', ipAddress, false, {
        reason: 'account_unavailable',
      });
      throw new UnauthorizedException('Invalid or expired deletion token');
    }

    const requestedAt = new Date();
    user.deletionRequestedAt = requestedAt;
    await this.repo.save(user);
    await this.cacheManager.del(key);
    const job = await this.privacyQueue.add(
      FINALIZE_ACCOUNT_DELETION_JOB,
      { userId, requestedAt: requestedAt.toISOString() },
      {
        delay: DELETION_GRACE_PERIOD_MS,
        jobId: `account-delete-${userId}-${requestedAt.getTime()}`,
        removeOnComplete: true,
        removeOnFail: false,
      },
    );
    await this.writeDeletionAudit(userId, 'verification', ipAddress, true, {
      jobId: String(job.id),
      finalizesAt: new Date(
        requestedAt.getTime() + DELETION_GRACE_PERIOD_MS,
      ).toISOString(),
    });
    return {
      success: true,
      deletionScheduledAt: requestedAt.toISOString(),
      deletionFinalizesAt: new Date(
        requestedAt.getTime() + DELETION_GRACE_PERIOD_MS,
      ).toISOString(),
    };
  }

  async getAccountDeletionStatus(userId: string) {
    const user = await this.repo.findOne({ where: { id: userId } });
    if (!user || user.anonymizedAt)
      throw new NotFoundException('User not found');
    if (!user.deletionRequestedAt) return { pending: false };
    return {
      pending: true,
      requestedAt: user.deletionRequestedAt,
      finalizesAt: new Date(
        user.deletionRequestedAt.getTime() + DELETION_GRACE_PERIOD_MS,
      ),
    };
  }

  async cancelAccountDeletion(userId: string, ipAddress?: string) {
    let cancelled = false;
    await this.dataSource.transaction(async (manager) => {
      const users = await manager.query<
        Array<{
          deletion_requested_at: Date | string | null;
          anonymized_at: Date | string | null;
        }>
      >(
        'SELECT deletion_requested_at, anonymized_at FROM users WHERE id = $1 FOR UPDATE',
        [userId],
      );
      const user = users[0];
      if (!user || user.anonymized_at)
        throw new NotFoundException('User not found');
      if (!user.deletion_requested_at) return;
      await manager.query(
        'UPDATE users SET deletion_requested_at = NULL WHERE id = $1',
        [userId],
      );
      cancelled = true;
    });

    if (!cancelled) {
      await this.writeDeletionAudit(userId, 'cancellation', ipAddress, false, {
        reason: 'no_pending_request',
      });
      throw new BadRequestException('No pending deletion request to cancel');
    }

    await this.writeDeletionAudit(userId, 'cancellation', ipAddress, true);
    return { success: true, cancelled: true };
  }

  async finalizeAccountDeletion(
    userId: string,
    requestedAt: string,
  ): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const users = await manager.query<
        Array<{
          email: string | null;
          address: string | null;
          wallet_address: string | null;
          deletion_requested_at: Date | string | null;
          anonymized_at: Date | string | null;
        }>
      >(
        'SELECT email, address, wallet_address, deletion_requested_at, anonymized_at FROM users WHERE id = $1 FOR UPDATE',
        [userId],
      );
      const user = users[0];
      if (!user || user.anonymized_at || !user.deletion_requested_at) return;
      const pendingAt = new Date(user.deletion_requested_at);
      if (
        pendingAt.toISOString() !== requestedAt ||
        Date.now() < pendingAt.getTime() + DELETION_GRACE_PERIOD_MS
      ) {
        return;
      }

      const queries = [
        'DELETE FROM user_follows WHERE follower_id = $1 OR following_id = $1',
        'DELETE FROM follows WHERE "followerId" = $1 OR "followingId" = $1',
        'DELETE FROM activities WHERE "actorId" = $1',
        'DELETE FROM verification_requests WHERE requester_id = $1 OR reviewed_by = $1',
        'DELETE FROM user_wallets WHERE user_id = $1',
        'DELETE FROM wallet_sessions WHERE user_id = $1 OR wallet_address IN (SELECT wallet_address FROM users WHERE id = $1)',
        'DELETE FROM refresh_tokens WHERE user_id = $1',
        'DELETE FROM refresh_token_families WHERE user_id = $1',
        'DELETE FROM collection_likes WHERE user_id = $1',
        'DELETE FROM ai_usage_records WHERE user_id = $1',
        'DELETE FROM ai_tool_call_logs WHERE user_id = $1',
        'DELETE FROM chat_sessions WHERE user_id = $1',
        'DELETE FROM user_ai_cap_overrides WHERE user_id = $1',
      ];
      const walletRows = await manager.query<Array<{ wallet_address: string }>>(
        'SELECT wallet_address FROM user_wallets WHERE user_id = $1',
        [userId],
      );
      const addresses = [
        user.address,
        user.wallet_address,
        ...walletRows.map((row) => row.wallet_address),
      ].filter((address): address is string => Boolean(address));
      if (addresses.length) {
        await manager.query(
          'UPDATE stellar_nfts SET owner = $2 WHERE owner = ANY($1::text[])',
          [addresses, 'ANONYMIZED'],
        );
      }
      for (const query of queries) await manager.query(query, [userId]);

      await manager.query(
        'UPDATE listings SET seller_id = NULL WHERE seller_id = $1',
        [userId],
      );
      await manager.query(
        'UPDATE auctions SET seller_id = NULL, winner_id = NULL WHERE seller_id = $1 OR winner_id = $1',
        [userId],
      );
      await manager.query(
        'UPDATE bids SET bidder_id = NULL WHERE bidder_id = $1',
        [userId],
      );
      await manager.query(
        'UPDATE offers SET bidder_id = NULL, owner_id = NULL WHERE bidder_id = $1 OR owner_id = $1',
        [userId],
      );
      await manager.query(
        'UPDATE "orders" SET buyer_id = NULL, seller_id = NULL WHERE buyer_id = $1 OR seller_id = $1',
        [userId],
      );
      await manager.query(
        'UPDATE transactions SET buyer_id = NULL, seller_id = NULL WHERE buyer_id = $1 OR seller_id = $1',
        [userId],
      );
      await manager.query(
        'UPDATE nfts SET owner_id = NULL, creator_id = NULL WHERE owner_id = $1 OR creator_id = $1',
        [userId],
      );
      await manager.query(
        'UPDATE collections SET creator_id = NULL WHERE creator_id = $1',
        [userId],
      );
      const collectionAddressColumns = await manager.query<
        Array<{ column_name: string }>
      >(
        `SELECT column_name FROM information_schema.columns
         WHERE table_schema = current_schema() AND table_name = 'collections'
           AND column_name IN ('creatorAddress', 'creator_address')`,
      );
      const creatorAddresses = [user.address, user.wallet_address].filter(
        (address): address is string => Boolean(address),
      );
      if (creatorAddresses.length) {
        for (const { column_name: column } of collectionAddressColumns) {
          const safeColumn =
            column === 'creatorAddress'
              ? '"creatorAddress"'
              : 'creator_address';
          await manager.query(
            `UPDATE collections SET ${safeColumn} = 'ANONYMIZED' WHERE ${safeColumn} = ANY($1::text[])`,
            [creatorAddresses],
          );
        }
      }
      if (user.email)
        await manager.query('DELETE FROM email_logs WHERE "to" = $1', [
          user.email,
        ]);
      await manager.query(
        `UPDATE users SET
          address = NULL, email = $2, password_hash = NULL, username = NULL,
          bio = NULL, avatar_url = NULL, banner_url = NULL, twitter_handle = NULL,
          instagram_handle = NULL, website = NULL, wallet_address = NULL,
          wallet_public_key = NULL, wallet_provider = NULL, wallet_connected_at = NULL,
          two_factor_secret = NULL, is_two_factor_enabled = false,
          two_factor_backup_codes = NULL, two_factor_enabled_at = NULL,
          two_factor_disabled_at = NULL, is_email_verified = false,
          last_login_at = NULL, deletion_requested_at = NULL, anonymized_at = now()
         WHERE id = $1`,
        [userId, `deleted+${userId}@users.invalid`],
      );
      await manager.query(
        `INSERT INTO account_deletion_audits (user_id, action, ip_address, success, details)
         VALUES ($1, 'finalization', NULL, true, '{}')`,
        [userId],
      );
    });
    setImmediate(() =>
      this.eventEmitter.emit('search.user.delete', { userId }),
    );
  }

  private async writeDeletionAudit(
    userId: string | null,
    action: string,
    ipAddress: string | undefined,
    success: boolean,
    details: Record<string, unknown> = {},
  ) {
    await this.dataSource.query(
      `INSERT INTO account_deletion_audits (user_id, action, ip_address, success, details)
       VALUES ($1, $2, $3, $4, $5)`,
      [userId, action, ipAddress ?? null, success, JSON.stringify(details)],
    );
  }

  private async consumeExportQuota(userId: string): Promise<void> {
    const allowed = await this.dataSource.transaction(async (manager) => {
      await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
        userId,
      ]);
      const countRows = await manager.query<Array<{ count: number | string }>>(
        `SELECT COUNT(*)::int AS count FROM account_deletion_audits
         WHERE user_id = $1 AND action = 'export' AND created_at > now() - interval '24 hours'`,
        [userId],
      );
      const isAllowed =
        Number(countRows[0]?.count ?? 0) < EXPORTS_PER_DAY_LIMIT;
      await manager.query(
        `INSERT INTO account_deletion_audits (user_id, action, ip_address, success, details)
         VALUES ($1, 'export', NULL, $2, $3)`,
        [
          userId,
          isAllowed,
          JSON.stringify({ limit: EXPORTS_PER_DAY_LIMIT, windowHours: 24 }),
        ],
      );
      return isAllowed;
    });
    if (!allowed) {
      throw new HttpException(
        'Export limit reached. You can request up to three exports every 24 hours.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  private exportAsCsv(data: Record<string, unknown>): string {
    const lines = ['section,index,data'];
    const append = (section: string, value: unknown, index = '') => {
      const serialized = JSON.stringify(value ?? null);
      lines.push(
        [section, index, serialized]
          .map((cell) => `"${cell.replace(/"/g, '""')}"`)
          .join(','),
      );
    };
    append('profile', data.profile);
    append('settings', data.settings);
    append('follows', data.follows);
    const wallets = data.wallets as unknown[];
    wallets.forEach((wallet, index) =>
      append('wallets', wallet, String(index)),
    );
    const activity = data.activity as Record<string, unknown[]>;
    for (const [section, records] of Object.entries(activity)) {
      records.forEach((record, index) =>
        append(section, record, String(index)),
      );
    }
    return `${lines.join('\n')}\n`;
  }

  findByIds(ids: string[]) {
    const uniqueIds = [...new Set(ids.filter(Boolean))];
    if (!uniqueIds.length) {
      return Promise.resolve([]);
    }

    return this.repo.find({ where: { id: In(uniqueIds) } });
  }

  findByAddress(address: string) {
    return this.repo.findOne({ where: { address } });
  }

  findByStellarAddress(address: string): Promise<User | null> {
    return this.repo
      .createQueryBuilder('u')
      .where('u.address = :address OR u.walletAddress = :address', { address })
      .getOne();
  }

  findByUsername(username: string): Promise<User | null> {
    return this.repo.findOne({
      where: { username },
    });
  }

  async findPublicCreator(identifier: string): Promise<User | null> {
    const trimmed = identifier.trim();
    if (!trimmed) return null;

    const byId = await this.findById(trimmed);
    if (byId) return byId;

    if (trimmed.startsWith('G') && trimmed.length >= 56) {
      return this.findByStellarAddress(trimmed);
    }

    return this.findByUsername(trimmed);
  }

  async countNftsCreated(userId: string): Promise<number> {
    const result = (await this.dataSource
      .createQueryBuilder()
      .select('COUNT(*)', 'count')
      .from('nfts', 'n')
      .where('n.creator_id = :userId', { userId })
      .getRawOne()) as { count?: string } | null;

    return Number(result?.count ?? 0);
  }

  async isVerifiedCreator(userId: string): Promise<boolean> {
    const result = (await this.dataSource
      .createQueryBuilder()
      .select('COUNT(*)', 'count')
      .from('collections', 'c')
      .where('c.creator_id = :userId', { userId })
      .andWhere('c.is_verified = true')
      .getRawOne()) as { count?: string } | null;

    return Number(result?.count ?? 0) > 0;
  }

  async updateProfile(address: string, data: UpdateProfileDto) {
    const user = await this.findByAddress(address);
    if (!user) throw new NotFoundException('User not found');

    Object.assign(user, data);
    const savedUser = await this.repo.save(user);
    setImmediate(() => {
      this.eventEmitter.emit('search.user.upsert', { userId: savedUser.id });
    });
    return savedUser;
  }

  listWallets(userId: string) {
    return this.walletRepo.find({
      where: { userId },
      order: { isPrimary: 'DESC', createdAt: 'ASC' },
    });
  }

  async getUserTransactionVolume(userId: string): Promise<string> {
    const result = (await this.dataSource
      .createQueryBuilder()
      .select('COALESCE(SUM(t.amount), 0)', 'volume')
      .from('transactions', 't')
      .where('t.buyerId = :userId OR t.sellerId = :userId', { userId })
      .andWhere('t.state = :state', { state: 'completed' })
      .getRawOne()) as { volume?: string } | null;

    return result?.volume || '0';
  }

  async getCreatorSalesVolume(userId: string): Promise<string> {
    const result = (await this.dataSource
      .createQueryBuilder()
      .select('COALESCE(SUM(t.amount), 0)', 'volume')
      .from('transactions', 't')
      .where('t.sellerId = :userId', { userId })
      .andWhere('t.state = :state', { state: 'completed' })
      .getRawOne()) as { volume?: string } | null;

    return result?.volume || '0';
  }
}
