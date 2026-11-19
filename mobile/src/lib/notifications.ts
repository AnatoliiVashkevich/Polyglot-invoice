// Phone notifications (local, scheduled on the iPhone; nothing goes through a server):
//   • task reminders (none / 30 min / 1 hour / 1 day before)
//   • one notice per late invoice, 3 days after its due date, with a ready reminder message when tapped
// The permission is asked only when the user first picks a reminder (App Store rule: when needed, with a reason).
// syncNotifications() rebuilds the whole schedule from the server's items, so it never goes out of date.
import * as Notifications from 'expo-notifications';

import { t } from '@/i18n';
import { addDays, todayIso } from '@/lib/dates';
import { api } from '@/lib/api';
import type { ServerItem } from '@/lib/items';
import { lateNoticeAt, taskReminderAt, usd } from '@/lib/reminders';

const IOS_LIMIT = 60; // iOS keeps at most 64 scheduled notifications per app
const IOS_PROVISIONAL = 3; // Notifications.IosAuthorizationStatus.PROVISIONAL (quiet notifications are allowed too)

export function setUpNotifications() {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
  });
}

export async function notificationsAllowed(): Promise<boolean> {
  try {
    const p = await Notifications.getPermissionsAsync();
    return p.granted || p.ios?.status === IOS_PROVISIONAL;
  } catch {
    return false;
  }
}

/** Asks once (iOS shows its own question). true if notifications can be shown. */
export async function askForNotifications(): Promise<boolean> {
  if (await notificationsAllowed()) return true;
  try {
    const p = await Notifications.requestPermissionsAsync({ ios: { allowAlert: true, allowSound: true, allowBadge: false } });
    return p.granted || p.ios?.status === IOS_PROVISIONAL;
  } catch {
    return false;
  }
}

type Planned = { at: Date; title: string; body: string; url: string };

function plan(items: ServerItem[], now = new Date()): Planned[] {
  const out: Planned[] = [];
  for (const it of items) {
    if (it.kind === 'task') {
      const at = taskReminderAt({ date: it.date, time: it.time, reminderMinutes: it.reminder_minutes, status: it.status }, now);
      if (at) {
        const when = it.time ? ` ${t('at')} ${it.time}` : '';
        out.push({
          at,
          title: it.client_name ? `${it.client_name}${when}` : `${t('Task')}${when}`,
          body: [it.title, it.address].filter(Boolean).join(' · '),
          url: `/job/${it.id}`,
        });
      }
    } else if (it.kind === 'invoice') {
      const at = lateNoticeAt({ status: it.status, dueDate: it.due_date }, now);
      if (at) {
        out.push({
          at,
          title: t('{name}’s invoice {amount} is 3 days late', { name: it.client_name || t('A customer'), amount: usd(Number(it.total)) }),
          body: t('Tap to send a polite reminder.'),
          url: `/job/${it.id}?remind=1`,
        });
      }
    }
  }
  return out.sort((a, b) => a.at.getTime() - b.at.getTime()).slice(0, IOS_LIMIT);
}

let syncing = false;

/** Rebuild every scheduled notification from the server (call after changes and when the calendar opens). */
export async function syncNotifications(): Promise<void> {
  if (syncing || !(await notificationsAllowed())) return;
  syncing = true;
  try {
    const today = todayIso();
    // tasks ahead, and invoices that may still become late
    const items = await api<ServerItem[]>(`/api/items?start=${addDays(today, -400)}&end=${addDays(today, 120)}`);
    await Notifications.cancelAllScheduledNotificationsAsync();
    for (const p of plan(items)) {
      await Notifications.scheduleNotificationAsync({
        content: { title: p.title, body: p.body, data: { url: p.url } },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: p.at },
      });
    }
  } catch {
    // a failed sync keeps the old schedule; the next one fixes it
  } finally {
    syncing = false;
  }
}
