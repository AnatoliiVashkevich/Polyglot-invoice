// Which phone notifications to schedule, from the server's items (pure: tested in notification-plan.test.ts).
//   • tasks and notes: their reminder (none / 30 min / 1 hour / 1 day before; a note without a time counts from 9:00)
//   • invoices waiting for money: one notice 3 days after the due date, with a ready reminder message when tapped
// notifications.ts schedules the result. No "@/" imports.
import { lateNoticeAt, taskReminderAt, usd } from './reminders.ts';

export const IOS_LIMIT = 60; // iOS keeps at most 64 scheduled notifications per app

export type PlanItem = {
  id: string;
  kind: string;
  status: string;
  date: string;
  time: string;
  reminder_minutes: number | null;
  title: string;
  address: string;
  client_name: string;
  total: number | string;
  due_date: string | null;
};

export type Planned = { at: Date; title: string; body: string; url: string };

type Translate = (text: string, vars?: Record<string, string | number>) => string;
const plain: Translate = (text, vars) => (vars ? text.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m)) : text);

export function planNotifications(items: PlanItem[], now = new Date(), t: Translate = plain): Planned[] {
  const out: Planned[] = [];
  for (const it of items) {
    if (it.kind === 'task' || it.kind === 'note') {
      const at = taskReminderAt({ date: it.date, time: it.time, reminderMinutes: it.reminder_minutes, status: it.status }, now);
      if (!at) continue;
      const when = it.time ? ` ${t('at')} ${it.time}` : '';
      if (it.kind === 'note') out.push({ at, title: `📝 ${t('Note')}${when}`, body: it.title, url: `/job/${it.id}` });
      else
        out.push({
          at,
          title: it.client_name ? `${it.client_name}${when}` : `${t('Task')}${when}`,
          body: [it.title, it.address].filter(Boolean).join(' · '),
          url: `/job/${it.id}`,
        });
    } else if (it.kind === 'invoice') {
      const at = lateNoticeAt({ status: it.status, dueDate: it.due_date }, now);
      if (at)
        out.push({
          at,
          title: t('{name}’s invoice {amount} is 3 days late', { name: it.client_name || t('A client'), amount: usd(Number(it.total)) }),
          body: t('Tap to send a polite reminder.'),
          url: `/job/${it.id}?remind=1`,
        });
    }
  }
  return out.sort((a, b) => a.at.getTime() - b.at.getTime()).slice(0, IOS_LIMIT);
}
