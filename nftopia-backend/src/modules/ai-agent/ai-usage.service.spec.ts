import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { ForbiddenException } from '@nestjs/common';
import { AiUsageService } from './ai-usage.service';
import { AiUsageRecord } from './entities/ai-usage-record.entity';
import { UserAiCapOverride } from './entities/user-ai-cap-override.entity';

describe('AiUsageService', () => {
  let service: AiUsageService;

  const queryBuilder = {
    select: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    getRawOne: jest.fn(),
  };

  const usageRepo = {
    create: jest.fn((data: Partial<AiUsageRecord>) => data as AiUsageRecord),
    save: jest.fn(),
    createQueryBuilder: jest.fn(() => queryBuilder),
  };

  const overrideRepo = {
    findOne: jest.fn(),
    create: jest.fn(
      (data: Partial<UserAiCapOverride>) => data as UserAiCapOverride,
    ),
    save: jest.fn((data: UserAiCapOverride) => Promise.resolve(data)),
    delete: jest.fn(),
  };

  const config = {
    get: jest.fn(),
  };

  const buildService = async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        AiUsageService,
        { provide: getRepositoryToken(AiUsageRecord), useValue: usageRepo },
        {
          provide: getRepositoryToken(UserAiCapOverride),
          useValue: overrideRepo,
        },
        { provide: ConfigService, useValue: config },
      ],
    }).compile();

    return moduleRef.get(AiUsageService);
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    config.get.mockImplementation((key: string) => {
      if (key === 'AI_CHAT_DAILY_TOKEN_CAP') return 1000;
      if (key === 'AI_CHAT_MONTHLY_TOKEN_CAP') return 10000;
      return undefined;
    });
    usageRepo.save.mockResolvedValue(undefined);
    queryBuilder.getRawOne.mockResolvedValue({
      totalTokens: '0',
      estimatedCostUsd: '0',
    });
    overrideRepo.findOne.mockResolvedValue(null);
    overrideRepo.delete.mockResolvedValue(undefined);

    service = await buildService();
  });

  describe('recordUsage', () => {
    it('saves a record with computed totalTokens and estimatedCostUsd', async () => {
      await service.recordUsage('user-1', 'claude-opus-5', 1_000_000, 0);

      expect(usageRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-1',
          model: 'claude-opus-5',
          inputTokens: 1_000_000,
          outputTokens: 0,
          totalTokens: 1_000_000,
          estimatedCostUsd: '5.000000',
        }),
      );
      expect(usageRepo.save).toHaveBeenCalled();
    });

    it('computes cost from both input and output tokens', async () => {
      await service.recordUsage(
        'user-1',
        'claude-opus-5',
        1_000_000,
        1_000_000,
      );

      const created = usageRepo.create.mock.calls[0][0] as AiUsageRecord;
      // (1M / 1M * $5) + (1M / 1M * $25) = $30
      expect(created.estimatedCostUsd).toBe('30.000000');
      expect(created.totalTokens).toBe(2_000_000);
    });

    it('does not throw when the repository write fails', async () => {
      usageRepo.save.mockRejectedValueOnce(new Error('db down'));

      await expect(
        service.recordUsage('user-1', 'claude-opus-5', 100, 50),
      ).resolves.toBeUndefined();
    });
  });

  describe('assertWithinCap — token cap boundaries', () => {
    it('resolves for a user under both caps', async () => {
      queryBuilder.getRawOne.mockResolvedValue({
        totalTokens: '500',
        estimatedCostUsd: '1',
      });

      await expect(service.assertWithinCap('user-1')).resolves.toBeUndefined();
    });

    it('does not throw for a user exactly one token under the daily cap', async () => {
      queryBuilder.getRawOne
        .mockResolvedValueOnce({ totalTokens: '999', estimatedCostUsd: '4.99' })
        .mockResolvedValueOnce({
          totalTokens: '999',
          estimatedCostUsd: '4.99',
        });

      await expect(service.assertWithinCap('user-1')).resolves.toBeUndefined();
    });

    it('throws once daily usage reaches exactly the daily cap', async () => {
      queryBuilder.getRawOne
        .mockResolvedValueOnce({ totalTokens: '1000', estimatedCostUsd: '5' }) // daily, at cap
        .mockResolvedValueOnce({ totalTokens: '2000', estimatedCostUsd: '10' }); // monthly

      await expect(service.assertWithinCap('user-1')).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });

    it('throws once daily usage goes just over the daily cap', async () => {
      queryBuilder.getRawOne
        .mockResolvedValueOnce({
          totalTokens: '1001',
          estimatedCostUsd: '5.01',
        }) // daily, over cap
        .mockResolvedValueOnce({ totalTokens: '2000', estimatedCostUsd: '10' });

      await expect(service.assertWithinCap('user-1')).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });

    it('throws once monthly usage reaches the monthly cap', async () => {
      queryBuilder.getRawOne
        .mockResolvedValueOnce({ totalTokens: '100', estimatedCostUsd: '0.5' }) // daily, under cap
        .mockResolvedValueOnce({
          totalTokens: '10000',
          estimatedCostUsd: '50',
        }); // monthly, at cap

      await expect(service.assertWithinCap('user-1')).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });

    it('reports a distinct machine-readable code and an ISO resetsAt, not just a 429-style generic error', async () => {
      queryBuilder.getRawOne
        .mockResolvedValueOnce({ totalTokens: '1000', estimatedCostUsd: '5' })
        .mockResolvedValueOnce({ totalTokens: '0', estimatedCostUsd: '0' });

      try {
        await service.assertWithinCap('user-1');
        throw new Error('expected assertWithinCap to throw');
      } catch (error) {
        expect(error).toBeInstanceOf(ForbiddenException);
        const response = (error as ForbiddenException).getResponse() as {
          code: string;
          resetsAt: string;
        };
        expect(response.code).toBe('AI_DAILY_TOKEN_CAP_REACHED');
        expect(new Date(response.resetsAt).getTime()).toBeGreaterThan(
          Date.now(),
        );
      }
    });
  });

  describe('assertWithinCap — USD spend cap', () => {
    beforeEach(() => {
      config.get.mockImplementation((key: string) => {
        if (key === 'AI_CHAT_DAILY_TOKEN_CAP') return 1_000_000; // high enough to not interfere
        if (key === 'AI_CHAT_MONTHLY_TOKEN_CAP') return 10_000_000;
        if (key === 'AI_CHAT_DAILY_SPEND_CAP_USD') return 5;
        if (key === 'AI_CHAT_MONTHLY_SPEND_CAP_USD') return 50;
        return undefined;
      });
    });

    it('is not enforced when no spend cap env vars are configured', async () => {
      config.get.mockImplementation((key: string) => {
        if (key === 'AI_CHAT_DAILY_TOKEN_CAP') return 1_000_000;
        if (key === 'AI_CHAT_MONTHLY_TOKEN_CAP') return 10_000_000;
        return undefined; // no spend caps
      });
      const noSpendCapService = await buildService();
      queryBuilder.getRawOne.mockResolvedValue({
        totalTokens: '100',
        estimatedCostUsd: '99999', // would be way over any reasonable spend cap
      });

      await expect(
        noSpendCapService.assertWithinCap('user-1'),
      ).resolves.toBeUndefined();
    });

    it('throws once daily spend reaches the configured USD cap', async () => {
      const spendCapService = await buildService();
      queryBuilder.getRawOne
        .mockResolvedValueOnce({ totalTokens: '100', estimatedCostUsd: '5' }) // daily, at $5 cap
        .mockResolvedValueOnce({ totalTokens: '100', estimatedCostUsd: '5' });

      const error: unknown = await spendCapService
        .assertWithinCap('user-1')
        .catch((e: unknown) => e);

      expect(error).toBeInstanceOf(ForbiddenException);
      expect(
        (error as ForbiddenException).getResponse() as { code: string },
      ).toMatchObject({ code: 'AI_DAILY_SPEND_CAP_REACHED' });
    });

    it('does not throw for spend just under the cap', async () => {
      const spendCapService = await buildService();
      queryBuilder.getRawOne.mockResolvedValue({
        totalTokens: '100',
        estimatedCostUsd: '4.999999',
      });

      await expect(
        spendCapService.assertWithinCap('user-1'),
      ).resolves.toBeUndefined();
    });
  });

  describe('assertWithinCap — admin override', () => {
    it('uses the override cap instead of the env default when one is active', async () => {
      overrideRepo.findOne.mockResolvedValue({
        userId: 'user-1',
        dailyTokenCap: 5000,
        monthlyTokenCap: null,
        dailySpendCapUsd: null,
        monthlySpendCapUsd: null,
        expiresAt: null,
      });
      // Would exceed the env default (1000) but not the override (5000).
      queryBuilder.getRawOne.mockResolvedValue({
        totalTokens: '2000',
        estimatedCostUsd: '10',
      });

      await expect(service.assertWithinCap('user-1')).resolves.toBeUndefined();
    });

    it('ignores an expired override and falls back to the env default cap', async () => {
      overrideRepo.findOne.mockResolvedValue({
        userId: 'user-1',
        dailyTokenCap: 5000,
        monthlyTokenCap: null,
        dailySpendCapUsd: null,
        monthlySpendCapUsd: null,
        expiresAt: new Date(Date.now() - 60_000), // expired a minute ago
      });
      queryBuilder.getRawOne
        .mockResolvedValueOnce({ totalTokens: '1000', estimatedCostUsd: '5' }) // daily, at the env default cap
        .mockResolvedValueOnce({ totalTokens: '0', estimatedCostUsd: '0' });

      await expect(service.assertWithinCap('user-1')).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });
  });

  describe('getUsageSummary', () => {
    it('returns totals, caps, remaining allowance, and reset time for both windows', async () => {
      queryBuilder.getRawOne
        .mockResolvedValueOnce({ totalTokens: '300', estimatedCostUsd: '1.5' }) // daily
        .mockResolvedValueOnce({ totalTokens: '4000', estimatedCostUsd: '20' }); // monthly

      const summary = await service.getUsageSummary('user-1');

      expect(summary.daily).toMatchObject({
        totalTokens: 300,
        estimatedCostUsd: 1.5,
        cap: 1000,
        remaining: 700,
        spendCapUsd: null,
        spendRemaining: null,
        percentUsed: 30,
        approachingCap: false,
      });
      expect(new Date(summary.daily.resetsAt).getTime()).toBeGreaterThan(
        Date.now(),
      );

      expect(summary.monthly).toMatchObject({
        totalTokens: 4000,
        estimatedCostUsd: 20,
        cap: 10000,
        remaining: 6000,
        percentUsed: 40,
      });
      expect(summary.hasOverride).toBe(false);
    });

    it('clamps remaining to zero and percentUsed to 100 when usage exceeds the cap', async () => {
      queryBuilder.getRawOne.mockResolvedValue({
        totalTokens: '5000',
        estimatedCostUsd: '25',
      });

      const summary = await service.getUsageSummary('user-1');

      expect(summary.daily.remaining).toBe(0);
      expect(summary.daily.percentUsed).toBe(100);
    });

    it('flags approachingCap once usage crosses the warning threshold but has not reached the cap', async () => {
      config.get.mockImplementation((key: string) => {
        if (key === 'AI_CHAT_DAILY_TOKEN_CAP') return 1000;
        if (key === 'AI_CHAT_MONTHLY_TOKEN_CAP') return 10000;
        if (key === 'AI_CHAT_CAP_WARNING_THRESHOLD') return 0.8;
        return undefined;
      });
      const thresholdService = await buildService();
      queryBuilder.getRawOne.mockResolvedValue({
        totalTokens: '850', // 85% of 1000
        estimatedCostUsd: '4',
      });

      const summary = await thresholdService.getUsageSummary('user-1');

      expect(summary.daily.approachingCap).toBe(true);
    });

    it('does not flag approachingCap well under the threshold', async () => {
      queryBuilder.getRawOne.mockResolvedValue({
        totalTokens: '100', // 10% of 1000
        estimatedCostUsd: '0.5',
      });

      const summary = await service.getUsageSummary('user-1');

      expect(summary.daily.approachingCap).toBe(false);
    });

    it('reflects an active override in hasOverride and the reported cap', async () => {
      overrideRepo.findOne.mockResolvedValue({
        userId: 'user-1',
        dailyTokenCap: 50_000,
        monthlyTokenCap: null,
        dailySpendCapUsd: null,
        monthlySpendCapUsd: null,
        expiresAt: null,
      });
      queryBuilder.getRawOne.mockResolvedValue({
        totalTokens: '100',
        estimatedCostUsd: '0.5',
      });

      const summary = await service.getUsageSummary('user-1');

      expect(summary.hasOverride).toBe(true);
      expect(summary.daily.cap).toBe(50_000);
    });
  });

  describe('cap override management', () => {
    it('setCapOverride persists the given fields and defaults the rest to null', async () => {
      await service.setCapOverride('user-1', {
        dailyTokenCap: 50_000,
        reason: 'Verified power user',
        grantedBy: 'admin-1',
      });

      expect(overrideRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-1',
          dailyTokenCap: 50_000,
          monthlyTokenCap: null,
          dailySpendCapUsd: null,
          reason: 'Verified power user',
          grantedBy: 'admin-1',
        }),
      );
    });

    it('setCapOverride formats USD fields to 6 decimal places', async () => {
      await service.setCapOverride('user-1', { dailySpendCapUsd: 10 });

      expect(overrideRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ dailySpendCapUsd: '10.000000' }),
      );
    });

    it('clearCapOverride deletes the override row', async () => {
      await service.clearCapOverride('user-1');

      expect(overrideRepo.delete).toHaveBeenCalledWith({ userId: 'user-1' });
    });

    it('getCapOverride returns null when no override exists', async () => {
      overrideRepo.findOne.mockResolvedValue(null);

      await expect(service.getCapOverride('user-1')).resolves.toBeNull();
    });

    it('getCapOverride returns null for an expired override', async () => {
      overrideRepo.findOne.mockResolvedValue({
        userId: 'user-1',
        expiresAt: new Date(Date.now() - 1000),
      });

      await expect(service.getCapOverride('user-1')).resolves.toBeNull();
    });
  });

  describe('default caps', () => {
    it('falls back to sane defaults when env vars are not configured', async () => {
      config.get.mockReturnValue(undefined);
      const defaultService = await buildService();

      queryBuilder.getRawOne.mockResolvedValue({
        totalTokens: '0',
        estimatedCostUsd: '0',
      });

      const summary = await defaultService.getUsageSummary('user-1');

      expect(summary.daily.cap).toBe(200_000);
      expect(summary.monthly.cap).toBe(2_000_000);
      expect(summary.daily.spendCapUsd).toBeNull();
    });
  });
});
