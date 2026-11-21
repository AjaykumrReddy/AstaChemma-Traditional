import { CENTRE, cellAt, isEight, type Cell, type GameState } from '@asta/engine';
import { boardColors, seatColors } from '../theme';
import type { HapticKind } from './haptics';

/** A short-lived visual effect drawn on the board. */
export interface BoardEffect {
  id: number;
  kind: 'capture' | 'home' | 'release' | 'enter';
  cell: Cell;
  color: string;
}

export interface Feedback {
  effects: BoardEffect[];
  haptic: HapticKind | null;
  /** Shake the board (captures). */
  shake: boolean;
}

let nextId = 1;
const id = () => nextId++;

/** Feedback for a throw of the shells: a stronger buzz for a 4 or an 8. */
export function feedbackForThrow(state: GameState): Feedback {
  const thrown = state.events.find((e) => e.type === 'throw');
  const open = thrown?.type === 'throw' ? thrown.result.open : null;
  const big = open !== null && (open === 4 || isEight(open));
  return { effects: [], haptic: big ? 'big' : 'land', shake: false };
}

/** Feedback for the move that just finished (the events after the last 'move'). */
export function feedbackForMove(state: GameState): Feedback {
  const all = state.events;
  let start = -1;
  for (let i = all.length - 1; i >= 0; i--) {
    if (all[i]!.type === 'move') {
      start = i;
      break;
    }
  }
  const events = start >= 0 ? all.slice(start) : [];
  const moveEvent = events[0];
  const result: Feedback = { effects: [], haptic: 'land', shake: false };
  if (!moveEvent || moveEvent.type !== 'move') return result;

  const move = moveEvent.move;
  const piece = state.pieces.find((p) => p.id === move.pieceId);
  if (!piece) return result;
  const seat = state.players[piece.owner]!.seat;
  const color = seatColors[seat].fill;
  const landing = cellAt(seat, move.to);

  if (move.captures.length > 0 && landing) {
    result.effects.push({ id: id(), kind: 'capture', cell: landing, color });
    result.haptic = 'capture';
    result.shake = true;
  } else if (move.finishes) {
    result.effects.push({ id: id(), kind: 'home', cell: CENTRE, color: boardColors.gold });
    result.haptic = 'success';
  } else if (move.enters && piece.kind === 'mother' && landing) {
    result.effects.push({ id: id(), kind: 'release', cell: landing, color: boardColors.gold });
    result.haptic = 'success';
  } else if (move.enters && landing) {
    result.effects.push({ id: id(), kind: 'enter', cell: landing, color });
  }

  if (events.some((e) => e.type === 'win')) result.haptic = 'success';
  return result;
}
