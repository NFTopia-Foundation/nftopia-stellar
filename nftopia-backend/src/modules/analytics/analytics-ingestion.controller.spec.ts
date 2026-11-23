import { AnalyticsIngestionController } from './analytics-ingestion.controller';
import { RecordEventDto } from './dto/record-event.dto';

describe('AnalyticsIngestionController (#662)', () => {
  const analyticsEventService = { record: jest.fn() };
  const controller = new AnalyticsIngestionController(
    analyticsEventService as never,
  );

  beforeEach(() => jest.clearAllMocks());

  it('records the event, mapping the snake_case wire context onto the camelCase schema fields', async () => {
    const dto: RecordEventDto = {
      eventName: 'funnel_stage_entered',
      context: {
        timestamp: '2026-01-01T00:00:00.000Z',
        route: '/marketplace',
        locale: 'en',
        session_id: 'session-abc',
        device_type: 'desktop',
        app_surface: 'marketplace',
        anonymous_id: 'anon-1',
        user_id: 'user-1',
        referrer_route: '/',
      },
      payload: { stage: 'marketplace_browse' },
    };

    const result = await controller.record(dto);

    expect(analyticsEventService.record).toHaveBeenCalledWith({
      eventName: dto.eventName,
      context: {
        timestamp: '2026-01-01T00:00:00.000Z',
        route: '/marketplace',
        locale: 'en',
        sessionId: 'session-abc',
        deviceType: 'desktop',
        appSurface: 'marketplace',
        anonymousId: 'anon-1',
        userId: 'user-1',
        referrerRoute: '/',
      },
      payload: dto.payload,
    });
    expect(result).toEqual({ success: true });
  });
});
