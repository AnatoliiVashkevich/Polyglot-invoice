// The month calendar: swipe left / right between months (a native paging list), tap a day to select it.
// Each day shows up to 2 colored bars with the customer's first name, then "+n".
import * as Haptics from 'expo-haptics';
import { forwardRef, memo, useCallback, useImperativeHandle, useMemo, useRef } from 'react';
import { FlatList, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { addMonths, monthGrid, monthOf, todayIso } from '@/lib/dates';
import { itemColorKey, kindColors, radius, useColors, type Colors } from '@/theme';
import type { Item } from '@/types';

const MONTHS_EACH_SIDE = 60; // 5 years back and ahead
export const CELL_HEIGHT = 60; // 2 top + 26 number + 2 × (2 gap + 13 bar) + 2 spare
const MAX_BARS = 2;

export type MonthPagerHandle = { showMonth: (monthKey: string, animated?: boolean) => void };

type Props = {
  itemsByDay: Map<string, Item[]>;
  selectedDay: string;
  onSelectDay: (day: string) => void;
  onMonthChange: (monthKey: string) => void;
};

const firstName = (item: Item) => (item.clientName ? item.clientName.split(' ')[0] : item.title);

export const MonthPager = forwardRef<MonthPagerHandle, Props>(function MonthPager(
  { itemsByDay, selectedDay, onSelectDay, onMonthChange },
  ref,
) {
  const { width } = useWindowDimensions();
  const listRef = useRef<FlatList<string>>(null);
  const baseMonth = useMemo(() => monthOf(todayIso()), []);
  const months = useMemo(
    () => Array.from({ length: MONTHS_EACH_SIDE * 2 + 1 }, (_, i) => addMonths(baseMonth, i - MONTHS_EACH_SIDE)),
    [baseMonth],
  );

  useImperativeHandle(ref, () => ({
    showMonth(monthKey, animated = true) {
      const index = months.indexOf(monthKey);
      if (index < 0) return;
      listRef.current?.scrollToIndex({ index, animated });
      onMonthChange(monthKey);
    },
  }));

  // a swipe finished: which month is on screen now
  const onSwipeEnd = (x: number) => {
    const month = months[Math.round(x / width)];
    if (month) onMonthChange(month);
    Haptics.selectionAsync();
  };

  const renderMonth = useCallback(
    ({ item: monthKey }: { item: string }) => (
      <MonthPage
        monthKey={monthKey}
        width={width}
        itemsByDay={itemsByDay}
        selectedDay={selectedDay}
        onSelectDay={onSelectDay}
      />
    ),
    [width, itemsByDay, selectedDay, onSelectDay],
  );

  return (
    <FlatList
      ref={listRef}
      data={months}
      keyExtractor={(m) => m}
      renderItem={renderMonth}
      horizontal
      pagingEnabled
      showsHorizontalScrollIndicator={false}
      initialScrollIndex={MONTHS_EACH_SIDE}
      getItemLayout={(_, index) => ({ length: width, offset: width * index, index })}
      onMomentumScrollEnd={(e) => onSwipeEnd(e.nativeEvent.contentOffset.x)}
      windowSize={3}
      initialNumToRender={1}
      maxToRenderPerBatch={2}
      extraData={[itemsByDay, selectedDay]}
      style={{ flexGrow: 0, height: CELL_HEIGHT * 6 }}
    />
  );
});

type PageProps = {
  monthKey: string;
  width: number;
  itemsByDay: Map<string, Item[]>;
  selectedDay: string;
  onSelectDay: (day: string) => void;
};

const MonthPage = memo(function MonthPage({ monthKey, width, itemsByDay, selectedDay, onSelectDay }: PageProps) {
  const colors = useColors();
  const days = useMemo(() => monthGrid(monthKey), [monthKey]);
  const today = todayIso();
  return (
    <View style={[styles.grid, { width }]}>
      {days.map((day) => (
        <DayCell
          key={day}
          day={day}
          items={itemsByDay.get(day) ?? []}
          inMonth={monthOf(day) === monthKey}
          isToday={day === today}
          isSelected={day === selectedDay}
          onPress={onSelectDay}
          colors={colors}
        />
      ))}
    </View>
  );
});

type CellProps = {
  day: string;
  items: Item[];
  inMonth: boolean;
  isToday: boolean;
  isSelected: boolean;
  onPress: (day: string) => void;
  colors: Colors;
};

function DayCell({ day, items, inMonth, isToday, isSelected, onPress, colors }: CellProps) {
  const circle = isSelected ? (isToday ? colors.accent : colors.selected) : 'transparent';
  const numberColor = isSelected
    ? isToday
      ? colors.onAccent
      : colors.onSelected
    : isToday
      ? colors.accent
      : inMonth
        ? colors.text
        : colors.faint;
  return (
    <Pressable
      onPress={() => {
        Haptics.selectionAsync();
        onPress(day);
      }}
      style={[styles.cell, { borderTopColor: colors.line }]}
      accessibilityRole="button"
      accessibilityLabel={`${day}${items.length ? `, ${items.length}` : ''}`}>
      <View style={[styles.num, { backgroundColor: circle }]}>
        <Text style={[styles.numText, { color: numberColor, fontWeight: isToday || isSelected ? '700' : '500' }]}>
          {Number(day.slice(8))}
        </Text>
      </View>
      {/* at most 2 lines under the number: 2 bars, or 1 bar + "+n" (so nothing spills into the next week) */}
      {items.slice(0, items.length > MAX_BARS ? MAX_BARS - 1 : MAX_BARS).map((item) => {
        const done = item.status === 'paid' || item.status === 'done';
        return (
          <View
            key={item.id}
            style={[styles.bar, { backgroundColor: kindColors[itemColorKey(item)], opacity: inMonth ? (done ? 0.45 : 1) : 0.35 }]}>
            <Text style={styles.barText} numberOfLines={1}>
              {done && item.kind === 'invoice' ? '✓ ' : ''}
              {firstName(item)}
            </Text>
          </View>
        );
      })}
      {items.length > MAX_BARS && (
        <View style={[styles.bar, styles.moreBar, { backgroundColor: colors.line, opacity: inMonth ? 1 : 0.35 }]}>
          <Text style={[styles.barText, { color: colors.muted }]}>+{items.length - MAX_BARS + 1}</Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 4 },
  cell: {
    width: `${100 / 7}%`,
    height: CELL_HEIGHT,
    alignItems: 'stretch',
    paddingHorizontal: 1.5,
    paddingTop: 2,
    gap: 2,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  num: { alignSelf: 'center', width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  numText: { fontSize: 15, fontVariant: ['tabular-nums'] },
  bar: { height: 13, borderRadius: radius.sm / 2, paddingHorizontal: 3, justifyContent: 'center' },
  barText: { color: '#FFFFFF', fontSize: 9, fontWeight: '700' },
  moreBar: { alignItems: 'center' },
});
