// "What kind of work do you do?" (product-decisions.md §6m): the choices, and the one text the server keeps
// (businesses.trade, the AI's context), e.g. "Handyman / repair, Cleaning, Mobile car detailing".
// No "@/" imports: tested with plain Node.

export const TRADES = [
  'Handyman / repair',
  'Construction / remodeling',
  'Cleaning',
  'Landscaping / lawn care',
  'Painting',
  'Plumbing',
  'Electrical',
  'HVAC',
  'Flooring / tile',
  'Moving',
  'Auto repair',
  'Hair / beauty',
  'Pet care',
  'Tutoring / lessons',
  'IT / computer help',
  'Photography',
] as const;

/** The saved text → the chosen chips + whatever the user wrote under "Other". */
export function splitTrade(saved: string): { chosen: string[]; other: string } {
  const parts = (saved ?? '').split(',').map((p) => p.trim()).filter(Boolean);
  const known = new Set<string>(TRADES);
  // "Handyman / repair" contains no comma, so splitting by comma keeps every chip whole
  return { chosen: parts.filter((p) => known.has(p)), other: parts.filter((p) => !known.has(p)).join(', ') };
}

/** The chips + "Other" → the text the server keeps (chips in list order, then Other). At most 300 characters. */
export function joinTrade(chosen: string[], other: string): string {
  const inOrder = TRADES.filter((t) => chosen.includes(t));
  return [...inOrder, other.trim()].filter(Boolean).join(', ').slice(0, 300);
}
