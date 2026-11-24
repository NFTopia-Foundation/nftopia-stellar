import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  AccessibilityInfo,
  Linking,
  AppState,
} from 'react-native';
import { useRoute, RouteProp } from '@react-navigation/native';
import { MainStackParamList } from '@/navigation/MainNavigator';
import { useAssistantStore, ChatMessage } from '@/stores/assistantStore';
import type { AIUsage } from '@/stores/assistantStore';
import { useAnalytics } from '@/src/hooks/useAnalytics';

export interface StructuredAssistantReference {
  kind: 'nft' | 'listing';
  id: string;
}

export function isSafeExternalUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

export function extractAssistantReferences(content: string): StructuredAssistantReference[] {
  const matches = new Map<string, StructuredAssistantReference>();
  const patterns: Array<[RegExp, 'nft' | 'listing']> = [
    [/\bNFT(?:\s+ID)?[:/# ]+([a-zA-Z0-9_-]{6,})/gi, 'nft'],
    [/\/nfts\/([a-zA-Z0-Z_-]{6,})/gi, 'nft'],
    [/\bListing(?:\s+ID)?[:/# ]+([a-zA-Z0-9_-]{6,})/gi, 'listing'],
    [/\/listings\/([a-zA-Z0-9_-]{6,})/gi, 'listing'],
  ];
  for (const [pattern, kind] of patterns) {
    for (const match of content.matchAll(pattern)) {
      const id = match[1];
      matches.set(`${kind}:${id}`, { kind, id });
    }
  }
  return [...matches.values()].slice(0, 5);
}

function AssistantLink({ href, children }: { href: string; children: React.ReactNode }) {
  const open = () => {
    if (isSafeExternalUrl(href)) void Linking.openURL(href);
  };
  return (
    <Text style={styles.inlineLink} onPress={open} accessibilityRole="link">
      {children}
    </Text>
  );
}

function MarkdownAssistantText({ content, streaming }: { content: string; streaming: boolean }) {
  const lines = content.split('\n');
  return (
    <View>
      {lines.map((line, index) => {
        const heading = line.match(/^#{1,3}\s+(.*)$/);
        if (heading) return <Text key={index} style={styles.markdownHeading}>{heading[1]}</Text>;
        const bullet = line.match(/^[-*]\s+(.*)$/);
        if (bullet) return <Text key={index} style={styles.markdownBullet}>• {bullet[1]}</Text>;
        const link = line.match(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/);
        if (link) {
          const [before, after] = line.split(link[0]);
          return (
            <Text key={index} style={styles.bubbleText}>
              {before}
              <AssistantLink href={link[2]}>{link[1]}</AssistantLink>
              {after}
            </Text>
          );
        }
        const code = line.match(/`([^`]+)`/);
        if (code) {
          const [before, after] = line.split(code[0]);
          return <Text key={index} style={styles.bubbleText}>{before}<Text style={styles.inlineCode}>{code[1]}</Text>{after}</Text>;
        }
        const bold = line.match(/\*\*([^*]+)\*\*/);
        if (bold) {
          const [before, after] = line.split(bold[0]);
          return <Text key={index} style={styles.bubbleText}>{before}<Text style={styles.boldText}>{bold[1]}</Text>{after}</Text>;
        }
        return <Text key={index} style={styles.bubbleText}>{line || (streaming && index === lines.length - 1 ? '…' : ' ')}</Text>;
      })}
    </View>
  );
}

export function MessageBubble({ item, navigation }: { item: ChatMessage; navigation?: any }) {
  const isUser = item.role === 'user';
  return (
    <View
      style={[styles.bubble, isUser ? styles.userBubble : styles.assistantBubble]}
      accessibilityRole="text"
      accessibilityLabel={`${isUser ? 'You' : 'Assistant'}: ${item.content}${
        item.streaming ? ' (typing)' : ''
      }`}
    >
      {isUser ? (
        <Text style={[styles.bubbleText, styles.userBubbleText]}>{item.content}</Text>
      ) : (
        <>
          <MarkdownAssistantText content={item.content || (item.streaming ? '' : ' ')} streaming={item.streaming === true} />
          {extractAssistantReferences(item.content).map((reference) => (
            <TouchableOpacity
              key={`${reference.kind}:${reference.id}`}
              style={styles.referenceCard}
              onPress={() => {
                if (reference.kind === 'nft') navigation?.navigate('NFTDetail', { nftId: reference.id });
              }}
              accessibilityRole="button"
              accessibilityLabel={`Open ${reference.kind} ${reference.id}`}
            >
              <Text style={styles.referenceKind}>{reference.kind.toUpperCase()}</Text>
              <Text style={styles.referenceId} numberOfLines={1}>{reference.id}</Text>
            </TouchableOpacity>
          ))}
        </>
      )}
      {item.streaming && !item.content ? (
        <ActivityIndicator size="small" color="#6C5CE7" style={{ marginTop: 4 }} />
      ) : null}
    </View>
  );
}

function QuotaIndicator({ usage }: { usage: AIUsage | null }) {
  if (!usage) return null;

  const dailyPercent = usage.daily.percentUsed;
  const monthlyPercent = usage.monthly.percentUsed;
  const isNearLimit = usage.daily.approachingCap || usage.monthly.approachingCap;
  const isExhausted = usage.daily.remaining === 0 || usage.monthly.remaining === 0;

  return (
    <View
      style={[
        styles.quotaContainer,
        isExhausted && styles.quotaExhausted,
        isNearLimit && !isExhausted && styles.quotaWarning,
      ]}
      accessibilityRole="text"
      accessibilityLabel={`Daily quota: ${dailyPercent}% used, Monthly quota: ${monthlyPercent}% used`}
    >
      <Text style={[styles.quotaText, isExhausted && styles.quotaTextExhausted]}>
        {isExhausted
          ? 'Quota exhausted'
          : isNearLimit
          ? 'Quota low'
          : 'Quota'}
        : {dailyPercent}% daily, {monthlyPercent}% monthly
      </Text>
    </View>
  );
}

export default function AssistantScreen({ navigation }: any) {
  const route = useRoute<RouteProp<MainStackParamList, 'Assistant'>>();
  const { track } = useAnalytics();
  const {
    messages,
    isStreaming,
    error,
    sendMessage,
    cancelStream,
    clearConversation,
    usage,
    fetchUsage,
    fetchHealth,
    health,
    isQuotaExhausted,
    rateLimitRetryAt,
    rateLimitRemaining,
  } = useAssistantStore();
  const [input, setInput] = useState('');
  const [now, setNow] = useState(Date.now());
  const listRef = useRef<FlatList>(null);

  useEffect(() => {
    if (!rateLimitRetryAt) return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [rateLimitRetryAt]);

  const retrySeconds = rateLimitRetryAt ? Math.max(0, Math.ceil((rateLimitRetryAt - now) / 1000)) : 0;
  const isRateLimited = retrySeconds > 0;

  const lastHealthCheck = useRef(0);
  const checkHealthThrottled = () => {
    const now = Date.now();
    if (now - lastHealthCheck.current < 30_000) return;
    lastHealthCheck.current = now;
    void fetchHealth();
  };

  useEffect(() => {
    track('ai_chat_opened');
  }, [track]);

  // Fetch usage and availability on mount.
  useEffect(() => {
    fetchUsage();
    checkHealthThrottled();
  }, [fetchUsage, fetchHealth]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') checkHealthThrottled();
    });
    return () => subscription.remove();
  }, [fetchHealth]);

  // Context-aware initialization for future use
  useEffect(() => {
    if (route.params?.context) {
      // Future: could initialize the conversation with context-aware prompt
      // e.g., "I'm browsing the marketplace with category X and filters Y. How can I help?"
    }
  }, [route.params?.context]);

  useEffect(() => {
    return () => {
      // Cancel in-flight stream when leaving the screen (#544)
      cancelStream();
    };
  }, [cancelStream]);

  useEffect(() => {
    if (messages.length === 0) return;
    const last = messages[messages.length - 1];
    if (last.role === 'assistant' && last.content && !last.streaming) {
      AccessibilityInfo.announceForAccessibility(`Assistant replied: ${last.content.slice(0, 120)}`);
    }
    listRef.current?.scrollToEnd({ animated: true });
  }, [messages]);

  const onSend = () => {
    const text = input.trim();
    if (!text) return;
    if (isQuotaExhausted || isRateLimited || health === 'down' || health === 'unconfigured') {
      return;
    }
    setInput('');
    void sendMessage(text);
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={80}
    >
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Text style={styles.back}>←</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.title} accessibilityRole="header">
            AI Assistant
          </Text>
          <QuotaIndicator usage={usage} />
        </View>
        <TouchableOpacity
          onPress={clearConversation}
          accessibilityRole="button"
          accessibilityLabel="Clear conversation"
        >
          <Text style={styles.clear}>Clear</Text>
        </TouchableOpacity>
      </View>

      {health === 'down' || health === 'unconfigured' ? (
        <Text style={styles.healthBanner} accessibilityRole="alert">
          {health === 'unconfigured' ? 'AI assistant is not configured.' : 'AI assistant is temporarily unavailable.'}
        </Text>
      ) : null}

      {messages.length === 0 ? (
        <View style={styles.empty} accessibilityRole="text">
          <Text style={styles.emptyTitle}>Marketplace assistant</Text>
          <Text style={styles.emptyBody}>
            Ask about listings, auctions, collections, or how to mint on Stellar.
          </Text>
        </View>
      ) : (
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(m) => m.id}
          renderItem={({ item }) => <MessageBubble item={item} navigation={navigation} />}
          contentContainerStyle={styles.list}
          accessibilityLabel="Chat messages"
        />
      )}

      {isRateLimited ? (
        <Text style={styles.rateLimitBanner} accessibilityRole="alert" accessibilityLiveRegion="polite">
          {`Too many requests. Try again in ${retrySeconds}s.`}{rateLimitRemaining !== null && rateLimitRemaining <= 3 ? ` ${rateLimitRemaining} requests remaining.` : ''}
        </Text>
      ) : null}

      {error ? (
        <Text style={styles.error} accessibilityRole="alert">
          {error}
        </Text>
      ) : null}

      {isStreaming ? (
        <Text style={styles.streamingHint} accessibilityLiveRegion="polite">
          Assistant is typing…
        </Text>
      ) : null}

      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          value={input}
          onChangeText={setInput}
          placeholder="Ask anything…"
          placeholderTextColor="#888"
          editable={!isStreaming && !isRateLimited}
          onSubmitEditing={onSend}
          returnKeyType="send"
          accessibilityLabel="Message input"
        />
        <TouchableOpacity
          style={[
            styles.sendBtn,
            (!input.trim() || isStreaming || isQuotaExhausted || isRateLimited || health === 'down' || health === 'unconfigured') &&
              styles.sendDisabled,
          ]}
          onPress={onSend}
          disabled={
            !input.trim() || isStreaming || isQuotaExhausted || isRateLimited || health === 'down' || health === 'unconfigured'
          }
          accessibilityRole="button"
          accessibilityLabel="Send message"
        >
          <Text style={styles.sendText}>Send</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f14' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 56,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#2a2a35',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  back: { color: '#6C5CE7', fontSize: 22, width: 40 },
  title: { color: '#fff', fontSize: 17, fontWeight: '600' },
  clear: { color: '#aaa', fontSize: 14 },
  quotaContainer: {
    marginTop: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    backgroundColor: '#1e1e28',
  },
  quotaWarning: {
    backgroundColor: '#ffa5001a',
    borderWidth: 1,
    borderColor: '#ffa500',
  },
  quotaExhausted: {
    backgroundColor: '#ff6b6b1a',
    borderWidth: 1,
    borderColor: '#ff6b6b',
  },
  quotaText: {
    color: '#999',
    fontSize: 11,
  },
  quotaTextExhausted: {
    color: '#ff6b6b',
  },
  empty: { flex: 1, justifyContent: 'center', padding: 32 },
  emptyTitle: { color: '#fff', fontSize: 20, fontWeight: '700', marginBottom: 8, textAlign: 'center' },
  emptyBody: { color: '#999', fontSize: 15, textAlign: 'center', lineHeight: 22 },
  list: { padding: 16, paddingBottom: 24 },
  bubble: {
    maxWidth: '85%',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 10,
  },
  userBubble: { alignSelf: 'flex-end', backgroundColor: '#6C5CE7' },
  assistantBubble: { alignSelf: 'flex-start', backgroundColor: '#1e1e28' },
  bubbleText: { color: '#e8e8ef', fontSize: 15, lineHeight: 21 },
  markdownHeading: { color: '#fff', fontSize: 17, fontWeight: '700', marginVertical: 4 },
  markdownBullet: { color: '#e8e8ef', fontSize: 15, lineHeight: 21, marginVertical: 1 },
  inlineLink: { color: '#8ea4ff', textDecorationLine: 'underline' },
  inlineCode: { color: '#ffd866', fontFamily: 'monospace', backgroundColor: '#272733' },
  boldText: { color: '#fff', fontWeight: '700' },
  referenceCard: { marginTop: 8, borderWidth: 1, borderColor: '#3c3c50', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8 },
  referenceKind: { color: '#9da8ff', fontSize: 10, fontWeight: '700' },
  referenceId: { color: '#fff', fontSize: 13, marginTop: 2 },
  userBubbleText: { color: '#fff' },
  rateLimitBanner: { color: '#ffd7a8', backgroundColor: '#ffa5001a', paddingHorizontal: 16, paddingVertical: 8, fontSize: 13 },
  healthBanner: { color: '#ffb3b3', backgroundColor: '#ff6b6b1a', paddingHorizontal: 16, paddingVertical: 10, fontSize: 13 },
  error: { color: '#ff6b6b', paddingHorizontal: 16, marginBottom: 4 },
  streamingHint: { color: '#6C5CE7', paddingHorizontal: 16, marginBottom: 4, fontSize: 12 },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#2a2a35',
    gap: 8,
  },
  input: {
    flex: 1,
    backgroundColor: '#1e1e28',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    color: '#fff',
    fontSize: 15,
  },
  sendBtn: {
    backgroundColor: '#6C5CE7',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  sendDisabled: { opacity: 0.4 },
  sendText: { color: '#fff', fontWeight: '600' },
});
