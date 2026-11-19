// THE CLIENT'S PAGE (product-decisions.md §9b):
//   name · Call / Text / Navigate · Paid total / Owes now · contacts, language, notes · their jobs, newest first.
// The ＋ here pre-fills this client (the questionnaire starts at "check the customer's info"). ✏️ Edit → edit-client.
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DayRow } from '@/components/calendar/day-list';
import { CreateButton } from '@/components/create-button';
import { LANGUAGES, t } from '@/i18n';
import { callUrl, clientMoney, mapsUrl, newestFirst, textUrl } from '@/lib/client-tools';
import { getClient, type Client } from '@/lib/clients';
import { formatDay } from '@/lib/dates';
import { fetchClientItems } from '@/lib/items';
import { money } from '@/lib/money';
import { kindColors, radius, useColors } from '@/theme';
import type { Item } from '@/types';

export default function ClientScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [client, setClient] = useState<Client | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [error, setError] = useState('');

  useFocusEffect(
    useCallback(() => {
      Promise.all([getClient(id), fetchClientItems(id)])
        .then(([c, its]) => {
          setClient(c);
          setItems(newestFirst(its));
          setError('');
        })
        .catch((e) => setError(t(e instanceof Error ? e.message : 'Could not load.')));
    }, [id]),
  );

  const sums = useMemo(() => clientMoney(items), [items]);

  const openLink = async (url: string, missing: string) => {
    if (!url) return Alert.alert(missing, t('Tap ✏️ Edit to add it.'));
    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert(t('This iPhone cannot open it.'));
    }
  };

  const actions = client
    ? [
        { icon: '📞', label: t('Call'), onPress: () => openLink(callUrl(client.phone), t('No phone number yet.')) },
        { icon: '💬', label: t('Text'), onPress: () => openLink(textUrl(client.phone), t('No phone number yet.')) },
        { icon: '📍', label: t('Navigate'), onPress: () => openLink(mapsUrl(client.address), t('No address yet.')) },
      ]
    : [];

  return (
    <View style={[styles.screen, { backgroundColor: colors.bg, paddingTop: insets.top + 4 }]}>
      <View style={styles.top}>
        <Pressable onPress={() => router.back()} hitSlop={12} accessibilityRole="button">
          <Text style={[styles.topBtn, { color: colors.accent }]}>‹ {t('Clients')}</Text>
        </Pressable>
        {client && (
          <Pressable
            onPress={() => router.push({ pathname: '/edit-client', params: { id: client.id } })}
            hitSlop={12}
            accessibilityRole="button"
            style={({ pressed }) => [styles.editBtn, { borderColor: colors.line, backgroundColor: pressed ? colors.line : colors.card }]}>
            <Text style={[styles.editText, { color: colors.text }]}>✏️ {t('Edit')}</Text>
          </Pressable>
        )}
      </View>

      {!client ? (
        error ? (
          <Text style={[styles.error, { color: kindColors.unpaid }]}>{error}</Text>
        ) : (
          <ActivityIndicator style={{ marginTop: 40 }} />
        )
      ) : (
        <ScrollView contentContainerStyle={{ paddingHorizontal: 16, gap: 12, paddingBottom: insets.bottom + 140 }}>
          <Text style={[styles.name, { color: colors.text }]}>{client.name}</Text>

          <View style={styles.actions}>
            {actions.map((a) => (
              <Pressable
                key={a.label}
                onPress={a.onPress}
                accessibilityRole="button"
                style={({ pressed }) => [styles.action, { borderColor: colors.line, backgroundColor: pressed ? colors.line : colors.card }]}>
                <Text style={styles.actionIcon}>{a.icon}</Text>
                <Text style={[styles.actionText, { color: colors.accent }]}>{a.label}</Text>
              </Pressable>
            ))}
          </View>

          <View style={styles.sums}>
            <View style={[styles.sum, { backgroundColor: colors.card }]}>
              <Text style={[styles.sumLabel, { color: colors.muted }]}>{t('PAID TOTAL')}</Text>
              <Text style={[styles.sumValue, { color: colors.text }]}>{money(sums.paid)}</Text>
            </View>
            <View style={[styles.sum, { backgroundColor: colors.card }]}>
              <Text style={[styles.sumLabel, { color: colors.muted }]}>{t('OWES NOW')}</Text>
              <Text style={[styles.sumValue, { color: sums.owes > 0 ? kindColors.unpaid : colors.text }]}>{money(sums.owes)}</Text>
            </View>
          </View>

          <View style={[styles.card, { backgroundColor: colors.card }]}>
            {[
              ['📞', client.phone],
              ['✉️', client.email],
              ['📍', client.address],
            ]
              .filter(([, v]) => v)
              .map(([icon, v]) => (
                <Text key={icon} style={[styles.info, { color: colors.text }]} selectable>
                  {icon} {v}
                </Text>
              ))}
            <Text style={[styles.info, { color: colors.muted }]}>
              🌐 {client.preferred_language ? t('Also gets a copy in {lang}', { lang: LANGUAGES[client.preferred_language] }) : t('No extra language')}
            </Text>
            {!!client.notes && (
              <Text style={[styles.info, { color: colors.text }]} selectable>
                📝 {client.notes}
              </Text>
            )}
          </View>

          <Text style={[styles.section, { color: colors.muted }]}>{t('JOBS')}</Text>
          {items.length === 0 ? (
            <View style={[styles.card, { backgroundColor: colors.card }]}>
              <Text style={[styles.info, { color: colors.muted }]}>{t('No jobs yet. Tap ＋ to make an invoice, an estimate or a task for {name}.', { name: client.name })}</Text>
            </View>
          ) : (
            items.map((it, i) => (
              <View key={it.id} style={{ gap: 4 }}>
                {(i === 0 || items[i - 1].date !== it.date) && (
                  <Text style={[styles.date, { color: colors.muted }]}>{formatDay(it.date, 'en-US')}</Text>
                )}
                <DayRow item={it} onPress={() => router.push({ pathname: '/job/[id]', params: { id: it.id } })} />
              </View>
            ))
          )}
        </ScrollView>
      )}

      {client && <CreateButton clientId={client.id} />}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 8, minHeight: 44 },
  topBtn: { fontSize: 17, fontWeight: '600' },
  editBtn: { height: 36, paddingHorizontal: 14, borderRadius: radius.pill, borderWidth: 1, justifyContent: 'center' },
  editText: { fontSize: 15, fontWeight: '600' },
  name: { fontSize: 28, fontWeight: '800', letterSpacing: -0.4 },
  actions: { flexDirection: 'row', gap: 8 },
  action: { flex: 1, height: 64, borderRadius: radius.md, borderWidth: 1, alignItems: 'center', justifyContent: 'center', gap: 2 },
  actionIcon: { fontSize: 20 },
  actionText: { fontSize: 14, fontWeight: '700' },
  sums: { flexDirection: 'row', gap: 8 },
  sum: { flex: 1, borderRadius: radius.md, padding: 12, gap: 2 },
  sumLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.6 },
  sumValue: { fontSize: 22, fontWeight: '800' },
  card: { borderRadius: radius.md, padding: 14, gap: 6 },
  info: { fontSize: 16 },
  section: { fontSize: 12, fontWeight: '700', letterSpacing: 0.6, marginTop: 4 },
  date: { fontSize: 13, fontWeight: '600', marginLeft: 4 },
  error: { fontSize: 15, fontWeight: '600', textAlign: 'center', marginTop: 40, paddingHorizontal: 16 },
});
