import type { AccountErrorCode, Profile } from '@asta/protocol';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { apiBaseUrl } from '../online/config';

/**
 * The player's account. Every install gets a guest account automatically (no
 * sign-up screen); later, signing in with Google/Apple keeps it across phones.
 *
 * The session token is a secret, so on phones it lives in the secure keystore
 * (Android Keystore / iOS Keychain), not in ordinary app storage. The profile
 * is cached so stats still show while offline.
 */

const TOKEN_KEY = 'asta-chemma.session';

/** The name the server gives a guest who hasn't chosen one. */
export const DEFAULT_GUEST_NAME = 'Player';

const tokenStorage = {
  async get(): Promise<string | null> {
    if (Platform.OS === 'web') return AsyncStorage.getItem(TOKEN_KEY);
    return SecureStore.getItemAsync(TOKEN_KEY);
  },
  async set(token: string): Promise<void> {
    if (Platform.OS === 'web') return AsyncStorage.setItem(TOKEN_KEY, token);
    return SecureStore.setItemAsync(TOKEN_KEY, token);
  },
};

class ApiError extends Error {
  constructor(readonly code: AccountErrorCode | 'network') {
    super(code);
  }
}

async function call<T>(method: string, path: string, opts: { token?: string; body?: unknown } = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${apiBaseUrl()}${path}`, {
      method,
      headers: {
        ...(opts.token ? { authorization: `Bearer ${opts.token}` } : {}),
        ...(opts.body !== undefined ? { 'content-type': 'application/json' } : {}),
      },
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    });
  } catch {
    throw new ApiError('network');
  }
  const data = (await res.json().catch(() => ({}))) as { error?: AccountErrorCode };
  if (!res.ok) throw new ApiError(data.error ?? 'unavailable');
  return data as T;
}

export type AccountStatus = 'idle' | 'loading' | 'ready' | 'offline';

interface AccountStore {
  /** Kept in memory once loaded (the saved copy is in secure storage). */
  token: string | null;
  /** Last known profile (saved, so stats show offline). */
  profile: Profile | null;
  status: AccountStatus;
  /** Make sure this device has an account and refresh the profile. Safe to call often. */
  ensure(defaultName?: string): Promise<void>;
  /** Change the display name. Returns false if it couldn't be saved. */
  rename(name: string): Promise<boolean>;
  /** Collect today's daily bonus. Returns the coins paid (0 if already collected), or null if offline. */
  claimDaily(): Promise<number | null>;
}

let ensuring: Promise<void> | null = null;

export const useAccountStore = create<AccountStore>()(
  persist(
    (set, get) => ({
      token: null,
      profile: null,
      status: 'idle',

      ensure(defaultName) {
        // One at a time: the app may ask from several places at start-up.
        ensuring ??= (async () => {
          set({ status: get().profile ? get().status : 'loading' });
          try {
            const token = get().token ?? (await tokenStorage.get());
            if (token) {
              try {
                const { profile } = await call<{ profile: Profile }>('GET', '/v1/me', { token });
                set({ token, profile, status: 'ready' });
                return;
              } catch (error) {
                // Unknown token (e.g. the account was removed): start a fresh guest below.
                if (!(error instanceof ApiError) || error.code !== 'unauthorized') throw error;
              }
            }
            const name = defaultName?.trim() || get().profile?.name || undefined;
            const created = await call<{ token: string; profile: Profile }>('POST', '/v1/auth/guest', {
              body: name ? { name } : {},
            });
            await tokenStorage.set(created.token);
            set({ token: created.token, profile: created.profile, status: 'ready' });
          } catch {
            set({ status: 'offline' });
          } finally {
            ensuring = null;
          }
        })();
        return ensuring;
      },

      async rename(name) {
        const { token } = get();
        if (!token) return false;
        try {
          const { profile } = await call<{ profile: Profile }>('PATCH', '/v1/me', { token, body: { name } });
          set({ profile, status: 'ready' });
          return true;
        } catch {
          return false;
        }
      },

      async claimDaily() {
        const { token } = get();
        if (!token) return null;
        try {
          const result = await call<{ claimed: boolean; coins: number; profile: Profile }>('POST', '/v1/me/daily', { token });
          set({ profile: result.profile, status: 'ready' });
          return result.coins;
        } catch {
          return null;
        }
      },
    }),
    {
      name: 'asta-chemma/account',
      version: 1,
      storage: createJSONStorage(() => AsyncStorage),
      // Never the token: that lives in secure storage.
      partialize: (s) => ({ profile: s.profile }),
    },
  ),
);
