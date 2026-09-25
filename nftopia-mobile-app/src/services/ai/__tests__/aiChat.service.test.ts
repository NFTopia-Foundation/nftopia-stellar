/**
 * @jest-environment node
 */
import { sendChatMessage } from '../aiChat.service';

// Mock config + fetch
jest.mock('@/src/config', () => ({
  config: { api: { baseUrl: 'https://api.test' } },
}));
jest.mock('@/lib/api/sample', () => ({
  __esModule: true,
  default: { token: 'test-token' },
}));

describe('aiChat.service', () => {
  beforeEach(() => {
    global.fetch = jest.fn();
  });

  it('sendChatMessage posts message and returns reply + sessionId', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ reply: 'Hello collector', sessionId: 'sess-1' }),
    });

    const result = await sendChatMessage('hi', null);
    expect(result).toEqual({ reply: 'Hello collector', sessionId: 'sess-1' });
    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.test/ai/chat',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ message: 'hi', sessionId: undefined }),
      }),
    );
  });

  it('sendChatMessage throws on non-OK response', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ message: 'Server error' }),
    });
    await expect(sendChatMessage('hi')).rejects.toThrow('Server error');
  });
});
