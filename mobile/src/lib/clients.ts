// Clients, settings and invoice numbers from the server.
import { api } from '@/lib/api';
import type { Lang } from '@/i18n';
import type { TaxAppliesTo } from '@/lib/invoice-math';

export type Client = {
  id: string;
  name: string;
  phone: string;
  email: string;
  address: string;
  notes: string;
  preferred_language: '' | Lang;
  last_used?: string; // when their newest job was created ('' = never)
  paid?: number; // the Clients list: all paid invoices
  owes?: number; // the Clients list: invoices sent and waiting for money
};

export type ClientDraft = Omit<Client, 'id' | 'notes' | 'last_used'> & { id?: string; fromContacts?: boolean };

export type Settings = {
  name: string;
  phone: string;
  email: string;
  address: string;
  payment_info: string;
  doc_language: Lang;
  tax_rate: number | string;
  tax_applies_to: TaxAppliesTo;
  due_days: 0 | 7 | 15 | 30;
  invoice_terms: string;
};

export const fetchClients = () => api<Client[]>('/api/clients');

export const getClient = (id: string) => api<Client>(`/api/clients/${id}`);

export type ClientFields = Pick<Client, 'name' | 'phone' | 'email' | 'address' | 'notes' | 'preferred_language'>;

/** The client page's Edit / New client: create (id empty) or update. */
export const storeClient = (fields: ClientFields, id?: string) =>
  id
    ? api<Client>(`/api/clients/${id}`, { method: 'PATCH', body: fields })
    : api<Client>('/api/clients', { method: 'POST', body: fields });

export const deleteClient = (id: string) => api<void>(`/api/clients/${id}`, { method: 'DELETE' });

export const fetchSettings = () => api<Settings>('/api/settings');

export const fetchNextNumber = (kind: 'invoice' | 'estimate') =>
  api<{ number: string }>(`/api/next-number?kind=${kind}`).then((r) => r.number);

const FIELDS = ['name', 'phone', 'email', 'address', 'preferred_language'] as const;

/** Save the customer from step 2: new → created (a phone contact reuses a matching client), changed → updated. */
export async function saveClient(draft: ClientDraft, original?: Client): Promise<Client> {
  const body = Object.fromEntries(FIELDS.map((k) => [k, String(draft[k] ?? '').trim()]));
  if (!draft.id) {
    return api<Client>('/api/clients', { method: 'POST', body: { ...body, use_existing: !!draft.fromContacts } });
  }
  const changed = Object.fromEntries(Object.entries(body).filter(([k, v]) => original?.[k as keyof Client] !== v));
  if (!original || Object.keys(changed).length === 0) return original ?? (await api<Client>(`/api/clients/${draft.id}`));
  return api<Client>(`/api/clients/${draft.id}`, { method: 'PATCH', body: changed });
}
