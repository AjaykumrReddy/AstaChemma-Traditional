import type { GameMode, Seat } from '@asta/engine';
import type { Profile } from '@asta/protocol';
import type { Db } from './db';

/**
 * Accounts: guests (and later Google/Apple sign-ins), their sessions, and the
 * results of finished online games.
 *
 * Session tokens are 256 random bits handed to the app once; only their
 * SHA-256 hash is stored, so a database leak doesn't hand out sign-ins.
 */

interface UserRow {
  id: string;
  name: string;
  google_sub: string | null;
  apple_sub: string | null;
  coins: string | number; // bigint comes back as a string
  games_played: number;
  games_won: number;
}

const USER_COLUMNS = 'u.id, u.name, u.google_sub, u.apple_sub, u.coins, u.games_played, u.games_won';

function toProfile(row: UserRow): Profile {
  return {
    id: row.id,
    name: row.name,
    guest: !row.google_sub && !row.apple_sub,
    coins: Number(row.coins),
    gamesPlayed: row.games_played,
    gamesWon: row.games_won,
  };
}

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

/** A new guest account and its first session. */
export async function createGuest(db: Db, name: string): Promise<{ token: string; profile: Profile }> {
  const token = newToken();
  const tokenHash = await hashToken(token);
  return db.tx(async (tx) => {
    const [row] = await tx.query<UserRow>(
      `INSERT INTO users AS u (name) VALUES ($1) RETURNING ${USER_COLUMNS}`,
      [name],
    );
    await tx.query('INSERT INTO sessions (token_hash, user_id) VALUES ($1, $2)', [tokenHash, row!.id]);
    return { token, profile: toProfile(row!) };
  });
}

/** The account a session token belongs to, or null if the token is unknown. */
export async function profileForToken(db: Db, token: string): Promise<Profile | null> {
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
  return toProfile(row);
}

export async function renameUser(db: Db, userId: string, name: string): Promise<Profile> {
  const [row] = await db.query<UserRow>(`UPDATE users AS u SET name = $2 WHERE u.id = $1 RETURNING ${USER_COLUMNS}`, [
    userId,
    name,
  ]);
  if (!row) throw new Error('no such user');
  return toProfile(row);
}

export interface GameRecord {
  /** Unique per game (room code + start time): recording twice is harmless. */
  key: string;
  code: string;
  mode: GameMode;
  startedAt: number;
  players: { seat: Seat; userId: string | null; name: string; bot: string | null; won: boolean }[];
}

/**
 * Store a finished online game and add it to each signed-in player's stats.
 * Returns false if this game was already recorded.
 */
export async function recordGame(db: Db, game: GameRecord): Promise<boolean> {
  return db.tx(async (tx) => {
    const [row] = await tx.query<{ id: string }>(
      `INSERT INTO games (game_key, room_code, mode, started_at) VALUES ($1, $2, $3, to_timestamp($4 / 1000.0))
       ON CONFLICT (game_key) DO NOTHING RETURNING id`,
      [game.key, game.code, game.mode, game.startedAt],
    );
    if (!row) return false;
    for (const p of game.players) {
      await tx.query('INSERT INTO game_players (game_id, seat, user_id, name, bot, won) VALUES ($1, $2, $3, $4, $5, $6)', [
        row.id,
        p.seat,
        p.userId,
        p.name,
        p.bot,
        p.won,
      ]);
    }
    // One update per player; a player can't hold two seats, but guard anyway.
    const counted = new Set<string>();
    for (const p of game.players) {
      if (!p.userId || counted.has(p.userId)) continue;
      counted.add(p.userId);
      await tx.query('UPDATE users SET games_played = games_played + 1, games_won = games_won + $2 WHERE id = $1', [
        p.userId,
        p.won ? 1 : 0,
      ]);
    }
    return true;
  });
}
