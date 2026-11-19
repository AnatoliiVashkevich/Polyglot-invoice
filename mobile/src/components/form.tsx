// Small building blocks for the questionnaire screens: a labeled field, the big bottom button, a choice chip.
import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';

import { radius, useColors } from '@/theme';

export function Field({ label, style, ...input }: TextInputProps & { label?: string }) {
  const colors = useColors();
  return (
    <View style={styles.field}>
      {!!label && <Text style={[styles.label, { color: colors.muted }]}>{label}</Text>}
      <TextInput
        placeholderTextColor={colors.faint}
        {...input}
        style={[styles.input, { backgroundColor: colors.card, borderColor: colors.line, color: colors.text }, style]}
      />
    </View>
  );
}

export function BigButton({
  title,
  onPress,
  busy,
  disabled,
  kind = 'main',
}: {
  title: string;
  onPress: () => void;
  busy?: boolean;
  disabled?: boolean;
  kind?: 'main' | 'second' | 'quiet';
}) {
  const colors = useColors();
  const main = kind === 'main';
  const second = kind === 'second';
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || busy}
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || busy }}
      style={({ pressed }) => [
        styles.big,
        main
          ? { backgroundColor: colors.accent, opacity: disabled ? 0.4 : pressed || busy ? 0.85 : 1 }
          : second
            ? { borderWidth: 2, borderColor: colors.accent, backgroundColor: pressed ? colors.line : colors.card }
            : { borderWidth: 1, borderColor: colors.line, backgroundColor: pressed ? colors.line : colors.card },
      ]}>
      {busy ? (
        <ActivityIndicator color={main ? colors.onAccent : colors.text} />
      ) : (
        <Text style={[styles.bigText, { color: main ? colors.onAccent : second ? colors.accent : colors.muted }]}>{title}</Text>
      )}
    </Pressable>
  );
}

export function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  const colors = useColors();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      style={[
        styles.chip,
        { borderColor: active ? colors.text : colors.line, backgroundColor: active ? colors.text : colors.card },
      ]}>
      <Text style={[styles.chipText, { color: active ? colors.bg : colors.text }]}>{label}</Text>
    </Pressable>
  );
}

/** A tappable card on the review screen. */
export function ReviewCard({ children, onPress }: { children: ReactNode; onPress: () => void }) {
  const colors = useColors();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [styles.card, { backgroundColor: pressed ? colors.line : colors.card }]}>
      <View style={{ flex: 1, gap: 4 }}>{children}</View>
      <Text style={[styles.edit, { color: colors.faint }]}>✏️</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  field: { gap: 6 },
  label: { fontSize: 13, fontWeight: '600' },
  input: { minHeight: 50, borderRadius: radius.md, borderWidth: 1, paddingHorizontal: 14, fontSize: 17 },
  big: { height: 54, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  bigText: { fontSize: 17, fontWeight: '800' },
  chip: { paddingHorizontal: 14, height: 38, borderRadius: radius.pill, borderWidth: 1, justifyContent: 'center' },
  chipText: { fontSize: 15, fontWeight: '600' },
  card: { flexDirection: 'row', borderRadius: radius.md, padding: 14, gap: 8 },
  edit: { fontSize: 15 },
});
