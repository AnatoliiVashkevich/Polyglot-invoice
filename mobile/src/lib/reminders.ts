// When phone notifications fire, and what they say (product-decisions.md §6b and §7 "Late invoices").
// No imports with "@/": tested with plain Node (reminders.test.ts).

export type ReminderMinutes = 30 | 60 | 1440;
export const REMINDER_CHOICES: (ReminderMinutes | null)[] = [null, 30, 60, 1440];
export const DEFAULT_REMINDER: ReminderMinutes = 60; // "1 hour before by default"
export const LATE_NOTICE_DAYS = 3; // "Ann Lee's invoice $450 is 3 days late"
export const LATE_NOTICE_HOUR = 9; // in the morning, not in the middle of the night

/** A local date + time as a Date ("2026-11-20", "14:30"). No time → 9:00. */
export function localDateTime(date: string, time?: string): Date {
  const [y, m, d] = date.split('-').map(Number);
  const [hh, mm] = (time || '09:00').split(':').map(Number);
  return new Date(y, m - 1, d, hh, mm, 0, 0);
}

/** When a task's reminder fires, or null (no reminder, or already past). */
export function taskReminderAt(
  task: { date: string; time?: string; reminderMinutes?: number | null; status: string },
  now = new Date(),
): Date | null {
  if (!task.reminderMinutes || task.status === 'done') return null;
  const at = new Date(localDateTime(task.date, task.time).getTime() - task.reminderMinutes * 60_000);
  return at > now ? at : null;
}

/** When the one "invoice is late" notice fires: 3 days after the due date, 9:00. null if past or not waiting. */
export function lateNoticeAt(invoice: { status: string; dueDate?: string | null }, now = new Date()): Date | null {
  if (invoice.status !== 'requested' || !invoice.dueDate) return null;
  const at = localDateTime(invoice.dueDate, `${String(LATE_NOTICE_HOUR).padStart(2, '0')}:00`);
  at.setDate(at.getDate() + LATE_NOTICE_DAYS);
  return at > now ? at : null;
}

export const usd = (n: number) =>
  `$${n.toLocaleString('en-US', { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 })}`;

/** The ready, polite reminder text the user can send to the client (in English for now; translated in step 7). */
export function reminderMessage(inv: { clientName?: string; number?: string; total: number; dueDate?: string | null }, business?: string): string {
  const hello = inv.clientName ? `Hi ${inv.clientName.split(' ')[0]},` : 'Hello,';
  const what = inv.number ? `invoice ${inv.number}` : 'the invoice';
  const sign = business ? `\n\nThank you,\n${business}` : '\n\nThank you!';
  return `${hello} just a friendly reminder about ${what} for ${usd(inv.total)}. If it's already paid, please ignore this message.${sign}`;
}

export function reminderLabel(minutes: ReminderMinutes | null): string {
  if (!minutes) return 'No reminder';
  if (minutes === 30) return '30 min before';
  if (minutes === 60) return '1 hour before';
  return '1 day before';
}
