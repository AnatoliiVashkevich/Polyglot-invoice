// Tasks · Estimates · Invoices · Notes · Unpaid. Same colors as the calendar bars. Tap again to show everything.
import * as Haptics from 'expo-haptics';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { t } from '@/i18n';
import { kindColors, radius, useColors } from '@/theme';
import type { Filter } from '@/types';

const FILTERS: { key: Exclude<Filter, 'all'>; label: string }[] = [
  { key: 'task', label: 'Tasks' },
  { key: 'estimate', label: 'Estimates' },
  { key: 'invoice', label: 'Invoices' },
  { key: 'note', label: 'Notes' },
  { key: 'unpaid', label: 'Unpaid' },
];

export function FilterChips({ value, onChange }: { value: Filter; onChange: (f: Filter) => void }) {
  const colors = useColors();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.scroll} contentContainerStyle={styles.row}>
      {FILTERS.map(({ key, label }) => {
        const active = value === key;
        const color = kindColors[key];
        return (
          <Pressable
            key={key}
            onPress={() => {
              Haptics.selectionAsync();
              onChange(active ? 'all' : key);
            }}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            style={[
              styles.chip,
              { borderColor: active ? color : colors.line, backgroundColor: active ? color : colors.card },
            ]}>
            <View style={[styles.dot, { backgroundColor: active ? '#FFFFFF' : color }]} />
            <Text style={[styles.label, { color: active ? '#FFFFFF' : colors.text }]}>{t(label)}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  // without flexGrow: 0 a horizontal ScrollView stretches down and leaves a big empty gap under the chips
  scroll: { flexGrow: 0 },
  row: { gap: 6, paddingHorizontal: 16 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    height: 32,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  label: { fontSize: 13, fontWeight: '600' },
});
