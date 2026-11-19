// Step 1 · Customer: ONE search box. Before typing: recent clients. While typing:
//   Your clients → From your phone contacts → ＋ New client "typed name"
// The contacts permission is asked only when the user taps "Search your phone contacts" (with the reason).
// Once allowed, matching contacts simply appear while typing. Refused → a row that opens Settings;
// only some contacts shared (iOS 18) → a row to choose more.
import { useEffect, useMemo, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { t } from '@/i18n';
import type { Client, ClientDraft } from '@/lib/clients';
import { chooseMoreContacts, contactsAccess, loadContacts, type ContactsAccess, type PhoneContact } from '@/lib/contacts';
import { radius, useColors } from '@/theme';

const MAX_ROWS = 8;

const phoneKey = (p: string) => {
  const digits = p.replace(/\D/g, '');
  return digits.length >= 7 ? digits.slice(-10) : '';
};

function matches(q: string, ...fields: string[]) {
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  const hay = fields.join(' ').toLowerCase();
  const digits = q.replace(/\D/g, '');
  return words.every((w) => hay.includes(w)) || (digits.length >= 3 && fields.some((f) => f.replace(/\D/g, '').includes(digits)));
}

export function CustomerStep({
  clients,
  onPick,
}: {
  clients: Client[];
  onPick: (draft: ClientDraft, original?: Client) => void;
}) {
  const colors = useColors();
  const [query, setQuery] = useState('');
  const [access, setAccess] = useState<ContactsAccess | 'unknown'>('unknown');
  const [contacts, setContacts] = useState<PhoneContact[]>([]);

  useEffect(() => {
    let alive = true;
    contactsAccess().then(async (status) => {
      if (!alive) return;
      setAccess(status);
      if (status === 'all' || status === 'limited') {
        const list = await loadContacts();
        if (alive) setContacts(list);
      }
    });
    return () => {
      alive = false;
    };
  }, []);

  const askContacts = async () => {
    const list = await loadContacts();
    setContacts(list);
    setAccess(await contactsAccess());
  };
  const moreContacts = async () => setContacts(await chooseMoreContacts());

  const q = query.trim();
  const recent = useMemo(() => {
    const used = clients.filter((c) => c.last_used).sort((a, b) => (b.last_used ?? '').localeCompare(a.last_used ?? ''));
    return (used.length ? used : clients).slice(0, MAX_ROWS);
  }, [clients]);
  const yourClients = useMemo(() => (q ? clients.filter((c) => matches(q, c.name, c.phone, c.email)).slice(0, MAX_ROWS) : []), [q, clients]);
  const fromPhone = useMemo(() => {
    if (!q) return [];
    const known = new Set(clients.map((c) => phoneKey(c.phone)).filter(Boolean));
    return contacts.filter((c) => !known.has(phoneKey(c.phone)) && matches(q, c.name, c.phone, c.email)).slice(0, MAX_ROWS);
  }, [q, contacts, clients]);

  const pickClient = (c: Client) =>
    onPick({ id: c.id, name: c.name, phone: c.phone, email: c.email, address: c.address, preferred_language: c.preferred_language }, c);
  const pickContact = (c: PhoneContact) =>
    onPick({ name: c.name, phone: c.phone, email: c.email, address: c.address, preferred_language: '', fromContacts: true });
  const pickNew = () => onPick({ name: q, phone: '', email: '', address: '', preferred_language: '' });

  const row = (key: string, title: string, sub: string, onPress: () => void, icon?: string) => (
    <Pressable
      key={key}
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [styles.row, { backgroundColor: pressed ? colors.line : colors.card }]}>
      {!!icon && <Text style={styles.icon}>{icon}</Text>}
      <View style={{ flex: 1 }}>
        <Text style={[styles.rowTitle, { color: colors.text }]} numberOfLines={1}>
          {title}
        </Text>
        {!!sub && (
          <Text style={[styles.rowSub, { color: colors.muted }]} numberOfLines={1}>
            {sub}
          </Text>
        )}
      </View>
    </Pressable>
  );
  const heading = (text: string) => <Text style={[styles.heading, { color: colors.muted }]}>{text}</Text>;

  return (
    <View style={{ gap: 8 }}>
      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder={t('🔍  Name, phone or email')}
        placeholderTextColor={colors.faint}
        autoFocus
        autoCorrect={false}
        returnKeyType="next"
        onSubmitEditing={() => q && pickNew()}
        style={[styles.search, { backgroundColor: colors.card, borderColor: colors.line, color: colors.text }]}
      />

      {!q && recent.length > 0 && (
        <>
          {heading(clients.some((c) => c.last_used) ? t('Recent') : t('Your clients'))}
          {recent.map((c) => row(c.id, c.name, c.phone || c.email, () => pickClient(c)))}
        </>
      )}
      {!q && clients.length === 0 && (
        <Text style={[styles.hint, { color: colors.muted }]}>{t('Type the customer’s name.')}</Text>
      )}

      {!!q && yourClients.length > 0 && (
        <>
          {heading(t('Your clients'))}
          {yourClients.map((c) => row(c.id, c.name, c.phone || c.email, () => pickClient(c)))}
        </>
      )}
      {!!q && fromPhone.length > 0 && (
        <>
          {heading(t('From your phone contacts'))}
          {fromPhone.map((c) => row(c.id, c.name, c.phone || c.email, () => pickContact(c), '📇'))}
        </>
      )}
      {!!q && (access === 'all' || access === 'limited') && fromPhone.length === 0 && (
        <Text style={[styles.hint, { color: colors.muted }]}>{t('No phone contacts match “{q}”.', { q })}</Text>
      )}
      {!!q && access === 'undetermined' &&
        row('ask', t('Search your phone contacts'), t('To find your customers faster.'), askContacts, '📇')}
      {!!q && access === 'limited' &&
        row('more', t('Choose more contacts'), t('You shared only some contacts with the app.'), moreContacts, '📇')}
      {!!q && access === 'denied' &&
        row('settings', t('Allow contacts in Settings'), t('To find your customers faster.'), () => Linking.openSettings(), '📇')}
      {!!q && row('new', t('New client “{name}”', { name: q }), '', pickNew, '＋')}
    </View>
  );
}

const styles = StyleSheet.create({
  search: { height: 52, borderRadius: radius.md, borderWidth: 1, paddingHorizontal: 14, fontSize: 17 },
  heading: { fontSize: 12, fontWeight: '700', letterSpacing: 0.6, textTransform: 'uppercase', marginTop: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: radius.md, paddingHorizontal: 14, minHeight: 54, paddingVertical: 8 },
  icon: { fontSize: 18 },
  rowTitle: { fontSize: 16, fontWeight: '600' },
  rowSub: { fontSize: 13, marginTop: 1 },
  hint: { fontSize: 15, marginTop: 8 },
});
