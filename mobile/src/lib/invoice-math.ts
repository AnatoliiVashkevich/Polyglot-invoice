// Invoice totals on the phone (for the review screen). The same rules as server/money.py; the server's numbers
// are the ones saved. Money is counted in whole cents, so 3 × $0.10 is exactly $0.30.
// No imports on purpose: the tests run with plain Node (`node --test src/lib/invoice-math.test.ts`).

export type LineKind = 'work' | 'material' | 'discount';
/** A "discount" line (§6o): pct% of the subtotal, or price = a fixed amount. One per invoice. */
export type Line = { text: string; qty: number; price: number; kind: LineKind; pct?: number };
export type TaxAppliesTo = 'materials' | 'everything';
export type Totals = { subtotal: number; discount: number; tax: number; total: number };

const toCents = (dollars: number) => Math.round((Number.isFinite(dollars) ? dollars : 0) * 100);

export function lineCents(line: Pick<Line, 'qty' | 'price'>): number {
  const qty = Number.isFinite(line.qty) ? line.qty : 1;
  // qty × price in cents, rounded half away from zero like the server (ROUND_HALF_UP)
  const raw = qty * toCents(line.price);
  return Math.sign(raw) * Math.round(Math.abs(raw) + 1e-9);
}

const half = (x: number) => Math.sign(x) * Math.round(Math.abs(x) + 1e-9); // round half away from zero

/** A discount line → its amount in cents (<= 0): pct% of the subtotal, else its fixed amount. */
export function discountCents(line: Pick<Line, 'qty' | 'price' | 'pct'>, subtotalCents: number): number {
  if (line.pct !== undefined && line.pct !== null && Number.isFinite(line.pct)) return -half((subtotalCents * line.pct) / 100);
  return -Math.abs(lineCents(line));
}

/** Totals in dollars (rounded to cents), like server/money.py: subtotal → discount → tax (after the discount) → total. */
export function totals(lines: Line[], taxRate = 0, appliesTo: TaxAppliesTo = 'materials'): Totals {
  const items = lines.filter((l) => l.kind !== 'discount');
  const subtotal = items.reduce((sum, l) => sum + lineCents(l), 0);
  const first = lines.find((l) => l.kind === 'discount');
  const discount = first ? Math.max(discountCents(first, subtotal), -Math.max(subtotal, 0)) : 0;
  const materials = items.filter((l) => l.kind === 'material').reduce((s, l) => s + lineCents(l), 0);
  const taxable = appliesTo === 'everything' ? subtotal + discount : subtotal > 0 ? (materials * (subtotal + discount)) / subtotal : materials;
  const tax = half((taxable * (taxRate || 0)) / 100);
  return { subtotal: subtotal / 100, discount: discount / 100, tax: tax / 100, total: (subtotal + discount + tax) / 100 };
}

/** "200", "200.5", "$1,250.00" → a number; anything else → NaN. */
export function parseAmount(text: string): number {
  const clean = text.replace(/[$,\s]/g, '');
  return /^-?\d*\.?\d+$|^-?\d+\.$/.test(clean) ? Number(clean) : NaN;
}

/** The due date: the invoice date plus 0 / 7 / 15 / 30 days (YYYY-MM-DD). */
export function dueDate(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number);
  const due = new Date(Date.UTC(y, m - 1, d + days));
  return due.toISOString().slice(0, 10);
}

/** The same limits as the server: they catch typos like an extra zero. */
export const MAX_PRICE = 1_000_000;
export const MAX_QTY = 100_000;

/** 'price' or 'qty' when a line is over the limit, else null. */
export function overLimit(line: Pick<Line, 'qty' | 'price'>): 'price' | 'qty' | null {
  if (Math.abs(line.price) > MAX_PRICE) return 'price';
  if (line.qty > MAX_QTY) return 'qty';
  return null;
}
