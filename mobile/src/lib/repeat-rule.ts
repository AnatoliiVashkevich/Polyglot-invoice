// Repeating tasks and notes (product-decisions.md §6g): the choices and how a rule reads.
// The server makes the visits (server/repeat.py). No "@/" imports: tested with plain Node.

export type RepeatUnit = 'day' | 'week' | 'month' | 'year';
export type RepeatRule = { every: number; unit: RepeatUnit; until: string | null };

/** The ready choices on the "Repeat?" screen (Custom is separate). */
export const REPEAT_CHOICES: { key: string; label: string; rule: RepeatRule | null }[] = [
  { key: 'never', label: 'Never', rule: null },
  { key: 'week', label: 'Every week', rule: { every: 1, unit: 'week', until: null } },
  { key: '2weeks', label: 'Every 2 weeks', rule: { every: 2, unit: 'week', until: null } },
  { key: 'month', label: 'Every month', rule: { every: 1, unit: 'month', until: null } },
  { key: 'year', label: 'Every year', rule: { every: 1, unit: 'year', until: null } },
];

/** Which ready choice a rule is ('custom' when none fits). */
export function choiceOf(rule: RepeatRule | null): string {
  if (!rule) return 'never';
  const hit = REPEAT_CHOICES.find((c) => c.rule && c.rule.every === rule.every && c.rule.unit === rule.unit);
  return hit ? hit.key : 'custom';
}

const UNIT_WORD: Record<RepeatUnit, [string, string]> = {
  day: ['day', 'days'],
  week: ['week', 'weeks'],
  month: ['month', 'months'],
  year: ['year', 'years'],
};

/** "Every week", "Every 3 days", "Every month until 03/01/2027" (English; the screens translate the parts). */
export function repeatLabel(rule: RepeatRule | null, formatDate: (iso: string) => string = (d) => d): string {
  if (!rule) return 'Does not repeat';
  const [one, many] = UNIT_WORD[rule.unit];
  const base = rule.every === 1 ? `Every ${one}` : `Every ${rule.every} ${many}`;
  return rule.until ? `${base} until ${formatDate(rule.until)}` : base;
}

/** A custom "every N": a whole number 1–365, or null when the typed text isn't one. */
export function parseEvery(text: string): number | null {
  const n = Number(text.trim());
  return Number.isInteger(n) && n >= 1 && n <= 365 ? n : null;
}
