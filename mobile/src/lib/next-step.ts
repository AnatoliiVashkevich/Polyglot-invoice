// The one big "next step" button on every job card (product-decisions.md §4, §6g, §6i):
//   Estimate, Created  → Send estimate            Estimate, Sent → Schedule the job · Make invoice
//   Task, no invoice yet   → Job done → Create invoice   (pay after the job)
//   Task, already invoiced → ✓ Job done; when done → Show invoice   (paid before the job)
//   Task done, no invoice yet → Make invoice
//   Repeating task     → ✓ Done · Make invoice (smaller)      Note → ✓ Done
//   Invoice, Created   → Send invoice · Schedule the job (when no task yet)
//   Invoice, Requested → Mark Paid · Schedule the job (when no task yet)       Paid → Schedule the job (when no task yet)
// The user never picks a "mode": the job's linked stages decide. No imports with "@/": tested with plain Node.

export type NextStep =
  | 'send-estimate'
  | 'schedule'
  | 'make-invoice'
  | 'job-done'
  | 'done'
  | 'invoice-from-task'
  | 'open-invoice'
  | 'send-invoice'
  | 'mark-paid';

/** What the job's other stages already have (from 🔗 Linked). */
export type Linked = { hasInvoice?: boolean; hasTask?: boolean };

export function nextSteps(item: { kind: string; status: string; series_id?: string | null }, linked: Linked = {}): NextStep[] {
  const { hasInvoice = false, hasTask = false } = linked;
  if (item.kind === 'estimate') return item.status === 'created' ? ['send-estimate'] : ['schedule', 'make-invoice'];
  if (item.kind === 'note') return item.status === 'done' ? [] : ['done'];
  if (item.kind === 'task') {
    if (item.status === 'done') return hasInvoice ? ['open-invoice'] : ['invoice-from-task'];
    if (hasInvoice) return ['done'];
    return item.series_id ? ['done', 'invoice-from-task'] : ['job-done'];
  }
  const schedule: NextStep[] = hasTask ? [] : ['schedule'];
  if (item.status === 'created') return ['send-invoice', ...schedule];
  if (item.status === 'requested') return ['mark-paid', ...schedule];
  return schedule;
}

export const NEXT_STEP_LABEL: Record<NextStep, string> = {
  'send-estimate': 'Send estimate',
  schedule: 'Schedule the job',
  'make-invoice': 'Make invoice',
  'job-done': 'Job done → Create invoice',
  done: '✓ Done',
  'invoice-from-task': 'Make invoice',
  'open-invoice': 'Show invoice',
  'send-invoice': 'Send invoice',
  'mark-paid': 'Mark Paid',
};
