// "Mark Paid": how the customer paid (Zelle, Cash…) and when (today by default). Used on the invoice screen and
// from the swipe action in the day list.
import DateTimePicker from '@react-native-community/datetimepicker';
import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BigButton, Chip, INVALID } from '@/components/form';
import { t } from '@/i18n';
import { isoDate, parseIso, todayIso } from '@/lib/dates';
import { markPaid, PAYMENT_METHODS, type ServerItem } from '@/lib/items';
import { money } from '@/lib/money';
import { radius, useColors } from '@/theme';

type Props = {
  item: { id: string; total: number | string; number?: string; client_name?: string } | null;
  onClose: () => void;
  onPaid: (item: ServerItem) => void;
};

export function MarkPaidSheet({ item, onClose, onPaid }: Props) {
  return (
    <Modal visible={!!item} transparent animationType="slide" onRequestClose={onClose}>
      {/* a fresh form each time it opens */}
      {item && <SheetBody key={item.id} item={item} onClose={onClose} onPaid={onPaid} />}
    </Modal>
  );
}

function SheetBody({ item, onClose, onPaid }: Props & { item: NonNullable<Props['item']> }) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [method, setMethod] = useState<string>('');
  const [date, setDate] = useState(todayIso());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [tried, setTried] = useState(false); // Mark Paid without a method (§6q)

  const save = async () => {
    if (!method) {
      setTried(true);
      return setError(t('How did the client pay?'));
    }
    setBusy(true);
    setError('');
    try {
      const updated = await markPaid(item.id, method, date);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onPaid(updated);
    } catch (e) {
      setError(t(e instanceof Error ? e.message : 'Something went wrong.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: colors.backdrop }]} onPress={onClose} />
      <View style={[styles.sheet, { backgroundColor: colors.card, paddingBottom: insets.bottom + 16 }]}>
        <View style={[styles.handle, { backgroundColor: colors.line }]} />
        <Text style={[styles.title, { color: colors.text }]}>
          {t('Mark Paid')} · {money(Number(item.total))}
        </Text>
        {!!(item.client_name || item.number) && (
          <Text style={[styles.sub, { color: colors.muted }]}>{[item.client_name, item.number].filter(Boolean).join(' · ')}</Text>
        )}

        <Text style={[styles.label, { color: tried && !method ? '#E5484D' : colors.muted }]}>{t('How did they pay?')}</Text>
        <View style={[styles.chips, tried && !method && { ...INVALID, borderRadius: radius.md, padding: 6 }]}>
          {PAYMENT_METHODS.map((m) => (
            <Chip key={m} label={t(m)} active={method === m} onPress={() => setMethod(m)} />
          ))}
        </View>

        <View style={styles.dateRow}>
          <Text style={[styles.label, { color: colors.muted, marginTop: 0 }]}>{t('Paid on')}</Text>
          <DateTimePicker
            value={parseIso(date)}
            mode="date"
            display="compact"
            accentColor={colors.accent}
            maximumDate={new Date()}
            onValueChange={(_, d) => setDate(isoDate(d))}
          />
        </View>

        {!!error && <Text style={styles.error}>{error}</Text>}
        <BigButton title={t('Mark Paid')} onPress={save} busy={busy} />
        <BigButton kind="quiet" title={t('Cancel')} onPress={onClose} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: radius.lg + 6,
    borderTopRightRadius: radius.lg + 6,
    paddingHorizontal: 16,
    paddingTop: 10,
    gap: 10,
  },
  handle: { alignSelf: 'center', width: 40, height: 5, borderRadius: 3, marginBottom: 4 },
  title: { fontSize: 22, fontWeight: '800' },
  sub: { fontSize: 15, marginTop: -6 },
  label: { fontSize: 13, fontWeight: '600', marginTop: 6 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  dateRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
  error: { color: '#E5484D', fontSize: 14, fontWeight: '600' },
});
