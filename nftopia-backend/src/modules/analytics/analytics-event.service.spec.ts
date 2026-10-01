import { Model } from 'mongoose';
import { AnalyticsEventService } from './analytics-event.service';
import {
  AnalyticsEventContext,
  AnalyticsEventDocument,
} from './schemas/analytics-event.schema';

describe('AnalyticsEventService', () => {
  const baseContext: AnalyticsEventContext = {
    timestamp: '2026-01-01T00:00:00.000Z',
    route: '/marketplace',
    locale: 'en',
    sessionId: 'session-abc',
    deviceType: 'desktop',
    appSurface: 'marketplace',
    userId: 'user-1',
  };

  const saveMock = jest.fn();
  const execMock = jest.fn();
  const limitMock = jest.fn();
  const sortMock = jest.fn();
  const findMock = jest.fn();

  // Mongoose models are constructor functions with static query methods —
  // a plain jest.fn() can't represent both, so this stands in for one:
  // `new model(doc)` returns an instance with `.save()`, and
  // `model.find()` is a static method on the same function.
  function ModelMock(
    this: { save: jest.Mock } & Record<string, unknown>,
    doc: Record<string, unknown>,
  ) {
    Object.assign(this, doc);
    this.save = saveMock;
  }
  (ModelMock as unknown as { find: jest.Mock }).find = findMock;

  let service: AnalyticsEventService;

  beforeEach(() => {
    jest.clearAllMocks();
    findMock.mockReturnValue({ sort: sortMock });
    sortMock.mockReturnValue({ limit: limitMock });
    limitMock.mockReturnValue({ exec: execMock });

    service = new AnalyticsEventService(
      ModelMock as unknown as Model<AnalyticsEventDocument>,
    );
  });

  describe('record', () => {
    it('saves a new document with the given eventName, context, and payload', async () => {
      saveMock.mockResolvedValue({ _id: 'doc-1' });

      const result = await service.record({
        eventName: 'wallet_connect_succeeded',
        context: baseContext,
        payload: { provider: 'freighter', latency_ms: 420 },
      });

      expect(saveMock).toHaveBeenCalled();
      expect(result).toEqual({ _id: 'doc-1' });
    });

    it('defaults payload to {} when omitted', async () => {
      saveMock.mockResolvedValue({ _id: 'doc-2' });

      let capturedPayload: unknown;
      saveMock.mockImplementation(function (this: { payload: unknown }) {
        capturedPayload = this.payload;
        return Promise.resolve({ _id: 'doc-2' });
      });

      await service.record({
        eventName: 'auth_login_succeeded',
        context: baseContext,
      });

      expect(capturedPayload).toEqual({});
    });

    it('sets receivedAt server-side rather than trusting any caller-supplied value', async () => {
      let capturedReceivedAt: unknown;
      saveMock.mockImplementation(function (this: { receivedAt: unknown }) {
        capturedReceivedAt = this.receivedAt;
        return Promise.resolve({ _id: 'doc-3' });
      });

      await service.record({
        eventName: 'auth_login_succeeded',
        context: baseContext,
      });

      expect(capturedReceivedAt).toBeInstanceOf(Date);
    });
  });

  describe('findRecentByEventName', () => {
    it('queries by eventName, sorted newest-first', async () => {
      execMock.mockResolvedValue([{ eventName: 'auth_login_succeeded' }]);

      const result = await service.findRecentByEventName(
        'auth_login_succeeded',
      );

      expect(findMock).toHaveBeenCalledWith({
        eventName: 'auth_login_succeeded',
      });
      expect(sortMock).toHaveBeenCalledWith({ receivedAt: -1 });
      expect(result).toEqual([{ eventName: 'auth_login_succeeded' }]);
    });

    it('defaults the limit to 20', async () => {
      execMock.mockResolvedValue([]);

      await service.findRecentByEventName('auth_login_succeeded');

      expect(limitMock).toHaveBeenCalledWith(20);
    });

    it('honors an explicit limit', async () => {
      execMock.mockResolvedValue([]);

      await service.findRecentByEventName('auth_login_succeeded', 5);

      expect(limitMock).toHaveBeenCalledWith(5);
    });
  });
});
