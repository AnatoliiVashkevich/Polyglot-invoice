// Teaching the statuses (product-decisions.md §6j): one plain line under the status on every job card, saying what
// it means and what happens next, and the question asked before marking a task / note done.
// No "@/" imports: tested with plain Node (status-help.test.ts). The screens translate the texts.

type HelpItem = { kind: string; status: string; date: string; time?: string; reminderMinutes?: number | null };

const REMINDER_TEXT: Record<number, string> = { 30: '30 min before', 60: '1 hour before', 1440: '1 day before' };

/** The line under the status: what it means right now. */
export function statusHelp(item: HelpItem): string {
  const reminder = item.reminderMinutes ? REMINDER_TEXT[item.reminderMinutes] : '';
  if (item.kind === 'task' || item.kind === 'note') {
    if (item.status === 'done') return 'Finished. No more reminders for it.';
    return reminder ? `You get a reminder ${reminder}.` : 'No reminder is set.';
  }
  if (item.kind === 'estimate') return item.status === 'sent' ? 'The client has it. When they say yes: Schedule the job or Make invoice.' : 'Only you can see it. Tap Send estimate to send it.';
  if (item.status === 'created') return 'Only you can see it. Tap Send invoice to send it.';
  if (item.status === 'requested') return 'Sent. When the money comes, tap Mark Paid.';
  return 'Paid. It is locked; Undo payment to change it.';
}

/** Is the visit still ahead? (then "done" is probably a mistake, so the question says when it is planned). */
export function isAhead(item: { date: string; time?: string }, now = new Date()): boolean {
  const [y, m, d] = item.date.split('-').map(Number);
  const [hh, mm] = (item.time || '23:59').split(':').map(Number);
  return new Date(y, m - 1, d, hh, mm) > now;
}
