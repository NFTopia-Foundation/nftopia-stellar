import {
  HttpException,
  HttpStatus,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { UsersService } from './users.service';

describe('UsersService GDPR export', () => {
  const repo = { findOne: jest.fn(), save: jest.fn() };
  const walletRepo = { find: jest.fn() };
  const followRepo = { find: jest.fn() };
  const eventEmitter = { emit: jest.fn() };
  const dataSource = { query: jest.fn(), transaction: jest.fn() };
  const cacheManager = { get: jest.fn(), set: jest.fn(), del: jest.fn() };
  const privacyQueue = { add: jest.fn(), getJob: jest.fn() };
  const emailService = { sendAccountDeletionVerificationEmail: jest.fn() };
  let service: UsersService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new UsersService(
      repo as never,
      walletRepo as never,
      followRepo as never,
      eventEmitter as never,
      dataSource as never,
      cacheManager as never,
      privacyQueue as never,
      emailService as never,
    );
    walletRepo.find.mockResolvedValue([{ walletAddress: 'GUSER' }]);
    followRepo.find.mockResolvedValue([
      { followerId: 'user-1', followingId: 'user-2' },
      { followerId: 'user-3', followingId: 'user-1' },
    ]);
    dataSource.query.mockResolvedValue([]);
    dataSource.transaction.mockImplementation(
      (callback: (manager: { query: jest.Mock }) => Promise<void>) =>
        callback({ query: jest.fn().mockResolvedValue([]) }),
    );
    cacheManager.set.mockResolvedValue(undefined);
    cacheManager.del.mockResolvedValue(undefined);
    privacyQueue.add.mockResolvedValue({ id: 'privacy-job-1' });
    emailService.sendAccountDeletionVerificationEmail.mockResolvedValue(
      undefined,
    );
  });

  it('exports personal data without password or two-factor secrets', async () => {
    repo.findOne.mockResolvedValue({
      id: 'user-1',
      email: 'user@example.com',
      username: 'user',
      passwordHash: 'must-not-export',
      twoFactorSecret: 'must-not-export',
      isEmailVerified: true,
      twoFactorEnabled: true,
    });

    const result = await service.exportUserData('user-1');

    expect(result.profile.email).toBe('user@example.com');
    expect(result.wallets).toEqual([{ walletAddress: 'GUSER' }]);
    expect(result.follows.following).toHaveLength(1);
    expect(result.follows.followers).toHaveLength(1);
    expect(JSON.stringify(result)).not.toContain('must-not-export');
    expect(dataSource.query).toHaveBeenCalledTimes(16);
  });

  it('rejects export for a missing account', async () => {
    repo.findOne.mockResolvedValue(null);

    await expect(service.exportUserData('missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('creates a verified deletion request and enforces the cooldown', async () => {
    repo.findOne.mockResolvedValue({
      id: 'user-1',
      email: 'user@example.com',
      username: 'user',
      isEmailVerified: true,
      deletionLastRequestedAt: null,
    });

    await expect(
      service.requestAccountDeletion('user-1', true, '127.0.0.1'),
    ).resolves.toMatchObject({ verificationRequired: true });
    expect(emailService.sendAccountDeletionVerificationEmail).toHaveBeenCalled();
    expect(cacheManager.set).toHaveBeenCalledWith(
      expect.stringMatching(/^account-deletion:/),
      { userId: 'user-1' },
      15 * 60 * 1000,
    );

    repo.findOne.mockResolvedValue({
      id: 'user-1',
      email: 'user@example.com',
      isEmailVerified: true,
      deletionLastRequestedAt: new Date(),
    });
    await expect(
      service.requestAccountDeletion('user-1', true),
    ).rejects.toMatchObject({ status: HttpStatus.TOO_MANY_REQUESTS });
  });

  it('schedules deletion after email verification and supports cancellation', async () => {
    cacheManager.get.mockResolvedValue({ userId: 'user-1' });
    repo.findOne.mockResolvedValue({
      id: 'user-1',
      email: 'user@example.com',
      isEmailVerified: true,
    });

    const result = await service.verifyAccountDeletion('verified-token', '127.0.0.1');

    expect(result.success).toBe(true);
    expect(privacyQueue.add).toHaveBeenCalledWith(
      'finalize-account-deletion',
      expect.objectContaining({ userId: 'user-1' }),
      expect.objectContaining({ delay: 30 * 24 * 60 * 60 * 1000 }),
    );

    repo.findOne.mockResolvedValue({
      id: 'user-1',
      deletionRequestedAt: new Date(),
    });
    dataSource.transaction.mockImplementation(
      (callback: (manager: { query: jest.Mock }) => Promise<void>) =>
        callback({
          query: jest.fn().mockResolvedValue([
            { deletion_requested_at: new Date(), anonymized_at: null },
          ]),
        }),
    );
    await expect(service.cancelAccountDeletion('user-1')).resolves.toEqual({
      success: true,
      cancelled: true,
    });
  });

  it('rejects deletion verification tokens belonging to another account', async () => {
    cacheManager.get.mockResolvedValue({ userId: 'someone-else' });

    await expect(
      service.verifyAccountDeletion('wrong-token'),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('creates a readable ZIP export', async () => {
    repo.findOne.mockResolvedValue({ id: 'user-1', email: 'user@example.com' });
    const file = await service.prepareExportFile('user-1', 'zip');

    expect(file.contentType).toBe('application/zip');
    expect(Buffer.from(file.contentBase64, 'base64').subarray(0, 2).toString()).toBe('PK');
  });

  it('limits synchronous and queued export requests to three per day', async () => {
    let exportCount = 0;
    dataSource.transaction.mockImplementation(
      (callback: (manager: { query: jest.Mock }) => Promise<boolean>) => {
        const query = jest.fn((sql: string) => {
          if (sql.includes('COUNT(*)')) return Promise.resolve([{ count: exportCount }]);
          if (sql.includes("VALUES ($1, 'export'")) exportCount += 1;
          return Promise.resolve([]);
        });
        return callback({ query });
      },
    );

    await service.requestExportFile('user-1', 'json');
    await service.requestExportFile('user-1', 'csv');
    await service.createExportJob('user-1', 'zip');
    await expect(service.createExportJob('user-1', 'json')).rejects.toMatchObject({
      status: HttpStatus.TOO_MANY_REQUESTS,
    });
  });

  it('anonymizes only the still-pending deletion when grace expires', async () => {
    const requestedAt = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000);
    repo.findOne.mockResolvedValue({
      id: 'user-1',
      email: 'user@example.com',
      deletionRequestedAt: requestedAt,
    });
    const statements: string[] = [];
    dataSource.transaction.mockImplementation(
      (callback: (manager: { query: jest.Mock }) => Promise<void>) => {
        const query = jest.fn((sql: string) => {
          statements.push(sql);
          if (sql.startsWith('SELECT email,')) {
            return Promise.resolve([
              {
                email: 'user@example.com',
                deletion_requested_at: requestedAt,
                anonymized_at: null,
              },
            ]);
          }
          if (sql.startsWith('SELECT wallet_address FROM user_wallets')) {
            return Promise.resolve([{ wallet_address: 'GUSER' }]);
          }
          return Promise.resolve([]);
        });
        return callback({ query });
      },
    );

    await service.finalizeAccountDeletion('user-1', requestedAt.toISOString());

    expect(statements).toContainEqual(
      expect.stringContaining('UPDATE transactions SET buyer_id = NULL'),
    );
    expect(statements).toContainEqual(
      expect.stringContaining('UPDATE stellar_nfts SET owner = $2'),
    );
    expect(statements).toContainEqual(
      expect.stringContaining('two_factor_secret = NULL'),
    );
  });
});