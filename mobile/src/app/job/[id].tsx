// THE JOB CARD: one screen for a task, an estimate or an invoice, with ONE big "next step" button
// (product-decisions.md §4; lib/next-step.ts). Other actions are smaller, underneath.
//   Estimate / invoice: the PDF preview.   Task / note: what, when, repeat, reminder.
//   Repeating task / note (§6g): big ✓ Done; Edit and Delete ask "Only this one / This and all next ones".
//   "🔗 Linked" (hidden until tapped): the same job's other stages; tap one to open it.
//   Leaving an invoice / estimate that isn't sent yet asks "Send it now?".
//   The preview switches between the invoice language (what is sent) and "Check in my language" (step 7, §9).
//   Invoice waiting for money: "Send a reminder" opens Messages with a ready, polite text (?remind=1 from the
//   late-invoice notification opens it right away).
import { router, useFocusEffect, useLocalSearchParams, usePreventRemove } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';

import { askScope } from '@/components/ask-scope';
import { ContactBar } from '@/components/contact-bar';
import { EditButton } from '@/components/edit-button';
import { BigButton } from '@/components/form';
import { MarkPaidSheet } from '@/components/mark-paid-sheet';
import { LANGUAGES, t, type Lang } from '@/i18n';
import { fetchClients, fetchSettings, type Client, type Settings } from '@/lib/clients';
import { formatDay, formatTime } from '@/lib/dates';
import { deleteItem, fetchRelated, getItem, patchItem, sendInvoice, undoPayment, type ServerItem } from '@/lib/items';
import { money } from '@/lib/money';
import { NEXT_STEP_LABEL, nextSteps, type NextStep } from '@/lib/next-step';
import { syncNotifications } from '@/lib/notifications';
import { cleanOldPdfs, downloadPdf } from '@/lib/pdf';
import { reminderLabel, reminderMessage, type ReminderMinutes } from '@/lib/reminders';
import { repeatLabel } from '@/lib/repeat-rule';
import { isAhead, statusHelp } from '@/lib/status-help';
import { isOverdue } from '@/lib/status';
import { kindColors, radius, useColors } from '@/theme';

const KIND_LABEL = { task: 'Task', estimate: 'Estimate', invoice: 'Invoice', note: 'Note' } as const;

/** Back to the calendar on that day (`at` makes the calendar select it even when it already shows it). */
function backToCalendar(day: string) {
  router.dismissTo({ pathname: '/', params: { day, at: String(Date.now()) } });
}

export default function JobScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { id, remind } = useLocalSearchParams<{ id: string; remind?: string }>();
  const [item, setItem] = useState<ServerItem | null>(null);
  const [client, setClient] = useState<Client | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [pdfUri, setPdfUri] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [paying, setPaying] = useState(false);
  const reminded = useRef(false);
  const [related, setRelated] = useState<ServerItem[]>([]);
  const [showLinked, setShowLinked] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [previewLang, setPreviewLang] = useState<Lang | null>(null); // null = the invoice language

  const load = useCallback(async () => {
    try {
      const [it, s, clients, rel] = await Promise.all([getItem(id), fetchSettings(), fetchClients(), fetchRelated(id).catch(() => [])]);
      setItem(it);
      setRelated(rel);
      setSettings(s);
      setClient(clients.find((c) => c.id === it.client_id) ?? null);
      setError('');
      if (it.kind === 'estimate' || it.kind === 'invoice') {
        cleanOldPdfs();
        setPdfUri((await downloadPdf(it, previewLang ?? s.doc_language)).uri); // the first time, translating takes a moment
      }
      return { it, s, client: clients.find((c) => c.id === it.client_id) ?? null };
    } catch (e) {
      setError(t(e instanceof Error ? e.message : 'Could not load.'));
      return null;
    }
  }, [id, previewLang]);

  // the ready reminder message for the client: Messages with the text filled in (or the share sheet)
  const sendReminder = useCallback(async (it: ServerItem, s: Settings | null, c: Client | null) => {
    const text = reminderMessage(
      { clientName: it.client_name, number: it.number, total: Number(it.total), dueDate: it.due_date },
      s?.name || undefined,
    );
    const phone = (c?.phone ?? '').replace(/[^\d+]/g, '');
    const sms = `sms:${phone}&body=${encodeURIComponent(text)}`;
    if (phone && (await Linking.canOpenURL(sms).catch(() => false))) return Linking.openURL(sms);
    Share.share({ message: text });
  }, []);

  useFocusEffect(
    useCallback(() => {
      load().then((r) => {
        if (r && remind && !reminded.current && r.it.status === 'requested') {
          reminded.current = true; // opened from the late-invoice notification
          sendReminder(r.it, r.s, r.client);
        }
      });
    }, [load, remind, sendReminder]),
  );

  const close = () => backToCalendar(item?.date ?? '');

  const run = async (fn: () => Promise<unknown>) => {
    if (busy) return;
    setBusy(true);
    try {
      await fn();
      syncNotifications();
      await load();
    } catch (e) {
      Alert.alert(t(e instanceof Error ? e.message : 'Something went wrong.'));
    } finally {
      setBusy(false);
    }
  };

  const send = () => item && run(() => sendInvoice(item, settings?.doc_language ?? 'en'));

  // not sent yet: ask before leaving (the back button, the swipe, or ‹ Calendar)
  const unsent = !!item && (item.kind === 'invoice' || item.kind === 'estimate') && item.status === 'created' && !leaving;
  const allowLeaving = usePreventRemove(unsent, ({ repeat }) => {
    const what = item?.kind === 'estimate' ? t('estimate') : t('invoice');
    Alert.alert(t('This {what} is not sent yet', { what }), t('Send it to the client now?'), [
      {
        text: t('Later'),
        onPress: () => {
          setLeaving(true);
          repeat();
        },
      },
      { text: t('Send now'), style: 'default', onPress: () => send() },
    ]);
  });

  const doStep = (step: NextStep) => {
    if (!item) return;
    if (step === 'send-estimate' || step === 'send-invoice') return send();
    if (step === 'mark-paid') return setPaying(true);
    if (step === 'schedule') return router.push({ pathname: '/new-task', params: { from: item.id } });
    if (step === 'done') return markDone();
    if (step === 'open-invoice') return linkedInvoice && router.push({ pathname: '/job/[id]', params: { id: linkedInvoice.id } });
    // make-invoice (from an estimate) or job-done (from a task): the questionnaire, filled in
    router.push({ pathname: '/new-invoice', params: { from: item.id } });
  };

  // "done" turns the reminder off, so it is never a silent tap (§6j): say what happens, ask first
  const markDone = () => {
    if (!item) return;
    const isTask = item.kind === 'task';
    const when = `${formatDay(item.date, 'en-US')}${item.time ? ` ${t('at')} ${formatTime(item.time)}` : ''}`;
    const message = isAhead({ date: item.date, time: item.time })
      ? t('It is planned for {when}. After this, its reminder is turned off.', { when })
      : t('After this, its reminder is turned off.');
    Alert.alert(isTask ? t('Is the job finished?') : t('Mark this note done?'), message, [
      { text: t('Not yet'), style: 'cancel' },
      { text: isTask ? t('Yes, it’s finished') : t('Yes, done'), onPress: () => run(() => patchItem(item.id, { status: 'done' })) },
    ]);
  };

  const edit = () => {
    if (!item) return;
    if (item.kind === 'task') router.push({ pathname: '/new-task', params: { id: item.id } });
    else if (item.kind === 'note') router.push({ pathname: '/new-note', params: { id: item.id } });
    else router.push({ pathname: '/new-invoice', params: { id: item.id } });
  };

  const remove = async () => {
    if (!item) return;
    if (item.series_id) {
      // a repeating task / note: only this visit, or this and all next ones
      const scope = await askScope(t('Delete the repeating {kind}?', { kind: t(KIND_LABEL[item.kind]).toLowerCase() }), true);
      if (!scope) return;
      try {
        await deleteItem(item.id, scope);
        syncNotifications();
        setLeaving(true);
        allowLeaving();
        close();
      } catch (e) {
        Alert.alert(t(e instanceof Error ? e.message : 'Something went wrong.'));
      }
      return;
    }
    Alert.alert(t('Delete this {kind}?', { kind: t(KIND_LABEL[item.kind]).toLowerCase() }), t('This cannot be undone.'), [
      { text: t('Cancel'), style: 'cancel' },
      {
        text: t('Delete'),
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteItem(item.id);
            syncNotifications();
            setLeaving(true);
            allowLeaving();
            close();
          } catch (e) {
            Alert.alert(t(e instanceof Error ? e.message : 'Something went wrong.'));
          }
        },
      },
    ]);
  };

  const undo = () =>
    Alert.alert(t('Undo payment?'), t('The invoice goes back to waiting for money and can be edited again.'), [
      { text: t('Cancel'), style: 'cancel' },
      { text: t('Undo payment'), style: 'destructive', onPress: () => item && run(() => undoPayment(item.id)) },
    ]);

  // ----- status line -----
  const overdue = !!item && isOverdue({ kind: item.kind, status: item.status, dueDate: item.due_date ?? undefined });
  const statusText = !item
    ? ''
    : item.kind === 'task' || item.kind === 'note'
      ? item.status === 'done'
        ? t('✓ Done')
        : item.kind === 'note'
          ? t('Not done yet')
          : t('Scheduled')
      : item.kind === 'estimate'
        ? item.status === 'sent'
          ? t('Sent · waiting for the client’s answer')
          : t('Created · not sent yet')
        : item.status === 'paid'
          ? t('✓ Paid {date} · {method}', { date: formatDay(item.paid_date ?? item.date, 'en-US'), method: t(item.payment_method || 'Other') })
          : item.status === 'requested'
            ? overdue
              ? t('Requested · overdue')
              : t('Requested · waiting for money')
            : t('Created · not sent yet');
  const statusColor =
    item?.status === 'paid' || item?.status === 'done'
      ? kindColors.invoice
      : item?.status === 'requested'
        ? kindColors.unpaid
        : colors.muted;

  // ----- the small buttons underneath -----
  const linkedInvoiceEarly = related.some((r) => r.kind === 'invoice');
  const small: { label: string; onPress: () => void }[] = [];
  if (item) {
    if (item.kind === 'invoice' && item.status === 'requested') {
      small.push({ label: t('Send a reminder'), onPress: () => sendReminder(item, settings, client) });
      small.push({ label: t('Send again'), onPress: send });
    }
    if (item.kind === 'estimate' && item.status === 'sent') small.push({ label: t('Send again'), onPress: send });
    if (item.kind === 'task' && item.status !== 'done' && !item.series_id && !linkedInvoiceEarly)
      small.push({ label: t('Finished, no invoice'), onPress: markDone }); // the big button finishes AND makes the invoice
    if ((item.kind === 'task' || item.kind === 'note') && item.status === 'done')
      small.push({ label: t('Not done'), onPress: () => run(() => patchItem(item.id, { status: 'created' })) });
    if (item.status === 'paid') small.push({ label: t('Undo payment'), onPress: undo });
    if (item.status !== 'paid') small.push({ label: t('Delete'), onPress: remove });
  }
  const linkedInvoice = related.find((r) => r.kind === 'invoice');
  const steps = item ? nextSteps(item, { hasInvoice: !!linkedInvoice, hasTask: related.some((r) => r.kind === 'task') }) : [];

  return (
    <View style={[styles.screen, { backgroundColor: colors.bg, paddingTop: insets.top + 4 }]}>
      <View style={styles.top}>
        <Pressable onPress={close} hitSlop={12} accessibilityRole="button">
          <Text style={[styles.topBtn, { color: colors.accent }]}>‹ {t('Calendar')}</Text>
        </Pressable>
        <Text style={[styles.topTitle, { color: colors.text }]}>
          {item ? (item.number ? `${t(KIND_LABEL[item.kind])} ${item.number}` : t(KIND_LABEL[item.kind])) : ''}
        </Text>
        <View style={styles.topRight}>{item && item.status !== 'paid' && <EditButton onPress={edit} />}</View>
      </View>

      {item && (
        <View style={styles.summary}>
          {/* the client's name opens their page */}
          <Pressable
            disabled={!client}
            onPress={() => client && router.push({ pathname: '/client/[id]', params: { id: client.id } })}
            accessibilityRole={client ? 'link' : undefined}>
            <Text style={[styles.client, { color: colors.text }]} numberOfLines={item.kind === 'note' ? 3 : 1}>
              {item.kind === 'note' ? `📝 ${item.title}` : item.client_name || t('No client')}
              {item.kind === 'estimate' || item.kind === 'invoice' || Number(item.total) > 0 ? ` · ${money(Number(item.total))}` : ''}
              {client ? <Text style={{ color: colors.faint }}> ›</Text> : null}
            </Text>
          </Pressable>
          <Text style={[styles.status, { color: statusColor }]}>{statusText}</Text>
          {/* what this status means and what happens next (§6j) */}
          <Text style={[styles.help, { color: colors.muted }]}>
            {t(statusHelp({ kind: item.kind, status: item.status, date: item.date, time: item.time, reminderMinutes: item.reminder_minutes }))}
          </Text>
          {!!client?.phone && <Text style={[styles.small, { color: colors.muted, marginTop: 4 }]}>📞 {client.phone}</Text>}
          {!!(item.address || client?.address) && (
            <Text style={[styles.small, { color: colors.muted }]}>📍 {item.address || client?.address}</Text>
          )}
          {!!client && (
            <View style={{ marginTop: 8 }}>
              <ContactBar phone={client.phone} address={item.address || client.address} compact />
            </View>
          )}
          {related.length > 0 && (
            <View style={{ marginTop: 8, gap: 6 }}>
              <Pressable onPress={() => setShowLinked((v) => !v)} accessibilityRole="button" hitSlop={6}>
                <Text style={[styles.linkedToggle, { color: colors.accent }]}>
                  🔗 {t('Linked')} ({related.length}) {showLinked ? '▴' : '▾'}
                </Text>
              </Pressable>
              {showLinked &&
                related.map((r) => (
                  <Pressable
                    key={r.id}
                    onPress={() => router.push({ pathname: '/job/[id]', params: { id: r.id } })}
                    accessibilityRole="link"
                    style={({ pressed }) => [styles.linked, { borderColor: colors.line, backgroundColor: pressed ? colors.line : colors.card }]}>
                    <View style={[styles.linkedDot, { backgroundColor: kindColors[r.kind === 'invoice' && r.status === 'requested' ? 'unpaid' : r.kind] }]} />
                    <Text style={[styles.small, { color: colors.text, flex: 1 }]} numberOfLines={1}>
                      {t(KIND_LABEL[r.kind])}
                      {r.number ? ` ${r.number}` : ''} · {formatDay(r.date, 'en-US')}
                      {r.kind === 'estimate' || r.kind === 'invoice' ? ` · ${money(Number(r.total))}` : ''}
                    </Text>
                    <Text style={[styles.small, { color: colors.faint }]}>›</Text>
                  </Pressable>
                ))}
            </View>
          )}
        </View>
      )}

      {item?.kind === 'task' || item?.kind === 'note' ? (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 16, gap: 10 }}>
          {item.kind === 'task' && linkedInvoice && (
            <Pressable
              onPress={() => router.push({ pathname: '/job/[id]', params: { id: linkedInvoice.id } })}
              accessibilityRole="link"
              style={({ pressed }) => [styles.card, styles.invoiceCard, { backgroundColor: pressed ? colors.line : colors.card, borderColor: colors.line }]}>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={[styles.cardLabel, { color: colors.muted }]}>{t('INVOICE')}</Text>
                <Text style={[styles.body, { color: colors.text, fontWeight: '700' }]}>
                  {linkedInvoice.number} · {money(Number(linkedInvoice.total))}
                </Text>
                <Text
                  style={[
                    styles.small,
                    { color: linkedInvoice.status === 'paid' ? kindColors.invoice : linkedInvoice.status === 'requested' ? kindColors.unpaid : colors.muted, fontWeight: '700' },
                  ]}>
                  {linkedInvoice.status === 'paid'
                    ? t('✓ Paid')
                    : linkedInvoice.status === 'requested'
                      ? t('Sent · waiting for money')
                      : t('Not sent yet')}
                </Text>
              </View>
              <Text style={[styles.body, { color: colors.faint }]}>›</Text>
            </Pressable>
          )}
          {item.kind === 'task' && (
            <View style={[styles.card, { backgroundColor: colors.card }]}>
              <Text style={[styles.cardLabel, { color: colors.muted }]}>{t('WHAT')}</Text>
              <Text style={[styles.body, { color: colors.text }]}>{item.title || '—'}</Text>
            </View>
          )}
          {item.lines.length > 0 && (
            <View style={[styles.card, { backgroundColor: colors.card }]}>
              <Text style={[styles.cardLabel, { color: colors.muted }]}>{linkedInvoice ? t('PRICE (INVOICED)') : t('PRICE (FROM THE ESTIMATE)')}</Text>
              {item.lines.map((l, i) => (
                <View key={i} style={styles.priceRow}>
                  <Text style={[styles.body, { color: colors.text, flex: 1 }]}>
                    {l.kind === 'discount' ? `${t('Discount')}${l.pct ? ` ${l.pct}%` : ''}${l.text ? ` · ${l.text}` : ''}` : l.text}
                    {Number(l.qty ?? 1) !== 1 ? ` × ${l.qty}` : ''}
                  </Text>
                  <Text style={[styles.body, { color: colors.text }]}>{money(Number(l.qty ?? 1) * Number(l.price ?? 0))}</Text>
                </View>
              ))}
              {Number(item.tax) > 0 && (
                <View style={styles.priceRow}>
                  <Text style={[styles.small, { color: colors.muted, flex: 1 }]}>{t('Sales tax')}</Text>
                  <Text style={[styles.small, { color: colors.muted }]}>{money(Number(item.tax))}</Text>
                </View>
              )}
              <View style={styles.priceRow}>
                <Text style={[styles.body, { color: colors.text, flex: 1, fontWeight: '800' }]}>{t('Total')}</Text>
                <Text style={[styles.body, { color: colors.text, fontWeight: '800' }]}>{money(Number(item.total))}</Text>
              </View>
            </View>
          )}
          <View style={[styles.card, { backgroundColor: colors.card }]}>
            <Text style={[styles.cardLabel, { color: colors.muted }]}>{t('WHEN')}</Text>
            <Text style={[styles.body, { color: colors.text }]}>
              {formatDay(item.date, 'en-US')}
              {item.time ? ` · ${formatTime(item.time)}` : ''}
            </Text>
            {!!item.repeat && (
              <Text style={[styles.small, { color: colors.muted }]}>
                🔁 {t(repeatLabel({ every: item.repeat.every, unit: item.repeat.unit, until: item.repeat.until ?? null }, (d) => formatDay(d, 'en-US')))}
              </Text>
            )}
            <Text style={[styles.small, { color: colors.muted }]}>
              🔔 {t(reminderLabel((item.reminder_minutes as ReminderMinutes | null) ?? null))}
            </Text>
          </View>
        </ScrollView>
      ) : (
        <>
        {!!settings?.app_language && settings.app_language !== settings.doc_language && (
          <View style={styles.langSwitch}>
            {[settings.doc_language, settings.app_language].map((l, i) => {
              const active = (previewLang ?? settings.doc_language) === l;
              return (
                <Pressable
                  key={l}
                  onPress={() => {
                    if (active) return;
                    setPdfUri('');
                    setPreviewLang(i === 0 ? null : l);
                  }}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  style={[styles.langBtn, { borderColor: active ? colors.text : colors.line, backgroundColor: active ? colors.text : colors.card }]}>
                  <Text style={[styles.langText, { color: active ? colors.bg : colors.text }]} numberOfLines={1}>
                    {LANGUAGES[l]} · {i === 0 ? t('sent') : t('check')}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        )}
        <View style={[styles.preview, { backgroundColor: colors.card, borderColor: colors.line }]}>
          {pdfUri ? (
            <WebView source={{ uri: pdfUri }} originWhitelist={['*']} allowFileAccess style={{ flex: 1, backgroundColor: 'transparent' }} />
          ) : error ? (
            <Pressable onPress={load} style={styles.center}>
              <Text style={[styles.error, { color: kindColors.unpaid }]}>
                {error} {t('Tap to try again.')}
              </Text>
            </Pressable>
          ) : (
            <View style={styles.center}>
              <ActivityIndicator />
            </View>
          )}
        </View>
        </>
      )}

      {item && (
        <View style={[styles.actions, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          {steps.map((s, i) => (
            <BigButton key={s} title={s === 'done' && item.kind === 'task' ? t('✓ Job finished') : t(NEXT_STEP_LABEL[s])} onPress={() => doStep(s)} busy={busy && i === 0} kind={i === 0 ? 'main' : 'second'} />
          ))}
          <View style={styles.smallRow}>
            {small.map((b) => (
              <Pressable
                key={b.label}
                onPress={b.onPress}
                accessibilityRole="button"
                style={({ pressed }) => [styles.smallBtn, { borderColor: colors.line, backgroundColor: pressed ? colors.line : colors.card }]}>
                <Text style={[styles.smallText, { color: b.label === t('Delete') ? kindColors.unpaid : colors.text }]} numberOfLines={1}>
                  {b.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      )}

      <MarkPaidSheet
        item={paying ? item : null}
        onClose={() => setPaying(false)}
        onPaid={() => {
          setPaying(false);
          syncNotifications();
          load();
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 8 },
  topBtn: { fontSize: 17, fontWeight: '600', width: 90 },
  topTitle: { fontSize: 17, fontWeight: '700' },
  topRight: { width: 90, alignItems: 'flex-end' },
  help: { fontSize: 14, marginTop: 2 },
  invoiceCard: { flexDirection: 'row', alignItems: 'center', borderWidth: 1 },
  langSwitch: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, marginBottom: 8 },
  langBtn: { flex: 1, height: 38, borderRadius: radius.pill, borderWidth: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  langText: { fontSize: 14, fontWeight: '700' },
  linkedToggle: { fontSize: 15, fontWeight: '700' },
  linked: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: radius.md, paddingHorizontal: 12, height: 42 },
  linkedDot: { width: 10, height: 10, borderRadius: 5 },
  summary: { paddingHorizontal: 16, gap: 2, marginBottom: 10 },
  client: { fontSize: 20, fontWeight: '800' },
  status: { fontSize: 15, fontWeight: '700' },
  preview: { flex: 1, marginHorizontal: 16, borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  card: { borderRadius: radius.md, padding: 14, gap: 4 },
  cardLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.6 },
  body: { fontSize: 17 },
  small: { fontSize: 14 },
  priceRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  error: { fontSize: 15, fontWeight: '600', textAlign: 'center' },
  actions: { paddingHorizontal: 16, paddingTop: 12, gap: 10 },
  smallRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  smallBtn: { flexGrow: 1, flexBasis: '30%', height: 44, borderRadius: radius.md, borderWidth: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  smallText: { fontSize: 15, fontWeight: '600' },
});
