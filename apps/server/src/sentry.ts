import * as Sentry from '@sentry/cloudflare';
import type { CloudflareOptions } from '@sentry/cloudflare';

/**
 * Error reports from the game server (Sentry).
 *
 * Off unless SENTRY_DSN is set (wrangler.jsonc). Reports carry the error, where
 * it happened and the request's path – never who the player is: no user info,
 * IP addresses, headers (so no sign-in tokens), cookies, query strings, bodies
 * or console output (which may contain player names).
 */
export interface SentryEnv {
  SENTRY_DSN?: string;
  SENTRY_ENVIRONMENT?: string;
}

export const sentryOptions = (env: SentryEnv): CloudflareOptions => ({
  dsn: env.SENTRY_DSN || undefined,
  environment: env.SENTRY_ENVIRONMENT || 'production',
  // Errors only: no performance tracing.
  tracesSampleRate: 0,
  dataCollection: { userInfo: false, cookies: false, httpHeaders: false, urlQueryParams: false, httpBodies: [] },
  beforeSend(event) {
    // Belt and braces: never send who the player is.
    delete event.user;
    if (event.request) {
      delete event.request.headers;
      delete event.request.cookies;
      delete event.request.query_string;
      delete event.request.data;
    }
    return event;
  },
  beforeBreadcrumb(crumb) {
    return crumb.category === 'console' ? null : crumb;
  },
});

/** Report an error we caught and handled ourselves (playing carries on). */
export function reportError(error: unknown): void {
  Sentry.captureException(error);
}

export { Sentry };
