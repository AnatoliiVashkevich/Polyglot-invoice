// Settings is built in step 9. For now: the two languages (needed for the translated invoice, step 7) and Sign out.
//   Your language: the language you write in and check the invoice in ("Check in my language"); the screens follow
//   in step 9.   Invoice language: the main invoice is always in this language (the one sent, for your records).
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ComingSoon } from '@/components/coming-soon';
import { Chip } from '@/components/form';
import { LANGUAGES, t, type Lang } from '@/i18n';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { fetchSettings, type Settings } from '@/lib/clients';
import { radius, useColors } from '@/theme';

export default function SettingsScreen() {
  const colors = useColors();
  const { signOut } = useAuth();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [error, setError] = useState('');

  useFocusEffect(
    useCallback(() => {
      fetchSettings()
        .then(setSettings)
        .catch(() => {});
    }, []),
  );

  const save = async (patch: Partial<Settings>) => {
    if (!settings) return;
    setSettings({ ...settings, ...patch }); // shows at once
    try {
      setSettings(await api<Settings>('/api/settings', { method: 'PATCH', body: patch }));
      setError('');
    } catch (e) {
      setError(t(e instanceof Error ? e.message : 'Something went wrong.'));
    }
  };

  const langCard = (title: string, sub: string, value: Lang, onPick: (l: Lang) => void) => (
    <View style={[styles.card, { backgroundColor: colors.card }]}>
      <Text style={[styles.cardTitle, { color: colors.text }]}>{title}</Text>
      <Text style={[styles.sub, { color: colors.muted }]}>{sub}</Text>
      <View style={styles.chips}>
        {(Object.keys(LANGUAGES) as Lang[]).map((l) => (
          <Chip key={l} label={LANGUAGES[l]} active={value === l} onPress={() => onPick(l)} />
        ))}
      </View>
    </View>
  );

  return (
    <ComingSoon title="Settings" step={9}>
      {settings && (
        <View style={{ gap: 12, marginTop: 20 }}>
          {langCard(
            t('Your language'),
            t('You write and check your invoices in it ("Check in my language"). The app’s screens follow in a later step.'),
            settings.app_language ?? 'en',
            (l) => save({ app_language: l }),
          )}
          {langCard(
            t('Invoice language'),
            t('The main invoice is always in this language: the one you send and keep for your records.'),
            settings.doc_language,
            (l) => save({ doc_language: l }),
          )}
          {!!error && <Text style={styles.error}>{error}</Text>}
        </View>
      )}
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
  card: { borderRadius: radius.md, padding: 14, gap: 6 },
  cardTitle: { fontSize: 17, fontWeight: '700' },
  sub: { fontSize: 14 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6 },
  button: { marginTop: 24, height: 50, borderRadius: radius.md, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  text: { fontSize: 17, fontWeight: '600' },
  error: { color: '#E5484D', fontSize: 14, fontWeight: '600' },
});
