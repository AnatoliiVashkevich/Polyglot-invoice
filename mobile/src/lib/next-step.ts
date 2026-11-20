// The one big "next step" button on every job card (product-decisions.md §4, §6g):
//   Estimate, Created  → Send estimate            Estimate, Sent → Schedule the job · Make invoice
//   Task (scheduled)   → Job done → Create invoice
//   Repeating task     → ✓ Done · Make invoice (smaller)      Note → ✓ Done
//   Invoice, Created   → Send invoice             Invoice, Requested → Mark Paid        Paid → ✓ Done, no button
// No imports with "@/": tested with plain Node.

export type NextStep = 'send-estimate' | 'schedule' | 'make-invoice' | 'job-done' | 'done' | 'invoice-from-task' | 'send-invoice' | 'mark-paid';

export function nextSteps(item: { kind: string; status: string; series_id?: string | null }): NextStep[] {
  if (item.kind === 'estimate') return item.status === 'created' ? ['send-estimate'] : ['schedule', 'make-invoice'];
  if (item.kind === 'note') return item.status === 'done' ? [] : ['done'];
  if (item.kind === 'task') {
    if (item.status === 'done') return [];
    return item.series_id ? ['done', 'invoice-from-task'] : ['job-done'];
  }
  if (item.status === 'created') return ['send-invoice'];
  if (item.status === 'requested') return ['mark-paid'];
  return [];
}

export const NEXT_STEP_LABEL: Record<NextStep, string> = {
  'send-estimate': 'Send estimate',
  schedule: 'Schedule the job',
  'make-invoice': 'Make invoice',
  'job-done': 'Job done → Create invoice',
  done: '✓ Done',
  'invoice-from-task': 'Make invoice',
  'send-invoice': 'Send invoice',
  'mark-paid': 'Mark Paid',
};
