// "Describe the work and prices" without the AI (no internet, or the AI is busy): each line or comma-separated part
// that ends with an amount becomes an invoice line. The AI does the same, smarter (server/ai.py).
//   "door installation 300"          → Door installation · 1 × 300
//   "2 doors 200 each" / "2 x 200"   → 2 × 200          "3 hours at 60" → 3 × 60
//   "2 double doors 700"             → 2 × 350 (one amount with a count = the line total)
// No "@/" imports: tested with plain Node.

export type QuickLine = { text: string; qty: number; price: number; kind: 'work' };

const AMOUNT = String.raw`\$?(\d[\d,]*(?:\.\d{1,2})?)(k)?`;
const num = (s: string, k?: string) => Number(s.replace(/,/g, '')) * (k ? 1000 : 1);
const tidy = (s: string) => {
  const t = s.replace(/\s+/g, ' ').replace(/[\s,:;-]+$/, '').replace(/^[\s,:;-]+/, '').trim();
  return t ? t[0].toUpperCase() + t.slice(1) : '';
};

function one(part: string): QuickLine | null {
  const s = part.trim();
  if (!s) return null;
  // "... 2 x 200" or "... 2 at 200" or "... 2 × 200"
  let m = s.match(new RegExp(String.raw`^(.*?)(\d+(?:\.\d+)?)\s*(?:x|×|at|по)\s*${AMOUNT}\s*(?:each|ea)?$`, 'i'));
  if (m) return { text: tidy(m[1]), qty: Number(m[2]), price: num(m[3], m[4]), kind: 'work' };
  // "... 200 each"
  m = s.match(new RegExp(String.raw`^(.*?)${AMOUNT}\s*(?:each|ea|cada)$`, 'i'));
  if (m) {
    const count = m[1].match(/^\s*(\d+(?:\.\d+)?)\s+(.*)$/);
    return count
      ? { text: tidy(count[2]), qty: Number(count[1]), price: num(m[2], m[3]), kind: 'work' }
      : { text: tidy(m[1]), qty: 1, price: num(m[2], m[3]), kind: 'work' };
  }
  // "... 700" (with a leading count: the total)
  m = s.match(new RegExp(String.raw`^(.*?)\s${AMOUNT}$`, 'i'));
  if (m) {
    const total = num(m[2], m[3]);
    const count = m[1].match(/^\s*(\d+)\s+(.*)$/);
    if (count && Number(count[1]) > 1) {
      const qty = Number(count[1]);
      return { text: tidy(count[2]), qty, price: Math.round((total / qty) * 100) / 100, kind: 'work' };
    }
    return { text: tidy(m[1]), qty: 1, price: total, kind: 'work' };
  }
  return { text: tidy(s), qty: 1, price: 0, kind: 'work' }; // no amount: the user adds the price
}

export function quickLines(text: string): QuickLine[] {
  return text
    .split(/\n|,(?!\d{3}\b)|;/)
    .map(one)
    .filter((l): l is QuickLine => !!l && (!!l.text || l.price > 0));
}
