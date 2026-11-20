// EDIT CLIENT (/edit-client?id=…) and NEW CLIENT (/edit-client): one screen with every field, Save at the bottom.
// Editing also offers "Delete client": their jobs and expenses stay (without the client), so no money record is lost.
// "Other addresses": a rental, an office… (the main Address is the billing one); jobs can be at any of them.
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BigButton, Chip, Field } from '@/components/form';
import { LANGUAGES, t, type Lang } from '@/i18n';
import { deleteClient, fetchSettings, getClient, storeClient, type ClientFields } from '@/lib/clients';
import { kindColors, radius, useColors } from '@/theme';

const EMPTY: ClientFields = { name: '', phone: '', email: '', address: '', notes: '', preferred_language: '', addresses: [] };

export default function EditClientScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const [fields, setFields] = useState<ClientFields | null>(id ? null : EMPTY);
  const [start, setStart] = useState<ClientFields>(EMPTY);
  const [docLang, setDocLang] = useState<Lang>('en');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchSettings()
      .then((s) => setDocLang(s.doc_language))
      .catch(() => {});
    if (!id) return;
    getClient(id)
      .then((c) => {
        const f: ClientFields = {
          name: c.name,
          phone: c.phone,
          email: c.email,
          address: c.address,
          notes: c.notes ?? '',
          preferred_language: c.preferred_language,
          addresses: c.addresses ?? [],
        };
        setFields(f);
        setStart(f);
      })
      .catch((e) => setError(t(e instanceof Error ? e.message : 'Could not load.')));
  }, [id]);

  const set = (patch: Partial<ClientFields>) => setFields((f) => (f ? { ...f, ...patch } : f));
  const setAddr = (i: number, patch: Partial<ClientFields['addresses'][number]>) =>
    setFields((f) => (f ? { ...f, addresses: f.addresses.map((a, j) => (j === i ? { ...a, ...patch } : a)) } : f));

  const close = () => {
    if (!fields || JSON.stringify(fields) === JSON.stringify(start)) return router.back();
    Alert.alert(t('Discard your changes?'), t('What you entered will be lost.'), [
      { text: t('Keep editing'), style: 'cancel' },
      { text: t('Discard'), style: 'destructive', onPress: () => router.back() },
    ]);
  };

  const save = async () => {
    if (!fields || busy) return;
    if (!fields.name.trim()) return setError(t('Please enter the client’s name.'));
    setBusy(true);
    setError('');
    try {
      const trimmed: ClientFields = {
        name: fields.name.trim(),
        phone: fields.phone.trim(),
        email: fields.email.trim(),
        address: fields.address.trim(),
        notes: fields.notes.trim(),
        preferred_language: fields.preferred_language,
        addresses: fields.addresses.map((a) => ({ label: a.label.trim(), address: a.address.trim() })).filter((a) => a.address),
      };
      // a new client without other addresses doesn't send the list (works before the database has the column)
      const body = !id && trimmed.addresses.length === 0 ? { ...trimmed, addresses: undefined } : trimmed;
      const saved = await storeClient(body as ClientFields, id);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      if (id) router.back();
      else router.replace({ pathname: '/client/[id]', params: { id: saved.id } });
    } catch (e) {
      setError(t(e instanceof Error ? e.message : 'Something went wrong.'));
    } finally {
      setBusy(false);
    }
  };

  const remove = () =>
    id &&
    Alert.alert(t('Delete this client?'), t('Their invoices, estimates and tasks stay, without the client’s name.'), [
      { text: t('Cancel'), style: 'cancel' },
      {
        text: t('Delete'),
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteClient(id);
            router.dismissTo('/clients');
          } catch (e) {
            Alert.alert(t(e instanceof Error ? e.message : 'Something went wrong.'));
          }
        },
      },
    ]);

  return (
    <KeyboardAvoidingView behavior="padding" style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={[styles.top, { paddingTop: insets.top + 4 }]}>
        <Pressable onPress={close} hitSlop={12} accessibilityRole="button">
          <Text style={[styles.topBtn, { color: colors.accent }]}>{t('Cancel')}</Text>
        </Pressable>
        <Text style={[styles.topTitle, { color: colors.muted }]}>{id ? t('Edit client') : t('New client')}</Text>
        <View style={{ width: 64 }} />
      </View>

      {!fields ? (
        error ? (
          <Text style={[styles.error, { marginTop: 40, textAlign: 'center' }]}>{error}</Text>
        ) : (
          <ActivityIndicator style={{ marginTop: 40 }} />
        )
      ) : (
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
          <Field label={t('Name')} value={fields.name} onChangeText={(v) => set({ name: v })} autoCapitalize="words" autoFocus={!id} />
          <Field label={t('Phone')} value={fields.phone} onChangeText={(v) => set({ phone: v })} keyboardType="phone-pad" textContentType="telephoneNumber" />
          <Field label={t('Email')} value={fields.email} onChangeText={(v) => set({ email: v })} keyboardType="email-address" autoCapitalize="none" />
          <Field label={t('Billing address')} value={fields.address} onChangeText={(v) => set({ address: v })} textContentType="fullStreetAddress" />
          {fields.addresses.map((a, i) => (
            <View key={i} style={[styles.addrCard, { backgroundColor: colors.card }]}>
              <View style={styles.addrHead}>
                <Text style={[styles.small, { color: colors.muted, flex: 1 }]}>{t('Other address {n}', { n: i + 1 })}</Text>
                <Pressable
                  onPress={() => set({ addresses: fields.addresses.filter((_, j) => j !== i) })}
                  hitSlop={10}
                  accessibilityLabel={t('Remove')}>
                  <Text style={[styles.small, { color: kindColors.unpaid, fontWeight: '700' }]}>{t('Remove')}</Text>
                </Pressable>
              </View>
              <Field value={a.label} onChangeText={(v) => setAddr(i, { label: v })} placeholder={t('Name, e.g. Rental, Office')} />
              <Field value={a.address} onChangeText={(v) => setAddr(i, { address: v })} placeholder={t('Address')} textContentType="fullStreetAddress" />
            </View>
          ))}
          <BigButton
            kind="second"
            title={t('＋ Another address')}
            onPress={() => set({ addresses: [...fields.addresses, { label: '', address: '' }] })}
          />
          <Field
            label={t('Notes (only you see them)')}
            value={fields.notes}
            onChangeText={(v) => set({ notes: v })}
            multiline
            placeholder={t('e.g. gate code, dog in the yard, prefers texts')}
            style={{ minHeight: 90, paddingTop: 12, textAlignVertical: 'top' }}
          />

          <View style={[styles.langCard, { backgroundColor: colors.card }]}>
            <Text style={[styles.langTitle, { color: colors.text }]}>{t('Also send a copy in your client’s language?')}</Text>
            <Text style={[styles.small, { color: colors.muted }]}>
              {t('The invoice is always in {lang}. If your client reads another language better, they also get a copy in that language.', {
                lang: LANGUAGES[docLang],
              })}
            </Text>
            <View style={styles.chips}>
              <Chip
                label={t('No, {lang} only', { lang: LANGUAGES[docLang] })}
                active={!fields.preferred_language || fields.preferred_language === docLang}
                onPress={() => set({ preferred_language: '' })}
              />
              {(Object.keys(LANGUAGES) as Lang[])
                .filter((l) => l !== docLang)
                .map((l) => (
                  <Chip key={l} label={LANGUAGES[l]} active={fields.preferred_language === l} onPress={() => set({ preferred_language: l })} />
                ))}
            </View>
          </View>

          {!!id && (
            <Pressable
              onPress={remove}
              accessibilityRole="button"
              style={({ pressed }) => [styles.deleteBtn, { borderColor: colors.line, backgroundColor: pressed ? colors.line : colors.card }]}>
              <Text style={[styles.deleteText, { color: kindColors.unpaid }]}>{t('Delete client')}</Text>
            </Pressable>
          )}
        </ScrollView>
      )}

      <View style={[styles.bottom, { paddingBottom: Math.max(insets.bottom, 12), borderTopColor: colors.line }]}>
        {!!error && !!fields && <Text style={styles.error}>{error}</Text>}
        <BigButton title={id ? t('Save changes') : t('Save client')} onPress={save} busy={busy} disabled={!fields} />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 8 },
  topBtn: { fontSize: 17, fontWeight: '600', width: 64 },
  topTitle: { fontSize: 15, fontWeight: '600' },
  content: { padding: 16, gap: 12, paddingBottom: 40 },
  langCard: { borderRadius: radius.md, padding: 14, gap: 6, marginTop: 4 },
  langTitle: { fontSize: 16, fontWeight: '700' },
  small: { fontSize: 14 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6 },
  addrCard: { borderRadius: radius.md, padding: 12, gap: 8 },
  addrHead: { flexDirection: 'row', alignItems: 'center' },
  deleteBtn: { height: 48, borderRadius: radius.md, borderWidth: 1, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  deleteText: { fontSize: 16, fontWeight: '700' },
  bottom: { paddingHorizontal: 16, paddingTop: 10, gap: 8, borderTopWidth: StyleSheet.hairlineWidth },
  error: { color: '#E5484D', fontSize: 14, fontWeight: '600' },
});
