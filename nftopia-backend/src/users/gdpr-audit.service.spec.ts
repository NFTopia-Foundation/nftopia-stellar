import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { GdprAuditService } from './gdpr-audit.service';
import { GdprAuditLog } from './entities/gdpr-audit-log.entity';
import { GdprAuditAction } from './gdpr.constants';

const mockRepo = {
  create: jest.fn().mockImplementation((dto: Partial<GdprAuditLog>) => dto),
  save: jest.fn().mockImplementation((e: GdprAuditLog) => Promise.resolve(e)),
  count: jest.fn(),
  find: jest.fn(),
};

describe('GdprAuditService', () => {
  let service: GdprAuditService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GdprAuditService,
        { provide: getRepositoryToken(GdprAuditLog), useValue: mockRepo },
      ],
    }).compile();
    service = module.get(GdprAuditService);
  });

  it('persists an audit entry with the actor and metadata', async () => {
    const saved = await service.log(GdprAuditAction.DATA_EXPORT_REQUESTED, {
      userId: 'user-1',
      entityId: 'user-1',
      metadata: { format: 'json' },
      ipAddress: '127.0.0.1',
    });

    expect(mockRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        action: GdprAuditAction.DATA_EXPORT_REQUESTED,
        userId: 'user-1',
        ipAddress: '127.0.0.1',
      }),
    );
    expect(saved.action).toBe(GdprAuditAction.DATA_EXPORT_REQUESTED);
  });

  it('counts matching actions since a cutoff', async () => {
    mockRepo.count.mockResolvedValueOnce(2);
    const since = new Date(Date.now() - 1000);

    const count = await service.countActions(
      'user-1',
      [GdprAuditAction.DATA_EXPORT_REQUESTED],
      since,
    );

    expect(count).toBe(2);
    expect(mockRepo.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ userId: 'user-1' }) as unknown,
      }),
    );
  });

  it('lists audit entries for a user', async () => {
    mockRepo.find.mockResolvedValueOnce([{ id: 'log-1' }]);
    const logs = await service.findForUser('user-1', 10);
    expect(logs).toHaveLength(1);
    expect(mockRepo.find).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 'user-1' }, take: 10 }),
    );
  });
});
