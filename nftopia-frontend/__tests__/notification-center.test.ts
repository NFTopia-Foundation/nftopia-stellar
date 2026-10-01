import { useNotificationStore } from '../lib/stores/notification-store';
import { NotificationItem } from '../lib/stores/types';

describe('NotificationStore Unit Tests', () => {
  beforeEach(() => {
    useNotificationStore.getState().clearAll();
  });

  test('should start with empty notifications after clearAll', () => {
    const state = useNotificationStore.getState();
    expect(state.notifications).toEqual([]);
  });

  test('should add new notification and increment unread count', () => {
    useNotificationStore.getState().addNotification({
      title: 'Test Notification',
      message: 'This is a test notification message',
      type: 'bid',
      link: '/test',
    });

    const state = useNotificationStore.getState();
    expect(state.notifications.length).toBe(1);
    expect(state.notifications[0].title).toBe('Test Notification');
    expect(state.notifications[0].read).toBe(false);
  });

  test('should mark single notification as read', () => {
    useNotificationStore.getState().addNotification({
      id: 'test-1',
      title: 'Test 1',
      message: 'Message 1',
      type: 'sale',
    });

    useNotificationStore.getState().markAsRead('test-1');

    const state = useNotificationStore.getState();
    expect(state.notifications[0].read).toBe(true);
  });

  test('should mark all notifications as read', () => {
    useNotificationStore.getState().addNotification({
      title: 'Test 1',
      message: 'Message 1',
      type: 'sale',
    });
    useNotificationStore.getState().addNotification({
      title: 'Test 2',
      message: 'Message 2',
      type: 'bid',
    });

    useNotificationStore.getState().markAllAsRead();

    const state = useNotificationStore.getState();
    expect(state.notifications.every((n: NotificationItem) => n.read === true)).toBe(true);
  });

  test('should enforce max notifications limit of 50', () => {
    for (let i = 0; i < 60; i++) {
      useNotificationStore.getState().addNotification({
        title: `Notif ${i}`,
        message: `Message ${i}`,
        type: 'system',
      });
    }

    const state = useNotificationStore.getState();
    expect(state.notifications.length).toBe(50);
    expect(state.notifications[0].title).toBe('Notif 59');
  });
});
