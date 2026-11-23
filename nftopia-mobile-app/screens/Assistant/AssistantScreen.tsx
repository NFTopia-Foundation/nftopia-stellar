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
} from 'react-native';
import { useRoute, RouteProp } from '@react-navigation/native';
import { MainStackParamList } from '@/navigation/MainNavigator';
import { useAssistantStore, ChatMessage } from '@/stores/assistantStore';
import type { AIUsage } from '@/stores/assistantStore';

function MessageBubble({ item }: { item: ChatMessage }) {
  const isUser = item.role === 'user';
  return (
    <View
      style={[styles.bubble, isUser ? styles.userBubble : styles.assistantBubble]}
      accessibilityRole="text"
      accessibilityLabel={`${isUser ? 'You' : 'Assistant'}: ${item.content}${
        item.streaming ? ' (typing)' : ''
      }`}
    >
      <Text style={[styles.bubbleText, isUser && styles.userBubbleText]}>
        {item.content || (item.streaming ? '…' : '')}
      </Text>
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
  const { messages, isStreaming, error, sendMessage, cancelStream, clearConversation, usage, fetchUsage, isQuotaExhausted } =
    useAssistantStore();
  const [input, setInput] = useState('');
  const listRef = useRef<FlatList>(null);

  // Fetch usage data on mount
  useEffect(() => {
    fetchUsage();
  }, [fetchUsage]);

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
    if (isQuotaExhausted) {
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
          renderItem={({ item }) => <MessageBubble item={item} />}
          contentContainerStyle={styles.list}
          accessibilityLabel="Chat messages"
        />
      )}

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
          editable={!isStreaming}
          onSubmitEditing={onSend}
          returnKeyType="send"
          accessibilityLabel="Message input"
        />
        <TouchableOpacity
          style={[styles.sendBtn, (!input.trim() || isStreaming || isQuotaExhausted) && styles.sendDisabled]}
          onPress={onSend}
          disabled={!input.trim() || isStreaming || isQuotaExhausted}
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
  userBubbleText: { color: '#fff' },
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
