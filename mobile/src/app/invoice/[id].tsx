// ONE INVOICE: the PDF preview and the next step, big (product-decisions.md §4 and §6 "After Create"):
//   Created   → [ Send ]          ✏️ Edit · Later
//   Requested → [ Mark Paid ]     Send again · ✏️ Edit
//   Paid      → ✓ Paid on … via … (locked)     Undo payment
// Sending opens the iPhone share sheet; when it closes, a Created invoice becomes Requested.
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';

import { BigButton } from '@/components/form';
import { MarkPaidSheet } from '@/components/mark-paid-sheet';
import { t } from '@/i18n';
import { fetchSettings } from '@/lib/clients';
import { formatDay } from '@/lib/dates';
import { getItem, sendInvoice, undoPayment, type ServerItem } from '@/lib/items';
import { money } from '@/lib/money';
import { cleanOldPdfs, downloadPdf } from '@/lib/pdf';
import { kindColors, radius, useColors } from '@/theme';

export default function InvoiceScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [item, setItem] = useState<ServerItem | null>(null);
  const [docLang, setDocLang] = useState('en');
  const [pdfUri, setPdfUri] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [paying, setPaying] = useState(false);

  const load = useCallback(async () => {
    try {
      const [it, settings] = await Promise.all([getItem(id), fetchSettings()]);
      setItem(it);
      setDocLang(settings.doc_language);
      cleanOldPdfs();
      const file = await downloadPdf(it, settings.doc_language);
      setPdfUri(file.uri);
      setError('');
    } catch (e) {
      setError(t(e instanceof Error ? e.message : 'Could not load.'));
    }
  }, [id]);

  // on open, and again when coming back from Edit
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  // back to the calendar, on this invoice's day
  const close = () => router.dismissTo({ pathname: '/', params: { day: item?.date ?? '', at: String(Date.now()) } });

  const send = async () => {
    if (!item || busy) return;
    setBusy(true);
    try {
      const updated = await sendInvoice(item, docLang);
      if (updated.status !== item.status) {
        setItem(updated);
        load(); // the PDF has no status on it, but keep everything fresh
      }
    } catch (e) {
      Alert.alert(t('Could not send'), t(e instanceof Error ? e.message : 'Something went wrong.'));
    } finally {
      setBusy(false);
    }
  };

  const undo = () =>
    Alert.alert(t('Undo payment?'), t('The invoice goes back to waiting for money and can be edited again.'), [
      { text: t('Cancel'), style: 'cancel' },
      {
        text: t('Undo payment'),
        style: 'destructive',
        onPress: async () => {
          try {
            setItem(await undoPayment(item!.id));
            load();
          } catch (e) {
            Alert.alert(t(e instanceof Error ? e.message : 'Something went wrong.'));
          }
        },
      },
    ]);

  const edit = () => item && router.push({ pathname: '/new-invoice', params: { id: item.id } });

  const status = item?.status;
  const overdue = status === 'requested' && !!item?.due_date && item.due_date < new Date().toISOString().slice(0, 10);
  const statusText =
    status === 'paid'
      ? t('✓ Paid {date} · {method}', { date: formatDay(item!.paid_date ?? item!.date, 'en-US'), method: t(item!.payment_method || 'Other') })
      : status === 'requested'
        ? overdue
          ? t('Requested · overdue')
          : t('Requested · waiting for money')
        : t('Created · not sent yet');
  const statusColor = status === 'paid' ? kindColors.invoice : status === 'requested' ? kindColors.unpaid : colors.muted;

  return (
    <View style={[styles.screen, { backgroundColor: colors.bg, paddingTop: insets.top + 4 }]}>
      <View style={styles.top}>
        <Pressable onPress={close} hitSlop={12} accessibilityRole="button">
          <Text style={[styles.topBtn, { color: colors.accent }]}>‹ {t('Calendar')}</Text>
        </Pressable>
        <Text style={[styles.topTitle, { color: colors.text }]}>{item?.number ?? ''}</Text>
        <View style={{ width: 90 }} />
      </View>

      {item && (
        <View style={styles.summary}>
          <Text style={[styles.client, { color: colors.text }]} numberOfLines={1}>
            {item.client_name} · {money(Number(item.total))}
          </Text>
          <Text style={[styles.status, { color: statusColor }]}>{statusText}</Text>
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

      {item && (
        <View style={[styles.actions, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          {status === 'created' && <BigButton title={t('Send')} onPress={send} busy={busy} />}
          {status === 'requested' && <BigButton title={t('Mark Paid')} onPress={() => setPaying(true)} />}
          <View style={styles.small}>
            {status === 'created' && <SmallButton label={`✏️ ${t('Edit')}`} onPress={edit} />}
            {status === 'created' && <SmallButton label={t('Later')} onPress={close} />}
            {status === 'requested' && <SmallButton label={t('Send again')} onPress={send} />}
            {status === 'requested' && <SmallButton label={`✏️ ${t('Edit')}`} onPress={edit} />}
            {status === 'paid' && <SmallButton label={t('Undo payment')} onPress={undo} />}
          </View>
        </View>
      )}

      <MarkPaidSheet
        item={paying ? item : null}
        onClose={() => setPaying(false)}
        onPaid={(updated) => {
          setPaying(false);
          setItem(updated);
          load();
        }}
      />
    </View>
  );
}

function SmallButton({ label, onPress }: { label: string; onPress: () => void }) {
  const colors = useColors();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [styles.smallBtn, { borderColor: colors.line, backgroundColor: pressed ? colors.line : colors.card }]}>
      <Text style={[styles.smallText, { color: colors.text }]}>{label}</Text>
    </Pressable>
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
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  error: { fontSize: 15, fontWeight: '600', textAlign: 'center' },
  actions: { paddingHorizontal: 16, paddingTop: 12, gap: 10 },
  small: { flexDirection: 'row', gap: 10 },
  smallBtn: { flex: 1, height: 46, borderRadius: radius.md, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  smallText: { fontSize: 16, fontWeight: '600' },
});
