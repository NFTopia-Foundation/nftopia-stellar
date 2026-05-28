import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  ContractEventIndexerJob,
  LAST_CONTRACT_EVENT_LEDGER_KEY,
} from './contract-event-indexer.job';
import { SystemSettings } from './system-settings.entity';
import { MarketplaceSettlementClient } from '../modules/stellar/marketplace-settlement.client';

describe('ContractEventIndexerJob', () => {
  let job: ContractEventIndexerJob;
  let settingsRepo: jest.Mocked<
    Pick<Repository<SystemSettings>, 'findOne' | 'save'>
  >;
  let settlementClient: { getEventsSince: jest.Mock };

  beforeEach(async () => {
    settingsRepo = {
      findOne: jest.fn(),
      save: jest.fn(),
    };

    settlementClient = {
      getEventsSince: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ContractEventIndexerJob,
        {
          provide: getRepositoryToken(SystemSettings),
          useValue: settingsRepo,
        },
        {
          provide: MarketplaceSettlementClient,
          useValue: settlementClient,
        },
      ],
    }).compile();

    job = module.get<ContractEventIndexerJob>(ContractEventIndexerJob);
  });

  // loadCursor

  describe('loadCursor', () => {
    it('should return 0 when no cursor is stored', async () => {
      settingsRepo.findOne.mockResolvedValue(null);

      const result = await job.loadCursor();

      expect(result).toBe(0);
      expect(settingsRepo.findOne).toHaveBeenCalledWith({
        where: { key: LAST_CONTRACT_EVENT_LEDGER_KEY },
      });
    });

    it('should return the stored ledger value', async () => {
      settingsRepo.findOne.mockResolvedValue({
        key: LAST_CONTRACT_EVENT_LEDGER_KEY,
        value: '42',
      });

      const result = await job.loadCursor();

      expect(result).toBe(42);
    });
  });

  // advanceCursor — monotonic guard

  describe('advanceCursor', () => {
    it('should save when newLedger > current', async () => {
      settingsRepo.findOne.mockResolvedValue({
        key: LAST_CONTRACT_EVENT_LEDGER_KEY,
        value: '10',
      });

      await job.advanceCursor(20);

      expect(settingsRepo.save).toHaveBeenCalledWith({
        key: LAST_CONTRACT_EVENT_LEDGER_KEY,
        value: '20',
      });
    });

    it('should NOT save when newLedger === current', async () => {
      settingsRepo.findOne.mockResolvedValue({
        key: LAST_CONTRACT_EVENT_LEDGER_KEY,
        value: '10',
      });

      await job.advanceCursor(10);

      expect(settingsRepo.save).not.toHaveBeenCalled();
    });

    it('should NOT save when newLedger < current', async () => {
      settingsRepo.findOne.mockResolvedValue({
        key: LAST_CONTRACT_EVENT_LEDGER_KEY,
        value: '10',
      });

      await job.advanceCursor(5);

      expect(settingsRepo.save).not.toHaveBeenCalled();
    });

    it('should save when no cursor exists yet (current = 0) and newLedger > 0', async () => {
      settingsRepo.findOne.mockResolvedValue(null);

      await job.advanceCursor(1);

      expect(settingsRepo.save).toHaveBeenCalledWith({
        key: LAST_CONTRACT_EVENT_LEDGER_KEY,
        value: '1',
      });
    });
  });

  // handleIndexing — full flow

  describe('handleIndexing', () => {
    it('should bootstrap from 0, fetch events, and advance cursor', async () => {
      // No cursor in DB
      settingsRepo.findOne.mockResolvedValue(null);
      settlementClient.getEventsSince.mockResolvedValue({
        events: [],
        latestLedger: 100,
      });

      await job.handleIndexing();

      expect(settlementClient.getEventsSince).toHaveBeenCalledWith(0);
      // advanceCursor calls loadCursor again, then saves
      expect(settingsRepo.save).toHaveBeenCalledWith({
        key: LAST_CONTRACT_EVENT_LEDGER_KEY,
        value: '100',
      });
    });

    it('should resume from stored cursor', async () => {
      settingsRepo.findOne.mockResolvedValue({
        key: LAST_CONTRACT_EVENT_LEDGER_KEY,
        value: '50',
      });
      settlementClient.getEventsSince.mockResolvedValue({
        events: [{ type: 'bid' }],
        latestLedger: 75,
      });

      await job.handleIndexing();

      expect(settlementClient.getEventsSince).toHaveBeenCalledWith(50);
      expect(settingsRepo.save).toHaveBeenCalledWith({
        key: LAST_CONTRACT_EVENT_LEDGER_KEY,
        value: '75',
      });
    });

    it('should NOT advance cursor when event fetching fails', async () => {
      settingsRepo.findOne.mockResolvedValue(null);
      settlementClient.getEventsSince.mockRejectedValue(
        new Error('RPC timeout'),
      );

      await job.handleIndexing();

      expect(settingsRepo.save).not.toHaveBeenCalled();
    });

    it('should NOT advance cursor when latestLedger <= current', async () => {
      settingsRepo.findOne.mockResolvedValue({
        key: LAST_CONTRACT_EVENT_LEDGER_KEY,
        value: '100',
      });
      settlementClient.getEventsSince.mockResolvedValue({
        events: [],
        latestLedger: 100,
      });

      await job.handleIndexing();

      expect(settingsRepo.save).not.toHaveBeenCalled();
    });
  });
});
