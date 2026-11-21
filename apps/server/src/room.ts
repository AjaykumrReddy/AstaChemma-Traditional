import { randomInt, randomUUID } from 'node:crypto';
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

/** Anything that can receive messages for a player (a WebSocket in production, a stub in tests). */
export interface Connection {
  send(message: ServerMessage): void;
}

export interface RoomTimings {
  /** A computer player's pause before throwing. */
  botThrowMs: number;
  /** A computer player's pause before moving. */
  botMoveMs: number;
  /** How long a disconnected player has before the computer plays for them (or, in the lobby, their seat frees up). */
  awayMs: number;
}

export const DEFAULT_TIMINGS: RoomTimings = { botThrowMs: 1100, botMoveMs: 900, awayMs: 30_000 };

/** The computer that plays for a human who is away. */
const STAND_IN_LEVEL: BotLevel = 'medium';

interface SeatSlot {
  kind: 'open' | 'human' | 'bot';
  name: string | null;
  level?: BotLevel;
  memberId?: string;
}

interface Member {
  id: string;
  token: string;
  name: string;
  seat: Seat;
  conn: Connection | null;
  away: boolean;
  awayTimer?: ReturnType<typeof setTimeout>;
}

export class RoomError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string,
  ) {
    super(message);
  }
}

/**
 * One online room: lobby, seats, the authoritative game, computer players and
 * away handling. It knows nothing about sockets; it talks through Connections.
 */
export class Room {
  readonly code: string;
  readonly mode: GameMode;
  readonly seatsInPlay: Seat[];
  status: RoomStatus = 'lobby';
  /** Full game, including the RNG state; never sent as-is. */
  private game: GameState | null = null;
  private version = 0;
  private readonly seats = new Map<Seat, SeatSlot>();
  private readonly members = new Map<string, Member>();
  private hostId: string | null = null;
  private botTimer: ReturnType<typeof setTimeout> | null = null;
  /** Last time anything happened, for cleaning up idle rooms. */
  lastActivity = Date.now();

  constructor(
    code: string,
    mode: GameMode,
    players: number,
    private readonly timings: RoomTimings = DEFAULT_TIMINGS,
  ) {
    this.code = code;
    this.mode = mode;
    this.seatsInPlay = seatsForCount(mode === 'team' ? 4 : players);
    for (const seat of this.seatsInPlay) this.seats.set(seat, { kind: 'open', name: null });
  }

  // -------------------------------------------------------------------------
  // Membership
  // -------------------------------------------------------------------------

  /** Seat a new player in the first open seat. The first player becomes host. */
  join(name: string, conn: Connection): Member {
    if (this.status !== 'lobby') throw new RoomError('already-started', 'This game has already started.');
    const seat = this.seatsInPlay.find((s) => this.seats.get(s)?.kind === 'open');
    if (seat === undefined) throw new RoomError('room-full', 'This room is full.');
    const member: Member = { id: randomUUID(), token: randomUUID(), name, seat, conn, away: false };
    this.members.set(member.id, member);
    this.seats.set(seat, { kind: 'human', name, memberId: member.id });
    this.hostId ??= member.id;
    conn.send({ t: 'welcome', code: this.code, playerId: member.id, token: member.token, seat });
    this.changed(null);
    return member;
  }

  /** Reattach a player after a disconnect, using the secret token from their welcome. */
  rejoin(playerId: string, token: string, conn: Connection): Member {
    const member = this.members.get(playerId);
    if (!member || member.token !== token) throw new RoomError('bad-token', 'Could not rejoin this room.');
    if (member.awayTimer) clearTimeout(member.awayTimer);
    member.awayTimer = undefined;
    member.conn = conn;
    member.away = false;
    conn.send({ t: 'welcome', code: this.code, playerId: member.id, token: member.token, seat: member.seat });
    // Their turn may have been waiting for the stand-in computer: cancel it.
    this.changed(null);
    return member;
  }

  /** The player's connection dropped: give them a grace period, then free the seat (lobby) or let the computer stand in. */
  disconnected(memberId: string, conn: Connection): void {
    const member = this.members.get(memberId);
    if (!member || member.conn !== conn) return;
    member.conn = null;
    member.awayTimer = setTimeout(() => {
      member.awayTimer = undefined;
      if (member.conn) return;
      if (this.status === 'lobby') this.removeMember(member);
      else {
        member.away = true;
        this.changed(null);
      }
    }, this.timings.awayMs);
    this.changed(null);
  }

  /** The player left on purpose. */
  leave(memberId: string): void {
    const member = this.members.get(memberId);
    if (!member) return;
    member.conn?.send({ t: 'left' });
    member.conn = null;
    this.removeMember(member);
  }

  private removeMember(member: Member): void {
    if (member.awayTimer) clearTimeout(member.awayTimer);
    this.members.delete(member.id);
    if (this.status === 'lobby') {
      this.seats.set(member.seat, { kind: 'open', name: null });
    } else {
      // Mid-game the seat stays, played by the computer from now on.
      this.seats.set(member.seat, { kind: 'bot', name: member.name, level: STAND_IN_LEVEL });
    }
    if (this.hostId === member.id) this.hostId = this.members.keys().next().value ?? null;
    this.changed(null);
  }

  /** No connected humans: nobody is playing here any more. */
  isAbandoned(): boolean {
    return ![...this.members.values()].some((m) => m.conn);
  }

  // -------------------------------------------------------------------------
  // Lobby
  // -------------------------------------------------------------------------

  setSeat(memberId: string, seat: Seat, kind: 'open' | 'bot', level: BotLevel = 'medium'): void {
    this.requireHost(memberId);
    if (this.status !== 'lobby') throw new RoomError('already-started', 'Seats can only be changed before the game starts.');
    const slot = this.seats.get(seat);
    if (!slot) throw new RoomError('illegal', 'That seat is not in this game.');
    if (slot.kind === 'human') throw new RoomError('illegal', 'A player is sitting there.');
    this.seats.set(seat, kind === 'open' ? { kind: 'open', name: null } : { kind: 'bot', name: null, level });
    this.changed(null);
  }

  start(memberId: string): void {
    this.requireHost(memberId);
    if (this.status !== 'lobby') throw new RoomError('already-started', 'The game has already started.');
    if (this.seatsInPlay.some((s) => this.seats.get(s)?.kind === 'open')) {
      throw new RoomError('not-ready', 'Fill every seat with a player or the computer first.');
    }
    let computer = 0;
    const config: GameConfig = {
      mode: this.mode,
      players: this.seatsInPlay.map((seat) => {
        const slot = this.seats.get(seat)!;
        if (slot.kind === 'bot') {
          computer++;
          return { name: slot.name ?? `Computer ${computer}`, seat, bot: slot.level ?? 'medium' };
        }
        return { name: slot.name ?? 'Player', seat };
      }),
    };
    this.game = createGame(config, randomInt(1, 2 ** 31 - 1));
    this.status = 'playing';
    this.changed({ type: 'start' });
  }

  private requireHost(memberId: string): void {
    if (memberId !== this.hostId) throw new RoomError('not-host', 'Only the host can do that.');
  }

  // -------------------------------------------------------------------------
  // Play
  // -------------------------------------------------------------------------

  throw(memberId: string): void {
    const seat = this.requireTurn(memberId);
    const game = this.game!;
    const canThrow = game.phase === 'awaitingThrow' || (game.phase === 'awaitingMove' && game.canHold);
    if (!canThrow) throw new RoomError('illegal', 'You cannot throw now.');
    this.applyThrow(seat);
  }

  move(memberId: string, moveId: string): void {
    const seat = this.requireTurn(memberId);
    const game = this.game!;
    if (game.phase !== 'awaitingMove' || !game.legalMoves.some((m) => m.id === moveId)) {
      throw new RoomError('illegal', 'That move is not allowed.');
    }
    this.applyMoveFor(seat, moveId);
  }

  private requireTurn(memberId: string): Seat {
    const member = this.members.get(memberId);
    if (!member) throw new RoomError('not-in-room', 'You are not in this room.');
    if (this.status !== 'playing' || !this.game) throw new RoomError('illegal', 'The game is not being played.');
    if (this.currentSeat() !== member.seat) throw new RoomError('not-your-turn', 'It is not your turn.');
    return member.seat;
  }

  private currentSeat(): Seat | null {
    return this.game ? (this.game.players[this.game.current]?.seat ?? null) : null;
  }

  private applyThrow(seat: Seat): void {
    this.game = throwShells(this.game!);
    this.changed({ type: 'throw', by: seat });
  }

  private applyMoveFor(seat: Seat, moveId: string): void {
    this.game = applyMove(this.game!, moveId);
    if (this.game.phase === 'finished') this.status = 'finished';
    this.changed({ type: 'move', by: seat, moveId });
  }

  /** Who plays the current turn by computer: a bot seat, or a human who is away. */
  private computerLevelForTurn(): BotLevel | null {
    const seat = this.currentSeat();
    if (seat === null) return null;
    const slot = this.seats.get(seat);
    if (slot?.kind === 'bot') return slot.level ?? 'medium';
    const member = slot?.memberId ? this.members.get(slot.memberId) : undefined;
    return member?.away ? STAND_IN_LEVEL : null;
  }

  private scheduleComputer(): void {
    if (this.botTimer) clearTimeout(this.botTimer);
    this.botTimer = null;
    if (this.status !== 'playing' || !this.game) return;
    const level = this.computerLevelForTurn();
    if (!level) return;
    const action = chooseBotAction(this.game, level);
    const seat = this.currentSeat()!;
    this.botTimer = setTimeout(
      () => {
        this.botTimer = null;
        if (this.status !== 'playing' || this.currentSeat() !== seat) return;
        if (action.type === 'throw') this.applyThrow(seat);
        else this.applyMoveFor(seat, action.move.id);
      },
      action.type === 'throw' ? this.timings.botThrowMs : this.timings.botMoveMs,
    );
  }

  // -------------------------------------------------------------------------
  // Broadcasting
  // -------------------------------------------------------------------------

  /** Something changed: bump the version, tell everyone, and let the computer play if it's its turn. */
  private changed(action: LastAction | null): void {
    this.version++;
    this.lastActivity = Date.now();
    const message: ServerMessage = { t: 'room', room: this.view(action) };
    for (const m of this.members.values()) m.conn?.send(message);
    this.scheduleComputer();
  }

  view(action: LastAction | null = null): RoomView {
    const seats: SeatView[] = this.seatsInPlay.map((seat) => {
      const slot = this.seats.get(seat)!;
      const member = slot.memberId ? this.members.get(slot.memberId) : undefined;
      return {
        seat,
        kind: slot.kind,
        name: slot.name,
        level: slot.level,
        connected: member ? member.conn !== null : undefined,
        away: member ? member.away : undefined,
        host: member ? member.id === this.hostId : undefined,
      };
    });
    return {
      code: this.code,
      mode: this.mode,
      status: this.status,
      seats,
      // Hide the random-number state so nobody can predict the next throw.
      game: this.game ? { ...this.game, rng: 0 } : null,
      version: this.version,
      lastAction: action,
    };
  }

  /** Stop timers; the room is being thrown away. */
  dispose(): void {
    if (this.botTimer) clearTimeout(this.botTimer);
    for (const m of this.members.values()) if (m.awayTimer) clearTimeout(m.awayTimer);
  }
}
