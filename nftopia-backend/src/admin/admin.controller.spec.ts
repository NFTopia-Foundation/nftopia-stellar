import { AdminController } from './admin.controller';

describe('AdminController', () => {
  let controller: AdminController;

  const adminService = {
    listUsers: jest.fn(),
    getUserDetails: jest.fn(),
    banUser: jest.fn(),
    unbanUser: jest.fn(),
    hideCollection: jest.fn(),
    verifyCollection: jest.fn(),
    listAuditLogs: jest.fn(),
  };

  const user = { userId: 'admin-1', username: 'superadmin' };
  const req = {
    ip: '127.0.0.1',
    get: jest.fn().mockReturnValue('jest-agent'),
  } as never;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new AdminController(adminService as never);
  });

  describe('listUsers', () => {
    it('calls adminService.listUsers with the query DTO', async () => {
      const mockResult = { users: [{ id: 'user-1', username: 'alice' }], total: 1 };
      adminService.listUsers.mockResolvedValue(mockResult);

      const query = { search: 'alice', status: 'active' as const, limit: 10, offset: 0 };
      const result = await controller.listUsers(query);

      expect(adminService.listUsers).toHaveBeenCalledWith(query);
      expect(result).toEqual(mockResult);
    });
  });

  describe('listAuditLogs', () => {
    it('delegates paging and filters to AdminService', async () => {
      const query = { adminId: '11111111-1111-1111-1111-111111111111', action: 'BAN_USER', limit: 50, offset: 0 };
      const result = { logs: [], total: 0, limit: 50, offset: 0 };
      adminService.listAuditLogs.mockResolvedValue(result);
      await expect(controller.listAuditLogs(query)).resolves.toEqual(result);
      expect(adminService.listAuditLogs).toHaveBeenCalledWith(query);
    });
  });

  describe('getUserDetails', () => {
    it('calls adminService.getUserDetails with user id', async () => {
      const mockDetails = {
        user: { id: 'user-1', username: 'alice' },
        wallets: [],
        activitySummary: { collectionsCount: 2, nftsOwned: 5, nftsCreated: 2 },
        auditTrail: [],
      };
      adminService.getUserDetails.mockResolvedValue(mockDetails);

      const result = await controller.getUserDetails('user-1');

      expect(adminService.getUserDetails).toHaveBeenCalledWith('user-1');
      expect(result).toEqual(mockDetails);
    });
  });

  describe('banUser', () => {
    it('passes userId, reason, ip and userAgent to adminService.banUser', async () => {
      adminService.banUser.mockResolvedValue({ id: 'user-1', isBanned: true });

      const result = await controller.banUser(
        'user-1',
        { reason: 'Violated Terms of Service' },
        user,
        req,
      );

      expect(adminService.banUser).toHaveBeenCalledWith(
        'admin-1',
        'user-1',
        'Violated Terms of Service',
        '127.0.0.1',
        'jest-agent',
      );
      expect(result).toEqual({ id: 'user-1', isBanned: true });
    });
  });

  describe('unbanUser', () => {
    it('calls adminService.unbanUser with adminId, userId, ip and userAgent', async () => {
      adminService.unbanUser.mockResolvedValue({ id: 'user-1', isBanned: false });

      const result = await controller.unbanUser('user-1', user, req);

      expect(adminService.unbanUser).toHaveBeenCalledWith(
        'admin-1',
        'user-1',
        '127.0.0.1',
        'jest-agent',
      );
      expect(result).toEqual({ id: 'user-1', isBanned: false });
    });
  });
});
