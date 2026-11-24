import * as Sentry from '@sentry/react-native';
import Constants from 'expo-constants';
import { isRunningInExpoGo } from 'expo';

/**
 * Crash and error reports (Sentry).
 *
 * Off unless EXPO_PUBLIC_SENTRY_DSN is set (eas.json sets it for store and
 * preview builds). Reports carry the error, the app version and the device
 * model/OS only: no names, emails, IP addresses, screen recordings or logs.
 */
const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN?.trim();

export const crashReportingEnabled = !!dsn && !__DEV__;

if (crashReportingEnabled) {
  Sentry.init({
    dsn,
    release: `asta-chemma@${Constants.expoConfig?.version ?? 'unknown'}`,
    environment: process.env.EXPO_PUBLIC_APP_ENV ?? 'production',
    sendDefaultPii: false,
    // A small sample of screen-load timings; errors are always sent.
    tracesSampleRate: 0.05,
    enableNativeFramesTracking: !isRunningInExpoGo(),
    integrations: [Sentry.expoRouterIntegration({ enableTimeToInitialDisplay: !isRunningInExpoGo() })],
    beforeSend(event) {
      // Belt and braces: never send who the player is.
      delete event.user;
      if (event.request) delete event.request.cookies;
      return event;
    },
    beforeBreadcrumb(crumb) {
      // Console output may contain names typed by players.
      return crumb.category === 'console' ? null : crumb;
    },
  });
}

/** Report a problem the app handled itself (it carries on), with a few non-personal details. */
export function reportProblem(message: string, details: Record<string, string>): void {
  if (!crashReportingEnabled) return;
  Sentry.captureMessage(message, { level: 'warning', extra: details });
}

/** A harmless test report, to check reports arrive (Profile → tap the version 7 times). */
export function sendTestReport(): boolean {
  if (!crashReportingEnabled) return false;
  Sentry.captureMessage('Test report from the Profile screen', 'info');
  return true;
}

/** Wraps the root layout so render errors are reported (a no-op when off). */
export const withCrashReporting = (component: () => React.JSX.Element): React.ComponentType =>
  crashReportingEnabled ? Sentry.wrap(component) : component;
