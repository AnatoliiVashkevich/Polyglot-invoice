// Call · Text · Navigate — on the client's page and on every job (task, estimate, invoice).
// Navigate goes to the job's address when there is one (a client can have several addresses).
import { Alert, Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { t } from '@/i18n';
import { callUrl, mapsUrl, textUrl } from '@/lib/client-tools';
import { radius, useColors } from '@/theme';

async function openLink(url: string, missing: string) {
  if (!url) return Alert.alert(missing, t('Add it on the client’s page (✏️ Edit).'));
  try {
    await Linking.openURL(url);
  } catch {
    Alert.alert(t('This iPhone cannot open it.'));
  }
}

export function ContactBar({ phone, address, compact }: { phone: string; address: string; compact?: boolean }) {
  const colors = useColors();
  const buttons = [
    { icon: '📞', label: t('Call'), onPress: () => openLink(callUrl(phone), t('No phone number yet.')) },
    { icon: '💬', label: t('Text'), onPress: () => openLink(textUrl(phone), t('No phone number yet.')) },
    { icon: '📍', label: t('Navigate'), onPress: () => openLink(mapsUrl(address), t('No address yet.')) },
  ];
  return (
    <View style={styles.row}>
      {buttons.map((b) => (
        <Pressable
          key={b.label}
          onPress={b.onPress}
          accessibilityRole="button"
          style={({ pressed }) => [
            compact ? styles.compact : styles.big,
            { borderColor: colors.line, backgroundColor: pressed ? colors.line : colors.card },
          ]}>
          <Text style={compact ? styles.iconSmall : styles.icon}>{b.icon}</Text>
          <Text style={[styles.label, { color: colors.accent }]}>{b.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8 },
  big: { flex: 1, height: 64, borderRadius: radius.md, borderWidth: 1, alignItems: 'center', justifyContent: 'center', gap: 2 },
  compact: { flex: 1, height: 40, borderRadius: radius.md, borderWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  icon: { fontSize: 20 },
  iconSmall: { fontSize: 15 },
  label: { fontSize: 14, fontWeight: '700' },
});
