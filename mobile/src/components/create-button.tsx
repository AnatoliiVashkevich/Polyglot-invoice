// The orange ＋ floating above the tab bar, and its menu: "New invoice" big and first, then Estimate · Task · Expense.
import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { Alert, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { t } from '@/i18n';
import { radius, useColors } from '@/theme';

export type CreateKind = 'invoice' | 'estimate' | 'task' | 'expense';

const TAB_BAR = 49; // the iPhone tab bar height above the home-indicator area

export function CreateButton({ onCreate }: { onCreate?: (kind: CreateKind) => void }) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);

  const choose = (kind: CreateKind) => {
    setOpen(false);
    if (onCreate) onCreate(kind);
    else Alert.alert(t('Coming soon'), t('This form is built in the next step.'));
  };

  return (
    <>
      <Pressable
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          setOpen(true);
        }}
        accessibilityRole="button"
        accessibilityLabel={t('Create')}
        style={({ pressed }) => [
          styles.fab,
          { backgroundColor: colors.accent, bottom: insets.bottom + TAB_BAR + 14, transform: [{ scale: pressed ? 0.94 : 1 }] },
        ]}>
        <Text style={[styles.plus, { color: colors.onAccent }]}>＋</Text>
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={[styles.backdrop, { backgroundColor: colors.backdrop }]} onPress={() => setOpen(false)} />
        <View style={[styles.sheet, { backgroundColor: colors.card, paddingBottom: insets.bottom + 16 }]}>
          <View style={[styles.handle, { backgroundColor: colors.line }]} />
          <Pressable
            onPress={() => choose('invoice')}
            style={({ pressed }) => [styles.main, { backgroundColor: colors.accent, opacity: pressed ? 0.85 : 1 }]}>
            <Text style={styles.mainIcon}>💵</Text>
            <Text style={[styles.mainText, { color: colors.onAccent }]}>{t('New invoice')}</Text>
          </Pressable>
          <View style={styles.others}>
            {(
              [
                ['estimate', '📋', 'Estimate'],
                ['task', '☑️', 'Task'],
                ['expense', '🧾', 'Expense'],
              ] as const
            ).map(([kind, icon, label]) => (
              <Pressable
                key={kind}
                onPress={() => choose(kind)}
                style={({ pressed }) => [
                  styles.other,
                  { borderColor: colors.line, backgroundColor: pressed ? colors.line : colors.bg },
                ]}>
                <Text style={styles.otherIcon}>{icon}</Text>
                <Text style={[styles.otherText, { color: colors.text }]}>{t(label)}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    alignSelf: 'center',
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#F26B1D',
    shadowOpacity: 0.4,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  plus: { fontSize: 32, fontWeight: '600', marginTop: -2 },
  backdrop: { ...StyleSheet.absoluteFill },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: radius.lg + 6,
    borderTopRightRadius: radius.lg + 6,
    paddingHorizontal: 16,
    paddingTop: 10,
    gap: 12,
  },
  handle: { alignSelf: 'center', width: 40, height: 5, borderRadius: 3, marginBottom: 4 },
  main: {
    height: 64,
    borderRadius: radius.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  mainIcon: { fontSize: 24 },
  mainText: { fontSize: 19, fontWeight: '800' },
  others: { flexDirection: 'row', gap: 10 },
  other: { flex: 1, height: 74, borderRadius: radius.md, borderWidth: 1, alignItems: 'center', justifyContent: 'center', gap: 4 },
  otherIcon: { fontSize: 22 },
  otherText: { fontSize: 14, fontWeight: '600' },
});
