// Repeating tasks and notes: "Only this one" or "This and all next ones", like the iPhone Calendar (§6g).
import { Alert } from 'react-native';

import { t } from '@/i18n';
import type { Scope } from '@/lib/items';

/** Asks which visits a change or a delete is for. null = cancelled. */
export function askScope(title: string, destructive = false): Promise<Scope | null> {
  return new Promise((resolve) =>
    Alert.alert(title, t('This repeats.'), [
      { text: t('Only this one'), onPress: () => resolve('one'), style: destructive ? 'destructive' : 'default' },
      { text: t('This and all next ones'), onPress: () => resolve('following'), style: destructive ? 'destructive' : 'default' },
      { text: t('Cancel'), style: 'cancel', onPress: () => resolve(null) },
    ]),
  );
}
