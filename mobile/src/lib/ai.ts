// The AI shortcuts (build step 7). Asks once for consent before any text or voice goes to OpenAI (App Store rule,
// product-decisions.md §2); without consent, or when the AI is not available, the app's own quick reader is used.
import * as SecureStore from 'expo-secure-store';
import { Alert } from 'react-native';

import { t } from '@/i18n';
import { api } from '@/lib/api';
import type { Line } from '@/lib/invoice-math';
import { quickLines } from '@/lib/quick-lines';

const CONSENT_KEY = 'ai-consent-v1';

async function hasConsent(): Promise<boolean> {
  try {
    return (await SecureStore.getItemAsync(CONSENT_KEY)) === 'yes';
  } catch {
    return false;
  }
}

/** Asks once ("Use AI…?"). true = the user agreed now or before. */
export async function askAiConsent(): Promise<boolean> {
  if (await hasConsent()) return true;
  const yes = await new Promise<boolean>((resolve) =>
    Alert.alert(
      t('Use AI to make the lines?'),
      t('Your text is sent to OpenAI, an AI company, only to turn it into invoice lines. OpenAI does not use it to train its AI. You can always type the lines yourself.'),
      [
        { text: t('Not now'), style: 'cancel', onPress: () => resolve(false) },
        { text: t('Yes, use AI'), onPress: () => resolve(true) },
      ],
    ),
  );
  if (yes) await SecureStore.setItemAsync(CONSENT_KEY, 'yes').catch(() => {});
  return yes;
}

/** Words → lines. by: 'ai' (the AI read it) or 'quick' (no consent / no AI: the app's own reader). */
export async function describeToLines(text: string): Promise<{ lines: Line[]; by: 'ai' | 'quick' }> {
  if (await askAiConsent()) {
    try {
      const r = await api<{ lines: Line[] }>('/api/ai/lines', { method: 'POST', body: { text } });
      if (r.lines.length) return { lines: r.lines, by: 'ai' };
    } catch {
      // the AI is not available: fall back to the quick reader below
    }
  }
  return { lines: quickLines(text), by: 'quick' };
}
