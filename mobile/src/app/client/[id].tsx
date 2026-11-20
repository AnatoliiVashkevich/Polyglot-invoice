// THE CLIENT'S PAGE (product-decisions.md §9b):
//   name · Call / Text / Navigate · Paid total / Owes now · contacts, language, notes · their jobs, newest first.
// Jobs: filter buttons (All · Invoices · Estimates · Tasks · Owes), grouped by month, 20 at a time ("Show more"),
// so a client with hundreds of jobs stays easy to read and fast.
// The ＋ here pre-fills this client (the questionnaire starts at "check the client's info"). ✏️ Edit → edit-client.
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DayRow } from '@/components/calendar/day-list';
import { ContactBar } from '@/components/contact-bar';
import { CreateButton } from '@/components/create-button';
import { LANGUAGES, t } from '@/i18n';
import { Chip } from '@/components/form';
import { addressOptions, clientMoney, filterJobs, mapsUrl, JOB_FILTERS, monthGroups, newestFirst, type JobFilter } from '@/lib/client-tools';
import { getClient, type Client } from '@/lib/clients';
import { fetchClientItems } from '@/lib/items';
import { money } from '@/lib/money';
import { kindColors, radius, useColors } from '@/theme';
import type { Item } from '@/types';

const PAGE = 20;
const FILTER_LABEL: Record<JobFilter, string> = { all: 'All', invoice: 'Invoices', estimate: 'Estimates', task: 'Tasks', owes: 'Owes' };
const monthName = (month: string) =>
  new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)) - 1, 1).toLocaleString('en-US', { month: 'long', year: 'numeric' });

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
  const [filter, setFilter] = useState<JobFilter>('all');
  const [shownCount, setShownCount] = useState(PAGE);
  const filtered = useMemo(() => filterJobs(items, filter), [items, filter]);
  const groups = useMemo(() => monthGroups(filtered.slice(0, shownCount)), [filtered, shownCount]);
  const choose = (f: JobFilter) => {
    setFilter(f);
    setShownCount(PAGE);
  };


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

          <ContactBar phone={client.phone} address={client.address} />

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
            ]
              .filter(([, v]) => v)
              .map(([icon, v]) => (
                <Text key={icon} style={[styles.info, { color: colors.text }]} selectable>
                  {icon} {v}
                </Text>
              ))}
            {addressOptions(client.address, client.addresses).map((a) => (
              <View key={a.address} style={styles.addrRow}>
                <Text style={[styles.info, { color: colors.text, flex: 1 }]} selectable>
                  📍 {a.main ? '' : `${a.label || t('Other')}: `}
                  {a.address}
                </Text>
                <Pressable
                  onPress={() => Linking.openURL(mapsUrl(a.address))}
                  accessibilityRole="button"
                  style={({ pressed }) => [styles.goBtn, { borderColor: colors.line, backgroundColor: pressed ? colors.line : colors.bg }]}>
                  <Text style={[styles.goText, { color: colors.accent }]}>{t('Navigate')}</Text>
                </Pressable>
              </View>
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
            <>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                {JOB_FILTERS.map((f) => (
                  <Chip key={f} label={`${t(FILTER_LABEL[f])} ${filterJobs(items, f).length}`} active={filter === f} onPress={() => choose(f)} />
                ))}
              </ScrollView>
              {filtered.length === 0 && <Text style={[styles.info, { color: colors.muted }]}>{t('Nothing here.')}</Text>}
              {groups.map((g) => (
                <View key={g.month} style={{ gap: 6 }}>
                  <Text style={[styles.month, { color: colors.muted }]}>
                    {monthName(g.month)} · {g.items.length}
                    {g.invoiced > 0 ? ` · ${money(g.invoiced)}` : ''}
                  </Text>
                  {g.items.map((it) => (
                    <DayRow key={it.id} item={it} onPress={() => router.push({ pathname: '/job/[id]', params: { id: it.id } })} />
                  ))}
                </View>
              ))}
              {filtered.length > shownCount && (
                <Pressable
                  onPress={() => setShownCount((n) => n + PAGE)}
                  accessibilityRole="button"
                  style={({ pressed }) => [styles.more, { borderColor: colors.line, backgroundColor: pressed ? colors.line : colors.card }]}>
                  <Text style={[styles.moreText, { color: colors.accent }]}>
                    {t('Show more ({n} left)', { n: filtered.length - shownCount })}
                  </Text>
                </Pressable>
              )}
            </>
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
  sums: { flexDirection: 'row', gap: 8 },
  sum: { flex: 1, borderRadius: radius.md, padding: 12, gap: 2 },
  sumLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.6 },
  sumValue: { fontSize: 22, fontWeight: '800' },
  card: { borderRadius: radius.md, padding: 14, gap: 6 },
  info: { fontSize: 16 },
  section: { fontSize: 12, fontWeight: '700', letterSpacing: 0.6, marginTop: 4 },
  addrRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  goBtn: { height: 32, paddingHorizontal: 10, borderRadius: radius.pill, borderWidth: 1, justifyContent: 'center' },
  goText: { fontSize: 13, fontWeight: '700' },
  month: { fontSize: 13, fontWeight: '700', marginLeft: 4, marginTop: 6 },
  more: { height: 46, borderRadius: radius.md, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  moreText: { fontSize: 15, fontWeight: '700' },
  error: { fontSize: 15, fontWeight: '600', textAlign: 'center', marginTop: 40, paddingHorizontal: 16 },
});
