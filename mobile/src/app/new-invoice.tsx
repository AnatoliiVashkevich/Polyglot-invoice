// NEW INVOICE: a questionnaire, one question per screen (product-decisions.md §6):
//   1 Customer · 2 Check info · 3 Work + prices (each line Work or Materials) · 4 Date · 5 Review → Create
// With Materials lines, Create asks "Add these materials to your expenses?" (what the user paid, counted once).
// Free plan: plain fields. (Voice fills these same steps in build step 7.)
// ESTIMATE: /new-invoice?kind=estimate — the same screens without Due (EST-0001…).
// FROM: /new-invoice?from=<task or estimate id> — "Job done → Create invoice" / "Make invoice", filled in: a task
//   gives the customer and the work (prices still to add, starts at Work); an estimate gives everything (Review).
// EDIT: /new-invoice?id=… opens the same screens filled in, on Review ("Tap anything to change it").
import DateTimePicker from '@react-native-community/datetimepicker';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
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
import { BusinessSheet } from '@/components/business-sheet';
import { AddressPicker } from '@/components/address-picker';
import { CustomerStep } from '@/components/invoice/customer-step';
import { MaterialsExpenseSheet, type PaidExpense } from '@/components/materials-expense-sheet';
import { LANGUAGES, t, type Lang } from '@/i18n';
import { describeToLines } from '@/lib/ai';
import { CLIENT_COPY } from '@/lib/features';
import { api, ApiError } from '@/lib/api';
import { addClientAddress, fetchClients, fetchNextNumber, fetchSettings, saveClient, type Client, type ClientDraft, type Settings } from '@/lib/clients';
import { formatDay, isoDate, parseIso, todayIso } from '@/lib/dates';
import { dueDate, lineCents, overLimit, parseAmount, totals, type Line, type LineKind } from '@/lib/invoice-math';
import { getItem, patchItem, sendInvoice, type ServerItem } from '@/lib/items';
import { money } from '@/lib/money';
import { radius, useColors } from '@/theme';

type WorkRow = { key: string; text: string; qty: string; price: string; kind: LineKind; question?: string; suggestion?: string };
type DueDays = number; // 0 = Now; the chips offer 0 / 7 / 15 / 30

const STEPS = ['Client', 'Check info', 'Work + prices', 'Date', 'Review'] as const;
const DATE = 3;
const REVIEW = 4;
const DUE_CHOICES: { days: DueDays; label: string }[] = [
  { days: 0, label: 'Now' },
  { days: 7, label: '7 days' },
  { days: 15, label: '15 days' },
  { days: 30, label: '30 days' },
];

let keySeq = 0;
const newKey = () => `k${++keySeq}`;
const emptyWork = (): WorkRow => ({ key: newKey(), text: '', qty: '1', price: '', kind: 'work' });
const daysBetween = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86400000);
// language names in the user's screen language (the chips show each language in its own name)
const LANGUAGE_NAMES: Record<Lang, string> = { en: 'English', es: 'Spanish', pt: 'Portuguese', ru: 'Russian', uk: 'Ukrainian' };
const firstName = (name: string) => name.trim().split(/\s+/)[0] ?? '';
/** A job's address when it isn't the client's billing address ('' when it is). */
const otherAddress = (job: string, billing: string) => (job && job.trim().toLowerCase() !== billing.trim().toLowerCase() ? job : '');

export default function NewInvoiceScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ id?: string; kind?: string; from?: string; client?: string }>();
  const editId = params.id;
  const fromId = params.from;
  const [kind, setKind] = useState<'invoice' | 'estimate'>(params.kind === 'estimate' ? 'estimate' : 'invoice');
  const isEstimate = kind === 'estimate';
  const [editing, setEditing] = useState<ServerItem | null>(null); // the invoice being edited

  // loaded once
  const [clients, setClients] = useState<Client[] | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loadError, setLoadError] = useState('');

  // the answers
  const [step, setStep] = useState(0);
  const [client, setClient] = useState<ClientDraft | null>(null);
  const [original, setOriginal] = useState<Client | undefined>();
  const [jobAddress, setJobAddress] = useState(''); // '' = the client's billing address
  const [work, setWork] = useState<WorkRow[]>([emptyWork()]);
  const [date, setDate] = useState(todayIso());
  const [dueDays, setDueDays] = useState<DueDays>(0);
  const [number, setNumber] = useState('');
  const [taxOn, setTaxOn] = useState(true);
  // step 7 part 1: "Describe it in one go" → lines (the AI, or the app's quick reader)
  const [describe, setDescribe] = useState('');
  const [describing, setDescribing] = useState(false);
  const [describeNote, setDescribeNote] = useState('');

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [editBusiness, setEditBusiness] = useState(false);

  useEffect(() => {
    const startKind = params.kind === 'estimate' ? 'estimate' : 'invoice';
    Promise.all([
      fetchClients(),
      fetchSettings(),
      editId ? getItem(editId) : fetchNextNumber(startKind),
      fromId ? getItem(fromId) : Promise.resolve(null),
    ])
      .then(([c, s, third, source]) => {
        setClients(c);
        setSettings(s);
        if (typeof third === 'string') {
          setDueDays(s.due_days);
          setNumber(third);
          // ＋ on a client's page: that client, starting at "check the customer's info"
          const pre = params.client ? c.find((x) => x.id === params.client) : undefined;
          if (pre && !source) {
            setClient({ id: pre.id, name: pre.name, phone: pre.phone, email: pre.email, address: pre.address, preferred_language: pre.preferred_language });
            setOriginal(pre);
            setStep(1);
          }
          if (!source) return;
          // made from a task or an estimate: fill in what it already knows
          const cl = c.find((x) => x.id === source.client_id);
          if (cl) {
            setClient({ id: cl.id, name: cl.name, phone: cl.phone, email: cl.email, address: cl.address, preferred_language: cl.preferred_language });
            setOriginal(cl);
            setJobAddress(otherAddress(source.address, cl.address));
          }
          if (source.lines.length) {
            // an estimate, or a task scheduled from one: everything is known, straight to Review
            setWork(source.lines.map((l) => ({ key: newKey(), text: l.text, qty: String(l.qty ?? 1), price: String(l.price ?? ''), kind: l.kind ?? 'work' })));
            setTaxOn(Number(source.tax_rate) > 0 || Number(s.tax_rate) === 0);
            setStep(cl ? REVIEW : 0);
          } else {
            setWork([{ ...emptyWork(), text: source.title }]); // a task: the work is known, the price is not
            setStep(cl ? 2 : 0);
          }
          return;
        }
        // edit: fill every answer from the invoice
        const it = third;
        const cl = c.find((x) => x.id === it.client_id);
        if (cl) {
          setClient({ id: cl.id, name: cl.name, phone: cl.phone, email: cl.email, address: cl.address, preferred_language: cl.preferred_language });
          setOriginal(cl);
          setJobAddress(otherAddress(it.address, cl.address));
        }
        setWork(
          it.lines.length
            ? it.lines.map((l) => ({ key: newKey(), text: l.text, qty: String(l.qty ?? 1), price: String(l.price ?? ''), kind: l.kind ?? 'work' }))
            : [emptyWork()],
        );
        setDate(it.date);
        setDueDays(it.due_date ? Math.max(0, daysBetween(it.date, it.due_date)) : 0);
        setNumber(it.number);
        setTaxOn(Number(it.tax_rate) > 0);
        if (it.kind === 'estimate') setKind('estimate');
        setEditing(it);
        setStep(REVIEW);
      })
      .catch((e) => setLoadError(e instanceof Error ? e.message : 'Could not load.'));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- loaded once for the screen's params
  }, [editId, fromId]);

  // ----- the lines as numbers -----
  const workLines: Line[] = useMemo(
    () =>
      work
        .filter((w) => w.text.trim() || w.price.trim())
        .map((w) => ({ text: w.text.trim(), qty: w.qty.trim() ? parseAmount(w.qty) : 1, price: parseAmount(w.price), kind: w.kind })),
    [work],
  );
  const invoiceLines = workLines;
  // an invoice keeps the tax rate it was made with; a new one takes it from Settings
  const taxRate = editing && Number(editing.tax_rate) > 0 ? Number(editing.tax_rate) : Number(settings?.tax_rate ?? 0);
  const taxAppliesTo = (editing ? editing.tax_applies_to : settings?.tax_applies_to) ?? 'materials';
  const docLang: Lang = settings?.doc_language ?? 'en';
  const sum = totals(invoiceLines, taxOn ? taxRate : 0, taxAppliesTo);

  const makeLines = async () => {
    const text = describe.trim();
    if (!text || describing) return;
    setDescribing(true);
    setDescribeNote('');
    try {
      const { lines, by } = await describeToLines(text);
      if (!lines.length) return setDescribeNote(t('No lines found. Please write the work and the price, like: door installation 300.'));
      const made = lines.map((l) => ({
        key: newKey(),
        text: l.text,
        qty: String(l.qty ?? 1),
        price: l.price ? String(l.price) : '',
        kind: l.kind ?? 'work',
        question: l.question || undefined, // the AI isn't sure: it asks under the line (§6n)
        suggestion: l.suggestion || undefined,
      }));
      // the new lines replace empty rows; rows the user already filled stay
      setWork((rows) => [...rows.filter((r) => r.text.trim() || r.price.trim()), ...made]);
      setDescribe('');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      const asks = made.filter((m) => m.question).length;
      setDescribeNote(
        by === 'ai' && asks
          ? t('Done. The AI has a question about {n} line(s) below; please answer it.', { n: asks })
          : by === 'ai'
          ? t('Done. Please check the lines below; you can change anything.')
          : t('Made from the numbers you typed (without AI). Please check the lines below.'),
      );
    } finally {
      setDescribing(false);
    }
  };

  // ----- moving between steps -----
  const go = (to: number) => {
    setError('');
    setStep(to);
  };

  const close = () => {
    const started = !!client || work.some((w) => w.text || w.price);
    if (!started) return router.back();
    Alert.alert(editing ? t('Discard your changes?') : t('Discard this invoice?'), t('What you entered will be lost.'), [
      { text: t('Keep editing'), style: 'cancel' },
      { text: t('Discard'), style: 'destructive', onPress: () => router.back() },
    ]);
  };

  const back = () => {
    if (step === 0 || (editing && step === REVIEW)) return close();
    if (step === 2 && !client) return go(0);
    go(step - 1);
  };

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
      // a typo guard (an extra zero), the same limits as the server
      if (workLines.some((l) => overLimit(l) === 'price')) return setError(t('One line can be at most $1,000,000. Please check for an extra zero.'));
      if (workLines.some((l) => overLimit(l) === 'qty')) return setError(t('Qty can be at most 100,000. Please check for an extra zero.'));
    }
    if (editing && (step === 2 || step === DATE)) return go(REVIEW); // editing: back to Review
    go(step + 1);
  };

  // Create: with Materials lines on an invoice, first ask whether to save what the user paid as expenses
  const [askMaterials, setAskMaterials] = useState<Line[] | null>(null);
  const create = () => {
    const materials = workLines.filter((l) => l.kind === 'material');
    if (!isEstimate && materials.length) return setAskMaterials(materials);
    createNow([]);
  };

  const createNow = async (paid: PaidExpense[]) => {
    if (!client?.id || busy) return;
    setBusy(true);
    setError('');
    try {
      const created = await api<ServerItem>('/api/items', {
        method: 'POST',
        body: {
          kind,
          client_id: client.id,
          date,
          ...(isEstimate ? {} : { due_date: dueDate(date, dueDays) }),
          ...(fromId ? { from_item_id: fromId } : {}),
          number: number.trim(),
          title: workLines.map((l) => l.text).join(', ').slice(0, 200),
          address: jobAddress || client.address,
          lines: workLines,
          expenses: paid.map((e) => ({ description: e.description, amount: e.amount, add_to_invoice: false })),
          tax_rate: taxOn ? taxRate : 0,
        },
      });
      setAskMaterials(null);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      // "After Create: the PDF opens with a big Send button"
      router.replace({ pathname: '/job/[id]', params: { id: created.id } });
    } catch (e) {
      setAskMaterials(null);
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

  const save = async () => {
    if (!editing || !client?.id || busy) return;
    if (workLines.length === 0) return setError(t('Please add the work and its price.'));
    setBusy(true);
    setError('');
    try {
      const updated = await patchItem(editing.id, {
        client_id: client.id,
        date,
        ...(isEstimate ? {} : { due_date: dueDate(date, dueDays) }),
        ...(number.trim() !== editing.number ? { number: number.trim() } : {}),
        title: workLines.filter((l) => l.kind === 'work').map((l) => l.text).join(', ').slice(0, 200),
        address: jobAddress || client.address,
        lines: workLines,
        tax_rate: taxOn ? taxRate : 0,
        tax_applies_to: taxAppliesTo,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      if (updated.status !== 'requested' && updated.status !== 'sent') return router.back();
      // already sent once: offer to send the corrected one (product-decisions.md §6)
      Alert.alert(isEstimate ? t('Send the updated estimate to the client?') : t('Send the updated invoice to the client?'), '', [
        { text: t('Not now'), style: 'cancel', onPress: () => router.back() },
        {
          text: t('Send'),
          onPress: async () => {
            try {
              await sendInvoice(updated, settings?.doc_language ?? 'en');
            } finally {
              router.back();
            }
          },
        },
      ]);
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
    t('Choose the client'),
    client?.id ? t('Check {name}’s info', { name: firstName(client.name) }) : t('New client'),
    isEstimate ? t('What work will you do?') : t('What did you do?'),
    isEstimate ? t('Date of the estimate') : t('Date'),
    t('Review'),
  ][step];
  const subtitle = [
    '',
    '',
    isEstimate
      ? t('Write the work and materials you offer, with prices. One fixed price for the whole job, or a line for each part. By the hour? Put the hours in Qty.')
      : t('Write what you did and the materials, with prices. One fixed price for the whole job, or a line for each part. By the hour? Put the hours in Qty.'),
    '',
    t('Tap anything to change it.'),
  ][step];

  const setW = (key: string, patch: Partial<WorkRow>) => setWork((rows) => rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));
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
            {!!client.id && !!original && (
              <AddressPicker
                main={client.address}
                others={original.addresses ?? []}
                value={jobAddress}
                onChange={setJobAddress}
                onAdd={async (a) => setOriginal(await addClientAddress(original, a))}
              />
            )}
            {/* the client's language: an extra translated copy (§9) — hidden for now (lib/features.ts) */}
            {CLIENT_COPY && (
            <View style={[styles.langCard, { backgroundColor: colors.card }]}>
              <Text style={[styles.langTitle, { color: colors.text }]}>{t('Also send a copy in your client’s language?')}</Text>
              <Text style={[styles.small, { color: colors.muted }]}>
                {t('The invoice is always in {lang}. If your client reads another language better, they also get a copy in that language.', {
                  lang: t(LANGUAGE_NAMES[docLang]),
                })}
              </Text>
              <View style={[styles.chips, { marginTop: 6 }]}>
                <Chip
                  label={t('No, {lang} only', { lang: t(LANGUAGE_NAMES[docLang]) })}
                  active={!client.preferred_language || client.preferred_language === docLang}
                  onPress={() => setC({ preferred_language: '' })}
                />
                {(Object.keys(LANGUAGES) as Lang[])
                  .filter((l) => l !== docLang)
                  .map((l) => (
                    <Chip key={l} label={LANGUAGES[l]} active={client.preferred_language === l} onPress={() => setC({ preferred_language: l })} />
                  ))}
              </View>
            </View>
            )}
          </View>
        ) : null;
      case 2:
        return (
          <View style={styles.gap}>
            {/* describe everything in one go; the lines below can always be typed by hand too */}
            <View style={[styles.describeCard, { backgroundColor: colors.card, borderColor: colors.accent }]}>
              <Text style={[styles.describeTitle, { color: colors.text }]}>✨ {t('Describe it in one go')}</Text>
              <TextInput
                value={describe}
                onChangeText={setDescribe}
                placeholder={t('e.g. door installation 300, 2 double swing doors installation and adjustment 700, hinges 3 at 12 each')}
                placeholderTextColor={colors.faint}
                multiline
                style={[styles.lineText, styles.lineBox, { color: colors.text, borderColor: colors.line, backgroundColor: colors.bg, minHeight: 80 }]}
              />
              <BigButton kind="second" title={t('Make lines')} onPress={makeLines} busy={describing} disabled={!describe.trim()} />
              {!!describeNote && <Text style={[styles.small, { color: colors.muted }]}>{describeNote}</Text>}
            </View>
            {work.map((w, i) => (
              <View key={w.key} style={[styles.lineCard, { backgroundColor: colors.card }]}>
                <TextInput
                  value={w.text}
                  onChangeText={(v) => setW(w.key, { text: v, question: undefined, suggestion: undefined })}
                  placeholder={i === 0 ? t('e.g. Installed 2 doors, or the full scope of work') : t('Work')}
                  placeholderTextColor={colors.faint}
                  autoFocus={false}
                  multiline
                  style={[styles.lineText, styles.lineBox, { color: colors.text, borderColor: colors.line, backgroundColor: colors.bg }]}
                />
                {!!w.question && (
                  <View style={[styles.askBox, { borderColor: '#F59E0B', backgroundColor: colors.bg }]}>
                    <Text style={[styles.askText, { color: colors.text }]}>❓ {w.question}</Text>
                    <View style={styles.chips}>
                      {!!w.suggestion && (
                        <Chip
                          label={t('Use «{s}»', { s: w.suggestion })}
                          active={false}
                          onPress={() => setW(w.key, { text: w.suggestion ?? w.text, question: undefined, suggestion: undefined })}
                        />
                      )}
                      <Chip label={t('Keep as I wrote')} active={false} onPress={() => setW(w.key, { question: undefined, suggestion: undefined })} />
                    </View>
                    <Text style={[styles.small, { color: colors.muted }]}>{t('Or correct the text above.')}</Text>
                  </View>
                )}
                <View style={styles.chips}>
                  <Chip label={t('Work')} active={w.kind !== 'material'} onPress={() => setW(w.key, { kind: 'work' })} />
                  <Chip label={t('Materials')} active={w.kind === 'material'} onPress={() => setW(w.key, { kind: 'material' })} />
                </View>
                <View style={styles.lineRow}>
                  <Text style={[styles.small, { color: colors.muted }]}>{t('Qty / hours')}</Text>
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
            <BigButton kind="second" title={t('＋ Add line')} onPress={() => setWork((rows) => [...rows, emptyWork()])} />
            {workLines.length > 0 && !workLines.some((l) => Number.isNaN(l.price) || Number.isNaN(l.qty)) && (
              <Text style={[styles.total, { color: colors.text }]}>
                {t('Total')} {money(totals(workLines).total)}
              </Text>
            )}
          </View>
        );
      case DATE:
        return (
          <View style={styles.gap}>
            <View style={[styles.calendarCard, { backgroundColor: colors.card }]}>
              <DateTimePicker
                value={parseIso(date)}
                mode="date"
                display="inline"
                style={{ alignSelf: 'stretch' }}
                accentColor={colors.accent}
                onValueChange={(_, d) => setDate(isoDate(d))}
              />
            </View>
            {!isEstimate && (
              <>
            <Text style={[styles.label, { color: colors.muted }]}>{t('Due')}</Text>
            <View style={styles.chips}>
              {DUE_CHOICES.map((c) => (
                <Chip key={c.days} label={t(c.label)} active={dueDays === c.days} onPress={() => setDueDays(c.days)} />
              ))}
            </View>
              </>
            )}
          </View>
        );
      default:
        return client ? (
          <View style={styles.gap}>
            {/* everything printed on the PDF, so it can be checked before Create */}
            <ReviewCard onPress={() => setEditBusiness(true)}>
              <Text style={[styles.cardLabel, { color: colors.muted }]}>{t('FROM')}</Text>
              {settings.name ? (
                <>
                  <Text style={[styles.cardTitle, { color: colors.text }]}>{settings.name}</Text>
                  {[settings.address, [settings.phone, settings.email].filter(Boolean).join(' · ')]
                    .filter(Boolean)
                    .map((line) => (
                      <Text key={line} style={[styles.small, { color: colors.muted }]}>
                        {line}
                      </Text>
                    ))}
                  {!!settings.payment_info && (
                    <Text style={[styles.small, { color: colors.muted }]}>
                      {t('Payment')}: {settings.payment_info}
                    </Text>
                  )}
                </>
              ) : (
                <Text style={[styles.reviewText, { color: colors.accent, fontWeight: '700' }]}>{t('Add your business name and contacts')}</Text>
              )}
            </ReviewCard>

            <ReviewCard onPress={() => go(1)}>
              <Text style={[styles.cardLabel, { color: colors.muted }]}>{t('BILL TO')}</Text>
              <Text style={[styles.cardTitle, { color: colors.text }]}>{client.name}</Text>
              {[client.address, [client.phone, client.email].filter(Boolean).join(' · ')]
                .filter(Boolean)
                .map((line) => (
                  <Text key={line} style={[styles.small, { color: colors.muted }]}>
                    {line}
                  </Text>
                ))}
              {!!jobAddress && (
                <Text style={[styles.small, { color: colors.text, marginTop: 4 }]}>
                  {t('JOB SITE')}: {jobAddress}
                </Text>
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
                    what: taxAppliesTo === 'everything' ? t('everything') : t('materials'),
                  })}{' '}
                  {money(totals(invoiceLines, taxRate, taxAppliesTo).tax)}
                </Text>
                <Switch value={taxOn} onValueChange={setTaxOn} trackColor={{ true: colors.accent }} />
              </View>
            )}

            <View style={styles.reviewLine}>
              <Text style={[styles.grand, { color: colors.text }]}>{t('Total')}</Text>
              <Text style={[styles.grand, { color: colors.text }]}>{money(sum.total)}</Text>
            </View>

            <View style={[styles.numberRow, { backgroundColor: colors.card }]}>
              <Text style={[styles.small, { color: colors.muted }]}>{isEstimate ? t('Estimate number') : t('Invoice number')}</Text>
              <TextInput
                value={number}
                onChangeText={setNumber}
                autoCapitalize="characters"
                autoCorrect={false}
                style={[styles.numberInput, { color: colors.text }]}
              />
            </View>

            <ReviewCard onPress={() => go(DATE)}>
              <Text style={[styles.reviewText, { color: colors.text }]}>
                {formatDay(date, 'en-US')}
                {isEstimate ? '' : ` · ${dueDays === 0 ? t('Due: Now') : t('Due: {date}', { date: formatDay(dueDate(date, dueDays), 'en-US') })}`}
              </Text>
            </ReviewCard>

            {!!settings.invoice_terms && (
              <View style={[styles.termsCard, { backgroundColor: colors.card }]}>
                <Text style={[styles.cardLabel, { color: colors.muted }]}>{t('TERMS')}</Text>
                <Text style={[styles.small, { color: colors.text }]}>{settings.invoice_terms}</Text>
              </View>
            )}
          </View>
        ) : null;
    }
  };

  const bottom =
    step === 0 ? null : step === REVIEW ? (
      editing ? (
        <BigButton title={t('Save changes')} onPress={save} busy={busy} />
      ) : (
        <BigButton title={isEstimate ? t('Create estimate') : t('Create invoice')} onPress={create} busy={busy} />
      )
    ) : (
      <BigButton title={t('Next')} onPress={next} busy={busy} />
    );

  return (
    <KeyboardAvoidingView behavior="padding" style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={[styles.top, { paddingTop: insets.top + 4 }]}>
        <Pressable onPress={back} hitSlop={12} accessibilityRole="button" accessibilityLabel={step === 0 ? t('Close') : t('Back')}>
          <Text style={[styles.topBtn, { color: colors.accent }]}>{step === 0 || (editing && step === REVIEW) ? t('Cancel') : `‹ ${t('Back')}`}</Text>
        </Pressable>
        <Text style={[styles.topTitle, { color: colors.muted }]}>
          {editing
            ? isEstimate
              ? t('Edit estimate')
              : t('Edit invoice')
            : `${isEstimate ? t('New estimate') : t('New invoice')} · ${step + 1}/${STEPS.length}`}
        </Text>
        <View style={{ width: 64 }} />
      </View>
      <View style={[styles.progress, { backgroundColor: colors.line }]}>
        <View style={[styles.progressFill, { backgroundColor: colors.accent, width: `${((step + 1) / STEPS.length) * 100}%` }]} />
      </View>

      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
        {/* nothing until loaded: an invoice made from a task or an estimate opens on a later step */}
        {!!clients && !!settings && <Text style={[styles.title, { color: colors.text }]}>{title}</Text>}
        {!!clients && !!settings && !!subtitle && <Text style={[styles.subtitle, { color: colors.muted }]}>{subtitle}</Text>}
        <View style={{ marginTop: 16 }}>{body()}</View>
      </ScrollView>

      <MaterialsExpenseSheet materials={askMaterials} busy={busy} onAnswer={createNow} onClose={() => setAskMaterials(null)} />
      <BusinessSheet
        settings={settings}
        visible={editBusiness}
        onClose={() => setEditBusiness(false)}
        onSaved={(s) => {
          setSettings(s);
          setEditBusiness(false);
        }}
      />

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
  askBox: { borderWidth: 1.5, borderRadius: radius.sm, padding: 10, gap: 8 },
  askText: { fontSize: 15, fontWeight: '600' },
  describeCard: { borderRadius: radius.md, padding: 12, gap: 10, borderWidth: 1.5 },
  describeTitle: { fontSize: 16, fontWeight: '700' },
  lineText: { fontSize: 17, minHeight: 28 },
  lineBox: { minHeight: 48, borderWidth: 1, borderRadius: radius.sm, paddingHorizontal: 10, paddingTop: 12, paddingBottom: 12 },
  lineRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  small: { fontSize: 14 },
  qty: { width: 54, height: 40, borderWidth: 1, borderRadius: radius.sm, textAlign: 'center', fontSize: 17 },
  price: { flex: 1, minWidth: 90, height: 40, borderWidth: 1, borderRadius: radius.sm, paddingHorizontal: 10, fontSize: 17 },
  remove: { fontSize: 18, paddingHorizontal: 4 },
  total: { fontSize: 17, fontWeight: '700', textAlign: 'right' },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 10 },
  switchText: { fontSize: 16 },
  langCard: { borderRadius: radius.md, padding: 14, gap: 6, marginTop: 4 },
  langTitle: { fontSize: 16, fontWeight: '700' },
  calendarCard: { borderRadius: radius.md, padding: 8, alignItems: 'center' },
  cardLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.6 },
  termsCard: { borderRadius: radius.md, padding: 14, gap: 4 },
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
