import type { GameMode, Seat } from '@asta/engine';
import { COINS, dailyBonus, gameReward, type DailyStatus, type Profile, type SignInOutcome } from '@asta/protocol';
import type { Db } from './db';

/**
 * Accounts: guests (and later Google/Apple sign-ins), their sessions, coins,
 * and the results of finished online games.
 *
 * Session tokens are 256 random bits handed to the app once; only their
 * SHA-256 hash is stored, so a database leak doesn't hand out sign-ins.
 *
 * Coins only ever change through `credit`, which writes the ledger row first:
 * (user, reason, ref) is unique there, so the same reward can't be paid twice.
 */

interface UserRow {
  id: string;
  name: string;
  google_sub: string | null;
  apple_sub: string | null;
  email: string | null;
  coins: string | number; // bigint comes back as a string
  games_played: number;
  games_won: number;
  /** 'YYYY-MM-DD' or null. */
  last_daily: string | null;
  daily_streak: number;
}

const USER_COLUMNS =
  "u.id, u.name, u.google_sub, u.apple_sub, u.email, u.coins, u.games_played, u.games_won, to_char(u.last_daily, 'YYYY-MM-DD') AS last_daily, u.daily_streak";

// ---------------------------------------------------------------------------
// Days (the daily bonus follows India time, where the players are)
// ---------------------------------------------------------------------------

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

/** Today's date in India, as 'YYYY-MM-DD'. */
export function indiaDate(now: number): string {
  return new Date(now + IST_OFFSET_MS).toISOString().slice(0, 10);
}

function dayBefore(date: string): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) - 86_400_000).toISOString().slice(0, 10);
}

function dailyStatus(row: UserRow, today: string): DailyStatus {
  if (row.last_daily === today) {
    return { available: false, streak: row.daily_streak, amount: dailyBonus(row.daily_streak + 1) };
  }
  const streak = row.last_daily === dayBefore(today) ? row.daily_streak + 1 : 1;
  return { available: true, streak: streak - 1, amount: dailyBonus(streak) };
}

function toProfile(row: UserRow, today: string): Profile {
  return {
    id: row.id,
    name: row.name,
    guest: !row.google_sub && !row.apple_sub,
    email: row.email,
    coins: Number(row.coins),
    gamesPlayed: row.games_played,
    gamesWon: row.games_won,
    daily: dailyStatus(row, today),
  };
}

// ---------------------------------------------------------------------------
// Tokens
// ---------------------------------------------------------------------------

function base64url(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function newToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return base64url(bytes);
}

export async function hashToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

// ---------------------------------------------------------------------------
// Coins
// ---------------------------------------------------------------------------

/**
 * Add `delta` coins for (`reason`, `ref`) — at most once ever. Returns whether
 * it was paid now. Must run inside a transaction.
 */
export async function credit(tx: Db, userId: string, delta: number, reason: string, ref: string): Promise<boolean> {
  const [entry] = await tx.query<{ id: string }>(
    `INSERT INTO coin_ledger (user_id, delta, reason, ref) VALUES ($1, $2, $3, $4)
     ON CONFLICT (user_id, reason, ref) DO NOTHING RETURNING id`,
    [userId, delta, reason, ref],
  );
  if (!entry) return false;
  await tx.query('UPDATE users SET coins = coins + $2 WHERE id = $1', [userId, delta]);
  return true;
}

// ---------------------------------------------------------------------------
// Accounts
// ---------------------------------------------------------------------------

async function loadUser(db: Db, userId: string, today: string): Promise<Profile> {
  const [row] = await db.query<UserRow>(`SELECT ${USER_COLUMNS} FROM users u WHERE u.id = $1`, [userId]);
  if (!row) throw new Error('no such user');
  return toProfile(row, today);
}

/** A new guest account (with its welcome coins) and its first session. */
export async function createGuest(db: Db, name: string, today: string): Promise<{ token: string; profile: Profile }> {
  const token = newToken();
  const tokenHash = await hashToken(token);
  return db.tx(async (tx) => {
    const [row] = await tx.query<{ id: string }>('INSERT INTO users (name) VALUES ($1) RETURNING id', [name]);
    await tx.query('INSERT INTO sessions (token_hash, user_id) VALUES ($1, $2)', [tokenHash, row!.id]);
    await credit(tx, row!.id, COINS.welcome, 'welcome', 'welcome');
    return { token, profile: await loadUser(tx, row!.id, today) };
  });
}

async function newSession(tx: Db, userId: string): Promise<string> {
  const token = newToken();
  await tx.query('INSERT INTO sessions (token_hash, user_id) VALUES ($1, $2)', [await hashToken(token), userId]);
  return token;
}

/**
 * Sign in with a verified Google identity. The outcome says how it was matched up:
 *  - 'upgraded': this phone's guest account now belongs to the Google account (nothing lost);
 *  - 'existing': the Google account already had an account (e.g. from another phone), now in use here;
 *  - 'created':  a brand-new account. `currentToken` is this phone's
 * session (usually a guest), so its progress can be kept.
 */
export async function signInWithGoogle(
  db: Db,
  google: { sub: string; email: string | null; givenName: string | null },
  currentToken: string | null,
  defaultName: string,
  today: string,
): Promise<{ token: string; profile: Profile; outcome: SignInOutcome }> {
  const currentHash = currentToken ? await hashToken(currentToken) : null;
  return db.tx(async (tx) => {
    const [existing] = await tx.query<{ id: string }>('SELECT id FROM users WHERE google_sub = $1', [google.sub]);
    const [current] = currentHash
      ? await tx.query<{ id: string; google_sub: string | null; apple_sub: string | null; name: string }>(
          `SELECT u.id, u.google_sub, u.apple_sub, u.name FROM sessions s JOIN users u ON u.id = s.user_id
           WHERE s.token_hash = $1 FOR UPDATE OF u`,
          [currentHash],
        )
      : [];

    if (existing) {
      // Already signed in as this person on this phone: nothing to do.
      if (current?.id === existing.id) {
        return { token: currentToken!, profile: await loadUser(tx, existing.id, today), outcome: 'existing' as const };
      }
      await tx.query('UPDATE users SET email = COALESCE($2, email) WHERE id = $1', [existing.id, google.email]);
      return { token: await newSession(tx, existing.id), profile: await loadUser(tx, existing.id, today), outcome: 'existing' as const };
    }

    if (current && !current.google_sub && !current.apple_sub) {
      // Keep this phone's guest progress: it becomes the Google account. A
      // guest still called by the default name takes their Google first name.
      const name = current.name === defaultName && google.givenName ? google.givenName : current.name;
      await tx.query('UPDATE users SET google_sub = $2, email = $3, name = $4 WHERE id = $1', [
        current.id,
        google.sub,
        google.email,
        name,
      ]);
      return { token: currentToken!, profile: await loadUser(tx, current.id, today), outcome: 'upgraded' as const };
    }

    const [row] = await tx.query<{ id: string }>(
      'INSERT INTO users (name, google_sub, email) VALUES ($1, $2, $3) RETURNING id',
      [google.givenName ?? defaultName, google.sub, google.email],
    );
    await credit(tx, row!.id, COINS.welcome, 'welcome', 'welcome');
    return { token: await newSession(tx, row!.id), profile: await loadUser(tx, row!.id, today), outcome: 'created' as const };
  });
}

/**
 * Delete an account for good: the user, their sessions, coins and coin
 * history, and their Google/Apple link. Finished games stay in other players'
 * history, but with this player's name and account removed.
 */
export async function deleteAccount(db: Db, userId: string): Promise<void> {
  await db.tx(async (tx) => {
    await tx.query(`UPDATE game_players SET name = $2, user_id = NULL WHERE user_id = $1`, [userId, DELETED_PLAYER_NAME]);
    // Sessions and the coin ledger go with the user (ON DELETE CASCADE).
    await tx.query('DELETE FROM users WHERE id = $1', [userId]);
  });
}

/** How a deleted player appears in other players' game history. */
export const DELETED_PLAYER_NAME = 'Player';

/** End a session (sign out on this phone). */
export async function endSession(db: Db, token: string): Promise<void> {
  await db.query('DELETE FROM sessions WHERE token_hash = $1', [await hashToken(token)]);
}

/** The account a session token belongs to, or null if the token is unknown. */
export async function profileForToken(db: Db, token: string, today: string): Promise<Profile | null> {
  const tokenHash = await hashToken(token);
  const [row] = await db.query<UserRow>(
    `SELECT ${USER_COLUMNS} FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = $1`,
    [tokenHash],
  );
  if (!row) return null;
  // Note activity, at most hourly, so idle-account cleanup is possible later without a write per request.
  await db.query(
    `UPDATE users SET last_seen_at = now() WHERE id = $1 AND last_seen_at < now() - interval '1 hour'`,
    [row.id],
  );
  return toProfile(row, today);
}

export async function renameUser(db: Db, userId: string, name: string, today: string): Promise<Profile> {
  await db.query('UPDATE users SET name = $2 WHERE id = $1', [userId, name]);
  return loadUser(db, userId, today);
}

/**
 * Claim today's daily bonus. Days in a row grow the bonus; missing a day
 * starts again from the first day.
 */
export async function claimDaily(
  db: Db,
  userId: string,
  today: string,
): Promise<{ claimed: boolean; coins: number; profile: Profile }> {
  return db.tx(async (tx) => {
    // Lock the row so two taps at once can't both claim.
    const [row] = await tx.query<UserRow>(`SELECT ${USER_COLUMNS} FROM users u WHERE u.id = $1 FOR UPDATE`, [userId]);
    if (!row) throw new Error('no such user');
    const status = dailyStatus(row, today);
    if (!status.available) return { claimed: false, coins: 0, profile: toProfile(row, today) };
    const streak = status.streak + 1;
    const paid = await credit(tx, userId, status.amount, 'daily', today);
    await tx.query('UPDATE users SET last_daily = $2::date, daily_streak = $3 WHERE id = $1', [userId, today, streak]);
    return { claimed: paid, coins: paid ? status.amount : 0, profile: await loadUser(tx, userId, today) };
  });
}

// ---------------------------------------------------------------------------
// Online games
// ---------------------------------------------------------------------------

export interface GameRecord {
  /** Unique per game (room code + start time): recording twice is harmless. */
  key: string;
  code: string;
  mode: GameMode;
  startedAt: number;
  players: { seat: Seat; userId: string | null; name: string; bot: string | null; won: boolean }[];
}

/**
 * Store a finished online game, add it to each signed-in player's stats and
 * pay their coins. Returns the coins paid per account, or null if this game
 * was already recorded.
 */
export async function recordGame(db: Db, game: GameRecord): Promise<Map<string, { coins: number; won: boolean }> | null> {
  return db.tx(async (tx) => {
    const [row] = await tx.query<{ id: string }>(
      `INSERT INTO games (game_key, room_code, mode, started_at) VALUES ($1, $2, $3, to_timestamp($4 / 1000.0))
       ON CONFLICT (game_key) DO NOTHING RETURNING id`,
      [game.key, game.code, game.mode, game.startedAt],
    );
    if (!row) return null;
    const humans = game.players.filter((p) => p.bot === null).length;
    // Someone may have deleted their account during the game: record them as anonymous.
    const ids = game.players.map((p) => p.userId).filter((id): id is string => id !== null);
    const live = new Set(
      ids.length ? (await tx.query<{ id: string }>('SELECT id FROM users WHERE id = ANY($1::uuid[])', [ids])).map((r) => r.id) : [],
    );
    const paid = new Map<string, { coins: number; won: boolean }>();
    for (const p of game.players) {
      const userId = p.userId && live.has(p.userId) ? p.userId : null;
      const deleted = p.userId !== null && userId === null;
      // A player can't hold two seats, but never pay anyone twice.
      const counted = userId !== null && !paid.has(userId);
      const coins = counted ? gameReward(p.won, humans - 1) : 0;
      await tx.query(
        'INSERT INTO game_players (game_id, seat, user_id, name, bot, won, coins) VALUES ($1, $2, $3, $4, $5, $6, $7)',
        [row.id, p.seat, userId, deleted ? DELETED_PLAYER_NAME : p.name, p.bot, p.won, coins],
      );
      if (!counted) continue;
      paid.set(userId, { coins, won: p.won });
      await tx.query('UPDATE users SET games_played = games_played + 1, games_won = games_won + $2 WHERE id = $1', [
        userId,
        p.won ? 1 : 0,
      ]);
      await credit(tx, userId, coins, p.won ? 'win' : 'played', game.key);
    }
    return paid;
  });
}
