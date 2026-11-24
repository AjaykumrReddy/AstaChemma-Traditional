import { isBoardId, type BoardId, type BotLevel, type GameMode, type GameState, type Seat } from '@asta/engine';

/**
 * Messages between the app and the online game server, sent as JSON over a
 * WebSocket. The server is the referee: it throws the shells, checks moves,
 * runs computer players and broadcasts the room after every change.
 */

/**
 * The version this app speaks. Bump when older apps would misunderstand
 * something new; the server accepts MIN_PROTOCOL_VERSION … PROTOCOL_VERSION.
 *   1: the 5×5 board only.
 *   2: rooms and quick match may use the 7×7 board (`board`).
 */
export const PROTOCOL_VERSION = 2;
/** The oldest app version the server still talks to. */
export const MIN_PROTOCOL_VERSION = 1;
/** Apps older than this can only play on the 5×5 board. */
export const BOARDS_PROTOCOL_VERSION = 2;

/** Whether the server can talk to an app speaking this version. */
export function supportedProtocol(version: number): boolean {
  return Number.isInteger(version) && version >= MIN_PROTOCOL_VERSION && version <= PROTOCOL_VERSION;
}

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
  /** The board (missing from older servers: 5×5). */
  board?: BoardId;
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
  /** A quick-match room (strangers, matched by the server): no host, turn timer. */
  quick?: boolean;
  /** Milliseconds left for the current player's throw or move (rooms with a turn timer). */
  turnEndsIn?: number | null;
  /** After a game: the seats whose players are ready to play again. */
  rematch?: Seat[];
}

// ---------------------------------------------------------------------------
// Quick match: WebSocket /match. Players wait in line and are paired in
// arrival order; each is then sent to a fresh room with their seat reserved.
// ---------------------------------------------------------------------------

/** The only queue for now: two players. */
export type QuickMode = '2p';

export type MatchClientMessage =
  /** `board`: which line to wait in (missing: 5×5). Players are only matched on the same board. */
  | { t: 'queue'; protocol: number; mode: QuickMode; name: string; account?: string; board?: BoardId }
  | { t: 'cancel' }
  | { t: 'ping' };

export type MatchServerMessage =
  /** You are in line; `waiting` counts everyone in line, you included. */
  | { t: 'queued'; waiting: number }
  /** Matched: join the room with these (exactly like rejoining after a dropped connection). */
  | { t: 'matched'; code: string; playerId: string; token: string; seat: Seat }
  | { t: 'error'; code: ErrorCode; message: string }
  | { t: 'pong' };

export function parseMatchMessage(raw: string): MatchClientMessage | null {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isObject(data) || typeof data.t !== 'string') return null;
  if (data.t === 'cancel' || data.t === 'ping') return { t: data.t };
  if (data.t !== 'queue' || data.mode !== '2p') return null;
  const name = cleanName(data.name);
  if (!name) return null;
  const protocol = typeof data.protocol === 'number' ? data.protocol : -1;
  const account = typeof data.account === 'string' && data.account.length <= MAX_TOKEN_LENGTH ? data.account : undefined;
  if (data.board !== undefined && !isBoardId(data.board)) return null;
  const board = data.board;
  return { t: 'queue', protocol, mode: '2p', name, ...(account ? { account } : {}), ...(board ? { board } : {}) };
}

// ---------------------------------------------------------------------------
// Names other players see: a light filter for obvious abuse (English and
// Telugu, including common transliterations). Not exhaustive; reporting comes later.
// ---------------------------------------------------------------------------

// Only fragments that don't occur inside ordinary names (so not "nazi" – Nazia –
// or "rape" – Grapes); a name that slips through can be changed after a report.
const BLOCKED_NAME_PARTS = [
  'fuck', 'shit', 'bitch', 'bastard', 'asshole', 'cunt', 'pussy', 'whore', 'slut', 'nigger', 'nigga', 'porn', 'hitler',
  'lanja', 'lanjha', 'dengu', 'dengey', 'pooku', 'modda', 'kojja', 'madarchod', 'behenchod', 'bhenchod', 'chutiya',
  'chutia', 'bhosdi',
  'లంజ', 'దెంగు', 'దెంగ', 'పూకు', 'మొడ్డ', 'గుద్ద', 'కొజ్జ', 'సుల్లి',
];

/** Whether a (cleaned) name is fine to show other players. */
export function isAcceptableName(name: string): boolean {
  // Ignore case, spaces, punctuation and digits used as letters ("f.u.c.k", "5ex").
  const flat = name
    .toLowerCase()
    .replace(/0/g, 'o')
    .replace(/1/g, 'i')
    .replace(/3/g, 'e')
    .replace(/4/g, 'a')
    .replace(/5/g, 's')
    .replace(/[\s\p{P}\p{S}]/gu, '');
  return !BLOCKED_NAME_PARTS.some((part) => flat.includes(part));
}

/**
 * Quick reactions players can send during an online game: a fixed set, shown
 * in each player's own language, so there is nothing free-form to moderate.
 */
export const REACTIONS = ['thumbs', 'laugh', 'wow', 'sad', 'fire', 'pray', 'niceThrow', 'oops', 'yourTurn', 'goodGame'] as const;
export type ReactionId = (typeof REACTIONS)[number];

export function isReactionId(value: unknown): value is ReactionId {
  return typeof value === 'string' && (REACTIONS as readonly string[]).includes(value);
}

/** At most one reaction per player this often. */
export const REACTION_GAP_MS = 1500;

export type ClientMessage =
  /** `account`: the player's session token, so results count towards their profile (optional). */
  | { t: 'create'; protocol: number; name: string; mode: GameMode; players: 2 | 3 | 4; account?: string; board?: BoardId }
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
  /** After a game: ready to play again with the same people (starts once everyone is). */
  | { t: 'rematch' }
  /** A quick reaction for the others to see (one of REACTIONS; no free text). */
  | { t: 'react'; id: ReactionId }
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
  | 'bad-token'
  /** The name isn't allowed (offensive); choose another. */
  | 'bad-name';

export type ServerMessage =
  /** You are in a room: keep playerId and token to rejoin after a disconnect. */
  | { t: 'welcome'; code: string; playerId: string; token: string; seat: Seat }
  | { t: 'room'; room: RoomView }
  | { t: 'error'; code: ErrorCode; message: string }
  | { t: 'left' }
  | { t: 'pong' }
  /** Someone in the room reacted (shown briefly by their name). */
  | { t: 'reaction'; seat: Seat; id: ReactionId }
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
//   GET   /v1/leaderboard?period=week|all  (Bearer optional, for `me`) → Leaderboard
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

export type AccountErrorCode =
  | 'bad-request'
  | 'unauthorized'
  | 'too-many'
  | 'unavailable'
  | 'not-enough-coins'
  | 'not-owned'
  | 'bad-name';

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

// ---------------------------------------------------------------------------
// Leaderboard: wins in online games against other people (not just computers).
// ---------------------------------------------------------------------------

export type LeaderboardPeriod = 'week' | 'all';

export interface LeaderboardEntry {
  /** 1 = first; players with the same wins share a rank. */
  rank: number;
  id: string;
  name: string;
  wins: number;
  played: number;
}

export interface Leaderboard {
  period: LeaderboardPeriod;
  /** Start of the week (India time), for 'week'. */
  since: string | null;
  /** The top players. */
  entries: LeaderboardEntry[];
  /** You (when signed in and on the board at all), even if outside the top. */
  me: LeaderboardEntry | null;
}

/** How many players the board lists. */
export const LEADERBOARD_SIZE = 50;

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
      if (data.board !== undefined && !isBoardId(data.board)) return null;
      const board = data.board;
      return { t: 'create', protocol, name, mode, players, ...(account ? { account } : {}), ...(board ? { board } : {}) };
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
    case 'react': {
      const id = str('id');
      return id && isReactionId(id) ? { t: 'react', id } : null;
    }
    case 'start':
    case 'throw':
    case 'leave':
    case 'rematch':
    case 'ping':
      return { t: data.t };
    default:
      return null;
  }
}
