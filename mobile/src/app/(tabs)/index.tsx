// HOME: the month calendar (works like the iPhone calendar) with the selected day's list under it,
// and the orange ＋ for creating. The items come from the server: the month on screen and one month either side.
import * as Haptics from 'expo-haptics';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DayRow, type RowAction } from '@/components/calendar/day-list';
import { FilterChips } from '@/components/calendar/filter-chips';
import { MonthPager, type MonthPagerHandle } from '@/components/calendar/month-pager';
import { CreateButton } from '@/components/create-button';
import { MarkPaidSheet } from '@/components/mark-paid-sheet';
import { fetchSettings } from '@/lib/clients';
import { addMonths, formatDay, formatMonth, monthGrid, monthOf, todayIso, weekdayNames } from '@/lib/dates';
import { fetchItems, getItem, sendInvoice } from '@/lib/items';
import { syncNotifications } from '@/lib/notifications';
import { locale, t } from '@/i18n';
import { kindColors, radius, useColors } from '@/theme';
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
  const [items, setItems] = useState<Item[]>([]);
  const [loadError, setLoadError] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [selectedDay, setSelectedDay] = useState(todayIso());
  const [month, setMonth] = useState(monthOf(todayIso()));

  // after "Create invoice" the questionnaire comes back here with ?day=…&at=…: show that day
  const params = useLocalSearchParams<{ day?: string; at?: string }>();
  const [seenAt, setSeenAt] = useState(params.at);
  if (params.day && params.at !== seenAt) {
    setSeenAt(params.at);
    setSelectedDay(params.day);
  }
  useEffect(() => {
    if (params.day) pager.current?.showMonth(monthOf(params.day));
  }, [params.day, params.at]);

  // load the visible month plus one month either side (so swiping shows bars right away)
  const load = useCallback(async (monthKey: string) => {
    const start = monthGrid(addMonths(monthKey, -1))[0];
    const end = monthGrid(addMonths(monthKey, 1))[41];
    try {
      const fresh = await fetchItems(start, end);
      setItems((old) => [...old.filter((it) => it.date < start || it.date > end), ...fresh]);
      setLoadError('');
      syncNotifications(); // keeps reminders right after any change made elsewhere
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Could not load.');
    }
  }, []);

  // runs when the tab is shown (e.g. back from creating an invoice) and again whenever the month changes
  useFocusEffect(
    useCallback(() => {
      load(month);
    }, [load, month]),
  );

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
    router.push({ pathname: '/job/[id]', params: { id: item.id } });
  }, []);

  // swipe actions on invoices: Send (Created / Requested) and Mark Paid (Requested)
  const [paying, setPaying] = useState<Item | null>(null);
  const send = useCallback(
    async (item: Item) => {
      try {
        const [full, settings] = await Promise.all([getItem(item.id), fetchSettings()]);
        await sendInvoice(full, settings.doc_language);
        load(month);
      } catch (e) {
        Alert.alert(t('Could not send'), t(e instanceof Error ? e.message : 'Something went wrong.'));
      }
    },
    [load, month],
  );
  const actionsFor = (item: Item): RowAction[] => {
    if (item.kind !== 'invoice' || item.status === 'paid') return [];
    const sendAction = { label: t('Send'), color: kindColors.task, onPress: () => send(item) };
    if (item.status === 'requested') return [{ label: t('Mark Paid'), color: kindColors.invoice, onPress: () => setPaying(item) }, sendAction];
    return [sendAction];
  };

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

      {!!loadError && (
        <Pressable onPress={() => load(month)} style={[styles.error, { backgroundColor: colors.card }]}>
          <Text style={[styles.errorText, { color: kindColors.unpaid }]}>
            {t(loadError)} {t('Tap to try again.')}
          </Text>
        </Pressable>
      )}

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
        renderItem={({ item }) => <DayRow item={item} onPress={openItem} actions={actionsFor(item)} />}
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

      <MarkPaidSheet
        item={paying ? { id: paying.id, total: paying.amount ?? 0, number: paying.number, client_name: paying.clientName } : null}
        onClose={() => setPaying(null)}
        onPaid={() => {
          setPaying(null);
          load(month);
        }}
      />
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
  error: { marginHorizontal: 16, marginTop: 8, borderRadius: radius.md, padding: 10 },
  errorText: { fontSize: 13, fontWeight: '600' },
  empty: { borderRadius: radius.md, padding: 16 },
  emptyText: { fontSize: 14 },
});
