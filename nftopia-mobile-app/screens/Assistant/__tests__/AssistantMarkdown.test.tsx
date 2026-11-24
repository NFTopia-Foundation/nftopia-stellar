import React from 'react';
import { act, create } from 'react-test-renderer';
import { Linking } from 'react-native';
import AssistantScreen, { extractAssistantReferences, isSafeExternalUrl, MessageBubble } from '../AssistantScreen';

const mockAssistantState: any = {
  messages: [], isStreaming: false, error: null, sendMessage: jest.fn(), cancelStream: jest.fn(),
  clearConversation: jest.fn(), usage: null, fetchUsage: jest.fn(), isQuotaExhausted: false,
  rateLimitRetryAt: null, rateLimitRemaining: null,
};

jest.mock('@react-navigation/native', () => ({
  useRoute: () => ({ params: {} }),
  RouteProp: {},
}));

jest.mock('@/stores/assistantStore', () => ({
  useAssistantStore: () => mockAssistantState,
}));

jest.mock('@/src/hooks/useAnalytics', () => ({
  useAnalytics: () => ({ track: jest.fn() }),
}));

describe('Assistant markdown rendering', () => {
  it('renders headings, bullets, bold and code without crashing', () => {
    const item = { id: '1', role: 'assistant' as const, content: '# Title\n- One item\n**Bold** and `code`', createdAt: 1 };
    let renderer!: ReturnType<typeof create>;
    act(() => { renderer = create(<MessageBubble item={item} />); });
    const text = renderer.root.findAll((node) => String(node.type) === 'RNText').map((node) => node.children.join(''));
    expect(text).toContain('Title');
    expect(text).toContain('• One item');
  });

  it('validates external links before opening', () => {
    expect(isSafeExternalUrl('https://nftopia.app/nfts/abc')).toBe(true);
    expect(isSafeExternalUrl('http://nftopia.app')).toBe(true);
    expect(isSafeExternalUrl('javascript:alert(1)')).toBe(false);
  });

  it('detects NFT and listing references', () => {
    const refs = extractAssistantReferences('See NFT ID nft-123456 and /listings/listing-7890.');
    expect(refs).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'nft' }),
      expect.objectContaining({ kind: 'listing' }),
    ]));
  });

  it('renders tappable NFT cards and navigates', () => {
    const navigate = jest.fn();
    const item = { id: '2', role: 'assistant' as const, content: 'NFT ID nft-123456 is available', createdAt: 1 };
    let renderer!: ReturnType<typeof create>;
    act(() => { renderer = create(<MessageBubble item={item} navigation={{ navigate }} />); });
    const card = renderer.root.findAll((node) => String(node.type) === 'RNTouchableOpacity').find((node) =>
      node.props.accessibilityLabel?.startsWith('Open nft'),
    );
    act(() => card?.props.onPress());
    expect(navigate).toHaveBeenCalledWith('NFTDetail', { nftId: 'nft-123456' });
  });

  it('shows a countdown and disables send/input during 429 retry window', () => {
    mockAssistantState.rateLimitRetryAt = Date.now() + 30_000;
    mockAssistantState.rateLimitRemaining = 2;
    let renderer!: ReturnType<typeof create>;
    act(() => { renderer = create(<AssistantScreen navigation={{ goBack: jest.fn() }} />); });
    const text = renderer.root.findAll((node) => String(node.type) === 'RNText').map((node) => node.children.join(''));
    expect(text.join(' ')).toContain('Too many requests');
    const send = renderer.root.findAll((node) => String(node.type) === 'RNTouchableOpacity').find((node) => node.props.accessibilityLabel === 'Send message');
    expect(send?.props.disabled).toBe(true);
    act(() => {
      mockAssistantState.rateLimitRetryAt = null;
      renderer.unmount();
    });
  });

  it('keeps partial streaming markdown stable', () => {
    const item = { id: '3', role: 'assistant' as const, content: '**Partial', createdAt: 1, streaming: true };
    let renderer: ReturnType<typeof create> | undefined;
    expect(() => {
      act(() => { renderer = create(<MessageBubble item={item} />); });
    }).not.toThrow();
  });
});
