// The iPhone's contacts, for step 1 "Customer". Permission is asked only the first time the user searches
// (App Store rule: ask when needed, with a reason). If refused, only clients and "New client" are shown.
import { Contact, ContactField, getPermissionsAsync, requestPermissionsAsync } from 'expo-contacts';

export type PhoneContact = { id: string; name: string; phone: string; email: string; address: string };

let cache: PhoneContact[] | null = null;

/** Without asking: 'all' (every contact) | 'limited' (only some, iOS 18+) | 'denied' | 'undetermined'. */
export type ContactsAccess = 'all' | 'limited' | 'denied' | 'undetermined';

export async function contactsAccess(): Promise<ContactsAccess> {
  try {
    const p = await getPermissionsAsync();
    if (p.status === 'undetermined') return 'undetermined';
    if (p.status !== 'granted') return 'denied';
    return p.accessPrivileges === 'limited' ? 'limited' : 'all';
  } catch {
    return 'denied';
  }
}

/** The iPhone's own contact list: tap a person → their details. 'cancelled' if closed; 'unreadable' when iOS
 *  doesn't let the app read that person (the user shared only some contacts) — then Settings → Full Access fixes it. */
export async function pickPhoneContact(): Promise<PhoneContact | 'cancelled' | 'unreadable'> {
  let picked: Contact | null;
  try {
    picked = await Contact.presentPicker();
  } catch {
    return 'unreadable';
  }
  if (!picked) return 'cancelled';
  try {
    const c = await picked.getDetails([ContactField.FULL_NAME, ContactField.PHONES, ContactField.EMAILS, ContactField.ADDRESSES]);
    const name = (c.fullName ?? '').trim();
    if (!name) return 'unreadable';
    const a = c.addresses?.[0];
    return {
      id: picked.id,
      name,
      phone: c.phones?.[0]?.number ?? '',
      email: c.emails?.[0]?.address ?? '',
      address: a ? [a.street, a.city, [a.state ?? a.region, a.postcode].filter(Boolean).join(' ')].filter(Boolean).join(', ') : '',
    };
  } catch {
    return 'unreadable';
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
