import {
  HttpException,
  HttpStatus,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { InjectRepository } from '@nestjs/typeorm';
import type { Queue } from 'bull';
import { Repository } from 'typeorm';
import { User } from './user.entity';
import { UserWallet } from '../auth/entities/user-wallet.entity';
import { UserFollow } from './user-follow.entity';
import { DataExportJob } from './entities/data-export-job.entity';
import { GdprAuditService, GdprAuditContext } from './gdpr-audit.service';
import { createZip, type ZipEntry } from './utils/zip.util';
import {
  DATA_EXPORT_JOB,
  DATA_EXPORT_QUEUE,
  DataExportStatus,
  EXPORT_RATE_LIMIT_MAX,
  EXPORT_RATE_LIMIT_WINDOW_MS,
  GdprAuditAction,
  type ExportFormat,
} from './gdpr.constants';

export interface ExportedProfile {
  id: string;
  email: string | null;
  username: string | null;
  address: string | null;
  walletAddress: string | null;
  walletPublicKey: string | null;
  walletProvider: string | null;
  avatarUrl: string | null;
  bannerUrl: string | null;
  bio: string | null;
  twitterHandle: string | null;
  instagramHandle: string | null;
  website: string | null;
  role: string;
  isEmailVerified: boolean;
  twoFactorEnabled: boolean;
  isBanned: boolean;
  createdAt: Date;
  lastLoginAt: Date | null;
  walletConnectedAt: Date | null;
}

export interface UserDataExport {
  exportedAt: string;
  format: ExportFormat;
  profile: ExportedProfile;
  wallets: Array<{
    id: string;
    walletAddress: string;
    walletProvider: string;
    isPrimary: boolean;
    createdAt: Date;
    lastUsedAt: Date | null;
  }>;
  follows: {
    following: string[];
    followers: string[];
  };
  settings: {
    twoFactorEnabled: boolean;
    emailVerified: boolean;
    marketingEmails: boolean;
  };
}

export interface FormattedExport {
  format: ExportFormat;
  contentType: string;
  filename: string;
  body: string | Buffer;
}

/**
 * Builds and serializes a user's personal data on demand, either inline for
 * small accounts or through a Bull queue for large ones.
 */
@Injectable()
export class GdprExportService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(UserWallet)
    private readonly walletRepo: Repository<UserWallet>,
    @InjectRepository(UserFollow)
    private readonly followRepo: Repository<UserFollow>,
    @InjectRepository(DataExportJob)
    private readonly jobRepo: Repository<DataExportJob>,
    private readonly audit: GdprAuditService,
    @InjectQueue(DATA_EXPORT_QUEUE)
    private readonly exportQueue: Queue,
  ) {}

  async buildExport(
    userId: string,
    format: ExportFormat,
  ): Promise<UserDataExport> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const [wallets, following, followers] = await Promise.all([
      this.walletRepo.find({
        where: { userId },
        order: { isPrimary: 'DESC', createdAt: 'ASC' },
      }),
      this.followRepo.find({ where: { followerId: userId } }),
      this.followRepo.find({ where: { followingId: userId } }),
    ]);

    return {
      exportedAt: new Date().toISOString(),
      format,
      profile: {
        id: user.id,
        email: user.email ?? null,
        username: user.username ?? null,
        address: user.address ?? null,
        walletAddress: user.walletAddress ?? null,
        walletPublicKey: user.walletPublicKey ?? null,
        walletProvider: user.walletProvider ?? null,
        avatarUrl: user.avatarUrl ?? null,
        bannerUrl: user.bannerUrl ?? null,
        bio: user.bio ?? null,
        twitterHandle: user.twitterHandle ?? null,
        instagramHandle: user.instagramHandle ?? null,
        website: user.website ?? null,
        role: user.role,
        isEmailVerified: user.isEmailVerified ?? false,
        twoFactorEnabled: user.twoFactorEnabled ?? false,
        isBanned: user.isBanned ?? false,
        createdAt: user.createdAt,
        lastLoginAt: user.lastLoginAt ?? null,
        walletConnectedAt: user.walletConnectedAt ?? null,
      },
      wallets: wallets.map((w) => ({
        id: w.id,
        walletAddress: w.walletAddress,
        walletProvider: w.walletProvider,
        isPrimary: w.isPrimary,
        createdAt: w.createdAt,
        lastUsedAt: w.lastUsedAt ?? null,
      })),
      follows: {
        following: following.map((f) => f.followingId),
        followers: followers.map((f) => f.followerId),
      },
      settings: {
        twoFactorEnabled: user.twoFactorEnabled ?? false,
        emailVerified: user.isEmailVerified ?? false,
        marketingEmails: false,
      },
    };
  }

  async exportNow(
    userId: string,
    format: ExportFormat,
    context: Partial<GdprAuditContext> = {},
  ): Promise<FormattedExport> {
    await this.assertExportAllowed(userId);

    await this.audit.log(GdprAuditAction.DATA_EXPORT_REQUESTED, {
      userId,
      entityType: 'user',
      entityId: userId,
      metadata: { format, mode: 'sync' },
      ...context,
    });

    try {
      const data = await this.buildExport(userId, format);
      const formatted = this.formatExport(data, format);
      await this.audit.log(GdprAuditAction.DATA_EXPORT_COMPLETED, {
        userId,
        entityType: 'user',
        entityId: userId,
        metadata: { format, mode: 'sync' },
        ...context,
      });
      return formatted;
    } catch (error) {
      await this.audit.log(GdprAuditAction.DATA_EXPORT_FAILED, {
        userId,
        entityType: 'user',
        entityId: userId,
        metadata: { format, reason: (error as Error).message },
        ...context,
      });
      throw error;
    }
  }

  async requestAsyncExport(
    userId: string,
    format: ExportFormat,
    context: Partial<GdprAuditContext> = {},
  ): Promise<{ jobId: string; status: DataExportStatus }> {
    await this.assertExportAllowed(userId);

    const job = await this.jobRepo.save(
      this.jobRepo.create({
        userId,
        format,
        status: DataExportStatus.PENDING,
      }),
    );

    await this.audit.log(GdprAuditAction.DATA_EXPORT_REQUESTED, {
      userId,
      entityType: 'data_export_job',
      entityId: job.id,
      metadata: { format, mode: 'async' },
      ...context,
    });

    if (!this.exportQueue) {
      throw new InternalServerErrorException('Export queue is unavailable');
    }

    await this.exportQueue.add(DATA_EXPORT_JOB, {
      jobId: job.id,
      userId,
      format,
    });

    return { jobId: job.id, status: job.status };
  }

  async processExportJob(jobId: string): Promise<DataExportJob> {
    const job = await this.jobRepo.findOne({ where: { id: jobId } });
    if (!job) {
      throw new NotFoundException('Export job not found');
    }

    job.status = DataExportStatus.PROCESSING;
    await this.jobRepo.save(job);

    try {
      const data = await this.buildExport(job.userId, job.format);
      const formatted = this.formatExport(data, job.format);
      job.data = Buffer.isBuffer(formatted.body)
        ? formatted.body.toString('base64')
        : formatted.body;
      job.status = DataExportStatus.COMPLETED;
      job.completedAt = new Date();
      job.error = null;
      await this.jobRepo.save(job);

      await this.audit.log(GdprAuditAction.DATA_EXPORT_COMPLETED, {
        userId: job.userId,
        entityType: 'data_export_job',
        entityId: job.id,
        metadata: { format: job.format, mode: 'async' },
      });
      return job;
    } catch (error) {
      job.status = DataExportStatus.FAILED;
      job.error = (error as Error).message;
      job.completedAt = new Date();
      await this.jobRepo.save(job);

      await this.audit.log(GdprAuditAction.DATA_EXPORT_FAILED, {
        userId: job.userId,
        entityType: 'data_export_job',
        entityId: job.id,
        metadata: { format: job.format, reason: (error as Error).message },
      });
      throw error;
    }
  }

  async getJob(
    userId: string,
    jobId: string,
  ): Promise<{
    id: string;
    status: DataExportStatus;
    format: ExportFormat;
    createdAt: Date;
    completedAt: Date | null;
    error: string | null;
    data: string | null;
  }> {
    const job = await this.jobRepo.findOne({
      where: { id: jobId, userId },
    });
    if (!job) {
      throw new NotFoundException('Export job not found');
    }

    return {
      id: job.id,
      status: job.status,
      format: job.format,
      createdAt: job.createdAt,
      completedAt: job.completedAt ?? null,
      error: job.error ?? null,
      data:
        job.status === DataExportStatus.COMPLETED ? (job.data ?? null) : null,
    };
  }

  formatExport(data: UserDataExport, format: ExportFormat): FormattedExport {
    if (format === 'csv') {
      return {
        format,
        contentType: 'text/csv; charset=utf-8',
        filename: `nftopia-export-${data.profile.id}.csv`,
        body: toCsv(data),
      };
    }

    if (format === 'zip') {
      const entries: ZipEntry[] = [
        {
          name: 'profile.json',
          content: JSON.stringify(data.profile, null, 2),
        },
        {
          name: 'wallets.json',
          content: JSON.stringify(data.wallets, null, 2),
        },
        {
          name: 'follows.json',
          content: JSON.stringify(data.follows, null, 2),
        },
        {
          name: 'settings.json',
          content: JSON.stringify(data.settings, null, 2),
        },
        { name: 'export.csv', content: toCsv(data) },
      ];
      return {
        format,
        contentType: 'application/zip',
        filename: `nftopia-export-${data.profile.id}.zip`,
        body: createZip(entries),
      };
    }

    return {
      format: 'json',
      contentType: 'application/json; charset=utf-8',
      filename: `nftopia-export-${data.profile.id}.json`,
      body: JSON.stringify(data, null, 2),
    };
  }

  private async assertExportAllowed(userId: string): Promise<void> {
    const since = new Date(Date.now() - EXPORT_RATE_LIMIT_WINDOW_MS);
    const count = await this.audit.countActions(
      userId,
      GdprAuditAction.DATA_EXPORT_REQUESTED,
      since,
    );
    if (count >= EXPORT_RATE_LIMIT_MAX) {
      throw new HttpException(
        `Export rate limit exceeded. Maximum ${EXPORT_RATE_LIMIT_MAX} exports per day.`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }
}

function escapeCsv(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }

  let str: string;
  if (typeof value === 'string') {
    str = value;
  } else if (
    typeof value === 'number' ||
    typeof value === 'boolean' ||
    typeof value === 'bigint'
  ) {
    str = value.toString();
  } else {
    str = JSON.stringify(value) ?? '';
  }

  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function toCsv(data: UserDataExport): string {
  const rows: string[][] = [['section', 'field', 'value']];

  const pushObject = (
    section: string,
    obj: Record<string, unknown> | undefined,
  ) => {
    if (!obj) return;
    for (const [key, value] of Object.entries(obj)) {
      rows.push([section, key, escapeCsv(value)]);
    }
  };

  pushObject('profile', data.profile as unknown as Record<string, unknown>);
  data.wallets.forEach((wallet, index) => {
    pushObject(`wallets[${index}]`, wallet);
  });
  pushObject('follows', {
    following: data.follows.following,
    followers: data.follows.followers,
  });
  pushObject('settings', data.settings);

  return rows.map((row) => row.join(',')).join('\n');
}
