// ── Mocks (must be hoisted before imports) ───────────────────────────────────
const mockShare = jest.fn();
jest.mock('react-native', () => ({
  Share: {
    share: (...args: unknown[]) => mockShare(...args),
    sharedAction: 'sharedAction',
    dismissedAction: 'dismissedAction',
  },
}));

const mockIsAvailableAsync = jest.fn();
jest.mock('expo-sharing', () => ({
  isAvailableAsync: (...args: unknown[]) => mockIsAvailableAsync(...args),
}));

const mockSetStringAsync = jest.fn();
jest.mock('expo-clipboard', () => ({
  setStringAsync: (...args: unknown[]) => mockSetStringAsync(...args),
}));

const mockTrack = jest.fn();
jest.mock('@/src/analytics/analytics.service', () => ({
  analyticsService: { track: (...args: unknown[]) => mockTrack(...args) },
}));
// `@/src/analytics/config` transitively imports `@/src/config`, which pulls
// in `expo-constants` (ESM-only, unparseable under this project's node-based
// jest setup) — mock it directly rather than letting that chain load.
jest.mock('@/src/analytics/config', () => ({
  ANALYTICS_EVENTS: {
    SHARE_INITIATED: 'share_initiated',
    SHARE_COMPLETED: 'share_completed',
    SHARE_CANCELLED: 'share_cancelled',
    SHARE_FAILED: 'share_failed',
  },
}));

const mockErrorLog = jest.fn();
jest.mock('@/src/errors/logger', () => ({
  errorLogger: { log: (...args: unknown[]) => mockErrorLog(...args) },
}));

// ── Imports (after mocks) ─────────────────────────────────────────────────────
import { shareEntity } from '../share.service';

describe('shareEntity', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsAvailableAsync.mockResolvedValue(true);
    mockSetStringAsync.mockResolvedValue(true);
  });

  it('tracks share_initiated before opening the share sheet', async () => {
    mockShare.mockResolvedValue({ action: 'sharedAction', activityType: null });

    await shareEntity('nft', 'nft-1', 'Cosmic Ape #7');

    expect(mockTrack).toHaveBeenCalledWith(
      'share_initiated',
      expect.objectContaining({ entity_type: 'nft', entity_id: 'nft-1' }),
    );
  });

  it('opens the OS share sheet with a title and a message containing the link', async () => {
    mockShare.mockResolvedValue({ action: 'sharedAction', activityType: null });

    await shareEntity('nft', 'nft-1', 'Cosmic Ape #7');

    const [content] = mockShare.mock.calls[0] as [{ title: string; message: string }];
    expect(content.title).toBe('Cosmic Ape #7 on NFTopia');
    expect(content.message).toContain('https://nftopia.io/nft/nft-1');
  });

  it('reports "shared" and tracks share_completed when the user completes the share', async () => {
    mockShare.mockResolvedValue({ action: 'sharedAction', activityType: 'com.apple.UIKit.activity.Message' });

    const result = await shareEntity('collection', 'col-1');

    expect(result).toEqual({
      status: 'shared',
      url: 'https://nftopia.io/collection/col-1',
      activityType: 'com.apple.UIKit.activity.Message',
    });
    expect(mockTrack).toHaveBeenCalledWith(
      'share_completed',
      expect.objectContaining({ method: 'share_sheet' }),
    );
  });

  it('reports "cancelled" without throwing when the user dismisses the share sheet', async () => {
    mockShare.mockResolvedValue({ action: 'dismissedAction' });

    const result = await shareEntity('profile', 'user-1');

    expect(result.status).toBe('cancelled');
    expect(mockTrack).toHaveBeenCalledWith(
      'share_cancelled',
      expect.objectContaining({ entity_type: 'profile', entity_id: 'user-1' }),
    );
  });

  it('falls back to copying the link when the share sheet is unavailable', async () => {
    mockIsAvailableAsync.mockResolvedValue(false);

    const result = await shareEntity('nft', 'nft-2');

    expect(mockShare).not.toHaveBeenCalled();
    expect(mockSetStringAsync).toHaveBeenCalledWith('https://nftopia.io/nft/nft-2');
    expect(result.status).toBe('copied');
  });

  it('falls back to copying the link when Share.share throws, and never rejects', async () => {
    mockShare.mockRejectedValue(new Error('share sheet crashed'));

    const result = await shareEntity('nft', 'nft-3');

    expect(mockErrorLog).toHaveBeenCalled();
    expect(mockTrack).toHaveBeenCalledWith(
      'share_failed',
      expect.objectContaining({ entity_id: 'nft-3' }),
    );
    expect(mockSetStringAsync).toHaveBeenCalledWith('https://nftopia.io/nft/nft-3');
    expect(result.status).toBe('copied');
  });

  it('reports "failed" (without throwing) when both the share sheet and the clipboard fallback fail', async () => {
    mockShare.mockRejectedValue(new Error('share sheet crashed'));
    mockSetStringAsync.mockRejectedValue(new Error('clipboard unavailable'));

    const result = await shareEntity('nft', 'nft-4');

    expect(result.status).toBe('failed');
    expect(result.url).toBe('https://nftopia.io/nft/nft-4');
  });

  it('treats a throwing availability check as available rather than failing the share', async () => {
    mockIsAvailableAsync.mockRejectedValue(new Error('native module missing'));
    mockShare.mockResolvedValue({ action: 'sharedAction', activityType: null });

    const result = await shareEntity('nft', 'nft-5');

    expect(mockShare).toHaveBeenCalled();
    expect(result.status).toBe('shared');
  });
});
