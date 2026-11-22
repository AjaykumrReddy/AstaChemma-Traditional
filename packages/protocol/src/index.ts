import type { BotLevel, GameMode, GameState, Seat } from '@asta/engine';

/**
 * Messages between the app and the online game server, sent as JSON over a
 * WebSocket. The server is the referee: it throws the shells, checks moves,
 * runs computer players and broadcasts the room after every change.
 */

/** Bump when a change would break older apps; the server rejects other versions. */
export const PROTOCOL_VERSION = 1;

/** Largest message either side accepts, in bytes. */
export const MAX_MESSAGE_BYTES = 16 * 1024;

/** Room codes: 4 characters from an alphabet without look-alikes (no I, O, 0, 1). */
export const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const CODE_LENGTH = 4;

export const MAX_NAME_LENGTH = 16;

export type SeatKind = 'open' | 'human' | 'bot';

/** One seat as everyone in the room sees it. */
export interface SeatView {
  seat: Seat;
  kind: SeatKind;
  /** Player or computer name; null for an open seat. */
  name: string | null;
  /** Computer difficulty (for bot seats, and for a human's stand-in while away). */
  level?: BotLevel;
  /** For human seats: currently connected. */
  connected?: boolean;
  /** For human seats: gone long enough that the computer is playing their turns. */
  away?: boolean;
  host?: boolean;
}

/** What just happened, so apps can animate it. */
export type LastAction =
  | { type: 'start' }
  | { type: 'throw'; by: Seat }
  | { type: 'move'; by: Seat; moveId: string };

export type RoomStatus = 'lobby' | 'playing' | 'finished';

/** The whole room as broadcast to every player after each change. */
export interface RoomView {
  code: string;
  mode: GameMode;
  status: RoomStatus;
  /** The seats in play for this room's player count. */
  seats: SeatView[];
  /**
   * The game, with the random-number state removed so throws can't be
   * predicted. Null in the lobby.
   */
  game: GameState | null;
  /** Increases by one with every change; apps use it to spot missed updates. */
  version: number;
  lastAction: LastAction | null;
}

export type ClientMessage =
  /** `account`: the player's session token, so results count towards their profile (optional). */
  | { t: 'create'; protocol: number; name: string; mode: GameMode; players: 2 | 3 | 4; account?: string }
  | { t: 'join'; protocol: number; code: string; name: string; account?: string }
  | { t: 'rejoin'; protocol: number; code: string; playerId: string; token: string }
  /** Host, in the lobby: make a seat open or a computer player. */
  | { t: 'seat'; seat: Seat; kind: 'open' | 'bot'; level?: BotLevel }
  /** Host: start the game (no seat may be open). */
  | { t: 'start' }
  | { t: 'throw' }
  | { t: 'move'; moveId: string }
  /** Leave the room for good (a computer takes over the seat in a game). */
  | { t: 'leave' }
  | { t: 'ping' };

export type ErrorCode =
  | 'bad-message'
  | 'version'
  | 'no-room'
  | 'room-full'
  | 'already-started'
  | 'not-in-room'
  | 'not-host'
  | 'not-ready'
  | 'not-your-turn'
  | 'illegal'
  | 'bad-token';

export type ServerMessage =
  /** You are in a room: keep playerId and token to rejoin after a disconnect. */
  | { t: 'welcome'; code: string; playerId: string; token: string; seat: Seat }
  | { t: 'room'; room: RoomView }
  | { t: 'error'; code: ErrorCode; message: string }
  | { t: 'left' }
  | { t: 'pong' }
  /** A finished game paid you coins (signed-in players only). */
  | GameRewardMessage;

// ---------------------------------------------------------------------------
// Accounts (HTTP, JSON)
//
//   POST  /v1/auth/guest   { name? }          → 201 { token, profile }
//   GET   /v1/me           Bearer token       → { profile }
//   PATCH /v1/me           Bearer, { name }   → { profile }
//   POST  /v1/me/daily     Bearer             → { claimed, coins, profile }
//   POST  /v1/auth/google  { idToken }, Bearer (optional: this phone's guest)
//                                             → { token, profile, outcome }
//   POST  /v1/auth/signout Bearer             → { ok: true }
//   POST  /v1/shop/buy     Bearer, { itemId } → { profile }   (409 not-enough-coins)
//   POST  /v1/shop/use     Bearer, { itemId } → { profile }   (409 not-owned)
//
// Errors: { error: AccountErrorCode } with 400 / 401 / 429 / 503.
// ---------------------------------------------------------------------------

/** A player's account as the app shows it. */
export interface Profile {
  id: string;
  name: string;
  /** Not yet signed in with Google/Apple: lives on this device only. */
  guest: boolean;
  /** The signed-in Google/Apple address (verified), if any. */
  email: string | null;
  /** Play money; never convertible to cash. */
  coins: number;
  /** Online games finished / won. */
  gamesPlayed: number;
  gamesWon: number;
  daily: DailyStatus;
  /** Shop items bought (free defaults aren't listed). */
  owned: string[];
  /** The look in use, per kind. */
  equipped: Record<ShopKind, string>;
}

export type AccountErrorCode = 'bad-request' | 'unauthorized' | 'too-many' | 'unavailable' | 'not-enough-coins' | 'not-owned';

/** How a sign-in was matched up (see the server's signInWithGoogle). */
export type SignInOutcome = 'upgraded' | 'existing' | 'created';

// ---------------------------------------------------------------------------
// Coins: play money, awarded only by the server. Never bought, sold or cashed.
// ---------------------------------------------------------------------------

export const COINS = {
  /** Once, for a new account. */
  welcome: 500,
  /** Daily bonus: base, plus `dailyStep` per day in a row, up to `dailyMaxSteps` steps. */
  dailyBase: 100,
  dailyStep: 20,
  dailyMaxSteps: 5,
  /** Finishing an online game without winning. */
  played: 10,
  /** Winning an online game: base, plus this much per other human player (computers don't count). */
  winBase: 30,
  winPerHuman: 70,
} as const;

/** The daily bonus on the `streak`-th day in a row (1 = first day). */
export function dailyBonus(streak: number): number {
  return COINS.dailyBase + COINS.dailyStep * Math.min(Math.max(streak - 1, 0), COINS.dailyMaxSteps);
}

/** Coins for finishing an online game. */
export function gameReward(won: boolean, otherHumans: number): number {
  return won ? COINS.winBase + COINS.winPerHuman * otherHumans : COINS.played;
}

// ---------------------------------------------------------------------------
// The coin shop: looks only, bought once and kept. Prices in coins.
// ---------------------------------------------------------------------------

export type ShopKind = 'board' | 'marbles' | 'shells';

export interface ShopItem {
  id: string;
  kind: ShopKind;
  /** 0 = the free default everyone has. */
  price: number;
}

export const SHOP_ITEMS: readonly ShopItem[] = [
  { id: 'board.classic', kind: 'board', price: 0 },
  { id: 'board.night', kind: 'board', price: 2000 },
  { id: 'board.festive', kind: 'board', price: 3000 },
  { id: 'marbles.glass', kind: 'marbles', price: 0 },
  { id: 'marbles.pearl', kind: 'marbles', price: 1200 },
  { id: 'marbles.metal', kind: 'marbles', price: 1800 },
  { id: 'shells.natural', kind: 'shells', price: 0 },
  { id: 'shells.golden', kind: 'shells', price: 800 },
  { id: 'shells.painted', kind: 'shells', price: 1000 },
];

/** What everyone has (and uses) to start with. */
export const DEFAULT_LOOK: Record<ShopKind, string> = { board: 'board.classic', marbles: 'marbles.glass', shells: 'shells.natural' };

export function shopItem(id: string): ShopItem | undefined {
  return SHOP_ITEMS.find((i) => i.id === id);
}

/** The daily bonus as the app shows it. */
export interface DailyStatus {
  /** Not yet claimed today (India time). */
  available: boolean;
  /** Days in a row so far (including today if already claimed). */
  streak: number;
  /** What claiming pays: today's bonus if available, otherwise tomorrow's. */
  amount: number;
}

/** Sent to a player when a finished online game pays them coins. */
export interface GameRewardMessage {
  t: 'reward';
  coins: number;
  won: boolean;
}

/** Session tokens are opaque strings; anything longer is not one of ours. */
export const MAX_TOKEN_LENGTH = 128;

/** Seats used for a player count: two players always sit opposite each other. */
export function seatsForCount(count: number): Seat[] {
  if (count === 2) return [0, 2];
  if (count === 3) return [0, 1, 2];
  return [0, 1, 2, 3];
}

export function normaliseCode(code: string): string {
  return code.trim().toUpperCase();
}

export function isValidCode(code: string): boolean {
  return code.length === CODE_LENGTH && [...code].every((c) => CODE_ALPHABET.includes(c));
}

export function cleanName(name: unknown): string | null {
  if (typeof name !== 'string') return null;
  const trimmed = name.replace(/\s+/g, ' ').trim().slice(0, MAX_NAME_LENGTH);
  return trimmed.length > 0 ? trimmed : null;
}

const SEATS = new Set([0, 1, 2, 3]);
const LEVELS = new Set(['easy', 'medium', 'hard']);
const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** Check an incoming message's shape. Returns null for anything malformed. */
export function parseClientMessage(raw: string): ClientMessage | null {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isObject(data) || typeof data.t !== 'string') return null;
  const str = (k: string) => (typeof data[k] === 'string' ? (data[k] as string) : null);
  const protocol = typeof data.protocol === 'number' ? data.protocol : -1;
  // Optional and never trusted as-is: the server looks the token up.
  const rawAccount = str('account');
  const account = rawAccount && rawAccount.length <= MAX_TOKEN_LENGTH ? rawAccount : undefined;

  switch (data.t) {
    case 'create': {
      const name = cleanName(data.name);
      const mode = data.mode === 'team' ? 'team' : data.mode === 'individual' ? 'individual' : null;
      const players = data.players;
      if (!name || !mode || (players !== 2 && players !== 3 && players !== 4)) return null;
      if (mode === 'team' && players !== 4) return null;
      return { t: 'create', protocol, name, mode, players, ...(account ? { account } : {}) };
    }
    case 'join': {
      const name = cleanName(data.name);
      const code = str('code');
      if (!name || !code) return null;
      return { t: 'join', protocol, code: normaliseCode(code), name, ...(account ? { account } : {}) };
    }
    case 'rejoin': {
      const code = str('code');
      const playerId = str('playerId');
      const token = str('token');
      if (!code || !playerId || !token) return null;
      return { t: 'rejoin', protocol, code: normaliseCode(code), playerId, token };
    }
    case 'seat': {
      const seat = data.seat;
      if (typeof seat !== 'number' || !SEATS.has(seat)) return null;
      if (data.kind !== 'open' && data.kind !== 'bot') return null;
      const level = data.level === undefined ? undefined : LEVELS.has(data.level as string) ? (data.level as BotLevel) : null;
      if (level === null) return null;
      return { t: 'seat', seat: seat as Seat, kind: data.kind, level };
    }
    case 'move': {
      const moveId = str('moveId');
      return moveId ? { t: 'move', moveId } : null;
    }
    case 'start':
    case 'throw':
    case 'leave':
    case 'ping':
      return { t: data.t };
    default:
      return null;
  }
}
