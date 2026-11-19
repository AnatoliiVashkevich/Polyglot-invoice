// The selected day's entries, under the month:
//   ● Ann Lee · Invoice INV-0012
//     Installed 3 doors · $700 · Requested
// Tasks show the time first and the address on the second line.
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { formatTime } from '@/lib/dates';
import { money } from '@/lib/money';
import { t } from '@/i18n';
import { itemColorKey, kindColors, radius, useColors } from '@/theme';
import type { Item } from '@/types';

const KIND_LABEL = { task: 'Task', estimate: 'Estimate', invoice: 'Invoice' } as const;
const STATUS_LABEL = { created: 'Created', done: 'Done', sent: 'Sent', requested: 'Requested', paid: 'Paid' } as const;

export function DayRow({ item, onPress }: { item: Item; onPress: (item: Item) => void }) {
  const colors = useColors();
  const color = kindColors[itemColorKey(item)];
  const done = item.status === 'paid' || item.status === 'done';
  const who = item.clientName || t('No customer');
  const first =
    item.kind === 'task'
      ? [item.time && formatTime(item.time), who, t(KIND_LABEL.task)].filter(Boolean).join(' · ')
      : `${who} · ${t(KIND_LABEL[item.kind])}${item.number ? ` ${item.number}` : ''}`;
  const second =
    item.kind === 'task'
      ? [item.title, item.address && `📍 ${item.address}`].filter(Boolean).join(' · ')
      : [item.title, item.amount !== undefined && money(item.amount)].filter(Boolean).join(' · ');
  const showStatus = item.status !== 'created';
  return (
    <Pressable
      onPress={() => onPress(item)}
      style={({ pressed }) => [styles.row, { backgroundColor: pressed ? colors.line : colors.card, opacity: done ? 0.6 : 1 }]}>
      <View style={[styles.stripe, { backgroundColor: color }]} />
      <View style={styles.body}>
        <Text style={[styles.first, { color: colors.text }]} numberOfLines={1}>
          {first}
        </Text>
        <Text style={[styles.second, { color: colors.muted }]} numberOfLines={1}>
          {second}
          {showStatus && (
            <Text style={{ color: item.status === 'requested' ? kindColors.unpaid : colors.muted, fontWeight: '700' }}>
              {' · '}
              {item.status === 'paid' ? '✓ ' : ''}
              {t(STATUS_LABEL[item.status])}
            </Text>
          )}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', borderRadius: radius.md, overflow: 'hidden', minHeight: 56 },
  stripe: { width: 5 },
  body: { flex: 1, paddingHorizontal: 12, paddingVertical: 9, gap: 2, justifyContent: 'center' },
  first: { fontSize: 15, fontWeight: '600' },
  second: { fontSize: 13 },
});
