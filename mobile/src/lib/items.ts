// Jobs (tasks, estimates, invoices) from the server, and the actions on them (send, mark paid, undo payment).
import { api } from '@/lib/api';
import type { Line, TaxAppliesTo } from '@/lib/invoice-math';
import type { RepeatRule } from '@/lib/repeat-rule';
import { downloadPdf, sharePdf } from '@/lib/pdf';
import type { Item, Kind, Status } from '@/types';

export type ServerItem = {
  id: string;
  kind: Kind;
  status: Status;
  client_id: string | null;
  client_name: string;
  date: string;
  time: string;
  reminder_minutes: number | null;
  address: string;
  title: string;
  number: string;
  lines: Line[];
  tax_rate: number | string;
  tax_applies_to: TaxAppliesTo;
  subtotal: number | string;
  tax: number | string;
  total: number | string;
  due_date: string | null;
  paid_date: string | null;
  payment_method: string;
  from_item_id: string | null;
  series_id?: string | null; // repeating tasks / notes: every visit of one series
  repeat?: (RepeatRule & { start?: string }) | null;
};

/** Repeating tasks and notes: change or delete only this visit, or this and all next ones. */
export type Scope = 'one' | 'following';

export const PAYMENT_METHODS = ['Zelle', 'Cash', 'Check', 'Venmo', 'Card', 'Other'] as const;

/** The server row → the shape the calendar uses (src/types.ts). */
export const toItem = (r: ServerItem): Item => ({
  id: r.id,
  kind: r.kind,
  status: r.status,
  date: r.date,
  time: r.time || undefined,
  clientName: r.client_name || undefined,
  address: r.address || undefined,
  title: r.title,
  number: r.number || undefined,
  amount: r.kind === 'task' || r.kind === 'note' ? undefined : Number(r.total),
  dueDate: r.due_date || undefined,
  repeating: !!r.series_id,
  seriesId: r.series_id || undefined,
});

/** Every item dated between start and end (YYYY-MM-DD, both included). */
export async function fetchItems(start: string, end: string): Promise<Item[]> {
  const rows = await api<ServerItem[]>(`/api/items?start=${start}&end=${end}`);
  return rows.map(toItem);
}

/** All jobs of one client (the client's page). */
export async function fetchClientItems(clientId: string): Promise<Item[]> {
  const rows = await api<ServerItem[]>(`/api/items?client_id=${encodeURIComponent(clientId)}`);
  return rows.map(toItem);
}

/** The same job's other stages (estimate → task → invoice), oldest first. */
export const fetchRelated = (id: string) => api<ServerItem[]>(`/api/items/${id}/related`);

export const getItem = (id: string) => api<ServerItem>(`/api/items/${id}`);

export const patchItem = (id: string, body: Record<string, unknown>, scope: Scope = 'one') =>
  api<ServerItem>(`/api/items/${id}${scope === 'following' ? '?scope=following' : ''}`, { method: 'PATCH', body });

export const markPaid = (id: string, method: string, date: string) =>
  patchItem(id, { status: 'paid', payment_method: method, paid_date: date });

export const deleteItem = (id: string, scope: Scope = 'one') =>
  api<void>(`/api/items/${id}${scope === 'following' ? '?scope=following' : ''}`, { method: 'DELETE' });

/** Undo payment: back to Requested (it was sent before it was paid). The server clears the date and method. */
export const undoPayment = (id: string) => patchItem(id, { status: 'requested' });

/**
 * Send: download the PDF in the document language, open the share sheet, and when it closes switch a Created
 * invoice to Requested (product-decisions.md §4). Returns the item as it is now.
 */
export async function sendInvoice(item: ServerItem, docLang: string): Promise<ServerItem> {
  const file = await downloadPdf(item, docLang);
  const shared = await sharePdf(file);
  if (shared && item.kind === 'invoice' && item.status === 'created') return patchItem(item.id, { status: 'requested' });
  if (shared && item.kind === 'estimate' && item.status === 'created') return patchItem(item.id, { status: 'sent' });
  return item;
}
