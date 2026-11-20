// "Repeat?" for tasks and notes (product-decisions.md §6g):
//   Never · Every week · Every 2 weeks · Every month · Every year · Custom (every N days / weeks / months)
//   Until: No end date · Until a date
import DateTimePicker from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { Chip } from '@/components/form';
import { t } from '@/i18n';
import { addDays, isoDate, parseIso } from '@/lib/dates';
import { choiceOf, parseEvery, REPEAT_CHOICES, type RepeatRule, type RepeatUnit } from '@/lib/repeat-rule';
import { radius, useColors } from '@/theme';

const CUSTOM_UNITS: { unit: RepeatUnit; label: string }[] = [
  { unit: 'day', label: 'days' },
  { unit: 'week', label: 'weeks' },
  { unit: 'month', label: 'months' },
];

export function RepeatPicker({ value, onChange, startDate }: { value: RepeatRule | null; onChange: (r: RepeatRule | null) => void; startDate: string }) {
  const colors = useColors();
  const [custom, setCustom] = useState(choiceOf(value) === 'custom');
  const [everyText, setEveryText] = useState(String(value?.every ?? 2));
  const choice = custom ? 'custom' : choiceOf(value);
  const until = value?.until ?? null;

  const pick = (key: string) => {
    if (key === 'custom') {
      setCustom(true);
      onChange({ every: parseEvery(everyText) ?? 2, unit: value?.unit === 'year' ? 'month' : (value?.unit ?? 'day'), until });
      return;
    }
    setCustom(false);
    const c = REPEAT_CHOICES.find((x) => x.key === key);
    onChange(c?.rule ? { ...c.rule, until } : null);
  };

  return (
    <View style={{ gap: 12 }}>
      <View style={styles.chips}>
        {REPEAT_CHOICES.map((c) => (
          <Chip key={c.key} label={t(c.label)} active={choice === c.key} onPress={() => pick(c.key)} />
        ))}
        <Chip label={t('Custom')} active={choice === 'custom'} onPress={() => pick('custom')} />
      </View>

      {choice === 'custom' && value && (
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <View style={styles.row}>
            <Text style={[styles.text, { color: colors.text }]}>{t('Every')}</Text>
            <TextInput
              value={everyText}
              onChangeText={(v) => {
                setEveryText(v);
                const n = parseEvery(v);
                if (n) onChange({ ...value, every: n });
              }}
              keyboardType="number-pad"
              selectTextOnFocus
              style={[styles.every, { color: colors.text, borderColor: colors.line, backgroundColor: colors.bg }]}
            />
          </View>
          <View style={styles.chips}>
            {CUSTOM_UNITS.map((u) => (
              <Chip key={u.unit} label={t(u.label)} active={value.unit === u.unit} onPress={() => onChange({ ...value, unit: u.unit })} />
            ))}
          </View>
          {!parseEvery(everyText) && <Text style={styles.error}>{t('A whole number from 1 to 365.')}</Text>}
        </View>
      )}

      {value && (
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <Text style={[styles.label, { color: colors.muted }]}>{t('UNTIL')}</Text>
          <View style={styles.chips}>
            <Chip label={t('No end date')} active={!until} onPress={() => onChange({ ...value, until: null })} />
            <Chip
              label={t('Until a date')}
              active={!!until}
              onPress={() => onChange({ ...value, until: until ?? addDays(startDate, 90) })}
            />
          </View>
          {!!until && (
            <View style={styles.row}>
              <Text style={[styles.text, { color: colors.text }]}>{t('Last day')}</Text>
              <DateTimePicker
                value={parseIso(until)}
                mode="date"
                display="compact"
                minimumDate={parseIso(startDate)}
                accentColor={colors.accent}
                onValueChange={(_, d) => onChange({ ...value, until: isoDate(d) })}
              />
            </View>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  card: { borderRadius: radius.md, padding: 14, gap: 10 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  text: { fontSize: 16, fontWeight: '600' },
  label: { fontSize: 11, fontWeight: '700', letterSpacing: 0.6 },
  every: { width: 70, height: 42, borderWidth: 1, borderRadius: radius.sm, textAlign: 'center', fontSize: 17 },
  error: { color: '#E5484D', fontSize: 14, fontWeight: '600' },
});
