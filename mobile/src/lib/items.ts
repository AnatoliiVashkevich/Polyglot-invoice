// Jobs (tasks, estimates, invoices) from the server, in the shape the screens use (src/types.ts).
import { api } from '@/lib/api';
import type { Item, Kind, Status } from '@/types';

type ServerItem = {
  id: string;
  kind: Kind;
  status: Status;
  date: string;
  time: string;
  client_name: string;
  address: string;
  title: string;
  number: string;
  total: number | string;
};

const toItem = (r: ServerItem): Item => ({
  id: r.id,
  kind: r.kind,
  status: r.status,
  date: r.date,
  time: r.time || undefined,
  clientName: r.client_name || undefined,
  address: r.address || undefined,
  title: r.title,
  number: r.number || undefined,
  amount: r.kind === 'task' ? undefined : Number(r.total),
});

/** Every item dated between start and end (YYYY-MM-DD, both included). */
export async function fetchItems(start: string, end: string): Promise<Item[]> {
  const rows = await api<ServerItem[]>(`/api/items?start=${start}&end=${end}`);
  return rows.map(toItem);
}
