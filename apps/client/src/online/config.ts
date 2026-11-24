import Constants from 'expo-constants';
import { Platform } from 'react-native';

/** The live game server on Cloudflare (`npm run deploy:server`). */
export const LIVE_SERVER_URL = 'wss://asta-chemma-server.asta-server.workers.dev';

/** The local game server's port (`npm run server`). */
const DEV_PORT = 8787;

/**
 * Where the online game server lives.
 *
 * Every build uses the live server, so phones can play from any network.
 * EXPO_PUBLIC_SERVER_URL overrides it (in apps/client/.env.local):
 *   - `local`: the dev server on the computer running Expo (`npm run server`),
 *     for working on the server itself;
 *   - any ws:// or wss:// address, e.g. a staging server.
 */
export function serverUrl(): string {
  const configured = process.env.EXPO_PUBLIC_SERVER_URL?.trim();
  if (!configured) return LIVE_SERVER_URL;
  if (configured !== 'local') return configured.replace(/\/+$/, '');
  if (Platform.OS === 'web' && typeof window !== 'undefined') return `ws://${window.location.hostname}:${DEV_PORT}`;
  // On a phone, the computer running Expo is the one serving the app.
  const host = Constants.expoConfig?.hostUri?.split(':')[0];
  return `ws://${host ?? 'localhost'}:${DEV_PORT}`;
}

/** The same server's HTTP address, for the account API. */
export function apiBaseUrl(): string {
  return serverUrl().replace(/^ws(s?):/, 'http$1:');
}

/** The privacy policy (always the live one, whichever server the app plays on). */
export const PRIVACY_URL = `${LIVE_SERVER_URL.replace(/^wss:/, 'https:')}/privacy`;

/**
 * A room invite to share (e.g. on WhatsApp): opens the app straight into the
 * room, or the store if the app isn't installed. Always the live server, so it
 * works on friends' phones.
 */
export function inviteLink(code: string): string {
  return `${LIVE_SERVER_URL.replace(/^wss:/, 'https:')}/join/${code}`;
}
