// "Add these materials to your expenses?" — asked at Create when an invoice has Materials lines
// (product-decisions.md §6f). Each material shows "I paid $", filled in with the line amount and changeable
// (the customer may pay more than the user paid). "Later" creates the invoice without expenses.
// Each cost is counted once: here, or later with ＋ → Expense (a receipt), not both.
import { useState } from 'react';
import { KeyboardAvoidingView, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BigButton } from '@/components/form';
import { t } from '@/i18n';
import { lineCents, parseAmount, type Line } from '@/lib/invoice-math';
import { radius, useColors } from '@/theme';

export type PaidExpense = { description: string; amount: number };

type Props = {
  materials: Line[] | null; // null = closed
  busy?: boolean;
  onAnswer: (expenses: PaidExpense[]) => void; // [] = Later
  onClose: () => void;
};

export function MaterialsExpenseSheet({ materials, busy, onAnswer, onClose }: Props) {
  return (
    <Modal visible={!!materials} transparent animationType="slide" onRequestClose={onClose}>
      {materials && <SheetBody materials={materials} busy={busy} onAnswer={onAnswer} onClose={onClose} />}
    </Modal>
  );
}

function SheetBody({ materials, busy, onAnswer, onClose }: Props & { materials: Line[] }) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [paid, setPaid] = useState(() => materials.map((l) => (lineCents(l) / 100).toFixed(2)));
  const [error, setError] = useState('');

  const add = () => {
    const values = paid.map((p) => (p.trim() ? parseAmount(p) : 0));
    if (values.some((v) => Number.isNaN(v) || v < 0)) return setError(t('Please check the amounts: numbers only, like 64.50.'));
    onAnswer(
      materials.map((l, i) => ({ description: l.text, amount: values[i] })).filter((e) => e.amount > 0),
    );
  };

  return (
    <KeyboardAvoidingView behavior="padding" style={styles.wrap}>
      <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: colors.backdrop }]} onPress={onClose} />
      <View style={[styles.sheet, { backgroundColor: colors.card, paddingBottom: insets.bottom + 16 }]}>
        <View style={[styles.handle, { backgroundColor: colors.line }]} />
        <Text style={[styles.title, { color: colors.text }]}>{t('Add these materials to your expenses?')}</Text>
        <Text style={[styles.sub, { color: colors.muted }]}>
          {t('Your expenses show how much you really earn. We count each cost once: add it here, or later from the receipt with ＋ → Expense — not both.')}
        </Text>
        <ScrollView style={{ maxHeight: 260 }} keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 8 }}>
          {materials.map((l, i) => (
            <View key={i} style={[styles.row, { borderColor: colors.line }]}>
              <Text style={[styles.text, { color: colors.text }]} numberOfLines={2}>
                {l.text}
              </Text>
              <Text style={[styles.small, { color: colors.muted }]}>{t('I paid $')}</Text>
              <TextInput
                value={paid[i]}
                onChangeText={(v) => setPaid((old) => old.map((p, j) => (j === i ? v : p)))}
                keyboardType="decimal-pad"
                selectTextOnFocus
                style={[styles.input, { color: colors.text, borderColor: colors.line, backgroundColor: colors.bg }]}
              />
            </View>
          ))}
        </ScrollView>
        {!!error && <Text style={styles.error}>{error}</Text>}
        <BigButton title={t('Add to my expenses')} onPress={add} busy={busy} />
        <BigButton kind="second" title={t('Later')} onPress={() => onAnswer([])} disabled={busy} />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: radius.lg + 6,
    borderTopRightRadius: radius.lg + 6,
    paddingHorizontal: 16,
    paddingTop: 10,
    gap: 10,
  },
  handle: { alignSelf: 'center', width: 40, height: 5, borderRadius: 3, marginBottom: 4 },
  title: { fontSize: 21, fontWeight: '800' },
  sub: { fontSize: 15, lineHeight: 20 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: radius.md, padding: 10 },
  text: { flex: 1, fontSize: 16, fontWeight: '600' },
  small: { fontSize: 14 },
  input: { width: 96, height: 42, borderWidth: 1, borderRadius: radius.sm, paddingHorizontal: 10, fontSize: 17 },
  error: { color: '#E5484D', fontSize: 14, fontWeight: '600' },
});
