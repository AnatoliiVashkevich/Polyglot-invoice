// NEW TASK (a scheduled job), one question per screen (product-decisions.md §6b):
//   1 Customer (or Skip) · 2 What to do · 3 Date and time · 4 Reminder (1 hour before by default) → Create
// No prices and no duration: prices are added when the job becomes an invoice.
// /new-task?from=<estimate id> ("Schedule the job") starts filled in, at Date and time.
// /new-task?id=<task id> edits a task (the same screens, filled in).
import DateTimePicker from '@react-native-community/datetimepicker';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BigButton, Chip } from '@/components/form';
import { CustomerStep } from '@/components/invoice/customer-step';
import { t } from '@/i18n';
import { api } from '@/lib/api';
import { fetchClients, saveClient, type Client, type ClientDraft } from '@/lib/clients';
import { isoDate, parseIso, todayIso } from '@/lib/dates';
import { getItem, patchItem, type ServerItem } from '@/lib/items';
import { askForNotifications, syncNotifications } from '@/lib/notifications';
import { DEFAULT_REMINDER, REMINDER_CHOICES, reminderLabel, type ReminderMinutes } from '@/lib/reminders';
import { radius, useColors } from '@/theme';

const STEPS = 4;

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
  const { id: editId, from } = useLocalSearchParams<{ id?: string; from?: string }>();

  const [clients, setClients] = useState<Client[] | null>(null);
  const [loadError, setLoadError] = useState('');
  const [editing, setEditing] = useState<ServerItem | null>(null);

  const [step, setStep] = useState(0);
  const [client, setClient] = useState<{ id: string; name: string; address: string } | null>(null);
  const [what, setWhat] = useState('');
  const [date, setDate] = useState(todayIso());
  const [time, setTime] = useState('09:00');
  const [reminder, setReminder] = useState<ReminderMinutes | null>(DEFAULT_REMINDER);
  const [fromId, setFromId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const source = editId ?? from;
    Promise.all([fetchClients(), source ? getItem(source) : Promise.resolve(null)])
      .then(([c, it]) => {
        setClients(c);
        if (!it) return;
        const cl = c.find((x) => x.id === it.client_id);
        if (cl) setClient({ id: cl.id, name: cl.name, address: cl.address });
        setWhat(it.title || it.lines.map((l) => l.text).join(', '));
        if (editId) {
          setEditing(it);
          setDate(it.date);
          setTime(it.time || '09:00');
          setReminder((it.reminder_minutes as ReminderMinutes | null) ?? null);
          setStep(1);
        } else {
          setFromId(it.id); // "Schedule the job" from an estimate
          setStep(2);
        }
      })
      .catch((e) => setLoadError(e instanceof Error ? e.message : 'Could not load.'));
  }, [editId, from]);

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
      setClient({ id: draft.id, name: draft.name, address: draft.address });
      return go(1);
    }
    setBusy(true); // a phone contact or a new name: saved as a client right away (no duplicates)
    try {
      const saved = await saveClient(draft, original);
      setClients((list) => [saved, ...(list ?? []).filter((c) => c.id !== saved.id)]);
      setClient({ id: saved.id, name: saved.name, address: saved.address });
      go(1);
    } catch (e) {
      setError(t(e instanceof Error ? e.message : 'Something went wrong.'));
    } finally {
      setBusy(false);
    }
  };

  const next = () => {
    if (step === 1 && !what.trim()) return setError(t('Please write what needs to be done.'));
    go(step + 1);
  };

  const finish = async () => {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      if (reminder) await askForNotifications(); // the iPhone asks once; the task is saved either way
      const body = {
        client_id: client?.id ?? null,
        title: what.trim(),
        address: client?.address ?? '',
        date,
        time,
        reminder_minutes: reminder,
      };
      const saved = editing
        ? await patchItem(editing.id, body)
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

  const title = [t('Who is it for?'), t('What needs to be done?'), t('When?'), t('Remind you?')][step];
  const subtitle = [
    t('Or tap Skip at the bottom if it is not for a customer.'),
    client ? client.name : '',
    '',
    t('A notification on your phone before the job. The iPhone asks once to allow notifications.'),
  ][step];

  const body = () => {
    if (!clients) return loadError ? <Text style={styles.error}>{t(loadError)}</Text> : <ActivityIndicator style={{ marginTop: 40 }} />;
    switch (step) {
      case 0:
        return <CustomerStep clients={clients} onPick={pick} />;
      case 1:
        return (
          <TextInput
            value={what}
            onChangeText={setWhat}
            placeholder={t('e.g. Mount TV and hide the cables')}
            placeholderTextColor={colors.faint}
            autoFocus
            multiline
            style={[styles.what, { backgroundColor: colors.card, borderColor: colors.line, color: colors.text }]}
          />
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
    step === 0 ? (
      <BigButton kind="quiet" title={t('Skip')} onPress={() => (setClient(null), go(1))} busy={busy} />
    ) : step === STEPS - 1 ? (
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
        <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
        {!!subtitle && <Text style={[styles.subtitle, { color: colors.muted }]}>{subtitle}</Text>}
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
