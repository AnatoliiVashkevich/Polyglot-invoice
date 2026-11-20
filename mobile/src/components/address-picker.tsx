// "Where is the job?" — for a client with more than one address (product-decisions.md §6h).
// Chips: the billing address first, then the others (Rental, Office…), then "＋ Another address", which adds it to
// the client right here. The chosen address goes on the job; the PDF shows it as JOB SITE when it isn't the billing one.
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { BigButton, Chip, Field } from '@/components/form';
import { t } from '@/i18n';
import { addressOptions, type ClientAddress } from '@/lib/client-tools';
import { radius, useColors } from '@/theme';

type Props = {
  main: string; // the client's billing address
  others: ClientAddress[];
  value: string; // the job's address ('' = the billing one)
  onChange: (address: string) => void;
  onAdd: (a: ClientAddress) => Promise<void>; // saves it to the client
};

export function AddressPicker({ main, others, value, onChange, onAdd }: Props) {
  const colors = useColors();
  const [adding, setAdding] = useState(false);
  const [label, setLabel] = useState('');
  const [address, setAddress] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const options = addressOptions(main, others);
  const chosen = (value || main).trim();
  const known = options.some((o) => o.address.toLowerCase() === chosen.toLowerCase());

  const add = async () => {
    if (!address.trim()) return setError(t('Please enter the address.'));
    setBusy(true);
    setError('');
    try {
      await onAdd({ label: label.trim(), address: address.trim() });
      onChange(address.trim());
      setAdding(false);
      setLabel('');
      setAddress('');
    } catch (e) {
      setError(t(e instanceof Error ? e.message : 'Something went wrong.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={[styles.card, { backgroundColor: colors.card }]}>
      <Text style={[styles.title, { color: colors.text }]}>{t('Where is the job?')}</Text>
      <View style={styles.chips}>
        {options.map((o) => (
          <Chip
            key={o.address}
            label={o.main ? t('Billing address') : o.label || o.address}
            active={chosen.toLowerCase() === o.address.toLowerCase()}
            onPress={() => onChange(o.main ? '' : o.address)}
          />
        ))}
        {!known && !!chosen && <Chip label={t('This job’s address')} active onPress={() => {}} />}
        {!adding && <Chip label={t('＋ Another address')} active={false} onPress={() => setAdding(true)} />}
      </View>
      {!!chosen && <Text style={[styles.small, { color: colors.muted }]}>📍 {chosen}</Text>}
      {adding && (
        <View style={styles.add}>
          <Field label={t('Name (optional)')} value={label} onChangeText={setLabel} placeholder={t('e.g. Rental, Office, Mom’s house')} />
          <Field label={t('Address')} value={address} onChangeText={setAddress} textContentType="fullStreetAddress" autoFocus />
          {!!error && <Text style={styles.error}>{error}</Text>}
          <BigButton kind="second" title={t('Add this address')} onPress={add} busy={busy} />
          <BigButton kind="quiet" title={t('Cancel')} onPress={() => setAdding(false)} disabled={busy} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.md, padding: 14, gap: 8, marginTop: 4 },
  title: { fontSize: 16, fontWeight: '700' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  small: { fontSize: 14 },
  add: { gap: 10, marginTop: 4 },
  error: { color: '#E5484D', fontSize: 14, fontWeight: '600' },
});
