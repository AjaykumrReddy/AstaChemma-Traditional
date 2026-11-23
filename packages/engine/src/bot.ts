import { cellAt, isSafeCell, sameCell } from './board';
import {
  SHELL_COUNT,
  applyMove,
  applyThrow,
  boardOf,
  areTeammates,
  canCapture,
  controlledPlayer,
  entryProgress,
  makeThrow,
  pieceCell,
  piecesOf,
  seatOf,
  stepsFor,
  throwProbability,
} from './rules';
import { expectedTurnsToFinish } from './race';
import type { BotLevel, GameState, Move, Piece, ShellThrow } from './types';

/**
 * Chance that some opponent can land on `piece` with their next throw.
 * Pieces on safe squares, at home or in the starting area are never at risk.
 */
export function captureRisk(state: GameState, piece: Piece): number {
  const board = boardOf(state);
  if (piece.progress < 0 || piece.progress >= board.home) return 0;
  const target = pieceCell(state, piece);
  if (!target || isSafeCell(board, target)) return 0;

  let survive = 1;
  for (const other of state.pieces) {
    if (other.progress >= board.home) continue;
    if (!canCapture(state, other, piece)) continue;
    const seat = seatOf(state, other.owner);
    let hit = 0;
    for (let open = 0; open <= SHELL_COUNT; open++) {
      let dest: number | null;
      if (other.progress < 0) {
        dest = entryProgress(other.kind, open);
      } else {
        const steps = stepsFor(other.kind, open);
        dest = steps === null ? null : other.progress + steps;
      }
      if (dest === null || dest >= board.home) continue;
      const cell = cellAt(board, seat, dest);
      if (cell && sameCell(cell, target)) hit += throwProbability(open);
    }
    survive *= 1 - Math.min(hit, 1);
  }
  return 1 - survive;
}

/**
 * Expected turns one player still needs to finish, including the expected
 * set-back from pieces that could be captured on the next throw.
 */
export function playerTurnsLeft(state: GameState, owner: number, riskWeight: number): number {
  const mine = piecesOf(state, owner);
  const home = boardOf(state).home;
  const pos = ['M', 'C1', 'C2'].map((k) => mine.find((p) => p.id === `${owner}-${k}`)?.progress ?? home);
  const at = (p: number[]) => expectedTurnsToFinish(p[0]!, p[1]!, p[2]!, home);
  const base = at(pos);
  if (riskWeight === 0) return base;
  let penalty = 0;
  mine.forEach((piece) => {
    const risk = captureRisk(state, piece);
    if (risk === 0) return;
    const i = piece.kind === 'mother' ? 0 : piece.id.endsWith('C1') ? 1 : 2;
    const reset = [...pos];
    reset[i] = -1;
    penalty += risk * (at(reset) - base);
  });
  return base + riskWeight * penalty;
}

/** Expected turns a side (a player, or a team of two) needs to finish. */
function sideTurnsLeft(state: GameState, members: number[], riskWeight: number): number {
  const turns = members.map((m) => playerTurnsLeft(state, m, riskWeight));
  if (turns.length === 1) return turns[0]!;
  // A team needs both players home; a finished player helps their teammate.
  return Math.max(...turns) * 0.6 + (turns.reduce((a, b) => a + b, 0) / turns.length) * 0.4;
}

/**
 * Score a position from `player`'s side, in turns: how far ahead of the
 * opponents they are. Higher is better. `riskWeight` scales how much the
 * evaluation fears being captured on the next throw.
 */
export function evaluate(state: GameState, player: number, riskWeight: number, opponentRiskWeight = riskWeight): number {
  const sides = new Map<string, number[]>();
  for (const p of state.players) {
    const key = p.team !== undefined ? `t${p.team}` : `p${p.index}`;
    sides.set(key, [...(sides.get(key) ?? []), p.index]);
  }
  let own = 0;
  const opponents: number[] = [];
  for (const members of sides.values()) {
    const mine = members.some((m) => areTeammates(state, m, player));
    const turns = sideTurnsLeft(state, members, mine ? riskWeight : opponentRiskWeight);
    if (mine) own = turns;
    else opponents.push(turns);
  }
  if (opponents.length === 0) return -own;
  // The leading opponent matters most, the rest a little.
  const nearest = Math.min(...opponents);
  const average = opponents.reduce((a, b) => a + b, 0) / opponents.length;
  return nearest * 0.7 + average * 0.3 - own;
}

/** Noise is in turns; one good move typically gains 0.5–5 turns. */
const LEVELS: Record<BotLevel, { randomChance: number; riskWeight: number; noise: number }> = {
  easy: { randomChance: 0.5, riskWeight: 0, noise: 3 },
  medium: { randomChance: 0.05, riskWeight: 0.6, noise: 0.5 },
  hard: { randomChance: 0, riskWeight: 1, noise: 0 },
};

/** Pick a move for the current player. `random` defaults to Math.random. */
export function chooseBotMove(
  state: GameState,
  level: BotLevel,
  random: () => number = Math.random,
): Move {
  const moves = state.legalMoves;
  const first = moves[0];
  if (!first) throw new Error('Bot asked to move with no legal moves');
  if (moves.length === 1) return first;

  const params = LEVELS[level];
  if (random() < params.randomChance) {
    return moves[Math.floor(random() * moves.length)] ?? first;
  }

  let best = first;
  let bestScore = -Infinity;
  for (const move of moves) {
    const after = applyMove(state, move.id);
    let score = evaluate(after, state.current, params.riskWeight);
    if (after.phase === 'finished' && after.winners.includes(state.current)) score += 1000;
    score += (random() - 0.5) * params.noise;
    if (score > bestScore) {
      bestScore = score;
      best = move;
    }
  }
  return best;
}

export type BotAction = { type: 'move'; move: Move } | { type: 'throw' };

/**
 * The simpler computer player (Easy and Medium): take the move that looks
 * best right now, and keep a 4 only while the Mother waits to be released.
 */
export function greedyBotAction(state: GameState, level: BotLevel, random: () => number = Math.random): BotAction {
  if (state.phase === 'awaitingThrow') return { type: 'throw' };
  if (state.canHold) {
    const owner = controlledPlayer(state, state.current);
    const motherWaiting = state.pieces.some((p) => p.owner === owner && p.kind === 'mother' && p.progress < 0);
    const holds = motherWaiting && state.pending.every((t) => t.open === 4) && (level !== 'easy' || random() < 0.5);
    if (holds) return { type: 'throw' };
  }
  return { type: 'move', move: chooseBotMove(state, level, random) };
}

// ---------------------------------------------------------------------------
// Hard: look ahead through the rest of the turn
// ---------------------------------------------------------------------------

/** One representative throw for each number of open shells. */
const THROW_OUTCOMES: { result: ShellThrow; p: number }[] = Array.from({ length: SHELL_COUNT + 1 }, (_, open) => ({
  result: makeThrow(Array.from({ length: SHELL_COUNT }, (_, i) => i < open)),
  p: throwProbability(open),
}));

export interface SearchOptions {
  /**
   * How many future throws to average over. Each one multiplies the work by
   * about 6; two throws ahead can take seconds on a phone, so Hard uses one.
   */
  throwsAhead: number;
  /** How much its own pieces' capture risk counts (they face the very next throw). */
  ownRisk: number;
  /** How much opponents' capture risk counts (they face its throw only after theirs). */
  opponentRisk: number;
}

/**
 * Tuned by self-play: counting opponents' risk at half weight beat equal
 * weighting about 55–45, because opponents move before Hard throws again.
 */
export const HARD_SEARCH: SearchOptions = { throwsAhead: 1, ownRisk: 1, opponentRisk: 0.5 };

const WIN_SCORE = 1000;

/**
 * Best score `me` can reach from `state` before the turn passes on.
 * Moves are free to explore; each extra throw costs one unit of `throwsLeft`
 * and is averaged over all six results by their probability.
 */
function searchTurn(state: GameState, me: number, throwsLeft: number, opts: SearchOptions): number {
  if (state.phase === 'finished') {
    return state.winners.some((w) => areTeammates(state, w, me)) ? WIN_SCORE : -WIN_SCORE;
  }
  // The turn has passed on: judge the position as it stands.
  if (state.current !== me) return evaluate(state, me, opts.ownRisk, opts.opponentRisk);

  if (state.phase === 'awaitingMove') {
    let best = -Infinity;
    for (const move of state.legalMoves) best = Math.max(best, searchTurn(applyMove(state, move.id), me, throwsLeft, opts));
    // Keeping the 4/8 and throwing again is another option.
    if (state.canHold && throwsLeft > 0) best = Math.max(best, expectThrow(state, me, throwsLeft - 1, opts));
    return best;
  }

  // Another throw is due (an extra throw, or kept throws waiting).
  return throwsLeft > 0 ? expectThrow(state, me, throwsLeft - 1, opts) : evaluate(state, me, opts.ownRisk, opts.opponentRisk);
}

/** Average outcome of throwing now, over all six possible results. */
function expectThrow(state: GameState, me: number, throwsLeft: number, opts: SearchOptions): number {
  let total = 0;
  for (const { result, p } of THROW_OUTCOMES) total += p * searchTurn(applyThrow(state, result), me, throwsLeft, opts);
  return total;
}

/**
 * Hard: try every move, every order of kept throws, and keeping vs using a
 * 4 or 8, looking one throw ahead, and pick what leaves it furthest ahead.
 */
export function searchBotAction(state: GameState, opts: SearchOptions = HARD_SEARCH): BotAction {
  if (state.phase === 'awaitingThrow') return { type: 'throw' };
  const me = state.current;
  const first = state.legalMoves[0];
  if (!first) return { type: 'throw' };

  let best: BotAction = { type: 'move', move: first };
  let bestScore = -Infinity;
  for (const move of state.legalMoves) {
    const score = searchTurn(applyMove(state, move.id), me, opts.throwsAhead, opts);
    if (score > bestScore) {
      bestScore = score;
      best = { type: 'move', move };
    }
  }
  if (state.canHold && opts.throwsAhead > 0) {
    const holdScore = expectThrow(state, me, opts.throwsAhead - 1, opts);
    if (holdScore > bestScore) best = { type: 'throw' };
  }
  return best;
}

/**
 * What a computer player does now: throw (when a throw is due, or to keep a
 * 4 or 8 and throw again) or make a move.
 */
export function chooseBotAction(
  state: GameState,
  level: BotLevel,
  random: () => number = Math.random,
): BotAction {
  return level === 'hard' ? searchBotAction(state) : greedyBotAction(state, level, random);
}
