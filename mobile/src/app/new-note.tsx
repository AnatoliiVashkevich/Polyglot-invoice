// NEW NOTE (＋ → Note) and EDIT NOTE (/new-note?id=…) — product-decisions.md §6g.
// One simple screen: the text, the day, an optional time, Repeat?, and a reminder. No client, no prices.
// Editing a repeating note asks "Only this one / This and all next ones".
import DateTimePicker from '@react-native-community/datetimepicker';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { askScope } from '@/components/ask-scope';
import { BigButton, Chip } from '@/components/form';
import { RepeatPicker } from '@/components/repeat-picker';
import { t } from '@/i18n';
import { api } from '@/lib/api';
import { isoDate, parseIso, todayIso } from '@/lib/dates';
import { getItem, patchItem, type ServerItem } from '@/lib/items';
import { askForNotifications, syncNotifications } from '@/lib/notifications';
import { REMINDER_CHOICES, reminderLabel, type ReminderMinutes } from '@/lib/reminders';
import type { RepeatRule } from '@/lib/repeat-rule';
import { radius, useColors } from '@/theme';

const hhmm = (d: Date) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
function timeToDate(date: string, time: string) {
  const d = parseIso(date);
  const [h, m] = (time || '09:00').split(':').map(Number);
  d.setHours(h, m, 0, 0);
  return d;
}
const sameRule = (a: RepeatRule | null | undefined, b: RepeatRule | null | undefined) =>
  (a?.every ?? 0) === (b?.every ?? 0) && (a?.unit ?? '') === (b?.unit ?? '') && (a?.until ?? null) === (b?.until ?? null);

export default function NewNoteScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { id: editId } = useLocalSearchParams<{ id?: string }>();
  const [editing, setEditing] = useState<ServerItem | null>(null);
  const [loading, setLoading] = useState(!!editId);
  const [text, setText] = useState('');
  const [date, setDate] = useState(todayIso());
  const [atTime, setAtTime] = useState(false);
  const [time, setTime] = useState('09:00');
  const [repeat, setRepeat] = useState<RepeatRule | null>(null);
  const [reminder, setReminder] = useState<ReminderMinutes | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!editId) return;
    getItem(editId)
      .then((it) => {
        setEditing(it);
        setText(it.title);
        setDate(it.date);
        setAtTime(!!it.time);
        setTime(it.time || '09:00');
        setReminder((it.reminder_minutes as ReminderMinutes | null) ?? null);
        if (it.repeat) setRepeat({ every: it.repeat.every, unit: it.repeat.unit, until: it.repeat.until ?? null });
      })
      .catch((e) => setError(t(e instanceof Error ? e.message : 'Could not load.')))
      .finally(() => setLoading(false));
  }, [editId]);

  const close = () => {
    if (!text.trim() || (editing && text === editing.title)) return router.back();
    Alert.alert(editing ? t('Discard your changes?') : t('Discard this note?'), t('What you entered will be lost.'), [
      { text: t('Keep editing'), style: 'cancel' },
      { text: t('Discard'), style: 'destructive', onPress: () => router.back() },
    ]);
  };

  const save = async () => {
    if (busy) return;
    if (!text.trim()) return setError(t('Please write the note.'));
    if (repeat?.until && repeat.until < date) return setError(t('The last day can’t be before the first one.'));
    const scope = editing?.series_id ? await askScope(t('Change the repeating note')) : 'one';
    if (!scope) return;
    setBusy(true);
    setError('');
    try {
      if (reminder) await askForNotifications();
      const body: Record<string, unknown> = { title: text.trim(), date, time: atTime ? time : '', reminder_minutes: reminder };
      if (editing) {
        if (scope === 'following') {
          if (date === editing.date) delete body.date;
          if (!sameRule(repeat, editing.repeat)) body.repeat = repeat;
        } else if (!editing.series_id && repeat) body.repeat = repeat;
      } else if (repeat) body.repeat = repeat;
      const saved = editing
        ? await patchItem(editing.id, body, scope)
        : await api<ServerItem>('/api/items', { method: 'POST', body: { kind: 'note', ...body } });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      syncNotifications();
      if (editing) router.back();
      else router.dismissTo({ pathname: '/', params: { day: saved.date, at: String(Date.now()) } });
    } catch (e) {
      setError(t(e instanceof Error ? e.message : 'Something went wrong.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior="padding" style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={[styles.top, { paddingTop: insets.top + 4 }]}>
        <Pressable onPress={close} hitSlop={12} accessibilityRole="button">
          <Text style={[styles.topBtn, { color: colors.accent }]}>{t('Cancel')}</Text>
        </Pressable>
        <Text style={[styles.topTitle, { color: colors.muted }]}>{editing ? t('Edit note') : t('New note')}</Text>
        <View style={{ width: 64 }} />
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} />
      ) : (
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder={t('e.g. Pick up tile at Home Depot, Pay the truck insurance')}
            placeholderTextColor={colors.faint}
            autoFocus={!editId}
            multiline
            style={[styles.text, { backgroundColor: colors.card, borderColor: colors.line, color: colors.text }]}
          />

          <View style={[styles.card, { backgroundColor: colors.card }]}>
            <View style={styles.row}>
              <Text style={[styles.label, { color: colors.text }]}>{t('Day')}</Text>
              <DateTimePicker value={parseIso(date)} mode="date" display="compact" accentColor={colors.accent} onValueChange={(_, d) => setDate(isoDate(d))} />
            </View>
            <View style={[styles.row, styles.line, { borderTopColor: colors.line }]}>
              <Text style={[styles.label, { color: colors.text }]}>{t('At a time')}</Text>
              <Switch value={atTime} onValueChange={setAtTime} trackColor={{ true: colors.accent }} />
            </View>
            {atTime && (
              <View style={styles.row}>
                <Text style={[styles.label, { color: colors.text }]}>{t('Time')}</Text>
                <DateTimePicker
                  value={timeToDate(date, time)}
                  mode="time"
                  display="compact"
                  minuteInterval={5}
                  accentColor={colors.accent}
                  onValueChange={(_, d) => setTime(hhmm(d))}
                />
              </View>
            )}
          </View>

          <Text style={[styles.section, { color: colors.muted }]}>{t('REPEAT?')}</Text>
          <RepeatPicker value={repeat} onChange={setRepeat} startDate={date} />

          <Text style={[styles.section, { color: colors.muted }]}>{t('REMIND YOU?')}</Text>
          <View style={styles.chips}>
            {REMINDER_CHOICES.map((m) => (
              <Chip key={String(m)} label={t(reminderLabel(m))} active={reminder === m} onPress={() => setReminder(m)} />
            ))}
          </View>
          {!atTime && !!reminder && <Text style={[styles.hint, { color: colors.muted }]}>{t('Without a time, reminders count from 9:00 that day.')}</Text>}
        </ScrollView>
      )}

      <View style={[styles.bottom, { paddingBottom: Math.max(insets.bottom, 12), borderTopColor: colors.line }]}>
        {!!error && <Text style={styles.error}>{error}</Text>}
        <BigButton title={editing ? t('Save changes') : t('Save note')} onPress={save} busy={busy} disabled={loading} />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 8 },
  topBtn: { fontSize: 17, fontWeight: '600', width: 64 },
  topTitle: { fontSize: 15, fontWeight: '600' },
  content: { padding: 16, gap: 12, paddingBottom: 40 },
  text: { minHeight: 110, borderRadius: radius.md, borderWidth: 1, padding: 14, paddingTop: 14, fontSize: 18, textAlignVertical: 'top' },
  card: { borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 6 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 48 },
  line: { borderTopWidth: StyleSheet.hairlineWidth },
  label: { fontSize: 16, fontWeight: '600' },
  section: { fontSize: 12, fontWeight: '700', letterSpacing: 0.6, marginTop: 6 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  hint: { fontSize: 13 },
  bottom: { paddingHorizontal: 16, paddingTop: 10, gap: 8, borderTopWidth: StyleSheet.hairlineWidth },
  error: { color: '#E5484D', fontSize: 14, fontWeight: '600' },
});
