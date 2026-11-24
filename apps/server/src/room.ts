import {
  DEFAULT_BOARD,
  applyMove,
  chooseBotAction,
  createGame,
  throwShells,
  type BoardId,
  type BotLevel,
  type GameConfig,
  type GameMode,
  type GameState,
  type Seat,
} from '@asta/engine';
import {
  REACTION_GAP_MS,
  seatsForCount,
  type ReactionId,
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
  /** Quick match: time for each throw or move before the server plays it for you. */
  turnMs: number;
  /** Quick match: time for matched players to connect before the computer stands in. */
  joinMs: number;
}

export const DEFAULT_TIMINGS: RoomTimings = {
  botThrowMs: 1100,
  botMoveMs: 900,
  awayMs: 30_000,
  abandonedMs: 10 * 60_000,
  turnMs: 20_000,
  joinMs: 15_000,
};

/** Quick match: this many turns in a row left to the timer and the computer takes over (until you act again). */
const MISSED_TURNS_AWAY = 3;

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
  /** Has connected at least once (quick-match seats are reserved before their players arrive). */
  joined?: boolean;
  /** Quick match: turns in a row the timer had to play. */
  missed?: number;
  /** When they last sent a reaction (limits how often). */
  reactedAt?: number;
}

/** Everything about a room, as plain JSON-safe data the host saves after every change. */
export interface RoomData {
  format: 1;
  code: string;
  mode: GameMode;
  /** Missing in rooms saved before 7×7 existed: 5×5. */
  board?: BoardId;
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
  /** A quick-match room: strangers paired by the server; no host, and a turn timer. */
  quick?: boolean;
  /** Quick match: when the current player's throw or move is due. */
  turnAt?: number | null;
  /** After a game: members ready to play again. */
  rematch?: string[];
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
  static create(code: string, mode: GameMode, players: number, now: number, board: BoardId = DEFAULT_BOARD): RoomData {
    const seatsInPlay = seatsForCount(mode === 'team' ? 4 : players);
    const seats: Partial<Record<Seat, SeatData>> = {};
    for (const seat of seatsInPlay) seats[seat] = { kind: 'open', name: null };
    return {
      format: 1,
      code,
      mode,
      board,
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

  /**
   * A quick-match room: the matched players' seats are reserved (each gets a
   * token to join with, exactly like rejoining) and the game starts at once.
   * Anyone who doesn't connect within `joinMs` is played by the computer.
   */
  static createQuick(
    code: string,
    players: { name: string; userId: string | null }[],
    now: number,
    timings: Pick<RoomTimings, 'joinMs' | 'turnMs'> = DEFAULT_TIMINGS,
    board: BoardId = DEFAULT_BOARD,
  ): RoomData {
    const d = Room.create(code, 'individual', players.length, now, board);
    d.quick = true;
    d.seatsInPlay.forEach((seat, i) => {
      const p = players[i]!;
      const member: MemberData = {
        id: crypto.randomUUID(),
        token: crypto.randomUUID(),
        name: p.name,
        seat,
        connected: false,
        away: false,
        awayAt: now + timings.joinMs,
        // Not here yet: no result or coins unless they arrive.
        joined: false,
      };
      d.members.push(member);
      d.seats[seat] = { kind: 'human', name: p.name, memberId: member.id, ...(p.userId ? { userId: p.userId } : {}) };
    });
    d.game = createGame(
      { mode: 'individual', board, players: d.seatsInPlay.map((seat) => ({ name: d.seats[seat]!.name!, seat })) },
      randomSeed(),
    );
    d.status = 'playing';
    d.startedAt = now;
    // The first player also gets the time to arrive.
    d.turnAt = now + timings.joinMs + timings.turnMs;
    return d;
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
      joined: true,
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
    member.joined = true;
    member.missed = 0;
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
    // Someone leaving may be all the others were waiting for.
    if (this.rematchReady()) return this.startRematch();
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
      ...(d.board && d.board !== DEFAULT_BOARD ? { board: d.board } : {}),
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

  // -------------------------------------------------------------------------
  // After a game
  // -------------------------------------------------------------------------

  /**
   * After a game: this player wants to play again with the same people. Once
   * everyone still in the room is ready, a new game starts on the same seats;
   * seats of players who are no longer connected go to the computer.
   */
  rematch(memberId: string): void {
    const d = this.data;
    const member = this.member(memberId);
    if (!member) throw new RoomError('not-in-room', 'You are not in this room.');
    if (d.status !== 'finished' || !d.game) throw new RoomError('illegal', 'The game is not over yet.');
    d.rematch = [...new Set([...(d.rematch ?? []), member.id])];
    if (this.rematchReady()) return this.startRematch();
    this.changed(null);
  }

  /** Everyone connected has asked to play again (and someone has). */
  private rematchReady(): boolean {
    const d = this.data;
    if (d.status !== 'finished' || !d.game || !d.rematch?.length) return false;
    const ready = new Set(d.rematch);
    return d.members.some((m) => ready.has(m.id)) && d.members.every((m) => !m.connected || ready.has(m.id));
  }

  private startRematch(): void {
    const d = this.data;
    const game = d.game!;
    // Players who aren't here any more: the computer plays their seat.
    for (const m of d.members.filter((x) => !x.connected)) {
      d.seats[m.seat] = { kind: 'bot', name: m.name, level: STAND_IN_LEVEL };
    }
    d.members = d.members.filter((m) => m.connected);
    if (!d.members.some((m) => m.id === d.hostId)) d.hostId = d.members[0]?.id ?? null;
    for (const m of d.members) {
      m.away = false;
      m.awayAt = null;
      m.missed = 0;
    }
    const config: GameConfig = {
      ...game.config,
      players: game.config.players.map((p) => {
        const slot = d.seats[p.seat]!;
        return slot.kind === 'bot'
          ? { name: slot.name ?? p.name, seat: p.seat, bot: slot.level ?? p.bot ?? STAND_IN_LEVEL }
          : { name: slot.name ?? p.name, seat: p.seat };
      }),
    };
    d.game = createGame(config, randomSeed());
    d.status = 'playing';
    d.startedAt = this.io.now();
    d.recorded = false;
    d.rematch = undefined;
    d.turnAt = null;
    this.changed({ type: 'start' });
  }

  /** A quick reaction, passed straight on to everyone (not saved; at most one every REACTION_GAP_MS). */
  react(memberId: string, id: ReactionId): void {
    const member = this.member(memberId);
    if (!member) throw new RoomError('not-in-room', 'You are not in this room.');
    const now = this.io.now();
    if (member.reactedAt !== undefined && now - member.reactedAt < REACTION_GAP_MS) return;
    member.reactedAt = now;
    for (const m of this.data.members) if (m.connected) this.io.send(m.id, { t: 'reaction', seat: member.seat, id });
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
      // Only players who actually joined: a matched player who never arrived gets nothing.
      const member = slot?.memberId ? this.member(slot.memberId) : undefined;
      const joined = member?.joined !== false;
      return {
        seat,
        userId: slot?.kind === 'human' && joined ? (slot.userId ?? null) : null,
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
    // Playing again: the timer's count starts over, and the computer stops standing in.
    member.missed = 0;
    if (member.away && member.connected) member.away = false;
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
    if (this.data.turnAt != null) times.push(this.data.turnAt);
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
    // Quick match: the current player ran out of time – play it for them.
    const d = this.data;
    if (d.turnAt != null && d.turnAt <= now) {
      d.turnAt = null;
      const seat = this.currentSeat();
      const slot = seat !== null ? d.seats[seat] : undefined;
      const member = slot?.memberId ? this.member(slot.memberId) : undefined;
      if (member && seat !== null && d.status === 'playing' && !this.computerLevelForTurn()) {
        member.missed = (member.missed ?? 0) + 1;
        if (member.missed >= MISSED_TURNS_AWAY) member.away = true;
        const action = chooseBotAction(d.game!, STAND_IN_LEVEL);
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
    // With nobody connected, nobody is watching: computers wait until someone is back.
    const active = d.status === 'playing' && !this.isAbandoned();
    const level = active ? this.computerLevelForTurn() : null;
    if (!level) d.botAt = null;
    else if (action || d.botAt === null) {
      // Pause like a person would: longer before throwing than before moving.
      const game = d.game!;
      const throwing = game.phase === 'awaitingThrow';
      d.botAt = this.io.now() + (throwing ? this.timings.botThrowMs : this.timings.botMoveMs);
    }
    // Quick match: each throw or move by a person has a time limit.
    if (d.quick) {
      if (!active || level) d.turnAt = null;
      else if (action || d.turnAt == null) d.turnAt = this.io.now() + this.timings.turnMs;
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
      board: d.board ?? DEFAULT_BOARD,
      status: d.status,
      seats,
      // The random-number state is hidden so nobody can predict the next throw.
      game: d.game ? { ...d.game, rng: 0 } : null,
      version: d.version,
      lastAction: action,
      ...(d.quick ? { quick: true, turnEndsIn: d.turnAt != null ? Math.max(0, d.turnAt - this.io.now()) : null } : {}),
      ...(d.status === 'finished' && d.rematch?.length
        ? { rematch: d.members.filter((m) => d.rematch!.includes(m.id)).map((m) => m.seat) }
        : {}),
    };
  }
}
