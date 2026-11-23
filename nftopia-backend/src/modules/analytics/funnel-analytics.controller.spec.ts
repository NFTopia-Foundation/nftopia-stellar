import { BadRequestException } from '@nestjs/common';
import { FunnelAnalyticsController } from './funnel-analytics.controller';

describe('FunnelAnalyticsController (#662)', () => {
  const analyticsEventService = { countDistinctSessionsByStage: jest.fn() };
  const controller = new FunnelAnalyticsController(
    analyticsEventService as never,
  );

  beforeEach(() => jest.clearAllMocks());

  it('returns the per-stage session counts for the requested range', async () => {
    analyticsEventService.countDistinctSessionsByStage.mockResolvedValue({
      landing: 100,
      marketplace_browse: 60,
    });

    const result = await controller.getSummary({
      from: '2026-01-01T00:00:00.000Z',
      to: '2026-01-07T23:59:59.999Z',
    });

    expect(
      analyticsEventService.countDistinctSessionsByStage,
    ).toHaveBeenCalledWith(
      'funnel_stage_entered',
      new Date('2026-01-01T00:00:00.000Z'),
      new Date('2026-01-07T23:59:59.999Z'),
    );
    expect(result).toEqual({
      from: '2026-01-01T00:00:00.000Z',
      to: '2026-01-07T23:59:59.999Z',
      sessionsByStage: { landing: 100, marketplace_browse: 60 },
    });
  });

  it('rejects a range where "from" is after "to"', async () => {
    await expect(
      controller.getSummary({
        from: '2026-01-10T00:00:00.000Z',
        to: '2026-01-01T00:00:00.000Z',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects a range longer than 90 days', async () => {
    await expect(
      controller.getSummary({
        from: '2026-01-01T00:00:00.000Z',
        to: '2026-06-01T00:00:00.000Z',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
