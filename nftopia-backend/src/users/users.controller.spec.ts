import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { GdprExportService } from './gdpr-export.service';
import { AccountDeletionService } from './account-deletion.service';

const mockUsersService = {
  listWallets: jest.fn(),
  getUserTransactionVolume: jest.fn(),
  findByStellarAddress: jest.fn(),
  findByUsername: jest.fn(),
};
const mockExportService = {
  exportNow: jest.fn(),
  requestAsyncExport: jest.fn(),
  getJob: jest.fn(),
};
const mockDeletionService = {
  requestDeletion: jest.fn(),
  verifyDeletion: jest.fn(),
  cancelDeletion: jest.fn(),
  getStatus: jest.fn(),
};

function makeReq(userId = 'user-1') {
  return { user: { userId }, ip: '127.0.0.1', headers: {} };
}

describe('UsersController (GDPR endpoints)', () => {
  let controller: UsersController;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        { provide: UsersService, useValue: mockUsersService },
        { provide: GdprExportService, useValue: mockExportService },
        { provide: AccountDeletionService, useValue: mockDeletionService },
      ],
    }).compile();

    controller = module.get(UsersController);
  });

  it('streams an export with attachment headers', async () => {
    mockExportService.exportNow.mockResolvedValueOnce({
      contentType: 'application/json; charset=utf-8',
      filename: 'nftopia-export-user-1.json',
      body: '{"ok":true}',
    });
    const res = { setHeader: jest.fn(), send: jest.fn() };

    await controller.exportMyData(makeReq() as never, {}, res as never);

    expect(mockExportService.exportNow).toHaveBeenCalledWith(
      'user-1',
      'json',
      expect.any(Object),
    );
    expect(res.setHeader).toHaveBeenCalledWith(
      'Content-Disposition',
      expect.stringContaining('attachment'),
    );
    expect(res.send).toHaveBeenCalledWith('{"ok":true}');
  });

  it('requires the confirm=true flag to delete an account', async () => {
    await expect(
      controller.deleteMyAccount(makeReq() as never, undefined, {}),
    ).rejects.toThrow(BadRequestException);
    expect(mockDeletionService.requestDeletion).not.toHaveBeenCalled();
  });

  it('delegates account deletion when confirmed', async () => {
    mockDeletionService.requestDeletion.mockResolvedValueOnce({
      status: 'PENDING_VERIFICATION',
      verificationRequired: true,
    });

    const result = await controller.deleteMyAccount(
      makeReq() as never,
      'true',
      { reason: 'leaving' },
    );

    expect(mockDeletionService.requestDeletion).toHaveBeenCalledWith(
      'user-1',
      { token: undefined, reason: 'leaving' },
      expect.any(Object),
    );
    expect(result.data.success).toBe(true);
  });

  it('verifies a deletion token', async () => {
    mockDeletionService.verifyDeletion.mockResolvedValueOnce({
      status: 'SCHEDULED',
    });
    await controller.verifyAccountDeletion(makeReq() as never, {
      token: 'abc',
    });
    expect(mockDeletionService.verifyDeletion).toHaveBeenCalledWith(
      'user-1',
      'abc',
      expect.any(Object),
    );
  });

  it('cancels a deletion request', async () => {
    mockDeletionService.cancelDeletion.mockResolvedValueOnce({
      status: 'CANCELLED',
    });
    await controller.cancelAccountDeletion(makeReq() as never);
    expect(mockDeletionService.cancelDeletion).toHaveBeenCalled();
  });

  it('returns the current deletion status', async () => {
    mockDeletionService.getStatus.mockResolvedValueOnce(null);
    const result = await controller.getAccountDeletionStatus(
      makeReq() as never,
    );
    expect(result.data.data).toBeNull();
  });

  it('hides anonymized users from public profiles', async () => {
    mockUsersService.findByStellarAddress.mockResolvedValueOnce({
      isBanned: false,
      isAnonymized: true,
    });
    await expect(controller.getPublicProfile('GABC')).rejects.toThrow(
      'User not found',
    );
  });
});
