import { Platform, TurboModuleRegistry } from 'react-native';
import { reportProblem } from '../crash';

/**
 * Google sign-in on the phone. Google gives the app an ID token, which the
 * server checks (it must be issued for our Web client) before linking the
 * account. Client ids are not secret.
 */

/** The Web client: Google issues ID tokens for it, and the server accepts only these. */
export const GOOGLE_WEB_CLIENT_ID = '743187252908-gfthj90i9kealbdok71ub1bluqruiohe.apps.googleusercontent.com';

/**
 * Whether Google sign-in can work here: the Android app (the native module is
 * missing in Expo Go and on the web; iPhone needs its own client id first).
 */
export function googleSignInAvailable(): boolean {
  return Platform.OS === 'android' && TurboModuleRegistry.get('RNGoogleSignin') != null;
}

type GoogleModule = typeof import('@react-native-google-signin/google-signin');
let google: GoogleModule | null = null;
let configured = false;

function load(): GoogleModule {
  // Loaded only when used, so the app still starts where the native module is missing.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  google ??= require('@react-native-google-signin/google-signin') as GoogleModule;
  if (!configured) {
    google.GoogleSignin.configure({ webClientId: GOOGLE_WEB_CLIENT_ID });
    configured = true;
  }
  return google;
}

export type GoogleResult = { type: 'success'; idToken: string } | { type: 'cancelled' } | { type: 'failed' };

/** Show Google's account picker and return the ID token. */
export async function googleIdToken(): Promise<GoogleResult> {
  try {
    const { GoogleSignin, isSuccessResponse } = load();
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    const response = await GoogleSignin.signIn();
    if (!isSuccessResponse(response)) return { type: 'cancelled' };
    const idToken = response.data.idToken;
    return idToken ? { type: 'success', idToken } : { type: 'failed' };
  } catch (error) {
    const { isErrorWithCode, statusCodes } = load();
    if (isErrorWithCode(error) && (error.code === statusCodes.SIGN_IN_CANCELLED || error.code === statusCodes.IN_PROGRESS)) {
      return { type: 'cancelled' };
    }
    console.warn('Google sign-in failed', error);
    // Report only Google's error code and message (e.g. DEVELOPER_ERROR = the app's
    // signing key isn't registered), never the account.
    const code = isErrorWithCode(error) ? String(error.code) : 'unknown';
    reportProblem(`Google sign-in failed (${code})`, { code, message: error instanceof Error ? error.message : String(error) });
    return { type: 'failed' };
  }
}

/** Forget the Google account on this phone, so the picker shows next time. */
export async function googleSignOut(): Promise<void> {
  if (!googleSignInAvailable()) return;
  try {
    await load().GoogleSignin.signOut();
  } catch {
    // nothing to sign out of
  }
}
