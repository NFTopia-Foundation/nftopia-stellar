import type { ConfigService } from '@nestjs/config';
import type { EmailService } from '../email/email.service';
import { ModerationAlertService } from './moderation-alert.service';

describe('ModerationAlertService (#748)', () => {
  const emailService = { sendModerationExhaustedAlertEmail: jest.fn() };
  let env: Record<string, string | undefined>;
  let service: ModerationAlertService;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date('2026-11-20T00:00:00Z'));
    env = {
      MODERATION_ALERT_EMAIL: 'ops@nftopia.test',
      MODERATION_ALERT_DEBOUNCE_MS: '60000',
    };
    emailService.sendModerationExhaustedAlertEmail.mockResolvedValue(undefined);
    service = new ModerationAlertService(
      { get: (k: string) => env[k] } as unknown as ConfigService,
      emailService as unknown as EmailService,
    );
  });

  afterEach(() => jest.useRealTimers());

  it('sends the first alert immediately', async () => {
    await service.alertExhausted('l1', 'boom');
    expect(emailService.sendModerationExhaustedAlertEmail).toHaveBeenCalledWith(
      'ops@nftopia.test',
      'l1',
      'boom',
      0,
    );
  });

  it('suppresses alerts inside the window and reports the suppressed count in the next one', async () => {
    await service.alertExhausted('l1', 'boom');
    await service.alertExhausted('l2', 'boom');
    await service.alertExhausted('l3', 'boom');
    expect(
      emailService.sendModerationExhaustedAlertEmail,
    ).toHaveBeenCalledTimes(1);

    jest.setSystemTime(Date.now() + 61_000);
    await service.alertExhausted('l4', 'boom');
    expect(
      emailService.sendModerationExhaustedAlertEmail,
    ).toHaveBeenCalledTimes(2);
    expect(
      emailService.sendModerationExhaustedAlertEmail,
    ).toHaveBeenLastCalledWith('ops@nftopia.test', 'l4', 'boom', 2);
  });

  it('does nothing when MODERATION_ALERT_EMAIL is unset', async () => {
    env.MODERATION_ALERT_EMAIL = undefined;
    await service.alertExhausted('l1', 'boom');
    expect(
      emailService.sendModerationExhaustedAlertEmail,
    ).not.toHaveBeenCalled();
  });

  it('never throws when the email send fails', async () => {
    emailService.sendModerationExhaustedAlertEmail.mockRejectedValue(
      new Error('smtp'),
    );
    await expect(service.alertExhausted('l1', 'boom')).resolves.toBeUndefined();
  });
});
