// Settings is built in step 9. For now: your work (the AI's context), the two languages (the translated invoice,
// step 7) and Sign out.
//   Your language: the language you write in and check the invoice in ("Check in my language"); the screens follow
//   in step 9.   Invoice language: the main invoice is always in this language (the one sent, for your records).
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Chip } from '@/components/form';
import { LANGUAGES, t, type Lang } from '@/i18n';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { fetchSettings, type Settings } from '@/lib/clients';
import { joinTrade, splitTrade, TRADES } from '@/lib/trades';
import { radius, useColors } from '@/theme';

export default function SettingsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { signOut } = useAuth();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [error, setError] = useState('');
  const [other, setOther] = useState<string | null>(null); // "Other" while typing (saved when leaving the field)

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
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ paddingTop: insets.top + 6, paddingHorizontal: 16, paddingBottom: insets.bottom + 120 }}>
      <Text style={[styles.title, { color: colors.text }]}>{t('Settings')}</Text>
      {settings && (
        <View style={{ gap: 12, marginTop: 20 }}>
          {(() => {
            const { chosen, other: savedOther } = splitTrade(settings.trade ?? '');
            const toggle = (trade: string) =>
              save({ trade: joinTrade(chosen.includes(trade) ? chosen.filter((c) => c !== trade) : [...chosen, trade], savedOther) });
            return (
              <View style={[styles.card, { backgroundColor: colors.card }]}>
                <Text style={[styles.cardTitle, { color: colors.text }]}>{t('What kind of work do you do?')}</Text>
                <Text style={[styles.sub, { color: colors.muted }]}>
                  {t('Pick one or more. The AI then reads your words in the sense of your work (for a hair salon “укладка” is a blowout, for lawn care it is sod).')}
                </Text>
                <View style={styles.chips}>
                  {TRADES.map((tr) => (
                    <Chip key={tr} label={t(tr)} active={chosen.includes(tr)} onPress={() => toggle(tr)} />
                  ))}
                </View>
                <TextInput
                  value={other ?? savedOther}
                  onChangeText={setOther}
                  onEndEditing={() => {
                    if (other !== null && other !== savedOther) save({ trade: joinTrade(chosen, other) });
                    setOther(null);
                  }}
                  placeholder={t('Other: write your work, e.g. mobile car detailing')}
                  placeholderTextColor={colors.faint}
                  style={[styles.input, { color: colors.text, borderColor: colors.line, backgroundColor: colors.bg }]}
                />
              </View>
            );
          })()}
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
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 32, fontWeight: '800', letterSpacing: -0.5 },
  card: { borderRadius: radius.md, padding: 14, gap: 6 },
  cardTitle: { fontSize: 17, fontWeight: '700' },
  sub: { fontSize: 14 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6 },
  button: { marginTop: 24, height: 50, borderRadius: radius.md, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  text: { fontSize: 17, fontWeight: '600' },
  error: { color: '#E5484D', fontSize: 14, fontWeight: '600' },
  input: { minHeight: 46, borderRadius: radius.sm, borderWidth: 1, paddingHorizontal: 12, fontSize: 16, marginTop: 6 },
});
