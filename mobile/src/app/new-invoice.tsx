// NEW INVOICE: a questionnaire, one question per screen (product-decisions.md §6):
//   1 Customer · 2 Check info · 3 Work + prices · 4 Expenses · 5 Date · 6 Review → Create
// Free plan: plain fields. (Voice fills these same steps in build step 7.)
import DateTimePicker from '@react-native-community/datetimepicker';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BigButton, Chip, Field, ReviewCard } from '@/components/form';
import { CustomerStep } from '@/components/invoice/customer-step';
import { LANGUAGES, t, type Lang } from '@/i18n';
import { api, ApiError } from '@/lib/api';
import { fetchClients, fetchNextNumber, fetchSettings, saveClient, type Client, type ClientDraft, type Settings } from '@/lib/clients';
import { formatDay, isoDate, parseIso, todayIso } from '@/lib/dates';
import { dueDate, lineCents, parseAmount, totals, type Line } from '@/lib/invoice-math';
import { money } from '@/lib/money';
import { radius, useColors } from '@/theme';

type WorkRow = { key: string; text: string; qty: string; price: string };
type ExpenseRow = { key: string; description: string; amount: string; addToInvoice: boolean };
type DueDays = 0 | 7 | 15 | 30;

const STEPS = ['Customer', 'Check info', 'Work + prices', 'Expenses', 'Date', 'Review'] as const;
const DUE_CHOICES: { days: DueDays; label: string }[] = [
  { days: 0, label: 'Now' },
  { days: 7, label: '7 days' },
  { days: 15, label: '15 days' },
  { days: 30, label: '30 days' },
];

let keySeq = 0;
const newKey = () => `k${++keySeq}`;
const emptyWork = (): WorkRow => ({ key: newKey(), text: '', qty: '1', price: '' });
const emptyExpense = (): ExpenseRow => ({ key: newKey(), description: '', amount: '', addToInvoice: true });
const firstName = (name: string) => name.trim().split(/\s+/)[0] ?? '';

export default function NewInvoiceScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();

  // loaded once
  const [clients, setClients] = useState<Client[] | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loadError, setLoadError] = useState('');

  // the answers
  const [step, setStep] = useState(0);
  const [client, setClient] = useState<ClientDraft | null>(null);
  const [original, setOriginal] = useState<Client | undefined>();
  const [work, setWork] = useState<WorkRow[]>([emptyWork()]);
  const [expenses, setExpenses] = useState<ExpenseRow[]>([emptyExpense()]);
  const [date, setDate] = useState(todayIso());
  const [dueDays, setDueDays] = useState<DueDays>(0);
  const [number, setNumber] = useState('');
  const [taxOn, setTaxOn] = useState(true);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([fetchClients(), fetchSettings(), fetchNextNumber('invoice')])
      .then(([c, s, n]) => {
        setClients(c);
        setSettings(s);
        setDueDays(s.due_days);
        setNumber(n);
      })
      .catch((e) => setLoadError(e instanceof Error ? e.message : 'Could not load.'));
  }, []);

  // ----- the lines as numbers -----
  const workLines: Line[] = useMemo(
    () =>
      work
        .filter((w) => w.text.trim() || w.price.trim())
        .map((w) => ({ text: w.text.trim(), qty: w.qty.trim() ? parseAmount(w.qty) : 1, price: parseAmount(w.price), kind: 'work' })),
    [work],
  );
  const expenseRows = useMemo(
    () => expenses.filter((e) => e.amount.trim()).map((e) => ({ ...e, value: parseAmount(e.amount) })),
    [expenses],
  );
  const invoiceLines: Line[] = useMemo(
    () => [
      ...workLines,
      ...expenseRows
        .filter((e) => e.addToInvoice && e.value > 0)
        .map((e) => ({ text: e.description.trim() || t('Materials'), qty: 1, price: e.value, kind: 'material' as const })),
    ],
    [workLines, expenseRows],
  );
  const taxRate = Number(settings?.tax_rate ?? 0);
  const sum = totals(invoiceLines, taxOn ? taxRate : 0, settings?.tax_applies_to);

  // ----- moving between steps -----
  const go = (to: number) => {
    setError('');
    setStep(to);
  };

  const close = () => {
    const started = !!client || work.some((w) => w.text || w.price);
    if (!started) return router.back();
    Alert.alert(t('Discard this invoice?'), t('What you entered will be lost.'), [
      { text: t('Keep editing'), style: 'cancel' },
      { text: t('Discard'), style: 'destructive', onPress: () => router.back() },
    ]);
  };

  const back = () => (step === 0 ? close() : go(step === 2 && !client ? 0 : step - 1));

  const next = async () => {
    setError('');
    if (step === 1) {
      if (!client?.name.trim()) return setError(t('Please enter the client’s name.'));
      setBusy(true);
      try {
        const saved = await saveClient(client, original);
        setClient({ ...client, id: saved.id, fromContacts: false });
        setOriginal(saved);
        setClients((list) => [saved, ...(list ?? []).filter((c) => c.id !== saved.id)]);
        go(2);
      } catch (e) {
        setError(t(e instanceof Error ? e.message : 'Something went wrong.'));
      } finally {
        setBusy(false);
      }
      return;
    }
    if (step === 2) {
      if (workLines.length === 0) return setError(t('Please add the work and its price.'));
      if (workLines.some((l) => !l.text)) return setError(t('Please describe each line of work.'));
      if (workLines.some((l) => Number.isNaN(l.price) || Number.isNaN(l.qty)))
        return setError(t('Please check the prices: numbers only, like 200 or 64.50.'));
    }
    if (step === 3 && expenseRows.some((e) => Number.isNaN(e.value) || e.value < 0))
      return setError(t('Please check the amounts: numbers only, like 64.50.'));
    go(step + 1);
  };

  const create = async () => {
    if (!client?.id || busy) return;
    setBusy(true);
    setError('');
    try {
      await api('/api/items', {
        method: 'POST',
        body: {
          kind: 'invoice',
          client_id: client.id,
          date,
          due_date: dueDate(date, dueDays),
          number: number.trim(),
          title: workLines.map((l) => l.text).join(', ').slice(0, 200),
          address: client.address,
          lines: workLines,
          expenses: expenseRows.map((e) => ({ description: e.description.trim(), amount: e.value, add_to_invoice: e.addToInvoice })),
          tax_rate: taxOn ? taxRate : 0,
        },
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.dismissTo({ pathname: '/', params: { day: date, at: String(Date.now()) } });
    } catch (e) {
      if (e instanceof ApiError && e.status === 409 && typeof e.detail?.next === 'string') {
        setNumber(e.detail.next);
        setError(t('{used} is already used. Changed to {next}.', { used: number.trim(), next: e.detail.next }));
      } else {
        setError(t(e instanceof Error ? e.message : 'Something went wrong.'));
      }
    } finally {
      setBusy(false);
    }
  };

  // ----- screens -----
  const title = [
    t('Who is it for?'),
    client?.id ? t('Check {name}’s info', { name: firstName(client.name) }) : t('New client'),
    t('What did you do?'),
    t('Any expenses?'),
    t('Date'),
    t('Review'),
  ][step];
  const subtitle = [
    '',
    '',
    t('The work and its price, one line each.'),
    t('Materials you bought for this job, with the price.'),
    '',
    t('Tap anything to change it.'),
  ][step];

  const setW = (key: string, patch: Partial<WorkRow>) => setWork((rows) => rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const setE = (key: string, patch: Partial<ExpenseRow>) =>
    setExpenses((rows) => rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const setC = (patch: Partial<ClientDraft>) => setClient((c) => (c ? { ...c, ...patch } : c));

  const body = () => {
    if (!clients || !settings)
      return loadError ? (
        <Text style={[styles.error, { color: '#E5484D' }]}>{t(loadError)}</Text>
      ) : (
        <ActivityIndicator style={{ marginTop: 40 }} />
      );
    switch (step) {
      case 0:
        return (
          <CustomerStep
            clients={clients}
            onPick={(draft, orig) => {
              setClient(draft);
              setOriginal(orig);
              go(1);
            }}
          />
        );
      case 1:
        return client ? (
          <View style={styles.gap}>
            <Field label={t('Name')} value={client.name} onChangeText={(v) => setC({ name: v })} autoCapitalize="words" />
            <Field label={t('Phone')} value={client.phone} onChangeText={(v) => setC({ phone: v })} keyboardType="phone-pad" textContentType="telephoneNumber" />
            <Field label={t('Email')} value={client.email} onChangeText={(v) => setC({ email: v })} keyboardType="email-address" autoCapitalize="none" />
            <Field label={t('Address')} value={client.address} onChangeText={(v) => setC({ address: v })} textContentType="fullStreetAddress" />
            <Text style={[styles.label, { color: colors.muted }]}>{t('Preferred language')}</Text>
            <View style={styles.chips}>
              <Chip label={t('Not set')} active={!client.preferred_language} onPress={() => setC({ preferred_language: '' })} />
              {(Object.keys(LANGUAGES) as Lang[]).map((l) => (
                <Chip key={l} label={LANGUAGES[l]} active={client.preferred_language === l} onPress={() => setC({ preferred_language: l })} />
              ))}
            </View>
          </View>
        ) : null;
      case 2:
        return (
          <View style={styles.gap}>
            {work.map((w, i) => (
              <View key={w.key} style={[styles.lineCard, { backgroundColor: colors.card }]}>
                <TextInput
                  value={w.text}
                  onChangeText={(v) => setW(w.key, { text: v })}
                  placeholder={i === 0 ? t('Work, e.g. Installed 2 doors') : t('Work')}
                  placeholderTextColor={colors.faint}
                  autoFocus={i === 0 && !w.text}
                  multiline
                  style={[styles.lineText, { color: colors.text }]}
                />
                <View style={styles.lineRow}>
                  <Text style={[styles.small, { color: colors.muted }]}>{t('Qty')}</Text>
                  <TextInput
                    value={w.qty}
                    onChangeText={(v) => setW(w.key, { qty: v })}
                    keyboardType="decimal-pad"
                    selectTextOnFocus
                    style={[styles.qty, { color: colors.text, borderColor: colors.line }]}
                  />
                  <Text style={[styles.small, { color: colors.muted }]}>× $</Text>
                  <TextInput
                    value={w.price}
                    onChangeText={(v) => setW(w.key, { price: v })}
                    placeholder={t('Price')}
                    placeholderTextColor={colors.faint}
                    keyboardType="decimal-pad"
                    style={[styles.price, { color: colors.text, borderColor: colors.line }]}
                  />
                  {work.length > 1 && (
                    <Pressable onPress={() => setWork((rows) => rows.filter((r) => r.key !== w.key))} hitSlop={10} accessibilityLabel={t('Remove')}>
                      <Text style={[styles.remove, { color: colors.faint }]}>✕</Text>
                    </Pressable>
                  )}
                </View>
              </View>
            ))}
            <BigButton kind="quiet" title={t('＋ Another line')} onPress={() => setWork((rows) => [...rows, emptyWork()])} />
            {workLines.length > 0 && !workLines.some((l) => Number.isNaN(l.price) || Number.isNaN(l.qty)) && (
              <Text style={[styles.total, { color: colors.text }]}>
                {t('Total')} {money(totals(workLines).total)}
              </Text>
            )}
          </View>
        );
      case 3:
        return (
          <View style={styles.gap}>
            {expenses.map((e) => (
              <View key={e.key} style={[styles.lineCard, { backgroundColor: colors.card }]}>
                <View style={styles.lineRow}>
                  <TextInput
                    value={e.description}
                    onChangeText={(v) => setE(e.key, { description: v })}
                    placeholder={t('Materials')}
                    placeholderTextColor={colors.faint}
                    style={[styles.lineText, { color: colors.text, flex: 1 }]}
                  />
                  <Text style={[styles.small, { color: colors.muted }]}>$</Text>
                  <TextInput
                    value={e.amount}
                    onChangeText={(v) => setE(e.key, { amount: v })}
                    placeholder="0.00"
                    placeholderTextColor={colors.faint}
                    keyboardType="decimal-pad"
                    style={[styles.price, { color: colors.text, borderColor: colors.line }]}
                  />
                  {expenses.length > 1 && (
                    <Pressable onPress={() => setExpenses((rows) => rows.filter((r) => r.key !== e.key))} hitSlop={10} accessibilityLabel={t('Remove')}>
                      <Text style={[styles.remove, { color: colors.faint }]}>✕</Text>
                    </Pressable>
                  )}
                </View>
                <View style={[styles.switchRow, { borderTopColor: colors.line }]}>
                  <Text style={[styles.switchText, { color: colors.text }]}>{t('Add to invoice?')}</Text>
                  <Switch value={e.addToInvoice} onValueChange={(v) => setE(e.key, { addToInvoice: v })} trackColor={{ true: colors.accent }} />
                </View>
              </View>
            ))}
            <Text style={[styles.small, { color: colors.muted }]}>{t('Always saved as your expense too.')}</Text>
            <BigButton kind="quiet" title={t('＋ Another expense')} onPress={() => setExpenses((rows) => [...rows, emptyExpense()])} />
          </View>
        );
      case 4:
        return (
          <View style={styles.gap}>
            <View style={[styles.calendarCard, { backgroundColor: colors.card }]}>
              <DateTimePicker
                value={parseIso(date)}
                mode="date"
                display="inline"
                accentColor={colors.accent}
                onValueChange={(_, d) => setDate(isoDate(d))}
              />
            </View>
            <Text style={[styles.label, { color: colors.muted }]}>{t('Due')}</Text>
            <View style={styles.chips}>
              {DUE_CHOICES.map((c) => (
                <Chip key={c.days} label={t(c.label)} active={dueDays === c.days} onPress={() => setDueDays(c.days)} />
              ))}
            </View>
          </View>
        );
      default:
        return client ? (
          <View style={styles.gap}>
            <ReviewCard onPress={() => go(1)}>
              <Text style={[styles.cardTitle, { color: colors.text }]}>{client.name}</Text>
              {!!(client.phone || client.email) && (
                <Text style={[styles.small, { color: colors.muted }]}>{[client.phone, client.email].filter(Boolean).join(' · ')}</Text>
              )}
            </ReviewCard>

            <ReviewCard onPress={() => go(2)}>
              {invoiceLines.map((l, i) => (
                <View key={i} style={styles.reviewLine}>
                  <Text style={[styles.reviewText, { color: colors.text }]}>
                    {l.qty !== 1 ? `${l.qty} × ` : ''}
                    {l.text}
                  </Text>
                  <Text style={[styles.reviewText, { color: colors.text }]}>{money(lineCents(l) / 100)}</Text>
                </View>
              ))}
            </ReviewCard>

            {taxRate > 0 && (
              <View style={[styles.taxRow, { backgroundColor: colors.card }]}>
                <Text style={[styles.reviewText, { color: colors.text, flex: 1 }]}>
                  {t('Sales tax {rate}% ({what})', {
                    rate: taxRate,
                    what: settings.tax_applies_to === 'everything' ? t('everything') : t('materials'),
                  })}{' '}
                  {money(totals(invoiceLines, taxRate, settings.tax_applies_to).tax)}
                </Text>
                <Switch value={taxOn} onValueChange={setTaxOn} trackColor={{ true: colors.accent }} />
              </View>
            )}

            <View style={styles.reviewLine}>
              <Text style={[styles.grand, { color: colors.text }]}>{t('Total')}</Text>
              <Text style={[styles.grand, { color: colors.text }]}>{money(sum.total)}</Text>
            </View>

            <View style={[styles.numberRow, { backgroundColor: colors.card }]}>
              <Text style={[styles.small, { color: colors.muted }]}>{t('Invoice number')}</Text>
              <TextInput
                value={number}
                onChangeText={setNumber}
                autoCapitalize="characters"
                autoCorrect={false}
                style={[styles.numberInput, { color: colors.text }]}
              />
            </View>

            <ReviewCard onPress={() => go(4)}>
              <Text style={[styles.reviewText, { color: colors.text }]}>
                {formatDay(date, 'en-US')} · {dueDays === 0 ? t('Due: Now') : t('Due: {date}', { date: formatDay(dueDate(date, dueDays), 'en-US') })}
              </Text>
            </ReviewCard>
          </View>
        ) : null;
    }
  };

  const bottom =
    step === 0 ? null : step === 5 ? (
      <BigButton title={t('Create invoice')} onPress={create} busy={busy} />
    ) : step === 3 && expenseRows.length === 0 ? (
      <BigButton kind="quiet" title={t('Skip')} onPress={next} />
    ) : (
      <BigButton title={t('Next')} onPress={next} busy={busy} />
    );

  return (
    <KeyboardAvoidingView behavior="padding" style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={[styles.top, { paddingTop: insets.top + 4 }]}>
        <Pressable onPress={back} hitSlop={12} accessibilityRole="button" accessibilityLabel={step === 0 ? t('Close') : t('Back')}>
          <Text style={[styles.topBtn, { color: colors.accent }]}>{step === 0 ? t('Cancel') : `‹ ${t('Back')}`}</Text>
        </Pressable>
        <Text style={[styles.topTitle, { color: colors.muted }]}>
          {t('New invoice')} · {step + 1}/{STEPS.length}
        </Text>
        <View style={{ width: 64 }} />
      </View>
      <View style={[styles.progress, { backgroundColor: colors.line }]}>
        <View style={[styles.progressFill, { backgroundColor: colors.accent, width: `${((step + 1) / STEPS.length) * 100}%` }]} />
      </View>

      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
        <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
        {!!subtitle && <Text style={[styles.subtitle, { color: colors.muted }]}>{subtitle}</Text>}
        <View style={{ marginTop: 16 }}>{body()}</View>
      </ScrollView>

      {(!!error || bottom) && (
        <View style={[styles.bottom, { paddingBottom: Math.max(insets.bottom, 12), borderTopColor: colors.line, backgroundColor: colors.bg }]}>
          {!!error && <Text style={[styles.error, { color: '#E5484D' }]}>{error}</Text>}
          {bottom}
        </View>
      )}
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
  gap: { gap: 12 },
  label: { fontSize: 13, fontWeight: '600', marginTop: 4 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  lineCard: { borderRadius: radius.md, padding: 12, gap: 10 },
  lineText: { fontSize: 17, minHeight: 28 },
  lineRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  small: { fontSize: 14 },
  qty: { width: 54, height: 40, borderWidth: 1, borderRadius: radius.sm, textAlign: 'center', fontSize: 17 },
  price: { flex: 1, minWidth: 90, height: 40, borderWidth: 1, borderRadius: radius.sm, paddingHorizontal: 10, fontSize: 17 },
  remove: { fontSize: 18, paddingHorizontal: 4 },
  total: { fontSize: 17, fontWeight: '700', textAlign: 'right' },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 10 },
  switchText: { fontSize: 16 },
  calendarCard: { borderRadius: radius.md, padding: 8 },
  cardTitle: { fontSize: 18, fontWeight: '700' },
  reviewLine: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  reviewText: { fontSize: 16, flexShrink: 1 },
  taxRow: { flexDirection: 'row', alignItems: 'center', borderRadius: radius.md, padding: 14, gap: 8 },
  grand: { fontSize: 22, fontWeight: '800', paddingHorizontal: 4 },
  numberRow: { flexDirection: 'row', alignItems: 'center', borderRadius: radius.md, paddingHorizontal: 14, gap: 12 },
  numberInput: { flex: 1, height: 50, fontSize: 17, fontWeight: '700', textAlign: 'right' },
  bottom: { paddingHorizontal: 16, paddingTop: 10, gap: 8, borderTopWidth: StyleSheet.hairlineWidth },
  error: { fontSize: 14, fontWeight: '600' },
});
