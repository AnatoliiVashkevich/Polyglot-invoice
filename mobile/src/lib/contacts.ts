// The iPhone's contacts, for step 1 "Customer". Permission is asked only the first time the user searches
// (App Store rule: ask when needed, with a reason). If refused, only clients and "New client" are shown.
import { Contact, ContactField, getPermissionsAsync, requestPermissionsAsync } from 'expo-contacts';

export type PhoneContact = { id: string; name: string; phone: string; email: string; address: string };

let cache: PhoneContact[] | null = null;

/** 'granted' | 'denied' | 'undetermined' without asking. */
export async function contactsPermission(): Promise<string> {
  try {
    return (await getPermissionsAsync()).status;
  } catch {
    return 'denied';
  }
}

/** Asks (once) and loads the contacts. [] when refused. */
export async function loadContacts(): Promise<PhoneContact[]> {
  if (cache) return cache;
  try {
    let { status } = await getPermissionsAsync();
    if (status === 'undetermined') status = (await requestPermissionsAsync()).status;
    if (status !== 'granted') return [];
    const rows = await Contact.getAllDetails([
      ContactField.FULL_NAME,
      ContactField.PHONES,
      ContactField.EMAILS,
      ContactField.ADDRESSES,
    ]);
    cache = rows
      .map((c) => {
        const a = c.addresses?.[0];
        return {
          id: c.id,
          name: (c.fullName ?? '').trim(),
          phone: c.phones?.[0]?.number ?? '',
          email: c.emails?.[0]?.address ?? '',
          address: a ? [a.street, a.city, [a.state ?? a.region, a.postcode].filter(Boolean).join(' ')].filter(Boolean).join(', ') : '',
        };
      })
      .filter((c) => c.name);
    return cache;
  } catch {
    return [];
  }
}
