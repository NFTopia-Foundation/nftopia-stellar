import { AiPlatformSpendService } from './ai-platform-spend.service';

describe('AiPlatformSpendService', () => {
  it('alerts once while a configured threshold remains crossed', async () => {
    const config = {
      get: jest.fn((key: string) => ({
        AI_PLATFORM_DAILY_SPEND_ALERT_USD: '10',
        AI_PLATFORM_MONTHLY_SPEND_ALERT_USD: undefined,
        AI_PLATFORM_SPEND_ALERT_EMAIL: 'ops@example.com',
      })[key]),
    };
    const usage = { getPlatformSpend: jest.fn().mockResolvedValue([
      { toolSet: 'chat', totalTokens: 1, estimatedCostUsd: 12 },
    ]) };
    const prometheus = { setAiPlatformSpendUsd: jest.fn() };
    const email = { sendAiPlatformSpendAlertEmail: jest.fn().mockResolvedValue(undefined) };
    const service = new AiPlatformSpendService(config as never, usage as never, prometheus as never, email as never);

    await service.checkSpend();
    await service.checkSpend();

    expect(email.sendAiPlatformSpendAlertEmail).toHaveBeenCalledTimes(1);
    expect(prometheus.setAiPlatformSpendUsd).toHaveBeenCalledWith('daily', 'all', 12);
  });
});
