// Talking to our server (server/main.py). Every request carries the signed-in user's token; an expired token is
// refreshed once, automatically.
// The address: EXPO_PUBLIC_API_URL (mobile/.env.local) if set; otherwise, while testing, the same PC that runs
// Expo, port 8000 (the server runs next to Expo on the owner's PC).
import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';

function serverAddress(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL;
  if (fromEnv) return fromEnv.replace(/\/$/, '');
  const host = Constants.expoConfig?.hostUri?.split(':')[0]; // e.g. "10.0.0.79" from "10.0.0.79:8081"
  return __DEV__ && host ? `http://${host}:8000` : '';
}

export const API_URL = serverAddress();

export type Session = { access_token: string; refresh_token: string; expires_at?: number };

const KEY = 'session';
let session: Session | null = null;
let onSignedOut: (() => void) | null = null;

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public detail?: Record<string, unknown>, // e.g. a used invoice number: { message, next }
  ) {
    super(message);
  }
}

export async function loadSession(): Promise<Session | null> {
  try {
    const raw = await SecureStore.getItemAsync(KEY);
    session = raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    session = null;
  }
  return session;
}

export async function saveSession(s: Session | null) {
  session = s;
  if (s) await SecureStore.setItemAsync(KEY, JSON.stringify(s));
  else await SecureStore.deleteItemAsync(KEY);
}

/** The current access token (for downloads that can't go through api(), like the PDF file). */
export const accessToken = () => session?.access_token ?? '';

/** The auth provider listens here, so an expired session sends the user back to the sign-in screen. */
export function setSignedOutHandler(fn: (() => void) | null) {
  onSignedOut = fn;
}

async function send(path: string, init: RequestInit, token?: string) {
  if (!API_URL) throw new ApiError('The server address is missing (EXPO_PUBLIC_API_URL).', 0);
  try {
    return await fetch(`${API_URL}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...init.headers,
      },
    });
  } catch {
    throw new ApiError('No connection to the server. Check the internet and try again.', 0);
  }
}

async function errorFrom(res: Response): Promise<ApiError> {
  let message = `Something went wrong (${res.status}).`;
  let detail: Record<string, unknown> | undefined;
  try {
    const body = await res.json();
    if (typeof body.detail === 'string') message = body.detail;
    else if (Array.isArray(body.detail)) message = 'Please check the fields and try again.';
    else if (body.detail && typeof body.detail === 'object') {
      detail = body.detail;
      if (typeof body.detail.message === 'string') message = body.detail.message;
    }
  } catch {}
  return new ApiError(message, res.status, detail);
}

async function refresh(): Promise<boolean> {
  if (!session?.refresh_token) return false;
  const res = await send('/api/auth/refresh', { method: 'POST', body: JSON.stringify({ refresh_token: session.refresh_token }) });
  if (!res.ok) return false;
  await saveSession((await res.json()) as Session);
  return true;
}

/** A request without sign-in (sign up / sign in). */
export async function publicRequest<T>(path: string, body: unknown): Promise<T> {
  const res = await send(path, { method: 'POST', body: JSON.stringify(body) });
  if (!res.ok) throw await errorFrom(res);
  return (await res.json()) as T;
}

/** A signed-in request. */
export async function api<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const options: RequestInit = { method: init.method ?? 'GET', body: init.body === undefined ? undefined : JSON.stringify(init.body) };
  let res = await send(path, options, session?.access_token);
  if (res.status === 401 && (await refresh())) res = await send(path, options, session?.access_token);
  if (res.status === 401) {
    await saveSession(null);
    onSignedOut?.();
  }
  if (!res.ok) throw await errorFrom(res);
  return (res.status === 204 ? undefined : await res.json()) as T;
}
