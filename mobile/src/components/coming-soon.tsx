// A tab that is built in a later step of the build plan (development only; never shipped).
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { t } from '@/i18n';
import { useColors } from '@/theme';

export function ComingSoon({ title, step }: { title: string; step: number }) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.screen, { backgroundColor: colors.bg, paddingTop: insets.top + 6 }]}>
      <Text style={[styles.title, { color: colors.text }]}>{t(title)}</Text>
      <Text style={[styles.note, { color: colors.muted }]}>{t('Built in step {n} of the plan.', { n: step })}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, paddingHorizontal: 16 },
  title: { fontSize: 32, fontWeight: '800', letterSpacing: -0.5 },
  note: { fontSize: 15, marginTop: 8 },
});
