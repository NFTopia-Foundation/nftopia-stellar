import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ContentFlagService } from './content-flag.service';
import {
  AI_AGENT_RAISED_BY,
  AI_AGENT_SYSTEM_ACTOR_ID,
} from './entities/content-flag.entity';
import { AuditAction } from '../../common/audit/audit.service';

describe('ContentFlagService', () => {
  let service: ContentFlagService;

  const qb = {
    andWhere: jest.fn(),
    orderBy: jest.fn(),
    skip: jest.fn(),
    take: jest.fn(),
    getCount: jest.fn(),
    getMany: jest.fn(),
  };

  const contentFlagRepo = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  const auditService = {
    logAdminAction: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    qb.andWhere.mockReturnValue(qb);
    qb.orderBy.mockReturnValue(qb);
    qb.skip.mockReturnValue(qb);
    qb.take.mockReturnValue(qb);
    qb.getCount.mockResolvedValue(0);
    qb.getMany.mockResolvedValue([]);
    contentFlagRepo.createQueryBuilder.mockReturnValue(qb);

    service = new ContentFlagService(
      contentFlagRepo as never,
      auditService as never,
    );
  });

  describe('findExistingFlag', () => {
    it('returns the existing flag for the given entity when one exists', async () => {
      const existing = {
        id: 'flag-1',
        entityType: 'listing',
        entityId: 'listing-1',
      };
      contentFlagRepo.findOne.mockResolvedValue(existing);

      const result = await service.findExistingFlag('listing', 'listing-1');

      expect(contentFlagRepo.findOne).toHaveBeenCalledWith({
        where: { entityType: 'listing', entityId: 'listing-1' },
      });
      expect(result).toEqual(existing);
    });

    it('returns null when no flag exists for the entity', async () => {
      contentFlagRepo.findOne.mockResolvedValue(null);

      const result = await service.findExistingFlag('listing', 'listing-1');

      expect(result).toBeNull();
    });
  });

  describe('createFlag', () => {
    it('persists a flag with the AI agent as raisedBy and pending status', async () => {
      const input = {
        entityType: 'listing' as const,
        entityId: 'listing-1',
        reason: 'Scam indicators',
        severity: 'high' as const,
        confidence: 0.8,
      };
      const created = {
        ...input,
        raisedBy: AI_AGENT_RAISED_BY,
        status: 'pending',
      };
      contentFlagRepo.create.mockReturnValue(created);
      contentFlagRepo.save.mockResolvedValue({ id: 'flag-1', ...created });

      const result = await service.createFlag(input);

      expect(contentFlagRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          ...input,
          raisedBy: AI_AGENT_RAISED_BY,
          status: 'pending',
        }),
      );
      expect(result).toEqual({ id: 'flag-1', ...created });
    });

    it('records the flag creation in the audit log under the system actor', async () => {
      const input = {
        entityType: 'nft' as const,
        entityId: 'nft-1',
        reason: 'IP infringement',
        severity: 'critical' as const,
        confidence: 0.95,
      };
      contentFlagRepo.create.mockReturnValue(input);
      contentFlagRepo.save.mockResolvedValue({ id: 'flag-2', ...input });

      await service.createFlag(input);

      expect(auditService.logAdminAction).toHaveBeenCalledTimes(1);
      const [action, metadata] = auditService.logAdminAction.mock.calls[0] as [
        AuditAction,
        {
          adminId: string;
          entityType: string;
          entityId: string;
          afterState: { flagId: string };
        },
      ];
      expect(action).toBe(AuditAction.FLAG_CONTENT);
      expect(metadata.adminId).toBe(AI_AGENT_SYSTEM_ACTOR_ID);
      expect(metadata.entityType).toBe('nft');
      expect(metadata.entityId).toBe('nft-1');
      expect(metadata.afterState.flagId).toBe('flag-2');
    });
  });

  describe('listFlags', () => {
    it('defaults to no status filter and pagination of 50/0', async () => {
      await service.listFlags({});

      expect(qb.andWhere).not.toHaveBeenCalled();
      expect(qb.skip).toHaveBeenCalledWith(0);
      expect(qb.take).toHaveBeenCalledWith(50);
    });

    it('filters by status when provided', async () => {
      await service.listFlags({ status: 'pending' });

      expect(qb.andWhere).toHaveBeenCalledWith('flag.status = :status', {
        status: 'pending',
      });
    });

    it('returns flags and total count', async () => {
      qb.getCount.mockResolvedValue(3);
      qb.getMany.mockResolvedValue([{ id: 'flag-1' }]);

      const result = await service.listFlags({});

      expect(result).toEqual({ flags: [{ id: 'flag-1' }], total: 3 });
    });
  });

  describe('resolveFlag', () => {
    it('throws NotFoundException when the flag does not exist', async () => {
      contentFlagRepo.findOne.mockResolvedValue(null);

      await expect(
        service.resolveFlag('missing', {
          status: 'reviewed',
          reviewedBy: 'admin-1',
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws BadRequestException when the flag is already resolved', async () => {
      contentFlagRepo.findOne.mockResolvedValue({
        id: 'flag-1',
        status: 'reviewed',
      });

      await expect(
        service.resolveFlag('flag-1', {
          status: 'dismissed',
          reviewedBy: 'admin-1',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('transitions a pending flag to reviewed and records reviewedBy/reviewedAt', async () => {
      const flag = { id: 'flag-1', status: 'pending' };
      contentFlagRepo.findOne.mockResolvedValue(flag);
      contentFlagRepo.save.mockImplementation((f) => Promise.resolve(f));

      const result = await service.resolveFlag('flag-1', {
        status: 'reviewed',
        reviewedBy: 'admin-1',
      });

      expect(result.status).toBe('reviewed');
      expect(result.reviewedBy).toBe('admin-1');
      expect(result.reviewedAt).toBeInstanceOf(Date);
    });

    it('records resolution in the audit log under REVIEW_CONTENT_FLAG', async () => {
      contentFlagRepo.findOne.mockResolvedValue({
        id: 'flag-1',
        status: 'pending',
      });
      contentFlagRepo.save.mockImplementation((f) => Promise.resolve(f));

      await service.resolveFlag('flag-1', {
        status: 'reviewed',
        reviewedBy: 'admin-1',
      });

      expect(auditService.logAdminAction).toHaveBeenCalledWith(
        AuditAction.REVIEW_CONTENT_FLAG,
        expect.objectContaining({ adminId: 'admin-1', entityId: 'flag-1' }),
      );
    });

    it('records resolution in the audit log under DISMISS_CONTENT_FLAG', async () => {
      contentFlagRepo.findOne.mockResolvedValue({
        id: 'flag-1',
        status: 'pending',
      });
      contentFlagRepo.save.mockImplementation((f) => Promise.resolve(f));

      await service.resolveFlag('flag-1', {
        status: 'dismissed',
        reviewedBy: 'admin-1',
      });

      expect(auditService.logAdminAction).toHaveBeenCalledWith(
        AuditAction.DISMISS_CONTENT_FLAG,
        expect.objectContaining({ adminId: 'admin-1', entityId: 'flag-1' }),
      );
    });
  });
});
