// "Your business": the details printed at the top of every invoice. Opened from the Review step so the user can
// check / fill in everything the PDF shows. (The full Settings screen and first-launch questions come in step 9.)
import { useState } from 'react';
import { KeyboardAvoidingView, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BigButton, Field } from '@/components/form';
import { t } from '@/i18n';
import { api } from '@/lib/api';
import type { Settings } from '@/lib/clients';
import { radius, useColors } from '@/theme';

type Props = { settings: Settings | null; visible: boolean; onClose: () => void; onSaved: (s: Settings) => void };

export function BusinessSheet({ settings, visible, onClose, onSaved }: Props) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      {visible && settings && <Body settings={settings} onClose={onClose} onSaved={onSaved} />}
    </Modal>
  );
}

function Body({ settings, onClose, onSaved }: { settings: Settings; onClose: () => void; onSaved: (s: Settings) => void }) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [form, setForm] = useState({
    name: settings.name,
    phone: settings.phone,
    email: settings.email,
    address: settings.address,
    payment_info: settings.payment_info,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = (k: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    if (!form.name.trim()) return setError(t('Please enter your business name.'));
    setBusy(true);
    setError('');
    try {
      const body = Object.fromEntries(Object.entries(form).map(([k, v]) => [k, v.trim()]));
      onSaved(await api<Settings>('/api/settings', { method: 'PATCH', body }));
    } catch (e) {
      setError(t(e instanceof Error ? e.message : 'Something went wrong.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior="padding" style={{ flex: 1, justifyContent: 'flex-end' }}>
      <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: colors.backdrop }]} onPress={onClose} />
      <View style={[styles.sheet, { backgroundColor: colors.bg, paddingBottom: insets.bottom + 12, maxHeight: '88%' }]}>
        <View style={[styles.handle, { backgroundColor: colors.line }]} />
        <Text style={[styles.title, { color: colors.text }]}>{t('Your business')}</Text>
        <Text style={[styles.sub, { color: colors.muted }]}>{t('Printed at the top of every invoice.')}</Text>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 12, paddingVertical: 12 }}>
          <Field label={t('Business name')} value={form.name} onChangeText={set('name')} autoCapitalize="words" />
          <Field label={t('Phone')} value={form.phone} onChangeText={set('phone')} keyboardType="phone-pad" />
          <Field label={t('Email')} value={form.email} onChangeText={set('email')} keyboardType="email-address" autoCapitalize="none" />
          <Field label={t('Address')} value={form.address} onChangeText={set('address')} />
          <Field
            label={t('How customers pay you')}
            value={form.payment_info}
            onChangeText={set('payment_info')}
            placeholder={t('e.g. Zelle (561) 555-0100, Venmo @fixit')}
            multiline
          />
        </ScrollView>
        {!!error && <Text style={styles.error}>{error}</Text>}
        <BigButton title={t('Save')} onPress={save} busy={busy} />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  sheet: {
    borderTopLeftRadius: radius.lg + 6,
    borderTopRightRadius: radius.lg + 6,
    paddingHorizontal: 16,
    paddingTop: 10,
  },
  handle: { alignSelf: 'center', width: 40, height: 5, borderRadius: 3, marginBottom: 8 },
  title: { fontSize: 22, fontWeight: '800' },
  sub: { fontSize: 15, marginTop: 2 },
  error: { color: '#E5484D', fontSize: 14, fontWeight: '600', marginBottom: 8 },
});
