import { HOME_INDEX, YARD_INDEX, cellAt, isSafeCell, sameCell, type Seat } from './board';
import { nextRandom } from './rng';
import type {
  GameConfig,
  GameEvent,
  GameState,
  Move,
  Piece,
  PieceKind,
  Player,
  ShellThrow,
} from './types';

export const SHELL_COUNT = 5;

// ---------------------------------------------------------------------------
// Shell results and movement values
// ---------------------------------------------------------------------------

/** All five open, or none open: both count as 8. */
export function isEight(open: number): boolean {
  return open === SHELL_COUNT || open === 0;
}

/** Movement score for a number of open shells: 1–4 → 1–4; 5 or 0 → 8. */
export function scoreForOpen(open: number): number {
  return isEight(open) ? 8 : open;
}

/** Steps a piece already on the board moves for a result, or null if it cannot move. */
export function stepsFor(kind: PieceKind, open: number): number | null {
  if (open < 0 || open > SHELL_COUNT) return null;
  const score = scoreForOpen(open);
  if (kind === 'child') return score;
  // Mother: only on 2, 4 or 8, moving 1, 2 or 4 steps.
  return open === 2 || open === 4 || isEight(open) ? score / 2 : null;
}

/**
 * Route index a piece lands on when it enters from the starting area, or null
 * if it cannot enter on this result.
 *  - Child: 4 → entry square; 8 → entry square + 4 steps.
 *  - Mother: 8 only → entry square, no extra steps (two joined 4s also count).
 */
export function entryProgress(kind: PieceKind, open: number): number | null {
  if (kind === 'child') {
    if (open === 4) return 0;
    if (isEight(open)) return 4;
    return null;
  }
  return isEight(open) ? 0 : null;
}

/** A 4 or an 8 earns another throw (so does bringing a piece home). */
export function earnsExtraTurn(open: number): boolean {
  return open === 4 || isEight(open);
}

export function makeThrow(shells: boolean[]): ShellThrow {
  if (shells.length !== SHELL_COUNT) throw new Error(`Expected ${SHELL_COUNT} shells`);
  const open = shells.filter(Boolean).length;
  return { shells: [...shells], open, score: scoreForOpen(open) };
}

/** Probability of exactly `open` shells landing open, assuming each is 50/50. */
export function throwProbability(open: number): number {
  const choose = [1, 5, 10, 10, 5, 1][open] ?? 0;
  return choose / 2 ** SHELL_COUNT;
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

export function validateConfig(config: GameConfig): void {
  const n = config.players.length;
  if (config.mode === 'team' && n !== 4) throw new Error('Team mode needs exactly 4 players');
  if (n < 2 || n > 4) throw new Error('Asta Chemma needs 2 to 4 players');
  const seats = new Set(config.players.map((p) => p.seat));
  if (seats.size !== n) throw new Error('Each player needs a different seat');
}

export function createGame(config: GameConfig, seed: number): GameState {
  validateConfig(config);
  // Turn order follows the seats counter-clockwise: bottom, right, top, left.
  const ordered = [...config.players].sort((a, b) => a.seat - b.seat);
  const players: Player[] = ordered.map((p, index) => ({
    index,
    name: p.name,
    seat: p.seat,
    bot: p.bot,
    team: config.mode === 'team' ? p.seat % 2 : undefined,
  }));
  const pieces: Piece[] = players.flatMap((p) => [
    { id: `${p.index}-M`, owner: p.index, kind: 'mother' as const, progress: YARD_INDEX },
    { id: `${p.index}-C1`, owner: p.index, kind: 'child' as const, progress: YARD_INDEX },
    { id: `${p.index}-C2`, owner: p.index, kind: 'child' as const, progress: YARD_INDEX },
  ]);
  return {
    config,
    players,
    pieces,
    current: 0,
    phase: 'awaitingThrow',
    lastThrow: null,
    pending: [],
    bonusThrow: false,
    canHold: false,
    legalMoves: [],
    winners: [],
    rng: seed | 0,
    turn: 1,
    events: [],
  };
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export function seatOf(state: GameState, playerIndex: number): Seat {
  const player = state.players[playerIndex];
  if (!player) throw new Error(`No player ${playerIndex}`);
  return player.seat;
}

export function areTeammates(state: GameState, a: number, b: number): boolean {
  if (a === b) return true;
  const pa = state.players[a];
  const pb = state.players[b];
  return pa?.team !== undefined && pa.team === pb?.team;
}

export function piecesOf(state: GameState, playerIndex: number): Piece[] {
  return state.pieces.filter((p) => p.owner === playerIndex);
}

export function isPlayerDone(state: GameState, playerIndex: number): boolean {
  return piecesOf(state, playerIndex).every((p) => p.progress === HOME_INDEX);
}

export function teammateOf(state: GameState, playerIndex: number): number | null {
  const team = state.players[playerIndex]?.team;
  if (team === undefined) return null;
  const mate = state.players.find((p) => p.index !== playerIndex && p.team === team);
  return mate ? mate.index : null;
}

/**
 * Whose pieces a player moves this turn: their own, or — in team mode, once all
 * their own pieces are home — their teammate's.
 */
export function controlledPlayer(state: GameState, playerIndex: number): number {
  if (state.config.mode === 'team' && isPlayerDone(state, playerIndex)) {
    const mate = teammateOf(state, playerIndex);
    if (mate !== null) return mate;
  }
  return playerIndex;
}

/** Board position of a piece, or null when it is in the starting area. */
export function pieceCell(state: GameState, piece: Piece) {
  return cellAt(seatOf(state, piece.owner), piece.progress);
}

/**
 * Whether `attacker` can capture `victim` by landing on it: only a Child
 * captures a Child and only a Mother captures a Mother, never a teammate.
 */
export function canCapture(state: GameState, attacker: Piece, victim: Piece): boolean {
  return attacker.kind === victim.kind && !areTeammates(state, attacker.owner, victim.owner);
}

/**
 * What happens if `mover` lands at route index `to`: the opponent pieces it
 * captures, or null if the move is blocked.
 *
 * Only one side may stand on a plain square: no two pieces share it unless
 * the newcomer captures what is there. So landing on your own piece, a
 * partner's, or an opponent of the other kind is not allowed. X squares and
 * home can always be shared.
 */
function landing(state: GameState, mover: Piece, to: number): string[] | null {
  if (to >= HOME_INDEX) return [];
  const target = cellAt(seatOf(state, mover.owner), to);
  if (!target || isSafeCell(target)) return [];
  const occupants = state.pieces.filter((p) => {
    if (p.id === mover.id || p.progress < 0 || p.progress >= HOME_INDEX) return false;
    const cell = pieceCell(state, p);
    return cell !== null && sameCell(cell, target);
  });
  if (occupants.some((p) => !canCapture(state, mover, p))) return null;
  return occupants.map((p) => p.id);
}

function destinationFor(piece: Piece, open: number): { to: number; enters: boolean } | null {
  if (piece.progress === HOME_INDEX) return null;
  if (piece.progress === YARD_INDEX) {
    const to = entryProgress(piece.kind, open);
    return to === null ? null : { to, enters: true };
  }
  const steps = stepsFor(piece.kind, open);
  if (steps === null) return null;
  const to = piece.progress + steps;
  // Exact finish: a move may not overshoot the centre.
  return to > HOME_INDEX ? null : { to, enters: false };
}

/** Indexes of held 4s that can be joined into an 8 (the first two), or null. */
function joinableFours(pending: ShellThrow[]): [number, number] | null {
  const fours = pending.map((t, i) => (t.open === 4 ? i : -1)).filter((i) => i >= 0);
  return fours.length >= 2 ? [fours[0]!, fours[1]!] : null;
}

/** All legal moves for the current player with their pending throws. */
export function legalMovesFor(state: GameState, playerIndex: number, pending: ShellThrow[]): Move[] {
  const owner = controlledPlayer(state, playerIndex);
  const moves: Move[] = [];
  // Identical throws give identical options; offer each result value once.
  const seen = new Set<number>();
  pending.forEach((result, index) => {
    if (seen.has(result.open)) return;
    seen.add(result.open);
    for (const piece of piecesOf(state, owner)) {
      const dest = destinationFor(piece, result.open);
      if (!dest) continue;
      const captures = landing(state, piece, dest.to);
      if (captures === null) continue;
      moves.push({
        id: `${piece.id}:${index}`,
        pieceId: piece.id,
        uses: [index],
        join: false,
        from: piece.progress,
        to: dest.to,
        enters: dest.enters,
        captures,
        finishes: dest.to === HOME_INDEX,
      });
    }
  });

  // Two held 4s may be joined into an 8, only to release the Mother.
  const pair = joinableFours(pending);
  const mother = piecesOf(state, owner).find((p) => p.kind === 'mother' && p.progress === YARD_INDEX);
  if (pair && mother) {
    moves.push({
      id: `${mother.id}:${pair.join('+')}`,
      pieceId: mother.id,
      uses: pair,
      join: true,
      from: YARD_INDEX,
      to: 0,
      enters: true,
      captures: [],
      finishes: false,
    });
  }
  return moves;
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

function nextPlayer(state: GameState): number {
  return (state.current + 1) % state.players.length;
}

/**
 * 4s and 8s may be kept: while every pending throw is a 4 or an 8, the player
 * can throw again first and use the kept throws afterwards, in any order.
 */
function holdAllowed(state: GameState): boolean {
  return state.bonusThrow && state.pending.length > 0 && state.pending.every((t) => earnsExtraTurn(t.open));
}

/**
 * Work out what the current player does next with their pending throws:
 * choose a move, throw again (when holding 4s), or end the turn.
 */
function settle(state: GameState, events: GameEvent[]): GameState {
  const legalMoves = legalMovesFor(state, state.current, state.pending);
  const canHold = holdAllowed(state);
  if (legalMoves.length > 0) {
    return { ...state, phase: 'awaitingMove', legalMoves, canHold, events };
  }
  // Nothing can move now, but kept 4s/8s may still be used after the next
  // throw (another 4 to join, or a move that clears the way).
  if (canHold) {
    events.push({ type: 'hold', player: state.current });
    return { ...state, phase: 'awaitingThrow', legalMoves: [], canHold: false, events };
  }
  if (state.pending.length > 0) events.push({ type: 'noMove', player: state.current });
  const cleared = { ...state, pending: [], legalMoves: [], canHold: false };
  if (state.bonusThrow) {
    events.push({ type: 'extraTurn', player: state.current });
    return { ...cleared, phase: 'awaitingThrow', bonusThrow: false, events };
  }
  return {
    ...cleared,
    current: nextPlayer(state),
    phase: 'awaitingThrow',
    bonusThrow: false,
    turn: state.turn + 1,
    events,
  };
}

/** Throw the five shells using the game's seeded RNG. */
export function throwShells(state: GameState): GameState {
  let rng = state.rng;
  const shells: boolean[] = [];
  for (let i = 0; i < SHELL_COUNT; i++) {
    const r = nextRandom(rng);
    rng = r.state;
    shells.push(r.value < 0.5);
  }
  return applyThrow({ ...state, rng }, makeThrow(shells));
}

/**
 * Apply a known throw result (used by throwShells, tests and replays).
 * Allowed when a throw is due, or mid-turn to keep 4s/8s and throw again.
 */
export function applyThrow(state: GameState, result: ShellThrow): GameState {
  const holding = state.phase === 'awaitingMove' && state.canHold;
  if (state.phase !== 'awaitingThrow' && !holding) throw new Error(`Cannot throw during ${state.phase}`);
  const events: GameEvent[] = [];
  if (holding) events.push({ type: 'hold', player: state.current });
  events.push({ type: 'throw', player: state.current, result });
  const next: GameState = {
    ...state,
    lastThrow: result,
    pending: [...state.pending, result],
    bonusThrow: earnsExtraTurn(result.open),
  };
  return settle(next, events);
}

function winnersAfter(state: GameState): number[] {
  if (state.config.mode === 'team') {
    for (const p of state.players) {
      const mate = teammateOf(state, p.index);
      if (mate !== null && isPlayerDone(state, p.index) && isPlayerDone(state, mate)) {
        return [p.index, mate].sort((a, b) => a - b);
      }
    }
    return [];
  }
  const done = state.players.find((p) => isPlayerDone(state, p.index));
  return done ? [done.index] : [];
}

/**
 * Make one of the current legal moves. `moveId` is a Move id; a piece id is
 * also accepted when that piece has exactly one option.
 */
export function applyMove(state: GameState, moveId: string): GameState {
  if (state.phase !== 'awaitingMove') throw new Error(`Cannot move during ${state.phase}`);
  let move = state.legalMoves.find((m) => m.id === moveId);
  if (!move) {
    const forPiece = state.legalMoves.filter((m) => m.pieceId === moveId);
    if (forPiece.length === 1) move = forPiece[0];
    else if (forPiece.length > 1) throw new Error(`Piece ${moveId} has several options; pass a move id`);
  }
  if (!move) throw new Error(`No legal move ${moveId}`);
  const chosen = move;

  const events: GameEvent[] = [...state.events, { type: 'move', player: state.current, move: chosen }];
  const captured = new Set(chosen.captures);
  const pieces = state.pieces.map((p) => {
    if (p.id === chosen.pieceId) return { ...p, progress: chosen.to };
    if (captured.has(p.id)) return { ...p, progress: YARD_INDEX };
    return p;
  });
  for (const id of chosen.captures) {
    const victim = state.pieces.find((p) => p.id === id);
    if (victim) events.push({ type: 'capture', player: state.current, pieceId: id, victimOwner: victim.owner });
  }
  if (chosen.finishes) events.push({ type: 'home', player: state.current, pieceId: chosen.pieceId });

  const used = new Set(chosen.uses);
  const moved: GameState = {
    ...state,
    pieces,
    pending: state.pending.filter((_, i) => !used.has(i)),
    // Reaching home, or capturing an opponent's piece, earns another throw.
    bonusThrow: state.bonusThrow || chosen.finishes || chosen.captures.length > 0,
    legalMoves: [],
    canHold: false,
    events,
  };
  const winners = winnersAfter(moved);
  if (winners.length > 0) {
    events.push({ type: 'win', winners });
    return { ...moved, phase: 'finished', pending: [], winners };
  }
  return settle(moved, events);
}
