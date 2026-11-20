// ✏️ Edit — always at the top right of a page (client, task, estimate, invoice, note), the same size everywhere.
// Delete is always at the bottom of a page, away from other buttons, so nothing is deleted by accident (§6h).
import { Pressable, StyleSheet, Text } from 'react-native';

import { t } from '@/i18n';
import { radius, useColors } from '@/theme';

export function EditButton({ onPress }: { onPress: () => void }) {
  const colors = useColors();
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={t('Edit')}
      style={({ pressed }) => [styles.btn, { borderColor: colors.line, backgroundColor: pressed ? colors.line : colors.card }]}>
      <Text style={[styles.text, { color: colors.text }]}>✏️ {t('Edit')}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: { height: 42, minWidth: 90, paddingHorizontal: 16, borderRadius: radius.pill, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  text: { fontSize: 17, fontWeight: '700' },
});
