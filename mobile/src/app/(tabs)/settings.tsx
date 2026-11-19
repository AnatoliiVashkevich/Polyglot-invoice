// Settings is built in step 9. For now: only Sign out (needed to test signing in).
import { Pressable, StyleSheet, Text } from 'react-native';

import { ComingSoon } from '@/components/coming-soon';
import { t } from '@/i18n';
import { useAuth } from '@/lib/auth';
import { radius, useColors } from '@/theme';

export default function SettingsScreen() {
  const colors = useColors();
  const { signOut } = useAuth();
  return (
    <ComingSoon title="Settings" step={9}>
      <Pressable
        onPress={signOut}
        accessibilityRole="button"
        style={({ pressed }) => [styles.button, { backgroundColor: pressed ? colors.line : colors.card, borderColor: colors.line }]}>
        <Text style={[styles.text, { color: '#E5484D' }]}>{t('Sign out')}</Text>
      </Pressable>
    </ComingSoon>
  );
}

const styles = StyleSheet.create({
  button: { marginTop: 24, height: 50, borderRadius: radius.md, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  text: { fontSize: 17, fontWeight: '600' },
});
