// HOME: the month calendar (works like the iPhone calendar) with the selected day's list under it,
// and the orange ＋ for creating. Data is FAKE until build step 2.
import * as Haptics from 'expo-haptics';
import { useCallback, useMemo, useRef, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DayRow } from '@/components/calendar/day-list';
import { FilterChips } from '@/components/calendar/filter-chips';
import { MonthPager, type MonthPagerHandle } from '@/components/calendar/month-pager';
import { CreateButton } from '@/components/create-button';
import { fakeItems } from '@/data/fake';
import { formatDay, formatMonth, monthOf, todayIso, weekdayNames } from '@/lib/dates';
import { locale, t } from '@/i18n';
import { radius, useColors } from '@/theme';
import type { Filter, Item } from '@/types';

const byTime = (a: Item, b: Item) => (a.time ?? '99:99').localeCompare(b.time ?? '99:99');

function passes(item: Item, filter: Filter) {
  if (filter === 'all') return true;
  if (filter === 'unpaid') return item.kind === 'invoice' && item.status === 'requested';
  return item.kind === filter;
}

export default function CalendarScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const pager = useRef<MonthPagerHandle>(null);
  const [items] = useState<Item[]>(fakeItems);
  const [filter, setFilter] = useState<Filter>('all');
  const [selectedDay, setSelectedDay] = useState(todayIso());
  const [month, setMonth] = useState(monthOf(todayIso()));

  const itemsByDay = useMemo(() => {
    const map = new Map<string, Item[]>();
    for (const it of items) {
      if (!passes(it, filter)) continue;
      map.set(it.date, [...(map.get(it.date) ?? []), it]);
    }
    for (const list of map.values()) list.sort(byTime);
    return map;
  }, [items, filter]);

  const dayItems = itemsByDay.get(selectedDay) ?? [];
  const isCurrentMonth = month === monthOf(todayIso());

  const goToday = useCallback(() => {
    Haptics.selectionAsync();
    setSelectedDay(todayIso());
    pager.current?.showMonth(monthOf(todayIso()));
  }, []);

  const openItem = useCallback((item: Item) => {
    Alert.alert(item.clientName || t('No customer'), t('The job card is built in a later step.'));
  }, []);

  return (
    <View style={[styles.screen, { backgroundColor: colors.bg, paddingTop: insets.top + 6 }]}>
      <View style={styles.header}>
        <View>
          <Text style={[styles.year, { color: colors.accent }]}>{month.slice(0, 4)}</Text>
          <Text style={[styles.month, { color: colors.text }]}>{formatMonth(month, locale())}</Text>
        </View>
        <Pressable
          onPress={goToday}
          accessibilityRole="button"
          style={[styles.todayBtn, { borderColor: colors.line, backgroundColor: colors.card, opacity: isCurrentMonth && selectedDay === todayIso() ? 0.5 : 1 }]}>
          <Text style={[styles.todayText, { color: colors.text }]}>{t('Today')}</Text>
        </Pressable>
      </View>

      <FilterChips value={filter} onChange={setFilter} />

      <View style={styles.weekdays}>
        {weekdayNames(locale()).map((d, i) => (
          <Text key={i} style={[styles.weekday, { color: colors.muted }]}>
            {d}
          </Text>
        ))}
      </View>

      <MonthPager
        ref={pager}
        itemsByDay={itemsByDay}
        selectedDay={selectedDay}
        onSelectDay={setSelectedDay}
        onMonthChange={setMonth}
      />

      <FlatList
        data={dayItems}
        keyExtractor={(it) => it.id}
        renderItem={({ item }) => <DayRow item={item} onPress={openItem} />}
        style={[styles.list, { borderTopColor: colors.line }]}
        contentContainerStyle={{ padding: 12, gap: 8, paddingBottom: insets.bottom + 140 }}
        ListHeaderComponent={
          <Text style={[styles.dayTitle, { color: colors.text }]}>
            {selectedDay === todayIso() ? `${t('Today')} · ` : ''}
            {formatDay(selectedDay, locale())}
          </Text>
        }
        ListEmptyComponent={
          <View style={[styles.empty, { backgroundColor: colors.card }]}>
            <Text style={[styles.emptyText, { color: colors.muted }]}>{t('Nothing on this day. Tap ＋ to add.')}</Text>
          </View>
        }
      />

      <CreateButton />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', paddingHorizontal: 16, marginBottom: 10 },
  year: { fontSize: 14, fontWeight: '800', letterSpacing: 0.5 },
  month: { fontSize: 32, fontWeight: '800', letterSpacing: -0.5, textTransform: 'capitalize' },
  todayBtn: { paddingHorizontal: 14, height: 34, borderRadius: radius.pill, borderWidth: 1, justifyContent: 'center', marginBottom: 4 },
  todayText: { fontSize: 15, fontWeight: '600' },
  weekdays: { flexDirection: 'row', paddingHorizontal: 4, marginTop: 10, marginBottom: 2 },
  weekday: { width: `${100 / 7}%`, textAlign: 'center', fontSize: 12, fontWeight: '600' },
  list: { flex: 1, borderTopWidth: StyleSheet.hairlineWidth },
  dayTitle: { fontSize: 17, fontWeight: '700', marginBottom: 2, textTransform: 'capitalize' },
  empty: { borderRadius: radius.md, padding: 16 },
  emptyText: { fontSize: 14 },
});
