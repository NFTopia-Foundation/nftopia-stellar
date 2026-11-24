import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { Horizon } from 'stellar-sdk';
import { User } from '../users/user.entity';
import { Collection } from '../modules/collection/entities/collection.entity';
import { AuditService, AuditAction } from '../common/audit/audit.service';
import { UserWallet } from '../auth/entities/user-wallet.entity';

import { ListUsersQueryDto } from './dto/list-users-query.dto';
import { AuditLogsQueryDto } from './dto/audit-logs-query.dto';

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Collection)
    private readonly collectionRepository: Repository<Collection>,
    private readonly auditService: AuditService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Native XLM balance for one wallet (#695), for the admin user-detail
   * view. Best-effort: an unfunded or unreachable account must not break
   * the rest of the user-detail response, so this returns null on any
   * failure rather than throwing.
   */
  private async fetchWalletBalance(address: string): Promise<string | null> {
    try {
      const horizonUrl =
        this.configService.get<string>('STELLAR_HORIZON_URL') ??
        'https://horizon-testnet.stellar.org';
      const server = new Horizon.Server(horizonUrl);
      const account = await server.loadAccount(address);
      const native = account.balances.find(
        (b): b is Horizon.HorizonApi.BalanceLineNative =>
          b.asset_type === 'native',
      );
      return native?.balance ?? null;
    } catch (error) {
      this.logger.warn(
        `Could not fetch balance for wallet ${address}: ${(error as Error).message}`,
      );
      return null;
    }
  }

  private async attachWalletBalances(
    wallets: UserWallet[],
  ): Promise<Array<UserWallet & { balance: string | null }>> {
    return Promise.all(
      wallets.map(async (wallet) => ({
        ...wallet,
        balance: await this.fetchWalletBalance(wallet.walletAddress),
      })),
    );
  }

  async listUsers(
    query: ListUsersQueryDto,
  ): Promise<{ users: Partial<User>[]; total: number }> {
    const qb = this.userRepository.createQueryBuilder('user');

    if (query.status && query.status !== 'all') {
      if (query.status === 'banned') {
        qb.andWhere('user.isBanned = :isBanned', { isBanned: true });
      } else if (query.status === 'active') {
        qb.andWhere('user.isBanned = :isBanned', { isBanned: false });
      }
    }

    if (query.search && query.search.trim()) {
      const term = `%${query.search.trim().toLowerCase()}%`;
      qb.andWhere(
        '(LOWER(user.username) LIKE :term OR LOWER(user.email) LIKE :term OR LOWER(user.walletAddress) LIKE :term OR LOWER(user.address) LIKE :term)',
        { term },
      );
    }

    qb.orderBy('user.createdAt', 'DESC');

    const limit = query.limit ?? 20;
    const offset = query.offset ?? 0;

    qb.skip(offset).take(limit);

    const [rawUsers, total] = await qb.getManyAndCount();

    const users = rawUsers.map((user) => {
      const sanitized = { ...user };
      delete sanitized.passwordHash;
      delete sanitized.twoFactorSecret;
      delete sanitized.twoFactorBackupCodes;
      return sanitized;
    });

    return { users, total };
  }

  async listAuditLogs(query: AuditLogsQueryDto) {
    const limit = query.limit ?? 50;
    const offset = query.offset ?? 0;
    const result = await this.auditService.findAuditLogs({
      adminId: query.adminId,
      action: query.action,
      entityType: query.entityType,
      entityId: query.entityId,
      startDate: query.startDate ? new Date(query.startDate) : undefined,
      endDate: query.endDate ? new Date(query.endDate) : undefined,
      limit,
      offset,
    });
    return { logs: result.logs, total: result.total, limit, offset };
  }

  async getUserDetails(userId: string) {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: ['wallets'],
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    const sanitizedUser = { ...user };
    delete sanitizedUser.passwordHash;
    delete sanitizedUser.twoFactorSecret;
    delete sanitizedUser.twoFactorBackupCodes;

    const [collectionsCount, auditLogsResult, walletsWithBalance] =
      await Promise.all([
        this.collectionRepository.count({ where: { creatorId: userId } }),
        this.auditService.findAuditLogs({
          entityType: 'User',
          entityId: userId,
          limit: 50,
        }),
        this.attachWalletBalances(user.wallets ?? []),
      ]);

    let nftsOwned = 0;
    let nftsCreated = 0;
    try {
      const nftRepo = this.userRepository.manager.getRepository('nfts');
      if (nftRepo) {
        [nftsOwned, nftsCreated] = await Promise.all([
          nftRepo.count({ where: { owner_id: userId } }).catch(() => 0),
          nftRepo.count({ where: { creator_id: userId } }).catch(() => 0),
        ]);
      }
    } catch {
      // Fallback if table name or relation mapping is not directly resolved
    }

    return {
      user: sanitizedUser,
      wallets: walletsWithBalance,
      activitySummary: {
        collectionsCount,
        nftsOwned,
        nftsCreated,
      },
      auditTrail: auditLogsResult.logs ?? [],
    };
  }

  async banUser(
    adminId: string,
    userId: string,
    reason?: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<User> {
    const user = await this.userRepository.findOne({ where: { id: userId } });

    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    if (user.isBanned) {
      throw new BadRequestException('User is already banned');
    }

    const beforeState = { isBanned: user.isBanned };
    user.isBanned = true;
    const afterState = {
      isBanned: user.isBanned,
      ...(reason ? { reason } : {}),
    };
    const saved = await this.userRepository.save(user);

    await this.auditService.logAdminAction(AuditAction.BAN_USER, {
      adminId,
      entityType: 'User',
      entityId: userId,
      beforeState,
      afterState,
      ipAddress,
      userAgent,
    });

    return saved;
  }

  async unbanUser(
    adminId: string,
    userId: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<User> {
    const user = await this.userRepository.findOne({ where: { id: userId } });

    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    if (!user.isBanned) {
      throw new BadRequestException('User is not banned');
    }

    const beforeState = { isBanned: user.isBanned };
    user.isBanned = false;
    const afterState = { isBanned: user.isBanned };
    const saved = await this.userRepository.save(user);

    await this.auditService.logAdminAction(AuditAction.UNBAN_USER, {
      adminId,
      entityType: 'User',
      entityId: userId,
      beforeState,
      afterState,
      ipAddress,
      userAgent,
    });

    return saved;
  }

  async hideCollection(
    adminId: string,
    collectionId: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<Collection> {
    const collection = await this.collectionRepository.findOne({
      where: { id: collectionId },
    });

    if (!collection) {
      throw new NotFoundException(
        `Collection with ID ${collectionId} not found`,
      );
    }

    if (collection.isHidden) {
      throw new BadRequestException('Collection is already hidden');
    }

    const beforeState = { isHidden: collection.isHidden };
    collection.isHidden = true;
    const afterState = { isHidden: collection.isHidden };
    const saved = await this.collectionRepository.save(collection);

    await this.auditService.logAdminAction(AuditAction.HIDE_COLLECTION, {
      adminId,
      entityType: 'Collection',
      entityId: collectionId,
      beforeState,
      afterState,
      ipAddress,
      userAgent,
    });

    return saved;
  }

  async verifyCollection(
    adminId: string,
    collectionId: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<Collection> {
    const collection = await this.collectionRepository.findOne({
      where: { id: collectionId },
    });

    if (!collection) {
      throw new NotFoundException(
        `Collection with ID ${collectionId} not found`,
      );
    }

    const beforeState = { isVerified: collection.isVerified };
    collection.isVerified = !collection.isVerified;
    const afterState = { isVerified: collection.isVerified };
    const saved = await this.collectionRepository.save(collection);

    await this.auditService.logAdminAction(AuditAction.VERIFY_COLLECTION, {
      adminId,
      entityType: 'Collection',
      entityId: collectionId,
      beforeState,
      afterState,
      ipAddress,
      userAgent,
    });

    return saved;
  }
}
