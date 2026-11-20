// CLIENTS TAB: everyone the user works for, A–Z, with one search box (name, phone or email).
// Each row: name, phone, and what they owe (red) — tap → the client's page. The ＋ here offers "New client" first.
// Clients are also added on the way, when an invoice / estimate / task picks a new name or a phone contact.
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CreateButton } from '@/components/create-button';
import { t } from '@/i18n';
import { matches } from '@/lib/client-tools';
import { fetchClients, type Client } from '@/lib/clients';
import { money } from '@/lib/money';
import { kindColors, radius, useColors } from '@/theme';

export default function ClientsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [clients, setClients] = useState<Client[] | null>(null);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');

  useFocusEffect(
    useCallback(() => {
      fetchClients()
        .then((c) => {
          setClients(c);
          setError('');
        })
        .catch((e) => setError(t(e instanceof Error ? e.message : 'Could not load.')));
    }, []),
  );

  const q = query.trim();
  const shown = useMemo(
    () => (clients ?? []).filter((c) => !q || matches(q, c.name, c.phone, c.email, c.address)),
    [clients, q],
  );
  const owesTotal = (clients ?? []).reduce((sum, c) => sum + Math.round((c.owes ?? 0) * 100), 0) / 100;

  const open = (c: Client) => router.push({ pathname: '/client/[id]', params: { id: c.id } });

  return (
    <View style={[styles.screen, { backgroundColor: colors.bg, paddingTop: insets.top + 6 }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>{t('Clients')}</Text>
      </View>
      {owesTotal > 0 && (
        <Text style={[styles.owesAll, { color: kindColors.unpaid }]}>{t('Clients owe you {amount}', { amount: money(owesTotal) })}</Text>
      )}
      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder={t('🔍  Name, phone or email')}
        placeholderTextColor={colors.faint}
        autoCorrect={false}
        clearButtonMode="while-editing"
        style={[styles.search, { backgroundColor: colors.card, borderColor: colors.line, color: colors.text }]}
      />

      <FlatList
        data={shown}
        keyExtractor={(c) => c.id}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 10, gap: 8, paddingBottom: insets.bottom + 140 }}
        renderItem={({ item: c }) => (
          <Pressable
            onPress={() => open(c)}
            accessibilityRole="button"
            style={({ pressed }) => [styles.row, { backgroundColor: pressed ? colors.line : colors.card, borderColor: colors.line }]}>
            <View style={[styles.avatar, { backgroundColor: colors.line }]}>
              <Text style={[styles.avatarText, { color: colors.text }]}>{(c.name.trim()[0] ?? '?').toUpperCase()}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
                {c.name}
              </Text>
              {!!(c.phone || c.email) && (
                <Text style={[styles.sub, { color: colors.muted }]} numberOfLines={1}>
                  {c.phone || c.email}
                </Text>
              )}
            </View>
            {(c.owes ?? 0) > 0 && (
              <Text style={[styles.owes, { color: kindColors.unpaid }]}>{t('owes {amount}', { amount: money(c.owes ?? 0) })}</Text>
            )}
            <Text style={[styles.chevron, { color: colors.faint }]}>›</Text>
          </Pressable>
        )}
        ListEmptyComponent={
          clients ? (
            <View style={[styles.empty, { backgroundColor: colors.card }]}>
              <Text style={[styles.emptyText, { color: colors.muted }]}>
                {q ? t('No client matches “{q}”.', { q }) : t('No clients yet. They are added when you create an invoice, or with ＋ → New client.')}
              </Text>
            </View>
          ) : (
            <Text style={[styles.emptyText, { color: error ? kindColors.unpaid : colors.muted, marginTop: 30 }]}>{error || t('Loading…')}</Text>
          )
        }
      />

      <CreateButton main="client" />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16 },
  title: { fontSize: 32, fontWeight: '800', letterSpacing: -0.5 },
  owesAll: { paddingHorizontal: 16, marginTop: 2, fontSize: 15, fontWeight: '700' },
  search: { marginHorizontal: 16, marginTop: 12, height: 46, borderRadius: radius.md, borderWidth: 1, paddingHorizontal: 14, fontSize: 17 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, padding: 12 },
  avatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 17, fontWeight: '800' },
  name: { fontSize: 17, fontWeight: '700' },
  sub: { fontSize: 14, marginTop: 2 },
  owes: { fontSize: 14, fontWeight: '700' },
  chevron: { fontSize: 24, marginLeft: 2 },
  empty: { borderRadius: radius.md, padding: 16 },
  emptyText: { fontSize: 15, textAlign: 'center' },
});
