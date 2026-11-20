// NEW TASK (a scheduled job), one question per screen (product-decisions.md §6b):
//   1 Client (always: §6g, no Skip) · 2 What to do · 3 Date and time · 4 Repeat? · 5 Reminder (1 hour before) → Create
// Editing a repeating task asks "Only this one / This and all next ones".
// No prices and no duration: prices are added when the job becomes an invoice.
// /new-task?from=<estimate id> ("Schedule the job") starts filled in, at Date and time.
// /new-task?id=<task id> edits a task (the same screens, filled in).
// /new-task?client=<client id> (＋ on a client's page) starts with that client, at "What needs to be done?".
import DateTimePicker from '@react-native-community/datetimepicker';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BigButton, Chip, INVALID } from '@/components/form';
import { AddressPicker } from '@/components/address-picker';
import { askScope } from '@/components/ask-scope';
import { CustomerStep } from '@/components/invoice/customer-step';
import { RepeatPicker } from '@/components/repeat-picker';
import { t } from '@/i18n';
import { api } from '@/lib/api';
import { addClientAddress, fetchClients, saveClient, type Client, type ClientDraft } from '@/lib/clients';
import { isoDate, parseIso, todayIso } from '@/lib/dates';
import { getItem, patchItem, type ServerItem } from '@/lib/items';
import type { RepeatRule } from '@/lib/repeat-rule';
import { askForNotifications, syncNotifications } from '@/lib/notifications';
import { DEFAULT_REMINDER, REMINDER_CHOICES, reminderLabel, type ReminderMinutes } from '@/lib/reminders';
import { radius, useColors } from '@/theme';

const STEPS = 5;
const REPEAT_STEP = 3;
const sameRule = (a: RepeatRule | null | undefined, b: RepeatRule | null | undefined) =>
  (a?.every ?? 0) === (b?.every ?? 0) && (a?.unit ?? '') === (b?.unit ?? '') && (a?.until ?? null) === (b?.until ?? null);

function timeToDate(date: string, time: string) {
  const d = parseIso(date);
  const [h, m] = (time || '09:00').split(':').map(Number);
  d.setHours(h, m, 0, 0);
  return d;
}
const hhmm = (d: Date) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

export default function NewTaskScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { id: editId, from, client: clientParam } = useLocalSearchParams<{ id?: string; from?: string; client?: string }>();

  const [clients, setClients] = useState<Client[] | null>(null);
  const [loadError, setLoadError] = useState('');
  const [editing, setEditing] = useState<ServerItem | null>(null);

  const [step, setStep] = useState(0);
  const [client, setClient] = useState<Client | null>(null);
  const [jobAddress, setJobAddress] = useState(''); // '' = the client's billing address
  const [what, setWhat] = useState('');
  const [date, setDate] = useState(todayIso());
  const [time, setTime] = useState('09:00');
  const [reminder, setReminder] = useState<ReminderMinutes | null>(DEFAULT_REMINDER);
  const [repeat, setRepeat] = useState<RepeatRule | null>(null);
  const [fromId, setFromId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [tried, setTried] = useState(false); // Next with "what" empty (§6q)

  useEffect(() => {
    const source = editId ?? from;
    Promise.all([fetchClients(), source ? getItem(source) : Promise.resolve(null)])
      .then(([c, it]) => {
        setClients(c);
        const pre = clientParam ? c.find((x) => x.id === clientParam) : undefined;
        if (pre && !it) {
          setClient(pre);
          setStep(1);
        }
        if (!it) return;
        const cl = c.find((x) => x.id === it.client_id);
        if (cl) {
          setClient(cl);
          if (it.address && it.address.trim().toLowerCase() !== cl.address.trim().toLowerCase()) setJobAddress(it.address);
        }
        setWhat(it.title || it.lines.map((l) => l.text).join(', '));
        if (editId) {
          setEditing(it);
          setDate(it.date);
          setTime(it.time || '09:00');
          setReminder((it.reminder_minutes as ReminderMinutes | null) ?? null);
          if (it.repeat) setRepeat({ every: it.repeat.every, unit: it.repeat.unit, until: it.repeat.until ?? null });
          setStep(1);
        } else {
          setFromId(it.id); // "Schedule the job" from an estimate
          setStep(2);
        }
      })
      .catch((e) => setLoadError(e instanceof Error ? e.message : 'Could not load.'));
  }, [editId, from, clientParam]);

  const go = (to: number) => {
    setError('');
    setStep(to);
  };

  const close = () => {
    if (!client && !what.trim()) return router.back();
    Alert.alert(editing ? t('Discard your changes?') : t('Discard this task?'), t('What you entered will be lost.'), [
      { text: t('Keep editing'), style: 'cancel' },
      { text: t('Discard'), style: 'destructive', onPress: () => router.back() },
    ]);
  };

  const pick = async (draft: ClientDraft, original?: Client) => {
    setError('');
    if (draft.id) {
      setClient(clients?.find((c) => c.id === draft.id) ?? (original as Client));
      setJobAddress('');
      return go(1);
    }
    setBusy(true); // a phone contact or a new name: saved as a client right away (no duplicates)
    try {
      const saved = await saveClient(draft, original);
      setClients((list) => [saved, ...(list ?? []).filter((c) => c.id !== saved.id)]);
      setClient(saved);
      setJobAddress('');
      go(1);
    } catch (e) {
      setError(t(e instanceof Error ? e.message : 'Something went wrong.'));
    } finally {
      setBusy(false);
    }
  };

  const next = () => {
    if (step === 1 && !what.trim()) {
      setTried(true);
      return setError(t('Please write what needs to be done.'));
    }
    if (step === REPEAT_STEP && repeat?.until && repeat.until < date) return setError(t('The last day can’t be before the first one.'));
    go(step + 1);
  };

  const finish = async () => {
    if (busy || !client) return;
    // a repeating task: this visit only, or this and all next ones
    const scope = editing?.series_id ? await askScope(t('Change the repeating task')) : 'one';
    if (!scope) return;
    setBusy(true);
    setError('');
    try {
      if (reminder) await askForNotifications(); // the iPhone asks once; the task is saved either way
      const body: Record<string, unknown> = {
        client_id: client.id,
        title: what.trim(),
        address: jobAddress || client.address || '',
        date,
        time,
        reminder_minutes: reminder,
      };
      if (editing) {
        const ruleChanged = !sameRule(repeat, editing.repeat);
        if (scope === 'following') {
          if (date === editing.date) delete body.date; // a new date restarts the series from this visit
          if (ruleChanged) body.repeat = repeat;
        } else if (!editing.series_id && repeat) body.repeat = repeat; // a single task starts repeating
      } else if (repeat) body.repeat = repeat;
      const saved = editing
        ? await patchItem(editing.id, body, scope)
        : await api<ServerItem>('/api/items', { method: 'POST', body: { kind: 'task', ...body, ...(fromId ? { from_item_id: fromId } : {}) } });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      syncNotifications();
      if (editing) router.back();
      else router.replace({ pathname: '/job/[id]', params: { id: saved.id } });
    } catch (e) {
      setError(t(e instanceof Error ? e.message : 'Something went wrong.'));
    } finally {
      setBusy(false);
    }
  };

  const title = [t('Choose the client'), t('What needs to be done?'), t('When?'), t('Repeat?'), t('Remind you?')][step];
  const subtitle = [
    t('Not for a client? Make a note instead (＋ → Note).'),
    client ? client.name : '',
    '',
    t('For regular work, like pool cleaning every week. Each visit gets its own reminder and is marked done on its own.'),
    t('A notification on your phone before the job. The iPhone asks once to allow notifications.'),
  ][step];

  const body = () => {
    if (!clients) return loadError ? <Text style={styles.error}>{t(loadError)}</Text> : <ActivityIndicator style={{ marginTop: 40 }} />;
    switch (step) {
      case 0:
        return <CustomerStep clients={clients} onPick={pick} />;
      case 1:
        return (
          <View style={{ gap: 12 }}>
            <TextInput
              value={what}
              onChangeText={setWhat}
              placeholder={t('e.g. Mount TV and hide the cables')}
              placeholderTextColor={colors.faint}
              autoFocus={!what}
              multiline
              style={[styles.what, { backgroundColor: colors.card, borderColor: colors.line, color: colors.text }, tried && !what.trim() && INVALID]}
            />
            {!!client && (
              <AddressPicker
                main={client.address}
                others={client.addresses ?? []}
                value={jobAddress}
                onChange={setJobAddress}
                onAdd={async (a) => setClient(await addClientAddress(client, a))}
              />
            )}
          </View>
        );
      case 2:
        return (
          <View style={{ gap: 12 }}>
            <View style={[styles.card, { backgroundColor: colors.card }]}>
              <DateTimePicker
                value={parseIso(date)}
                mode="date"
                display="inline"
                accentColor={colors.accent}
                style={{ alignSelf: 'stretch' }}
                onValueChange={(_, d) => setDate(isoDate(d))}
              />
            </View>
            <View style={[styles.timeRow, { backgroundColor: colors.card }]}>
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
          </View>
        );
      case REPEAT_STEP:
        return <RepeatPicker value={repeat} onChange={setRepeat} startDate={date} />;
      default:
        return (
          <View style={styles.chips}>
            {REMINDER_CHOICES.map((m) => (
              <Chip key={String(m)} label={t(reminderLabel(m))} active={reminder === m} onPress={() => setReminder(m)} />
            ))}
          </View>
        );
    }
  };

  const bottom =
    step === 0 ? null : step === STEPS - 1 ? (
      <BigButton title={editing ? t('Save changes') : t('Create task')} onPress={finish} busy={busy} />
    ) : (
      <BigButton title={t('Next')} onPress={next} />
    );

  return (
    <KeyboardAvoidingView behavior="padding" style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={[styles.top, { paddingTop: insets.top + 4 }]}>
        <Pressable onPress={step === 0 ? close : () => go(step - 1)} hitSlop={12} accessibilityRole="button">
          <Text style={[styles.topBtn, { color: colors.accent }]}>{step === 0 ? t('Cancel') : `‹ ${t('Back')}`}</Text>
        </Pressable>
        <Text style={[styles.topTitle, { color: colors.muted }]}>
          {editing ? t('Edit task') : `${t('New task')} · ${step + 1}/${STEPS}`}
        </Text>
        <View style={{ width: 64 }} />
      </View>
      <View style={[styles.progress, { backgroundColor: colors.line }]}>
        <View style={[styles.progressFill, { backgroundColor: colors.accent, width: `${((step + 1) / STEPS) * 100}%` }]} />
      </View>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
        {!!clients && <Text style={[styles.title, { color: colors.text }]}>{title}</Text>}
        {!!clients && !!subtitle && <Text style={[styles.subtitle, { color: colors.muted }]}>{subtitle}</Text>}
        <View style={{ marginTop: 16 }}>{body()}</View>
      </ScrollView>
      <View style={[styles.bottom, { paddingBottom: Math.max(insets.bottom, 12), borderTopColor: colors.line }]}>
        {!!error && <Text style={styles.error}>{error}</Text>}
        {bottom}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 10 },
  topBtn: { fontSize: 17, fontWeight: '600', width: 64 },
  topTitle: { fontSize: 14, fontWeight: '600' },
  progress: { height: 3, marginHorizontal: 16, borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: 3 },
  content: { padding: 16, paddingBottom: 40 },
  title: { fontSize: 28, fontWeight: '800', letterSpacing: -0.4 },
  subtitle: { fontSize: 15, marginTop: 4 },
  what: { minHeight: 120, borderRadius: radius.md, borderWidth: 1, padding: 14, fontSize: 17, textAlignVertical: 'top' },
  card: { borderRadius: radius.md, padding: 8, alignItems: 'center' },
  timeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: radius.md, padding: 14 },
  label: { fontSize: 17, fontWeight: '600' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  bottom: { paddingHorizontal: 16, paddingTop: 10, gap: 8, borderTopWidth: StyleSheet.hairlineWidth },
  error: { color: '#E5484D', fontSize: 14, fontWeight: '600' },
});
