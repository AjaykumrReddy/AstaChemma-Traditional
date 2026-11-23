import { SHELL_COUNT, earnsExtraTurn, entryProgress, stepsFor, throwProbability } from './rules';
import type { PieceKind } from './types';

/**
 * Exact solution of the solo race: for every position of one player's
 * (Mother, Child, Child), the expected number of turns needed to bring all
 * three home when playing optimally and ignoring opponents.
 *
 * Every move strictly increases total progress, so one backward pass in order
 * of decreasing progress solves it; the only cycles are "nothing could move"
 * self-loops, which are solved in closed form. Throws of 4/5, and moves that
 * bring a piece home, cost no turn because they earn another throw.
 *
 * Each route length (24 steps on 5×5, 48 on 7×7) has its own table, solved
 * the first time it's needed.
 */

const KINDS: readonly PieceKind[] = ['mother', 'child', 'child'];

/** Index into the table for a route ending at `home` (positions -1 … home). */
function encode(home: number, m: number, c1: number, c2: number): number {
  const span = home + 2;
  return (m + 1) * span * span + (c1 + 1) * span + (c2 + 1);
}

function destination(home: number, kind: PieceKind, progress: number, open: number): number | null {
  if (progress >= home) return null;
  const to = progress < 0 ? entryProgress(kind, open) : (() => {
    const steps = stepsFor(kind, open);
    return steps === null ? null : progress + steps;
  })();
  return to === null || to > home ? null : to;
}

const tables = new Map<number, Float64Array>();

function solve(home: number): Float64Array {
  const span = home + 2;
  const values = new Float64Array(span * span * span);
  const states: [number, number, number][] = [];
  for (let m = -1; m <= home; m++)
    for (let a = -1; a <= home; a++)
      for (let b = -1; b <= home; b++) states.push([m, a, b]);
  states.sort((x, y) => y[0] + y[1] + y[2] - (x[0] + x[1] + x[2]));

  for (const pos of states) {
    if (pos[0] === home && pos[1] === home && pos[2] === home) continue;
    let stuck = 0;
    let total = 0;
    for (let open = 0; open <= SHELL_COUNT; open++) {
      const p = throwProbability(open);
      const cost = earnsExtraTurn(open) ? 0 : 1;
      let best = Infinity;
      for (let i = 0; i < 3; i++) {
        const to = destination(home, KINDS[i]!, pos[i]!, open);
        if (to === null) continue;
        const next: [number, number, number] = [pos[0], pos[1], pos[2]];
        next[i] = to;
        // Reaching home also earns another throw.
        const moveCost = to === home ? 0 : cost;
        best = Math.min(best, moveCost + values[encode(home, next[0], next[1], next[2])]!);
      }
      if (best === Infinity) {
        stuck += p;
        total += p * cost;
      } else {
        total += p * best;
      }
    }
    values[encode(home, pos[0], pos[1], pos[2])] = total / (1 - stuck);
  }
  return values;
}

/**
 * Expected turns for one player to finish from these positions.
 * `mother`, `child1`, `child2` are route indices (-1 = starting area, `home` = home:
 * 24 on the 5×5 board, 48 on 7×7).
 */
export function expectedTurnsToFinish(mother: number, child1: number, child2: number, home = 24): number {
  let table = tables.get(home);
  if (!table) tables.set(home, (table = solve(home)));
  return table[encode(home, mother, child1, child2)]!;
}
