import Constants from 'expo-constants';
import { Platform } from 'react-native';

/** The local game server's port (`npm run server`). */
const DEV_PORT = 8787;

/**
 * Where the online game server lives.
 *
 * - Release builds: set EXPO_PUBLIC_SERVER_URL (e.g. wss://asta-chemma-server.example.workers.dev).
 * - Development: the computer running the dev servers. On a phone that's the
 *   same machine Expo serves the app from, so its address is taken from Expo.
 */
export function serverUrl(): string {
  const configured = process.env.EXPO_PUBLIC_SERVER_URL;
  if (configured) return configured.replace(/\/+$/, '');
  if (Platform.OS === 'web' && typeof window !== 'undefined') return `ws://${window.location.hostname}:${DEV_PORT}`;
  const host = Constants.expoConfig?.hostUri?.split(':')[0];
  return `ws://${host ?? 'localhost'}:${DEV_PORT}`;
}
