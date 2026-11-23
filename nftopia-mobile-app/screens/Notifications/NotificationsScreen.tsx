import React, { useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { useNotificationStore } from '@/stores/notificationStore';
import apiClient from '@/lib/api/sample';
import { Notification } from '@/types';

function NotificationItem({ notification, onPress, onMarkRead }: { 
  notification: Notification; 
  onPress: () => void;
  onMarkRead: () => void;
}) {
  const typeConfig: Record<string, { icon: string; color: string }> = {
    outbid: { icon: '🔨', color: '#E17055' },
    sale: { icon: '💰', color: '#00B894' },
    follow: { icon: '👤', color: '#6C5CE7' },
    mint: { icon: '🖼️', color: '#FDCB6E' },
    auction_end: { icon: '⏰', color: '#E17055' },
    listing: { icon: '📋', color: '#0984E3' },
    offer: { icon: '💎', color: '#6C5CE7' },
    transfer: { icon: '↔️', color: '#636E72' },
  };

  const config = typeConfig[notification.type] || { icon: '📌', color: '#666' };
  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <TouchableOpacity
      style={[styles.notificationItem, !notification.read && styles.notificationUnread]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={[styles.notificationIcon, { backgroundColor: config.color + '20' }]}>
        <Text style={styles.notificationEmoji}>{config.icon}</Text>
      </View>
      <View style={styles.notificationContent}>
        <Text style={styles.notificationTitle}>{notification.title}</Text>
        <Text style={styles.notificationMessage} numberOfLines={2}>{notification.message}</Text>
        <Text style={styles.notificationTime}>{formatTime(notification.createdAt)}</Text>
      </View>
      {!notification.read && <View style={styles.unreadDot} />}
    </TouchableOpacity>
  );
}

function EmptyState() {
  return (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyIcon}>🔔</Text>
      <Text style={styles.emptyTitle}>No Notifications</Text>
      <Text style={styles.emptySubtitle}>You're all caught up! Notifications will appear here.</Text>
    </View>
  );
}

export default function NotificationsScreen({ navigation }: any) {
  const {
    notifications,
    unreadCount,
    loading,
    error,
    fetchNotifications,
    markAsRead,
    markAllAsRead,
  } = useNotificationStore();

  useEffect(() => {
    fetchNotifications();
    apiClient.trackEvent('notifications_view', { timestamp: new Date().toISOString() });
  }, []);

  const onRefresh = useCallback(async () => {
    await fetchNotifications();
    apiClient.trackEvent('notifications_refresh', { timestamp: new Date().toISOString() });
  }, [fetchNotifications]);

  const handleNotificationPress = async (notification: Notification) => {
    if (!notification.read) {
      await markAsRead(notification.id);
      apiClient.trackEvent('notification_opened', { 
        notificationId: notification.id, 
        type: notification.type 
      });
    }
    // Deep link navigation based on notification data
    if (notification.data?.nftId) {
      navigation.navigate('NFTDetail', { nftId: notification.data.nftId });
    }
  };

  const handleMarkAllRead = async () => {
    await markAllAsRead();
    apiClient.trackEvent('notifications_mark_all_read', { timestamp: new Date().toISOString() });
  };

  const renderItem = ({ item }: { item: Notification }) => (
    <NotificationItem
      notification={item}
      onPress={() => handleNotificationPress(item)}
      onMarkRead={() => markAsRead(item.id)}
    />
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Notifications</Text>
          {unreadCount > 0 && (
            <Text style={styles.headerSubtitle}>{unreadCount} unread</Text>
          )}
        </View>
        {unreadCount > 0 && (
          <TouchableOpacity style={styles.markAllButton} onPress={handleMarkAllRead}>
            <Text style={styles.markAllText}>Mark all read</Text>
          </TouchableOpacity>
        )}
      </View>

      <FlatList
        data={notifications}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={onRefresh} tintColor="#6C5CE7" />
        }
        ListEmptyComponent={<EmptyState />}
        ListFooterComponent={
          error ? (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{error}</Text>
              <TouchableOpacity style={styles.retryButton} onPress={() => fetchNotifications()}>
                <Text style={styles.retryText}>Retry</Text>
              </TouchableOpacity>
            </View>
          ) : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingTop: 60,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E8E8E8',
  },
  headerTitle: { fontSize: 24, fontWeight: 'bold', color: '#1A1A1A' },
  headerSubtitle: { fontSize: 13, color: '#6C5CE7', marginTop: 2 },
  markAllButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#6C5CE7',
    borderRadius: 8,
  },
  markAllText: { color: '#FFFFFF', fontSize: 12, fontWeight: '600' },
  listContent: { padding: 12, paddingBottom: 100 },
  notificationItem: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 2,
    elevation: 1,
  },
  notificationUnread: { borderLeftWidth: 3, borderLeftColor: '#6C5CE7' },
  notificationIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  notificationEmoji: { fontSize: 20 },
  notificationContent: { flex: 1 },
  notificationTitle: { fontSize: 14, fontWeight: '600', color: '#1A1A1A', marginBottom: 2 },
  notificationMessage: { fontSize: 13, color: '#666', lineHeight: 18 },
  notificationTime: { fontSize: 11, color: '#999', marginTop: 4 },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#6C5CE7',
    marginLeft: 8,
  },
  emptyContainer: { alignItems: 'center', padding: 60 },
  emptyIcon: { fontSize: 64, marginBottom: 16 },
  emptyTitle: { fontSize: 20, fontWeight: '600', color: '#1A1A1A', marginBottom: 8 },
  emptySubtitle: { fontSize: 14, color: '#666', textAlign: 'center' },
  errorContainer: { alignItems: 'center', padding: 20 },
  errorText: { fontSize: 14, color: '#E17055', marginBottom: 12, textAlign: 'center' },
  retryButton: {
    backgroundColor: '#6C5CE7',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryText: { color: '#FFFFFF', fontWeight: '600' },
});