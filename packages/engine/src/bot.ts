import { HOME_INDEX, cellAt, isSafeCell, sameCell } from './board';
import {
  SHELL_COUNT,
  applyMove,
  areTeammates,
  canCapture,
  controlledPlayer,
  entryProgress,
  pieceCell,
  piecesOf,
  seatOf,
  stepsFor,
  throwProbability,
} from './rules';
import { expectedTurnsToFinish } from './race';
import type { BotLevel, GameState, Move, Piece } from './types';

/**
 * Chance that some opponent can land on `piece` with their next throw.
 * Pieces on safe squares, at home or in the starting area are never at risk.
 */
export function captureRisk(state: GameState, piece: Piece): number {
  if (piece.progress < 0 || piece.progress >= HOME_INDEX) return 0;
  const target = pieceCell(state, piece);
  if (!target || isSafeCell(target)) return 0;

  let survive = 1;
  for (const other of state.pieces) {
    if (other.progress >= HOME_INDEX) continue;
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
      if (dest === null || dest >= HOME_INDEX) continue;
      const cell = cellAt(seat, dest);
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
  const pos = ['M', 'C1', 'C2'].map((k) => mine.find((p) => p.id === `${owner}-${k}`)?.progress ?? HOME_INDEX);
  const at = (p: number[]) => expectedTurnsToFinish(p[0]!, p[1]!, p[2]!);
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
export function evaluate(state: GameState, player: number, riskWeight: number): number {
  const sides = new Map<string, number[]>();
  for (const p of state.players) {
    const key = p.team !== undefined ? `t${p.team}` : `p${p.index}`;
    sides.set(key, [...(sides.get(key) ?? []), p.index]);
  }
  let own = 0;
  const opponents: number[] = [];
  for (const members of sides.values()) {
    const turns = sideTurnsLeft(state, members, riskWeight);
    if (members.some((m) => areTeammates(state, m, player))) own = turns;
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
 * What a computer player does now: throw (when a throw is due, or to keep a
 * held 4 while its Mother waits to be released) or make a move.
 */
export function chooseBotAction(
  state: GameState,
  level: BotLevel,
  random: () => number = Math.random,
): BotAction {
  if (state.phase === 'awaitingThrow') return { type: 'throw' };
  if (state.canHold) {
    const owner = controlledPlayer(state, state.current);
    const motherWaiting = state.pieces.some((p) => p.owner === owner && p.kind === 'mother' && p.progress < 0);
    // Holding costs nothing (the 4 can still be used after the next throw)
    // and is the only way a 4 can help release the Mother.
    const holds = motherWaiting && (level !== 'easy' || random() < 0.5);
    if (holds) return { type: 'throw' };
  }
  return { type: 'move', move: chooseBotMove(state, level, random) };
}
