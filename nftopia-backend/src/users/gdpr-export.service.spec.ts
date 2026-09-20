import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { getQueueToken } from '@nestjs/bull';
import { HttpException } from '@nestjs/common';
import { GdprExportService } from './gdpr-export.service';
import { GdprAuditService } from './gdpr-audit.service';
import { User } from './user.entity';
import { UserWallet } from '../auth/entities/user-wallet.entity';
import { UserFollow } from './user-follow.entity';
import { DataExportJob } from './entities/data-export-job.entity';
import {
  DATA_EXPORT_QUEUE,
  DataExportStatus,
  GdprAuditAction,
} from './gdpr.constants';

const USER_ID = 'user-uuid-1';

const mockUserRepo = { findOne: jest.fn() };
const mockWalletRepo = { find: jest.fn() };
const mockFollowRepo = { find: jest.fn() };
const mockJobRepo = {
  findOne: jest.fn(),
  save: jest.fn().mockImplementation((j: Partial<DataExportJob>) =>
    Promise.resolve({
      id: 'job-1',
      createdAt: new Date(),
      ...j,
    }),
  ),
  create: jest.fn().mockImplementation((dto: Partial<DataExportJob>) => dto),
};
const mockAudit = {
  countActions: jest.fn().mockResolvedValue(0),
  log: jest.fn().mockResolvedValue(undefined),
};
const mockQueue = { add: jest.fn().mockResolvedValue({ id: 'bull-1' }) };

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: USER_ID,
    email: 'alice@example.com',
    username: 'alice',
    address: 'GALICE',
    walletAddress: 'GALICE',
    walletPublicKey: 'GALICE',
    walletProvider: 'freighter',
    avatarUrl: 'https://example.com/a.png',
    bannerUrl: 'https://example.com/b.png',
    bio: 'hello',
    twitterHandle: '@alice',
    instagramHandle: '@alice',
    website: 'https://alice.example.com',
    role: 'USER' as never,
    isEmailVerified: true,
    isBanned: false,
    twoFactorEnabled: true,
    passwordHash: 'super-secret-hash',
    twoFactorSecret: 'totp-secret',
    createdAt: new Date('2024-01-01T00:00:00Z'),
    lastLoginAt: new Date('2024-02-01T00:00:00Z'),
    walletConnectedAt: new Date('2024-01-02T00:00:00Z'),
    ...overrides,
  } as User;
}

describe('GdprExportService', () => {
  let service: GdprExportService;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockAudit.countActions.mockResolvedValue(0);
    mockUserRepo.findOne.mockResolvedValue(makeUser());
    mockWalletRepo.find.mockResolvedValue([
      {
        id: 'w1',
        walletAddress: 'GALICE',
        walletProvider: 'freighter',
        isPrimary: true,
        createdAt: new Date('2024-01-02T00:00:00Z'),
        lastUsedAt: null,
      },
    ]);
    mockFollowRepo.find.mockResolvedValue([{ followingId: 'other-1' }]);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GdprExportService,
        { provide: getRepositoryToken(User), useValue: mockUserRepo },
        { provide: getRepositoryToken(UserWallet), useValue: mockWalletRepo },
        { provide: getRepositoryToken(UserFollow), useValue: mockFollowRepo },
        { provide: getRepositoryToken(DataExportJob), useValue: mockJobRepo },
        { provide: GdprAuditService, useValue: mockAudit },
        { provide: getQueueToken(DATA_EXPORT_QUEUE), useValue: mockQueue },
      ],
    }).compile();

    service = module.get(GdprExportService);
  });

  describe('buildExport', () => {
    it('includes profile, wallets, follows and settings', async () => {
      const data = await service.buildExport(USER_ID, 'json');

      expect(data.profile.email).toBe('alice@example.com');
      expect(data.wallets).toHaveLength(1);
      expect(data.follows.following).toEqual(['other-1']);
      expect(data.settings.twoFactorEnabled).toBe(true);
    });

    it('never exposes password hashes or 2FA secrets', async () => {
      const data = await service.buildExport(USER_ID, 'json');
      const serialized = JSON.stringify(data);
      expect(serialized).not.toContain('super-secret-hash');
      expect(serialized).not.toContain('totp-secret');
      expect(
        (data.profile as unknown as Record<string, unknown>).passwordHash,
      ).toBe(undefined);
    });

    it('throws NotFoundException for an unknown user', async () => {
      mockUserRepo.findOne.mockResolvedValueOnce(null);
      await expect(service.buildExport('missing', 'json')).rejects.toThrow(
        'User not found',
      );
    });
  });

  describe('exportNow', () => {
    it('returns a JSON payload and records the audit trail', async () => {
      const result = await service.exportNow(USER_ID, 'json');

      expect(result.contentType).toContain('application/json');
      const parsed = JSON.parse(result.body as string) as {
        profile: { id: string };
      };
      expect(parsed.profile.id).toBe(USER_ID);
      expect(mockAudit.log).toHaveBeenCalledWith(
        GdprAuditAction.DATA_EXPORT_REQUESTED,
        expect.objectContaining({ userId: USER_ID }),
      );
      expect(mockAudit.log).toHaveBeenCalledWith(
        GdprAuditAction.DATA_EXPORT_COMPLETED,
        expect.objectContaining({ userId: USER_ID }),
      );
    });

    it('supports CSV output', async () => {
      const result = await service.exportNow(USER_ID, 'csv');
      expect(result.contentType).toContain('text/csv');
      expect(result.body as string).toContain('section,field,value');
      expect(result.body as string).toContain('alice@example.com');
    });

    it('supports ZIP output', async () => {
      const result = await service.exportNow(USER_ID, 'zip');
      expect(result.contentType).toBe('application/zip');
      expect(Buffer.isBuffer(result.body)).toBe(true);
      expect((result.body as Buffer).subarray(0, 4).toString('binary')).toBe(
        'PK\x03\x04',
      );
    });

    it('enforces the daily export rate limit', async () => {
      mockAudit.countActions.mockResolvedValueOnce(3);
      await expect(service.exportNow(USER_ID, 'json')).rejects.toThrow(
        HttpException,
      );
    });
  });

  describe('async exports', () => {
    it('creates a job and enqueues it', async () => {
      const result = await service.requestAsyncExport(USER_ID, 'json');

      expect(result.status).toBe(DataExportStatus.PENDING);
      expect(mockQueue.add).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ jobId: 'job-1', userId: USER_ID }),
      );
    });

    it('processes a job and stores the serialized payload', async () => {
      const job: Partial<DataExportJob> = {
        id: 'job-1',
        userId: USER_ID,
        format: 'json',
        status: DataExportStatus.PENDING,
      };
      mockJobRepo.findOne.mockResolvedValueOnce(job);
      mockJobRepo.save.mockImplementation((j: DataExportJob) =>
        Promise.resolve(j),
      );

      const saved = await service.processExportJob('job-1');

      expect(saved.status).toBe(DataExportStatus.COMPLETED);
      expect(saved.data).toBeTruthy();
      const parsed = JSON.parse(saved.data as string) as {
        profile: { id: string };
      };
      expect(parsed.profile.id).toBe(USER_ID);
    });

    it('marks a job failed when the export cannot be built', async () => {
      const job: Partial<DataExportJob> = {
        id: 'job-2',
        userId: 'missing',
        format: 'json',
        status: DataExportStatus.PENDING,
      };
      mockJobRepo.findOne.mockResolvedValueOnce(job);
      mockJobRepo.save.mockImplementation((j: DataExportJob) =>
        Promise.resolve(j),
      );
      mockUserRepo.findOne.mockResolvedValueOnce(null);

      await expect(service.processExportJob('job-2')).rejects.toThrow();
      expect(job.status).toBe(DataExportStatus.FAILED);
      expect(mockAudit.log).toHaveBeenCalledWith(
        GdprAuditAction.DATA_EXPORT_FAILED,
        expect.objectContaining({ userId: 'missing' }),
      );
    });

    it('hides data until the job completes', async () => {
      mockJobRepo.findOne.mockResolvedValueOnce({
        id: 'job-3',
        userId: USER_ID,
        format: 'json',
        status: DataExportStatus.PROCESSING,
        data: 'secret',
        createdAt: new Date(),
      });

      const view = await service.getJob(USER_ID, 'job-3');
      expect(view.data).toBeNull();
    });

    it('throws when the job does not belong to the user', async () => {
      mockJobRepo.findOne.mockResolvedValueOnce(null);
      await expect(service.getJob(USER_ID, 'nope')).rejects.toThrow(
        'Export job not found',
      );
    });
  });
});
