// Sign in / create an account with email and password. (Sign in with Apple is added in build step 10.)
import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { t } from '@/i18n';
import { useAuth } from '@/lib/auth';
import { radius, useColors } from '@/theme';

export default function SignInScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<'in' | 'up'>('in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    if (busy) return;
    setError('');
    if (!email.trim() || !password) {
      setError(t('Please enter your email and password.'));
      return;
    }
    setBusy(true);
    try {
      await (mode === 'in' ? signIn : signUp)(email.trim(), password);
    } catch (e) {
      setError(t(e instanceof Error ? e.message : 'Something went wrong.'));
    } finally {
      setBusy(false);
    }
  };

  const input = [styles.input, { backgroundColor: colors.card, borderColor: colors.line, color: colors.text }];

  return (
    <KeyboardAvoidingView behavior="padding" style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 48, paddingBottom: insets.bottom + 24 }]}>
        <Text style={[styles.brand, { color: colors.accent }]}>Polyglot Invoice</Text>
        <Text style={[styles.title, { color: colors.text }]}>{mode === 'in' ? t('Sign in') : t('Create your account')}</Text>
        <Text style={[styles.lead, { color: colors.muted }]}>
          {mode === 'in' ? t('Welcome back.') : t('Invoices in your client’s language, in a minute.')}
        </Text>

        <View style={styles.form}>
          <TextInput
            style={input}
            value={email}
            onChangeText={setEmail}
            placeholder={t('Email')}
            placeholderTextColor={colors.faint}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            textContentType="emailAddress"
            returnKeyType="next"
          />
          <TextInput
            style={input}
            value={password}
            onChangeText={setPassword}
            placeholder={mode === 'up' ? t('Password (at least 8 characters)') : t('Password')}
            placeholderTextColor={colors.faint}
            secureTextEntry
            autoComplete={mode === 'up' ? 'new-password' : 'current-password'}
            textContentType={mode === 'up' ? 'newPassword' : 'password'}
            returnKeyType="go"
            onSubmitEditing={submit}
          />
          {!!error && <Text style={[styles.error, { color: '#E5484D' }]}>{error}</Text>}

          <Pressable
            onPress={submit}
            disabled={busy}
            accessibilityRole="button"
            style={({ pressed }) => [styles.button, { backgroundColor: colors.accent, opacity: pressed || busy ? 0.8 : 1 }]}>
            {busy ? (
              <ActivityIndicator color={colors.onAccent} />
            ) : (
              <Text style={[styles.buttonText, { color: colors.onAccent }]}>
                {mode === 'in' ? t('Sign in') : t('Create account')}
              </Text>
            )}
          </Pressable>

          <Pressable
            onPress={() => {
              setMode(mode === 'in' ? 'up' : 'in');
              setError('');
            }}
            accessibilityRole="button"
            style={styles.switch}>
            <Text style={[styles.switchText, { color: colors.accent }]}>
              {mode === 'in' ? t('New here? Create an account') : t('Already have an account? Sign in')}
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 24, flexGrow: 1 },
  brand: { fontSize: 15, fontWeight: '800', letterSpacing: 0.3 },
  title: { fontSize: 32, fontWeight: '800', letterSpacing: -0.5, marginTop: 6 },
  lead: { fontSize: 16, marginTop: 6 },
  form: { marginTop: 32, gap: 12 },
  input: { height: 52, borderRadius: radius.md, borderWidth: 1, paddingHorizontal: 14, fontSize: 17 },
  error: { fontSize: 14, fontWeight: '600' },
  button: { height: 54, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  buttonText: { fontSize: 17, fontWeight: '800' },
  switch: { alignItems: 'center', paddingVertical: 12 },
  switchText: { fontSize: 15, fontWeight: '600' },
});
