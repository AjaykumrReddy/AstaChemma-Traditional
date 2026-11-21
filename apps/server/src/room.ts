import {
  applyMove,
  chooseBotAction,
  createGame,
  throwShells,
  type BotLevel,
  type GameConfig,
  type GameMode,
  type GameState,
  type Seat,
} from '@asta/engine';
import {
  seatsForCount,
  type ErrorCode,
  type LastAction,
  type RoomStatus,
  type RoomView,
  type SeatView,
  type ServerMessage,
} from '@asta/protocol';
import type { GameRecord } from './db/accounts';

/**
 * One online room: lobby, seats, the authoritative game, computer players and
 * away handling.
 *
 * Platform-independent on purpose: everything lives in plain `RoomData` that
 * the host saves after every change, time comes from the injected clock, and
 * instead of timers the room reports when it next needs waking (`wakeAt`).
 * The Cloudflare Durable Object turns that into a storage alarm; tests just
 * move the clock and call `wake()`.
 */

export interface RoomTimings {
  /** A computer player's pause before throwing. */
  botThrowMs: number;
  /** A computer player's pause before moving. */
  botMoveMs: number;
  /** Grace period for a dropped player before the computer stands in (or, in the lobby, the seat frees up). */
  awayMs: number;
  /** A room with nobody connected is removed after this long. */
  abandonedMs: number;
}

export const DEFAULT_TIMINGS: RoomTimings = {
  botThrowMs: 1100,
  botMoveMs: 900,
  awayMs: 30_000,
  abandonedMs: 10 * 60_000,
};

/** The computer that plays for a human who is away or has left. */
const STAND_IN_LEVEL: BotLevel = 'medium';

export interface SeatData {
  kind: 'open' | 'human' | 'bot';
  name: string | null;
  level?: BotLevel;
  memberId?: string;
  /** The player's account, when they joined signed in: their result counts towards it. */
  userId?: string;
}

export interface MemberData {
  id: string;
  /** Secret proving it's this player when they rejoin. */
  token: string;
  name: string;
  seat: Seat;
  connected: boolean;
  /** Gone past the grace period: the computer plays their turns. */
  away: boolean;
  /** When an unanswered disconnect becomes "away" (or frees a lobby seat). */
  awayAt: number | null;
}

/** Everything about a room, as plain JSON-safe data the host saves after every change. */
export interface RoomData {
  format: 1;
  code: string;
  mode: GameMode;
  seatsInPlay: Seat[];
  /** Keyed by seat number. */
  seats: Partial<Record<Seat, SeatData>>;
  members: MemberData[];
  hostId: string | null;
  status: RoomStatus;
  /** The full game, including the RNG state. Never sent as-is. */
  game: GameState | null;
  version: number;
  /** When the computer should take the current turn, if it's a computer's turn. */
  botAt: number | null;
  lastActivity: number;
  /** When the game started (identifies it when recording the result). */
  startedAt?: number;
  /** The finished game's result has been saved to players' accounts. */
  recorded?: boolean;
}

/** How the room reaches players and reads the time. */
export interface RoomIO {
  /** Send a message to every connection of one member. */
  send(memberId: string, message: ServerMessage): void;
  now(): number;
}

export class RoomError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string,
  ) {
    super(message);
  }
}

/** A cryptographically random positive 31-bit integer (works in Workers and Node). */
function randomSeed(): number {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return (buf[0]! % (2 ** 31 - 2)) + 1;
}

export class Room {
  constructor(
    readonly data: RoomData,
    private readonly io: RoomIO,
    private readonly timings: RoomTimings = DEFAULT_TIMINGS,
  ) {}

  /** A fresh lobby. */
  static create(code: string, mode: GameMode, players: number, now: number): RoomData {
    const seatsInPlay = seatsForCount(mode === 'team' ? 4 : players);
    const seats: Partial<Record<Seat, SeatData>> = {};
    for (const seat of seatsInPlay) seats[seat] = { kind: 'open', name: null };
    return {
      format: 1,
      code,
      mode,
      seatsInPlay,
      seats,
      members: [],
      hostId: null,
      status: 'lobby',
      game: null,
      version: 0,
      botAt: null,
      lastActivity: now,
    };
  }

  // -------------------------------------------------------------------------
  // Membership
  // -------------------------------------------------------------------------

  /**
   * Seat a new player in the first open seat; the first player becomes host.
   * `attach` binds the player's connection before the room is broadcast, so
   * they receive it too.
   */
  join(name: string, attach: (member: MemberData) => void, userId?: string | null): MemberData {
    const d = this.data;
    if (d.status !== 'lobby') throw new RoomError('already-started', 'This game has already started.');
    const seat = d.seatsInPlay.find((s) => d.seats[s]?.kind === 'open');
    if (seat === undefined) throw new RoomError('room-full', 'This room is full.');
    const member: MemberData = {
      id: crypto.randomUUID(),
      token: crypto.randomUUID(),
      name,
      seat,
      connected: true,
      away: false,
      awayAt: null,
    };
    d.members.push(member);
    d.seats[seat] = { kind: 'human', name, memberId: member.id, ...(userId ? { userId } : {}) };
    d.hostId ??= member.id;
    attach(member);
    this.changed(null);
    return member;
  }

  /** Reattach a player after a disconnect, using the secret token from their welcome. */
  rejoin(playerId: string, token: string, attach: (member: MemberData) => void): MemberData {
    const member = this.member(playerId);
    if (!member || member.token !== token) throw new RoomError('bad-token', 'Could not rejoin this room.');
    member.connected = true;
    member.away = false;
    member.awayAt = null;
    attach(member);
    // If the stand-in computer was about to play their turn, that's cancelled.
    this.changed(null);
    return member;
  }

  /** The player's last connection dropped: start the grace period. */
  disconnected(memberId: string): void {
    const member = this.member(memberId);
    if (!member || !member.connected) return;
    member.connected = false;
    member.awayAt = this.io.now() + this.timings.awayMs;
    this.changed(null);
  }

  /** The player left on purpose. */
  leave(memberId: string): void {
    const member = this.member(memberId);
    if (!member) return;
    this.io.send(member.id, { t: 'left' });
    this.removeMember(member);
  }

  private removeMember(member: MemberData): void {
    const d = this.data;
    d.members = d.members.filter((m) => m.id !== member.id);
    // In the lobby the seat opens up; mid-game the computer plays it from now on.
    d.seats[member.seat] =
      d.status === 'lobby' ? { kind: 'open', name: null } : { kind: 'bot', name: member.name, level: STAND_IN_LEVEL };
    if (d.hostId === member.id) d.hostId = d.members[0]?.id ?? null;
    this.changed(null);
  }

  private member(id: string): MemberData | undefined {
    return this.data.members.find((m) => m.id === id);
  }

  // -------------------------------------------------------------------------
  // Lobby
  // -------------------------------------------------------------------------

  setSeat(memberId: string, seat: Seat, kind: 'open' | 'bot', level: BotLevel = 'medium'): void {
    this.requireHost(memberId);
    const d = this.data;
    if (d.status !== 'lobby') throw new RoomError('already-started', 'Seats can only be changed before the game starts.');
    const slot = d.seats[seat];
    if (!slot) throw new RoomError('illegal', 'That seat is not in this game.');
    if (slot.kind === 'human') throw new RoomError('illegal', 'A player is sitting there.');
    d.seats[seat] = kind === 'open' ? { kind: 'open', name: null } : { kind: 'bot', name: null, level };
    this.changed(null);
  }

  start(memberId: string): void {
    this.requireHost(memberId);
    const d = this.data;
    if (d.status !== 'lobby') throw new RoomError('already-started', 'The game has already started.');
    if (d.seatsInPlay.some((s) => d.seats[s]?.kind === 'open')) {
      throw new RoomError('not-ready', 'Fill every seat with a player or the computer first.');
    }
    let computer = 0;
    const config: GameConfig = {
      mode: d.mode,
      players: d.seatsInPlay.map((seat) => {
        const slot = d.seats[seat]!;
        if (slot.kind === 'bot') {
          computer++;
          return { name: slot.name ?? `Computer ${computer}`, seat, bot: slot.level ?? 'medium' };
        }
        return { name: slot.name ?? 'Player', seat };
      }),
    };
    d.game = createGame(config, randomSeed());
    d.status = 'playing';
    d.startedAt = this.io.now();
    this.changed({ type: 'start' });
  }

  /**
   * The finished game's result for players' accounts, or null if there's
   * nothing (more) to record. Seats whose player left count as the computer's.
   */
  result(): GameRecord | null {
    const d = this.data;
    if (d.status !== 'finished' || !d.game || d.recorded) return null;
    const game = d.game;
    const players = d.seatsInPlay.map((seat) => {
      const slot = d.seats[seat];
      const player = game.players.find((p) => p.seat === seat)!;
      return {
        seat,
        userId: slot?.kind === 'human' ? (slot.userId ?? null) : null,
        name: player.name,
        bot: slot?.kind === 'bot' ? (slot.level ?? 'medium') : null,
        won: game.winners.includes(player.index),
      };
    });
    const startedAt = d.startedAt ?? 0;
    return { key: `${d.code}:${startedAt}`, code: d.code, mode: d.mode, startedAt, players };
  }

  private requireHost(memberId: string): void {
    if (memberId !== this.data.hostId) throw new RoomError('not-host', 'Only the host can do that.');
  }

  // -------------------------------------------------------------------------
  // Play
  // -------------------------------------------------------------------------

  throw(memberId: string): void {
    const seat = this.requireTurn(memberId);
    const game = this.data.game!;
    const canThrow = game.phase === 'awaitingThrow' || (game.phase === 'awaitingMove' && game.canHold);
    if (!canThrow) throw new RoomError('illegal', 'You cannot throw now.');
    this.applyThrow(seat);
  }

  move(memberId: string, moveId: string): void {
    const seat = this.requireTurn(memberId);
    const game = this.data.game!;
    if (game.phase !== 'awaitingMove' || !game.legalMoves.some((m) => m.id === moveId)) {
      throw new RoomError('illegal', 'That move is not allowed.');
    }
    this.applyMoveFor(seat, moveId);
  }

  private requireTurn(memberId: string): Seat {
    const member = this.member(memberId);
    if (!member) throw new RoomError('not-in-room', 'You are not in this room.');
    if (this.data.status !== 'playing' || !this.data.game) throw new RoomError('illegal', 'The game is not being played.');
    if (this.currentSeat() !== member.seat) throw new RoomError('not-your-turn', 'It is not your turn.');
    return member.seat;
  }

  private currentSeat(): Seat | null {
    const game = this.data.game;
    return game ? (game.players[game.current]?.seat ?? null) : null;
  }

  private applyThrow(seat: Seat): void {
    this.data.game = throwShells(this.data.game!);
    this.changed({ type: 'throw', by: seat });
  }

  private applyMoveFor(seat: Seat, moveId: string): void {
    this.data.game = applyMove(this.data.game!, moveId);
    if (this.data.game.phase === 'finished') this.data.status = 'finished';
    this.changed({ type: 'move', by: seat, moveId });
  }

  /** The computer level playing the current turn: a bot seat, or a human who is away. */
  private computerLevelForTurn(): BotLevel | null {
    const seat = this.currentSeat();
    if (seat === null) return null;
    const slot = this.data.seats[seat];
    if (slot?.kind === 'bot') return slot.level ?? 'medium';
    const member = slot?.memberId ? this.member(slot.memberId) : undefined;
    return member?.away ? STAND_IN_LEVEL : null;
  }

  // -------------------------------------------------------------------------
  // Time: the room's wake-ups
  // -------------------------------------------------------------------------

  /** The earliest time the room needs waking: a computer's turn, a grace period ending, or removal when abandoned. */
  wakeAt(): number | null {
    const times: number[] = [];
    if (this.data.botAt !== null) times.push(this.data.botAt);
    for (const m of this.data.members) if (m.awayAt !== null) times.push(m.awayAt);
    if (this.isAbandoned()) times.push(this.data.lastActivity + this.timings.abandonedMs);
    return times.length ? Math.min(...times) : null;
  }

  /** Handle everything that has become due. */
  wake(): void {
    const now = this.io.now();
    for (const member of [...this.data.members]) {
      if (member.awayAt !== null && member.awayAt <= now && !member.connected) {
        member.awayAt = null;
        if (this.data.status === 'lobby') this.removeMember(member);
        else {
          member.away = true;
          this.changed(null);
        }
      }
    }
    if (this.data.botAt !== null && this.data.botAt <= now) {
      this.data.botAt = null;
      const level = this.computerLevelForTurn();
      const seat = this.currentSeat();
      if (level && seat !== null && this.data.status === 'playing') {
        const action = chooseBotAction(this.data.game!, level);
        if (action.type === 'throw') this.applyThrow(seat);
        else this.applyMoveFor(seat, action.move.id);
      }
    }
  }

  /** Nobody connected: nobody is playing here. */
  isAbandoned(): boolean {
    return !this.data.members.some((m) => m.connected);
  }

  /** Abandoned long enough to be removed. */
  isExpired(): boolean {
    return this.isAbandoned() && this.io.now() >= this.data.lastActivity + this.timings.abandonedMs;
  }

  // -------------------------------------------------------------------------
  // Broadcasting
  // -------------------------------------------------------------------------

  /** Something changed: bump the version, tell everyone, and plan the computer's turn if it has one. */
  private changed(action: LastAction | null): void {
    const d = this.data;
    d.version++;
    d.lastActivity = this.io.now();
    const level = d.status === 'playing' ? this.computerLevelForTurn() : null;
    if (!level) d.botAt = null;
    else if (action || d.botAt === null) {
      // Pause like a person would: longer before throwing than before moving.
      const game = d.game!;
      const throwing = game.phase === 'awaitingThrow';
      d.botAt = this.io.now() + (throwing ? this.timings.botThrowMs : this.timings.botMoveMs);
    }
    const message: ServerMessage = { t: 'room', room: this.view(action) };
    for (const m of d.members) if (m.connected) this.io.send(m.id, message);
  }

  view(action: LastAction | null = null): RoomView {
    const d = this.data;
    const seats: SeatView[] = d.seatsInPlay.map((seat) => {
      const slot = d.seats[seat]!;
      const member = slot.memberId ? this.member(slot.memberId) : undefined;
      return {
        seat,
        kind: slot.kind,
        name: slot.name,
        level: slot.level,
        connected: member?.connected,
        away: member?.away,
        host: member ? member.id === d.hostId : undefined,
      };
    });
    return {
      code: d.code,
      mode: d.mode,
      status: d.status,
      seats,
      // The random-number state is hidden so nobody can predict the next throw.
      game: d.game ? { ...d.game, rng: 0 } : null,
      version: d.version,
      lastAction: action,
    };
  }
}
