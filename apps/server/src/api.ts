import { cleanName, MAX_TOKEN_LENGTH, type AccountErrorCode, type Profile } from '@asta/protocol';
import { claimDaily, createGuest, endSession, indiaDate, profileForToken, renameUser, signInWithGoogle } from './db/accounts';
import { verifyGoogleIdToken } from './google';
import { withDb, type Db } from './db/db';

/**
 * The account API (JSON over HTTPS):
 *
 *   POST  /v1/auth/guest   { name? }          → 201 { token, profile }
 *   GET   /v1/me           Bearer token       → { profile }
 *   PATCH /v1/me           Bearer, { name }   → { profile }
 *   POST  /v1/me/daily     Bearer             → { claimed, coins, profile }
 *   POST  /v1/auth/google  { idToken }, Bearer (optional) → { token, profile, outcome }
 *   POST  /v1/auth/signout Bearer             → { ok: true }
 */

export interface ApiEnv {
  /** Cloudflare Hyperdrive in front of Postgres (absent: accounts unavailable). */
  HYPERDRIVE?: Hyperdrive;
  /** Limits how fast one address can create guest accounts. */
  GUEST_LIMITER?: RateLimit;
  /** Google OAuth client ids whose sign-ins we accept (comma-separated; the Web client id). */
  GOOGLE_CLIENT_IDS?: string;
  /** Where Google's signing keys are (tests point this at their own keys). */
  GOOGLE_JWKS_URL?: string;
}

const MAX_BODY_BYTES = 4096;
const DEFAULT_GUEST_NAME = 'Player';

const CORS: Record<string, string> = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization, content-type',
  'access-control-allow-methods': 'GET, POST, PATCH, OPTIONS',
  'access-control-max-age': '86400',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...CORS } });
}
const fail = (error: AccountErrorCode, status: number) => json({ error }, status);

async function readJson(request: Request): Promise<Record<string, unknown> | null> {
  const text = await request.text();
  if (text.length > MAX_BODY_BYTES) return null;
  if (!text) return {};
  try {
    const value: unknown = JSON.parse(text);
    return typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function bearer(request: Request): string | null {
  const header = request.headers.get('authorization') ?? '';
  const match = /^Bearer\s+(\S+)$/i.exec(header);
  const token = match?.[1] ?? null;
  return token && token.length <= MAX_TOKEN_LENGTH ? token : null;
}

/** Handle /v1/… requests; null for any other path. */
export async function handleApi(request: Request, env: ApiEnv, url: URL): Promise<Response | null> {
  if (!url.pathname.startsWith('/v1/')) return null;
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  const hyperdrive = env.HYPERDRIVE;
  if (!hyperdrive) return fail('unavailable', 503);
  const db = <T>(fn: (d: Db) => Promise<T>) => withDb(hyperdrive.connectionString, fn);
  const today = indiaDate(Date.now());

  try {
    if (url.pathname === '/v1/auth/guest' && request.method === 'POST') {
      if (env.GUEST_LIMITER) {
        const ip = request.headers.get('cf-connecting-ip') ?? 'unknown';
        const { success } = await env.GUEST_LIMITER.limit({ key: ip });
        if (!success) return fail('too-many', 429);
      }
      const body = await readJson(request);
      if (!body) return fail('bad-request', 400);
      const name = body.name === undefined ? DEFAULT_GUEST_NAME : cleanName(body.name);
      if (!name) return fail('bad-request', 400);
      const { token, profile } = await db((d) => createGuest(d, name, today));
      return json({ token, profile }, 201);
    }

    if (url.pathname === '/v1/auth/google' && request.method === 'POST') {
      const clientIds = (env.GOOGLE_CLIENT_IDS ?? '').split(',').map((s) => s.trim()).filter(Boolean);
      if (clientIds.length === 0) return fail('unavailable', 503);
      if (env.GUEST_LIMITER) {
        const ip = request.headers.get('cf-connecting-ip') ?? 'unknown';
        if (!(await env.GUEST_LIMITER.limit({ key: `google:${ip}` })).success) return fail('too-many', 429);
      }
      const body = await readJson(request);
      if (!body || typeof body.idToken !== 'string') return fail('bad-request', 400);
      const google = await verifyGoogleIdToken(body.idToken, { clientIds, jwksUrl: env.GOOGLE_JWKS_URL || undefined });
      if (!google) return fail('unauthorized', 401);
      const result = await db((d) => signInWithGoogle(d, google, bearer(request), DEFAULT_GUEST_NAME, today));
      return json(result);
    }

    if (url.pathname === '/v1/auth/signout' && request.method === 'POST') {
      const token = bearer(request);
      if (!token) return fail('unauthorized', 401);
      await db((d) => endSession(d, token));
      return json({ ok: true });
    }

    if (url.pathname === '/v1/me/daily' && request.method === 'POST') {
      const token = bearer(request);
      if (!token) return fail('unauthorized', 401);
      const result = await db(async (d) => {
        const me = await profileForToken(d, token, today);
        return me ? claimDaily(d, me.id, today) : null;
      });
      return result ? json(result) : fail('unauthorized', 401);
    }

    if (url.pathname === '/v1/me' && (request.method === 'GET' || request.method === 'PATCH')) {
      const token = bearer(request);
      if (!token) return fail('unauthorized', 401);
      const body = request.method === 'PATCH' ? await readJson(request) : null;
      if (request.method === 'PATCH' && !body) return fail('bad-request', 400);
      const name = body ? cleanName(body.name) : null;
      if (body && !name) return fail('bad-request', 400);

      const profile = await db(async (d): Promise<Profile | null> => {
        const me = await profileForToken(d, token, today);
        if (!me) return null;
        return name && name !== me.name ? renameUser(d, me.id, name, today) : me;
      });
      return profile ? json({ profile }) : fail('unauthorized', 401);
    }

    return json({ error: 'not found' }, 404);
  } catch (error) {
    console.error('api error', error);
    return fail('unavailable', 503);
  }
}

/** The account id for a session token, or null (unknown token, or accounts unavailable). */
export async function userIdForToken(env: ApiEnv, token: string | undefined): Promise<string | null> {
  if (!token || !env.HYPERDRIVE) return null;
  try {
    const profile = await withDb(env.HYPERDRIVE.connectionString, (d) => profileForToken(d, token, indiaDate(Date.now())));
    return profile?.id ?? null;
  } catch (error) {
    // Playing matters more than stats: carry on without the account.
    console.error('account lookup failed', error);
    return null;
  }
}
