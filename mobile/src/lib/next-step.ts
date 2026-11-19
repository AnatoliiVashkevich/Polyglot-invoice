// The one big "next step" button on every job card (product-decisions.md §4):
//   Estimate, Created  → Send estimate            Estimate, Sent → Schedule the job · Make invoice
//   Task (scheduled)   → Job done → Create invoice
//   Invoice, Created   → Send invoice             Invoice, Requested → Mark Paid        Paid → ✓ Done, no button
// No imports with "@/": tested with plain Node.

export type NextStep = 'send-estimate' | 'schedule' | 'make-invoice' | 'job-done' | 'send-invoice' | 'mark-paid';

export function nextSteps(item: { kind: string; status: string }): NextStep[] {
  if (item.kind === 'estimate') return item.status === 'created' ? ['send-estimate'] : ['schedule', 'make-invoice'];
  if (item.kind === 'task') return item.status === 'done' ? [] : ['job-done'];
  if (item.status === 'created') return ['send-invoice'];
  if (item.status === 'requested') return ['mark-paid'];
  return [];
}

export const NEXT_STEP_LABEL: Record<NextStep, string> = {
  'send-estimate': 'Send estimate',
  schedule: 'Schedule the job',
  'make-invoice': 'Make invoice',
  'job-done': 'Job done → Create invoice',
  'send-invoice': 'Send invoice',
  'mark-paid': 'Mark Paid',
};
