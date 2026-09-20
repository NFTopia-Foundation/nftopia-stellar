import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { createHash } from 'crypto';
import { HttpException } from '@nestjs/common';
import { AccountDeletionService } from './account-deletion.service';
import { GdprAuditService } from './gdpr-audit.service';
import { User } from './user.entity';
import { UserWallet } from '../auth/entities/user-wallet.entity';
import { WalletSession } from '../auth/entities/wallet-session.entity';
import { UserFollow } from './user-follow.entity';
import { Listing } from '../modules/listing/entities/listing.entity';
import { Offer } from '../modules/offer/entities/offer.entity';
import { AccountDeletionRequest } from './entities/account-deletion-request.entity';
import { EmailService } from '../modules/email/email.service';
import { DeletionRequestStatus, GdprAuditAction } from './gdpr.constants';

const USER_ID = 'user-uuid-1';
const TOKEN = 'plain-token';
const TOKEN_HASH = createHash('sha256').update(TOKEN).digest('hex');

const mockRequestRepo = {
  findOne: jest.fn(),
  find: jest.fn(),
  create: jest
    .fn()
    .mockImplementation((dto: Partial<AccountDeletionRequest>) => ({
      id: 'req-1',
      createdAt: new Date(),
      ...dto,
    })),
  save: jest
    .fn()
    .mockImplementation((r: AccountDeletionRequest) => Promise.resolve(r)),
};
const mockUserRepo = { findOne: jest.fn(), save: jest.fn() };
const mockWalletRepo = { delete: jest.fn().mockResolvedValue({ affected: 1 }) };
const mockSessionRepo = {
  delete: jest.fn().mockResolvedValue({ affected: 1 }),
};
const mockFollowRepo = { delete: jest.fn().mockResolvedValue({ affected: 1 }) };
const mockListingRepo = {
  update: jest.fn().mockResolvedValue({ affected: 1 }),
};
const mockOfferRepo = { update: jest.fn().mockResolvedValue({ affected: 1 }) };
const mockAudit = {
  countActions: jest.fn().mockResolvedValue(0),
  log: jest.fn().mockResolvedValue(undefined),
};
const mockEmail = {
  sendAccountDeletionEmail: jest.fn().mockResolvedValue(undefined),
};

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
    bannerUrl: null,
    bio: 'hello',
    twitterHandle: '@alice',
    instagramHandle: null,
    website: null,
    passwordHash: 'hash',
    twoFactorSecret: 'secret',
    twoFactorBackupCodes: ['abc'],
    twoFactorEnabled: true,
    isEmailVerified: true,
    isAnonymized: false,
    ...overrides,
  } as User;
}

function makeRequest(
  overrides: Partial<AccountDeletionRequest> = {},
): AccountDeletionRequest {
  return {
    id: 'req-1',
    userId: USER_ID,
    status: DeletionRequestStatus.PENDING_VERIFICATION,
    verificationTokenHash: TOKEN_HASH,
    verificationExpiresAt: new Date(Date.now() + 3_600_000),
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('AccountDeletionService', () => {
  let service: AccountDeletionService;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockAudit.countActions.mockResolvedValue(0);
    mockUserRepo.findOne.mockResolvedValue(makeUser());
    mockUserRepo.save.mockImplementation((u: User) => Promise.resolve(u));

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AccountDeletionService,
        {
          provide: getRepositoryToken(AccountDeletionRequest),
          useValue: mockRequestRepo,
        },
        { provide: getRepositoryToken(User), useValue: mockUserRepo },
        { provide: getRepositoryToken(UserWallet), useValue: mockWalletRepo },
        {
          provide: getRepositoryToken(WalletSession),
          useValue: mockSessionRepo,
        },
        { provide: getRepositoryToken(UserFollow), useValue: mockFollowRepo },
        { provide: getRepositoryToken(Listing), useValue: mockListingRepo },
        { provide: getRepositoryToken(Offer), useValue: mockOfferRepo },
        { provide: GdprAuditService, useValue: mockAudit },
        { provide: EmailService, useValue: mockEmail },
      ],
    }).compile();

    service = module.get(AccountDeletionService);
  });

  describe('requestDeletion', () => {
    it('creates a pending request and emails a verification token', async () => {
      mockRequestRepo.findOne.mockResolvedValueOnce(null);

      const result = await service.requestDeletion(USER_ID, {});

      expect(result.verificationRequired).toBe(true);
      expect(result.status).toBe(DeletionRequestStatus.PENDING_VERIFICATION);
      expect(mockEmail.sendAccountDeletionEmail).toHaveBeenCalledWith(
        'alice@example.com',
        expect.any(String),
        'alice',
      );
      expect(mockAudit.log).toHaveBeenCalledWith(
        GdprAuditAction.ACCOUNT_DELETION_REQUESTED,
        expect.objectContaining({ userId: USER_ID }),
      );
    });

    it('rejects when a request is already active', async () => {
      mockRequestRepo.findOne.mockResolvedValueOnce(makeRequest());
      await expect(service.requestDeletion(USER_ID, {})).rejects.toThrow(
        'already in progress',
      );
    });

    it('enforces the 30-day deletion rate limit', async () => {
      mockRequestRepo.findOne.mockResolvedValueOnce(null);
      mockAudit.countActions.mockResolvedValueOnce(1);
      await expect(service.requestDeletion(USER_ID, {})).rejects.toThrow(
        HttpException,
      );
    });

    it('schedules immediately when a valid token is supplied', async () => {
      mockRequestRepo.findOne.mockResolvedValueOnce(makeRequest());

      const result = await service.requestDeletion(USER_ID, { token: TOKEN });

      expect(result.verificationRequired).toBe(false);
      expect(result.status).toBe(DeletionRequestStatus.SCHEDULED);
    });
  });

  describe('verifyDeletion', () => {
    it('schedules deletion 30 days out', async () => {
      mockRequestRepo.findOne.mockResolvedValueOnce(makeRequest());

      const before = Date.now();
      const result = await service.verifyDeletion(USER_ID, TOKEN);

      expect(result.status).toBe(DeletionRequestStatus.SCHEDULED);
      const scheduled = result.scheduledFor?.getTime() ?? 0;
      const thirtyDays = 30 * 24 * 60 * 60 * 1000;
      expect(scheduled).toBeGreaterThanOrEqual(before + thirtyDays - 5000);
    });

    it('rejects an unknown token', async () => {
      mockRequestRepo.findOne.mockResolvedValueOnce(null);
      await expect(service.verifyDeletion(USER_ID, 'bad')).rejects.toThrow(
        'Invalid or expired',
      );
    });

    it('rejects an expired token', async () => {
      mockRequestRepo.findOne.mockResolvedValueOnce(
        makeRequest({ verificationExpiresAt: new Date(Date.now() - 1000) }),
      );
      await expect(service.verifyDeletion(USER_ID, TOKEN)).rejects.toThrow(
        'Invalid or expired',
      );
    });
  });

  describe('cancelDeletion', () => {
    it('cancels an active request', async () => {
      mockRequestRepo.findOne.mockResolvedValueOnce(
        makeRequest({ status: DeletionRequestStatus.SCHEDULED }),
      );

      const result = await service.cancelDeletion(USER_ID);
      expect(result.status).toBe(DeletionRequestStatus.CANCELLED);
      expect(result.cancelledAt).toBeInstanceOf(Date);
      expect(mockAudit.log).toHaveBeenCalledWith(
        GdprAuditAction.ACCOUNT_DELETION_CANCELLED,
        expect.objectContaining({ userId: USER_ID }),
      );
    });

    it('throws when there is nothing to cancel', async () => {
      mockRequestRepo.findOne.mockResolvedValueOnce(null);
      await expect(service.cancelDeletion(USER_ID)).rejects.toThrow(
        'No active deletion request',
      );
    });
  });

  describe('completeDeletion', () => {
    it('cascades related rows and anonymizes the user', async () => {
      const user = makeUser();
      mockUserRepo.findOne.mockResolvedValueOnce(user);

      const result = await service.completeDeletion(makeRequest());

      expect(mockWalletRepo.delete).toHaveBeenCalledWith({ userId: USER_ID });
      expect(mockSessionRepo.delete).toHaveBeenCalledWith({ userId: USER_ID });
      expect(mockFollowRepo.delete).toHaveBeenCalledWith({
        followerId: USER_ID,
      });
      expect(mockFollowRepo.delete).toHaveBeenCalledWith({
        followingId: USER_ID,
      });
      expect(mockListingRepo.update).toHaveBeenCalledWith(
        { sellerId: USER_ID, status: 'ACTIVE' },
        { status: 'CANCELLED' },
      );
      expect(mockOfferRepo.update).toHaveBeenCalled();

      expect(user.email).toBeNull();
      expect(user.address).toBeNull();
      expect(user.walletAddress).toBeNull();
      expect(user.passwordHash).toBeNull();
      expect(user.twoFactorSecret).toBeNull();
      expect(user.isAnonymized).toBe(true);
      expect(user.username).toContain('deleted_');
      expect(result.status).toBe(DeletionRequestStatus.COMPLETED);
    });
  });

  describe('completeDueDeletions', () => {
    it('processes every scheduled request past its grace period', async () => {
      mockRequestRepo.find.mockResolvedValueOnce([makeRequest()]);
      mockUserRepo.findOne.mockResolvedValueOnce(makeUser());

      const count = await service.completeDueDeletions();

      expect(count).toBe(1);
      expect(mockAudit.log).toHaveBeenCalledWith(
        GdprAuditAction.ACCOUNT_DELETION_COMPLETED,
        expect.objectContaining({ userId: USER_ID }),
      );
    });
  });
});
