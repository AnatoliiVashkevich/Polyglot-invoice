// Colors of Polyglot Invoice. Category colors are shared by the filter chips, the calendar bars and the day list.
import { useColorScheme } from 'react-native';

import type { Item } from '@/types';

const light = {
  bg: '#F5F5F8',
  card: '#FFFFFF',
  text: '#14161F',
  muted: '#6B7085',
  faint: '#B4B7C6',
  line: '#E4E5EC',
  accent: '#F26B1D', // orange: today, the ＋ button, the main action
  onAccent: '#FFFFFF',
  selected: '#14161F', // the selected day's circle
  onSelected: '#FFFFFF',
  backdrop: 'rgba(12, 14, 24, 0.35)',
};

const dark: typeof light = {
  bg: '#0B0C12',
  card: '#171923',
  text: '#F1F2F7',
  muted: '#9A9FB4',
  faint: '#4A4E63',
  line: '#262938',
  accent: '#FF7A2E',
  onAccent: '#FFFFFF',
  selected: '#F1F2F7',
  onSelected: '#0B0C12',
  backdrop: 'rgba(0, 0, 0, 0.55)',
};

export type Colors = typeof light;

export function useColors(): Colors {
  return useColorScheme() === 'dark' ? dark : light;
}

export const kindColors = {
  task: '#3B82F6', // blue
  estimate: '#8B5CF6', // purple
  invoice: '#10B981', // green
  unpaid: '#EF4444', // red: an invoice waiting for money (Requested)
} as const;

export type ColorKey = keyof typeof kindColors;

/** The color of an item on the calendar and in lists. */
export function itemColorKey(item: Item): ColorKey {
  if (item.kind === 'invoice' && item.status === 'requested') return 'unpaid';
  return item.kind;
}

export const radius = { sm: 8, md: 12, lg: 18, pill: 999 } as const;
