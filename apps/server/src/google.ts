/**
 * Checking a Google sign-in. The app signs in with Google on the phone and
 * sends us the ID token Google gave it: a JWT signed by Google. We trust it
 * only if the signature checks out against Google's published keys, it was
 * issued by Google, for our app (audience = our Web client ID), and it hasn't
 * expired. Nothing from the token is used before that.
 */

export const GOOGLE_JWKS_URL = 'https://www.googleapis.com/oauth2/v3/certs';
const ISSUERS = new Set(['accounts.google.com', 'https://accounts.google.com']);
/** Allowance for clocks that are slightly off. */
const CLOCK_SKEW_S = 60;

export interface GoogleIdentity {
  /** Google's permanent id for the person. */
  sub: string;
  email: string | null;
  /** First name, if Google shares it (used as the starting display name). */
  givenName: string | null;
}

interface Jwk {
  kid: string;
  kty: string;
  n: string;
  e: string;
  alg?: string;
}

let keyCache: { url: string; keys: Map<string, CryptoKey>; expires: number } | null = null;

async function loadKeys(url: string, now: number, force = false): Promise<Map<string, CryptoKey>> {
  if (!force && keyCache && keyCache.url === url && keyCache.expires > now) return keyCache.keys;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`could not fetch Google's keys (${res.status})`);
  const { keys } = (await res.json()) as { keys: Jwk[] };
  const map = new Map<string, CryptoKey>();
  for (const jwk of keys) {
    if (jwk.kty !== 'RSA') continue;
    const key = await crypto.subtle.importKey(
      'jwk',
      { kty: 'RSA', n: jwk.n, e: jwk.e, alg: 'RS256', ext: true },
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['verify'],
    );
    map.set(jwk.kid, key);
  }
  // Google rotates keys and says for how long they may be cached.
  const maxAge = Number(/max-age=(\d+)/.exec(res.headers.get('cache-control') ?? '')?.[1] ?? 3600);
  keyCache = { url, keys: map, expires: now + Math.min(maxAge, 24 * 3600) * 1000 };
  return map;
}

function decodePart(part: string): Uint8Array {
  const b64 = part.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

function decodeJson(part: string): Record<string, unknown> | null {
  try {
    const value: unknown = JSON.parse(new TextDecoder().decode(decodePart(part)));
    return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/** The person a Google ID token vouches for, or null if it doesn't check out. */
export async function verifyGoogleIdToken(
  token: string,
  opts: { clientIds: string[]; jwksUrl?: string; now?: number },
): Promise<GoogleIdentity | null> {
  const now = opts.now ?? Date.now();
  const jwksUrl = opts.jwksUrl ?? GOOGLE_JWKS_URL;
  const parts = token.split('.');
  if (parts.length !== 3 || token.length > 4096) return null;
  const [h, p, s] = parts as [string, string, string];
  const header = decodeJson(h);
  const claims = decodeJson(p);
  if (!header || !claims || header.alg !== 'RS256' || typeof header.kid !== 'string') return null;

  let keys = await loadKeys(jwksUrl, now);
  if (!keys.has(header.kid)) keys = await loadKeys(jwksUrl, now, true); // keys were rotated
  const key = keys.get(header.kid);
  if (!key) return null;
  let signature: Uint8Array;
  try {
    signature = decodePart(s);
  } catch {
    return null;
  }
  const valid = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, signature, new TextEncoder().encode(`${h}.${p}`));
  if (!valid) return null;

  const nowS = now / 1000;
  if (!ISSUERS.has(String(claims.iss))) return null;
  if (typeof claims.aud !== 'string' || !opts.clientIds.includes(claims.aud)) return null;
  if (typeof claims.exp !== 'number' || claims.exp + CLOCK_SKEW_S < nowS) return null;
  if (typeof claims.iat === 'number' && claims.iat - CLOCK_SKEW_S > nowS) return null;
  if (typeof claims.sub !== 'string' || !claims.sub) return null;
  // Only verified addresses are kept.
  const email = typeof claims.email === 'string' && claims.email_verified === true ? claims.email : null;
  const givenName = typeof claims.given_name === 'string' ? claims.given_name : null;
  return { sub: claims.sub, email, givenName };
}
