// Status rules shown on the calendar and in lists. No imports with "@/": tested with plain Node.
import type { Item } from '../types.ts';

/** Requested and past its due date (product-decisions.md §5: a red mark). */
export function isOverdue(item: Pick<Item, 'kind' | 'status' | 'dueDate'>, today = new Date().toISOString().slice(0, 10)): boolean {
  return item.kind === 'invoice' && item.status === 'requested' && !!item.dueDate && item.dueDate < today;
}
