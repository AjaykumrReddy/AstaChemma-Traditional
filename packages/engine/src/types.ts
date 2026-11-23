import type { BoardId, Seat } from './board';

export type PieceKind = 'mother' | 'child';

export type GameMode = 'individual' | 'team';

export type BotLevel = 'easy' | 'medium' | 'hard';

export interface PlayerConfig {
  name: string;
  seat: Seat;
  /** Omit for a human player; set for a computer player. */
  bot?: BotLevel;
}

export interface GameConfig {
  mode: GameMode;
  /** 2–4 players for individual mode, exactly 4 for team mode. */
  players: PlayerConfig[];
  /** Which board (missing in games saved before 7×7: those are 5×5). */
  board?: BoardId;
}

export interface Player {
  index: number;
  name: string;
  seat: Seat;
  bot?: BotLevel;
  /** Team number in team mode (opposite seats share a team). */
  team?: number;
}

export interface Piece {
  id: string;
  owner: number;
  kind: PieceKind;
  /** -1 = waiting in the starting area, 0… = on the route, the board's `home` index = home (24 on 5×5, 48 on 7×7). */
  progress: number;
}

export interface ShellThrow {
  /** true = the shell landed open. */
  shells: boolean[];
  open: number;
  /** Movement score: 1–4 for 1–4 open, 8 for 5 open or none open. */
  score: number;
}

export interface Move {
  /** Unique id for this option: `${pieceId}:${uses}`. */
  id: string;
  pieceId: string;
  /** Indexes into `GameState.pending` of the throw(s) this move spends. */
  uses: number[];
  /** True when two held 4s are joined into an 8 to release the Mother. */
  join: boolean;
  from: number;
  to: number;
  /** True when the piece comes onto the board from the starting area. */
  enters: boolean;
  /** Ids of opponent pieces sent back to their starting area. */
  captures: string[];
  /** True when the move ends at the centre. */
  finishes: boolean;
}

export type GameEvent =
  | { type: 'throw'; player: number; result: ShellThrow }
  | { type: 'noMove'; player: number }
  | { type: 'hold'; player: number }
  | { type: 'move'; player: number; move: Move }
  | { type: 'capture'; player: number; pieceId: string; victimOwner: number }
  | { type: 'home'; player: number; pieceId: string }
  | { type: 'extraTurn'; player: number }
  | { type: 'win'; winners: number[] };

export type Phase = 'awaitingThrow' | 'awaitingMove' | 'finished';

export interface GameState {
  config: GameConfig;
  players: Player[];
  pieces: Piece[];
  /** Index into `players` of the player whose turn it is. */
  current: number;
  phase: Phase;
  lastThrow: ShellThrow | null;
  /**
   * Throws the current player has made but not yet used, in order. Usually
   * one; more when a 4 was held while throwing again.
   */
  pending: ShellThrow[];
  /** The current player is owed another throw once the pending throws are used. */
  bonusThrow: boolean;
  /**
   * The player may keep the pending 4s/8s and throw again now (to use them
   * after the next throw, e.g. once a square is cleared), or hoping for
   * another 4 to join into an 8 for the Mother.
   */
  canHold: boolean;
  /** Legal moves for the pending throws (only while phase is awaitingMove). */
  legalMoves: Move[];
  winners: number[];
  rng: number;
  turn: number;
  /** Events produced by the most recent action, for UI messages and sounds. */
  events: GameEvent[];
}
