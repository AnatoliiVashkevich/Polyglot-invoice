// Calendar dates as plain "YYYY-MM-DD" strings in the phone's local time (no time-zone surprises).

export const pad = (n: number) => String(n).padStart(2, '0');

export const isoDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export const todayIso = () => isoDate(new Date());

export function parseIso(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export const addDays = (iso: string, days: number) => {
  const d = parseIso(iso);
  d.setDate(d.getDate() + days);
  return isoDate(d);
};

/** Month key "YYYY-MM" shifted by n months. */
export function addMonths(monthKey: string, n: number): string {
  const [y, m] = monthKey.split('-').map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}

export const monthOf = (iso: string) => iso.slice(0, 7);

/** The 42 days (6 weeks, Sunday first) shown for a month. */
export function monthGrid(monthKey: string): string[] {
  const first = parseIso(`${monthKey}-01`);
  const start = new Date(first);
  start.setDate(1 - first.getDay());
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return isoDate(d);
  });
}

/** How many week rows a month needs (4, 5 or 6), like the iPhone calendar: no extra row of next month. */
export function weeksIn(monthKey: string): number {
  const first = parseIso(`${monthKey}-01`);
  const daysInMonth = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  return Math.ceil((first.getDay() + daysInMonth) / 7);
}

export function formatMonth(monthKey: string, locale: string) {
  return parseIso(`${monthKey}-01`).toLocaleDateString(locale, { month: 'long' });
}

export function formatDay(iso: string, locale: string) {
  return parseIso(iso).toLocaleDateString(locale, { weekday: 'long', month: 'long', day: 'numeric' });
}

/** Short weekday names, Sunday first. */
export function weekdayNames(locale: string) {
  return Array.from({ length: 7 }, (_, i) =>
    new Date(2023, 0, 1 + i).toLocaleDateString(locale, { weekday: 'narrow' }),
  );
}

/** "14:30" -> "2:30 PM" */
export function formatTime(hhmm: string) {
  const [h, m] = hhmm.split(':').map(Number);
  return `${h % 12 || 12}:${pad(m)} ${h < 12 ? 'AM' : 'PM'}`;
}
