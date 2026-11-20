// THE JOB CARD: one screen for a task, an estimate or an invoice, with ONE big "next step" button
// (product-decisions.md §4; lib/next-step.ts). Other actions are smaller, underneath.
//   Estimate / invoice: the PDF preview.   Task / note: what, when, repeat, reminder.
//   Repeating task / note (§6g): big ✓ Done; Edit and Delete ask "Only this one / This and all next ones".
//   Invoice waiting for money: "Send a reminder" opens Messages with a ready, polite text (?remind=1 from the
//   late-invoice notification opens it right away).
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';

import { askScope } from '@/components/ask-scope';
import { ContactBar } from '@/components/contact-bar';
import { BigButton } from '@/components/form';
import { MarkPaidSheet } from '@/components/mark-paid-sheet';
import { t } from '@/i18n';
import { fetchClients, fetchSettings, type Client, type Settings } from '@/lib/clients';
import { formatDay, formatTime } from '@/lib/dates';
import { deleteItem, getItem, patchItem, sendInvoice, undoPayment, type ServerItem } from '@/lib/items';
import { money } from '@/lib/money';
import { NEXT_STEP_LABEL, nextSteps, type NextStep } from '@/lib/next-step';
import { syncNotifications } from '@/lib/notifications';
import { cleanOldPdfs, downloadPdf } from '@/lib/pdf';
import { reminderLabel, reminderMessage, type ReminderMinutes } from '@/lib/reminders';
import { repeatLabel } from '@/lib/repeat-rule';
import { isOverdue } from '@/lib/status';
import { kindColors, radius, useColors } from '@/theme';

const KIND_LABEL = { task: 'Task', estimate: 'Estimate', invoice: 'Invoice', note: 'Note' } as const;

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

  const load = useCallback(async () => {
    try {
      const [it, s, clients] = await Promise.all([getItem(id), fetchSettings(), fetchClients()]);
      setItem(it);
      setSettings(s);
      setClient(clients.find((c) => c.id === it.client_id) ?? null);
      setError('');
      if (it.kind === 'estimate' || it.kind === 'invoice') {
        cleanOldPdfs();
        setPdfUri((await downloadPdf(it, s.doc_language)).uri);
      }
      return { it, s, client: clients.find((c) => c.id === it.client_id) ?? null };
    } catch (e) {
      setError(t(e instanceof Error ? e.message : 'Could not load.'));
      return null;
    }
  }, [id]);

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

  const close = () => router.dismissTo({ pathname: '/', params: { day: item?.date ?? '', at: String(Date.now()) } });

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

  const doStep = (step: NextStep) => {
    if (!item) return;
    if (step === 'send-estimate' || step === 'send-invoice') return send();
    if (step === 'mark-paid') return setPaying(true);
    if (step === 'schedule') return router.push({ pathname: '/new-task', params: { from: item.id } });
    if (step === 'done') return run(() => patchItem(item.id, { status: 'done' }));
    // make-invoice (from an estimate) or job-done (from a task): the questionnaire, filled in
    router.push({ pathname: '/new-invoice', params: { from: item.id } });
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
  const small: { label: string; onPress: () => void }[] = [];
  if (item) {
    if (item.kind === 'invoice' && item.status === 'requested') {
      small.push({ label: t('Send a reminder'), onPress: () => sendReminder(item, settings, client) });
      small.push({ label: t('Send again'), onPress: send });
    }
    if (item.kind === 'estimate' && item.status === 'sent') small.push({ label: t('Send again'), onPress: send });
    if (item.kind === 'task' && item.status !== 'done' && !item.series_id)
      small.push({ label: t('Mark done'), onPress: () => run(() => patchItem(item.id, { status: 'done' })) });
    if ((item.kind === 'task' || item.kind === 'note') && item.status === 'done')
      small.push({ label: t('Not done'), onPress: () => run(() => patchItem(item.id, { status: 'created' })) });
    if (item.status !== 'paid') small.push({ label: `✏️ ${t('Edit')}`, onPress: edit });
    if (item.status === 'paid') small.push({ label: t('Undo payment'), onPress: undo });
    if (item.status !== 'paid') small.push({ label: t('Delete'), onPress: remove });
  }
  const steps = item ? nextSteps(item) : [];

  return (
    <View style={[styles.screen, { backgroundColor: colors.bg, paddingTop: insets.top + 4 }]}>
      <View style={styles.top}>
        <Pressable onPress={close} hitSlop={12} accessibilityRole="button">
          <Text style={[styles.topBtn, { color: colors.accent }]}>‹ {t('Calendar')}</Text>
        </Pressable>
        <Text style={[styles.topTitle, { color: colors.text }]}>
          {item ? (item.number ? `${t(KIND_LABEL[item.kind])} ${item.number}` : t(KIND_LABEL[item.kind])) : ''}
        </Text>
        <View style={{ width: 90 }} />
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
          {!!client?.phone && <Text style={[styles.small, { color: colors.muted, marginTop: 4 }]}>📞 {client.phone}</Text>}
          {!!(item.address || client?.address) && (
            <Text style={[styles.small, { color: colors.muted }]}>📍 {item.address || client?.address}</Text>
          )}
          {!!client && (
            <View style={{ marginTop: 8 }}>
              <ContactBar phone={client.phone} address={item.address || client.address} compact />
            </View>
          )}
        </View>
      )}

      {item?.kind === 'task' || item?.kind === 'note' ? (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 16, gap: 10 }}>
          {item.kind === 'task' && (
            <View style={[styles.card, { backgroundColor: colors.card }]}>
              <Text style={[styles.cardLabel, { color: colors.muted }]}>{t('WHAT')}</Text>
              <Text style={[styles.body, { color: colors.text }]}>{item.title || '—'}</Text>
            </View>
          )}
          {item.lines.length > 0 && (
            <View style={[styles.card, { backgroundColor: colors.card }]}>
              <Text style={[styles.cardLabel, { color: colors.muted }]}>{t('PRICE (FROM THE ESTIMATE)')}</Text>
              {item.lines.map((l, i) => (
                <View key={i} style={styles.priceRow}>
                  <Text style={[styles.body, { color: colors.text, flex: 1 }]}>
                    {l.text}
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
      )}

      {item && (
        <View style={[styles.actions, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          {steps.map((s, i) => (
            <BigButton key={s} title={t(NEXT_STEP_LABEL[s])} onPress={() => doStep(s)} busy={busy && i === 0} kind={i === 0 ? 'main' : 'second'} />
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
