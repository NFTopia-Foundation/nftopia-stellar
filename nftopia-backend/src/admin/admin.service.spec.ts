import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AuditAction } from '../common/audit/audit.service';

// Prevent real Horizon HTTP calls — fetchWalletBalance falls back to the
// testnet URL even when STELLAR_HORIZON_URL is undefined (same pattern as
// bid.service.spec.ts).
jest.mock('stellar-sdk', () => {
  const actual =
    jest.requireActual<typeof import('stellar-sdk')>('stellar-sdk');
  return {
    ...actual,
    Horizon: {
      ...actual.Horizon,
      Server: jest.fn().mockImplementation(() => ({
        loadAccount: jest.fn().mockResolvedValue({
          balances: [{ asset_type: 'native', balance: '1000.0000000' }],
        }),
      })),
    },
  };
});

import { AdminService } from './admin.service';

describe('AdminService', () => {
  let service: AdminService;

  const mockQueryBuilder = {
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getManyAndCount: jest.fn(),
  };

  const userRepository = {
    createQueryBuilder: jest.fn().mockReturnValue(mockQueryBuilder),
    findOne: jest.fn(),
    save: jest.fn(),
    manager: {
      getRepository: jest.fn().mockReturnValue({
        count: jest.fn().mockResolvedValue(3),
      }),
    },
  };

  const collectionRepository = {
    findOne: jest.fn(),
    save: jest.fn(),
    count: jest.fn(),
  };

  const auditService = {
    logAdminAction: jest.fn(),
    findAuditLogs: jest.fn(),
  };

  const configService = {
    get: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AdminService(
      userRepository as never,
      collectionRepository as never,
      auditService as never,
      configService as never,
    );
  });

  describe('listUsers', () => {
    it('queries users with status filter and search term', async () => {
      const rawUsers = [
        {
          id: 'user-1',
          username: 'bob',
          email: 'bob@example.com',
          passwordHash: 'secret-hash',
          twoFactorSecret: 'totp-secret',
        },
      ];
      mockQueryBuilder.getManyAndCount.mockResolvedValue([rawUsers, 1]);

      const result = await service.listUsers({
        search: 'bob',
        status: 'active',
        limit: 10,
        offset: 0,
      });

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'user.isBanned = :isBanned',
        { isBanned: false },
      );
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        expect.stringContaining('LOWER(user.username) LIKE :term'),
        { term: '%bob%' },
      );
      expect(result.total).toBe(1);
      expect(result.users[0].passwordHash).toBeUndefined();
      expect(result.users[0].twoFactorSecret).toBeUndefined();
      expect(result.users[0].username).toBe('bob');
    });

    it('queries banned users when status is banned', async () => {
      mockQueryBuilder.getManyAndCount.mockResolvedValue([[], 0]);

      await service.listUsers({ status: 'banned' });

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'user.isBanned = :isBanned',
        { isBanned: true },
      );
    });
  });

  describe('getUserDetails', () => {
    it('returns sanitized user, wallets, activitySummary, and auditTrail', async () => {
      const user = {
        id: 'u-123',
        username: 'alice',
        email: 'alice@example.com',
        passwordHash: 'hash',
        wallets: [{ id: 'w-1', walletAddress: 'GABC...' }],
      };
      userRepository.findOne.mockResolvedValue(user);
      collectionRepository.count.mockResolvedValue(2);
      auditService.findAuditLogs.mockResolvedValue({
        logs: [{ id: 'log-1', action: AuditAction.BAN_USER }],
        total: 1,
      });

      const result = await service.getUserDetails('u-123');

      expect(result.user.id).toBe('u-123');
      expect(result.user.passwordHash).toBeUndefined();
      expect(result.wallets).toHaveLength(1);
      expect(result.wallets[0]).toMatchObject({
        walletAddress: 'GABC...',
        balance: '1000.0000000',
      });
      expect(result.activitySummary.collectionsCount).toBe(2);
      expect(result.auditTrail).toHaveLength(1);
    });

    it('throws NotFoundException if user does not exist', async () => {
      userRepository.findOne.mockResolvedValue(null);

      await expect(service.getUserDetails('missing-id')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('returns a null balance for a wallet Horizon cannot resolve (#695)', async () => {
      const { Horizon } =
        jest.requireMock<typeof import('stellar-sdk')>('stellar-sdk');
      (Horizon.Server as jest.Mock).mockImplementationOnce(() => ({
        loadAccount: jest
          .fn()
          .mockRejectedValue(new Error('account not found')),
      }));

      const user = {
        id: 'u-456',
        username: 'bob',
        wallets: [{ id: 'w-2', walletAddress: 'GUNFUNDED...' }],
      };
      userRepository.findOne.mockResolvedValue(user);
      collectionRepository.count.mockResolvedValue(0);
      auditService.findAuditLogs.mockResolvedValue({ logs: [], total: 0 });

      const result = await service.getUserDetails('u-456');

      expect(result.wallets[0]).toMatchObject({
        walletAddress: 'GUNFUNDED...',
        balance: null,
      });
    });

    it('fetches balances for multiple wallets independently', async () => {
      const user = {
        id: 'u-789',
        username: 'carol',
        wallets: [
          { id: 'w-3', walletAddress: 'GFIRST...' },
          { id: 'w-4', walletAddress: 'GSECOND...' },
        ],
      };
      userRepository.findOne.mockResolvedValue(user);
      collectionRepository.count.mockResolvedValue(0);
      auditService.findAuditLogs.mockResolvedValue({ logs: [], total: 0 });

      const result = await service.getUserDetails('u-789');

      expect(result.wallets).toHaveLength(2);
      expect(result.wallets[0].balance).toBe('1000.0000000');
      expect(result.wallets[1].balance).toBe('1000.0000000');
    });
  });

  describe('banUser', () => {
    it('sets isBanned to true, logs audit action with reason, and saves user', async () => {
      const user = { id: 'u-1', isBanned: false };
      userRepository.findOne.mockResolvedValue(user);
      userRepository.save.mockImplementation((u) => Promise.resolve(u));

      const result = await service.banUser(
        'admin-1',
        'u-1',
        'Abusive behavior',
        '127.0.0.1',
        'agent',
      );

      expect(result.isBanned).toBe(true);
      expect(auditService.logAdminAction).toHaveBeenCalledWith(
        AuditAction.BAN_USER,
        expect.objectContaining({
          adminId: 'admin-1',
          entityId: 'u-1',
          afterState: { isBanned: true, reason: 'Abusive behavior' },
        }),
      );
    });

    it('throws BadRequestException if user is already banned', async () => {
      userRepository.findOne.mockResolvedValue({ id: 'u-1', isBanned: true });

      await expect(service.banUser('admin-1', 'u-1', 'Reason')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('unbanUser', () => {
    it('sets isBanned to false, logs audit action, and saves user', async () => {
      const user = { id: 'u-1', isBanned: true };
      userRepository.findOne.mockResolvedValue(user);
      userRepository.save.mockImplementation((u) => Promise.resolve(u));

      const result = await service.unbanUser('admin-1', 'u-1');

      expect(result.isBanned).toBe(false);
      expect(auditService.logAdminAction).toHaveBeenCalledWith(
        AuditAction.UNBAN_USER,
        expect.objectContaining({
          adminId: 'admin-1',
          entityId: 'u-1',
          afterState: { isBanned: false },
        }),
      );
    });

    it('throws BadRequestException if user is not banned', async () => {
      userRepository.findOne.mockResolvedValue({ id: 'u-1', isBanned: false });

      await expect(service.unbanUser('admin-1', 'u-1')).rejects.toThrow(
        BadRequestException,
      );
    });
  });
});
