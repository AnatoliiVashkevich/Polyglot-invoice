// Pure helpers for clients (no @/ imports, so Node can test them: client-tools.test.ts).
//   search, Call / Text / Navigate links, and the two numbers on the client's page.

/** Phone numbers compared by their last 10 digits: "+1 (561) 555-0101" == "561-555-0101". '' if too short. */
export const phoneKey = (p: string) => {
  const digits = (p ?? '').replace(/\D/g, '');
  return digits.length >= 7 ? digits.slice(-10) : '';
};

/** Search: every typed word is somewhere in the fields, or 3+ typed digits are inside a phone number. */
export function matches(q: string, ...fields: string[]) {
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  const hay = fields.join(' ').toLowerCase();
  const digits = q.replace(/\D/g, '');
  return words.every((w) => hay.includes(w)) || (digits.length >= 3 && fields.some((f) => (f ?? '').replace(/\D/g, '').includes(digits)));
}

const dialable = (phone: string) => (phone ?? '').replace(/[^\d+]/g, '');

/** tel: link, or '' when there is no number. */
export const callUrl = (phone: string) => (dialable(phone) ? `tel:${dialable(phone)}` : '');

/** sms: link (Messages), or '' when there is no number. */
export const textUrl = (phone: string) => (dialable(phone) ? `sms:${dialable(phone)}` : '');

/** Directions in Apple Maps, or '' when there is no address. */
export const mapsUrl = (address: string) =>
  (address ?? '').trim() ? `https://maps.apple.com/?daddr=${encodeURIComponent(address.trim())}` : '';

type MoneyItem = { kind: string; status: string; amount?: number };

/** The client's page: Paid total (paid invoices) and Owes now (invoices sent, waiting for money). In dollars. */
export function clientMoney(items: MoneyItem[]): { paid: number; owes: number } {
  let paid = 0;
  let owes = 0;
  for (const it of items) {
    if (it.kind !== 'invoice') continue;
    const cents = Math.round((it.amount ?? 0) * 100);
    if (it.status === 'paid') paid += cents;
    else if (it.status === 'requested') owes += cents;
  }
  return { paid: paid / 100, owes: owes / 100 };
}

/** Their jobs, newest first (by date, then time). */
export function newestFirst<T extends { date: string; time?: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => (b.date + (b.time ?? '')).localeCompare(a.date + (a.time ?? '')));
}
