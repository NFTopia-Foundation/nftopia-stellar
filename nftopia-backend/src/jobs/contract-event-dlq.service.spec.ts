import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ContractEventDlqService } from './contract-event-dlq.service';
import { ContractEventDlq, DlqStatus } from './contract-event-dlq.entity';

const makeRecord = (overrides: Partial<ContractEventDlq> = {}): ContractEventDlq =>
  ({
    id: 'dlq-1',
    contractId: 'C1',
    eventType: 'mint',
    attemptCount: 1,
    status: DlqStatus.PENDING,
    firstFailedAt: new Date(),
    lastFailedAt: new Date(),
    nextRetryAt: new Date(),
    ...overrides,
  } as ContractEventDlq);

describe('ContractEventDlqService', () => {
  let service: ContractEventDlqService;
  const mockRepo = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    findOneOrFail: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ContractEventDlqService,
        { provide: getRepositoryToken(ContractEventDlq), useValue: mockRepo },
      ],
    }).compile();
    service = module.get<ContractEventDlqService>(ContractEventDlqService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('enqueue', () => {
    it('creates a DLQ record with PENDING status on failure', async () => {
      const record = makeRecord();
      mockRepo.create.mockReturnValue(record);
      mockRepo.save.mockResolvedValue(record);

      const result = await service.enqueue({ contractId: 'C1', eventType: 'mint' }, new Error('boom'));

      expect(mockRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ status: DlqStatus.PENDING, attemptCount: 1, errorMessage: 'boom' }),
      );
      expect(result.status).toBe(DlqStatus.PENDING);
    });

    it('handles non-Error thrown values', async () => {
      const record = makeRecord();
      mockRepo.create.mockReturnValue(record);
      mockRepo.save.mockResolvedValue(record);

      await expect(service.enqueue({}, 'string error')).resolves.toBeDefined();
      expect(mockRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ errorMessage: 'string error' }),
      );
    });
  });

  describe('recordFailure', () => {
    it('marks record as RETRYING when under max attempts', async () => {
      const record = makeRecord({ attemptCount: 2 });
      const updated = makeRecord({ attemptCount: 3, status: DlqStatus.RETRYING });
      mockRepo.save.mockResolvedValue(updated);

      const result = await service.recordFailure(record, new Error('retry'));
      expect(result.status).toBe(DlqStatus.RETRYING);
    });

    it('marks record as EXHAUSTED after max attempts (5)', async () => {
      const record = makeRecord({ attemptCount: 5 });
      const exhausted = makeRecord({ attemptCount: 6, status: DlqStatus.EXHAUSTED });
      mockRepo.save.mockResolvedValue(exhausted);

      const result = await service.recordFailure(record, new Error('final'));
      expect(result.status).toBe(DlqStatus.EXHAUSTED);
    });
  });

  describe('replay', () => {
    it('marks record as RESOLVED when handler succeeds', async () => {
      const record = makeRecord();
      const resolved = makeRecord({ status: DlqStatus.RESOLVED });
      mockRepo.findOneOrFail.mockResolvedValue(record);
      mockRepo.save.mockResolvedValue(resolved);

      const handler = jest.fn().mockResolvedValue(undefined);
      await service.replay('dlq-1', handler);

      expect(handler).toHaveBeenCalledWith(record);
      expect(mockRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: DlqStatus.RESOLVED }),
      );
    });

    it('calls recordFailure when handler throws', async () => {
      const record = makeRecord();
      mockRepo.findOneOrFail.mockResolvedValue(record);
      const retrying = makeRecord({ status: DlqStatus.RETRYING });
      mockRepo.save.mockResolvedValue(retrying);

      const handler = jest.fn().mockRejectedValue(new Error('handler fail'));
      await service.replay('dlq-1', handler);

      expect(mockRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: DlqStatus.RETRYING }),
      );
    });
  });

  describe('listPending', () => {
    it('returns pending and retrying records', async () => {
      const records = [makeRecord(), makeRecord({ status: DlqStatus.RETRYING })];
      mockRepo.find.mockResolvedValue(records);
      const result = await service.listPending();
      expect(result).toHaveLength(2);
    });
  });
});
