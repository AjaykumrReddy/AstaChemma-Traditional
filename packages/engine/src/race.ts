import { HOME_INDEX } from './board';
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
 */

const SPAN = HOME_INDEX + 2; // positions -1 … 24
const KINDS: readonly PieceKind[] = ['mother', 'child', 'child'];

function encode(m: number, c1: number, c2: number): number {
  return (m + 1) * SPAN * SPAN + (c1 + 1) * SPAN + (c2 + 1);
}

function destination(kind: PieceKind, progress: number, open: number): number | null {
  if (progress >= HOME_INDEX) return null;
  const to = progress < 0 ? entryProgress(kind, open) : (() => {
    const steps = stepsFor(kind, open);
    return steps === null ? null : progress + steps;
  })();
  return to === null || to > HOME_INDEX ? null : to;
}

let table: Float64Array | null = null;

function solve(): Float64Array {
  const values = new Float64Array(SPAN * SPAN * SPAN);
  const states: [number, number, number][] = [];
  for (let m = -1; m <= HOME_INDEX; m++)
    for (let a = -1; a <= HOME_INDEX; a++)
      for (let b = -1; b <= HOME_INDEX; b++) states.push([m, a, b]);
  states.sort((x, y) => y[0] + y[1] + y[2] - (x[0] + x[1] + x[2]));

  for (const pos of states) {
    if (pos[0] === HOME_INDEX && pos[1] === HOME_INDEX && pos[2] === HOME_INDEX) continue;
    let stuck = 0;
    let total = 0;
    for (let open = 0; open <= SHELL_COUNT; open++) {
      const p = throwProbability(open);
      const cost = earnsExtraTurn(open) ? 0 : 1;
      let best = Infinity;
      for (let i = 0; i < 3; i++) {
        const to = destination(KINDS[i]!, pos[i]!, open);
        if (to === null) continue;
        const next: [number, number, number] = [pos[0], pos[1], pos[2]];
        next[i] = to;
        // Reaching home also earns another throw.
        const moveCost = to === HOME_INDEX ? 0 : cost;
        best = Math.min(best, moveCost + values[encode(next[0], next[1], next[2])]!);
      }
      if (best === Infinity) {
        stuck += p;
        total += p * cost;
      } else {
        total += p * best;
      }
    }
    values[encode(pos[0], pos[1], pos[2])] = total / (1 - stuck);
  }
  return values;
}

/**
 * Expected turns for one player to finish from these positions.
 * `mother`, `child1`, `child2` are route indices (-1 = starting area, 24 = home).
 */
export function expectedTurnsToFinish(mother: number, child1: number, child2: number): number {
  table ??= solve();
  return table[encode(mother, child1, child2)]!;
}
