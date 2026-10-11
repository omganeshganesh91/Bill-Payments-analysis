import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';

// Configure how notifications appear when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

// ─── Request Permissions ──────────────────────────────────────
export async function requestNotificationPermissions() {
  if (!Device.isDevice) {
    console.log('Notifications only work on physical devices');
    return false;
  }

  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;

  if (existing !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    console.log('Notification permission denied');
    return false;
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('bill-alerts', {
      name: 'Bill Due Alerts',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#6366f1',
      sound: 'default',
    });
  }

  return true;
}

// ─── Schedule Due Date Notification ──────────────────────────
export async function scheduleBillNotification(bill) {
  if (!bill.due_date) return;

  const dueDate = new Date(bill.due_date);
  if (isNaN(dueDate.getTime())) return;

  // Cancel any existing notifications for this bill
  await cancelBillNotifications(bill.id);

  const notifications = [];

  // 3 days before
  const threeDaysBefore = new Date(dueDate);
  threeDaysBefore.setDate(threeDaysBefore.getDate() - 3);
  threeDaysBefore.setHours(9, 0, 0, 0);

  if (threeDaysBefore > new Date()) {
    try {
      const id3 = await Notifications.scheduleNotificationAsync({
        identifier: `bill-${bill.id}-3d`,
        content: {
          title: '📅 Bill Due in 3 Days',
          body: `${bill.title}: ₹${Number(bill.total_amount).toLocaleString('en-IN')} due on ${dueDate.toLocaleDateString('en-IN')}`,
          data: { billId: bill.id, type: '3d' },
          sound: 'default',
          categoryIdentifier: 'bill-reminder',
        },
        trigger: { date: threeDaysBefore },
      });
      notifications.push(id3);
    } catch (e) {
      console.log('Could not schedule 3-day notification:', e.message);
    }
  }

  // 1 day before
  const oneDayBefore = new Date(dueDate);
  oneDayBefore.setDate(oneDayBefore.getDate() - 1);
  oneDayBefore.setHours(9, 0, 0, 0);

  if (oneDayBefore > new Date()) {
    try {
      const id1 = await Notifications.scheduleNotificationAsync({
        identifier: `bill-${bill.id}-1d`,
        content: {
          title: '⚠️ Bill Due Tomorrow!',
          body: `${bill.title}: ₹${Number(bill.total_amount).toLocaleString('en-IN')} is due tomorrow!`,
          data: { billId: bill.id, type: '1d' },
          sound: 'default',
        },
        trigger: { date: oneDayBefore },
      });
      notifications.push(id1);
    } catch (e) {
      console.log('Could not schedule 1-day notification:', e.message);
    }
  }

  // On due date
  const onDueDate = new Date(dueDate);
  onDueDate.setHours(8, 0, 0, 0);

  if (onDueDate > new Date()) {
    try {
      const idToday = await Notifications.scheduleNotificationAsync({
        identifier: `bill-${bill.id}-today`,
        content: {
          title: '🚨 Bill Due Today!',
          body: `Pay ${bill.title} — ₹${Number(bill.total_amount).toLocaleString('en-IN')} to avoid late fees!`,
          data: { billId: bill.id, type: 'today' },
          sound: 'default',
        },
        trigger: { date: onDueDate },
      });
      notifications.push(idToday);
    } catch (e) {
      console.log('Could not schedule today notification:', e.message);
    }
  }

  return notifications;
}

// ─── Cancel Notifications for a Bill ─────────────────────────
export async function cancelBillNotifications(billId) {
  try {
    await Notifications.cancelScheduledNotificationAsync(`bill-${billId}-3d`);
    await Notifications.cancelScheduledNotificationAsync(`bill-${billId}-1d`);
    await Notifications.cancelScheduledNotificationAsync(`bill-${billId}-today`);
  } catch (e) {
    // Silently ignore if notifications don't exist
  }
}

// ─── Cancel All Notifications ─────────────────────────────────
export async function cancelAllNotifications() {
  await Notifications.cancelAllScheduledNotificationsAsync();
}

// ─── Get All Scheduled Notifications ─────────────────────────
export async function getScheduledNotifications() {
  return Notifications.getAllScheduledNotificationsAsync();
}

// ─── Send Immediate Test Notification ────────────────────────
export async function sendTestNotification() {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: '✅ Notifications Working!',
      body: 'Bill due date reminders are set up correctly.',
      sound: 'default',
    },
    trigger: { seconds: 1 },
  });
}

// ─── Notification Tap Handler ─────────────────────────────────
export function useNotificationListener(onPress) {
  const { useEffect } = require('react');
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener(response => {
      const billId = response.notification.request.content.data?.billId;
      if (billId && onPress) onPress(billId);
    });
    return () => sub.remove();
  }, [onPress]);
}
