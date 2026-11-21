import { isEight, type GameEvent, type GameState, type Move } from '@asta/engine';

/** One line in the move history: who did what. */
export interface HistoryEntry {
  id: number;
  /** Player index (for the name and colour). */
  player: number;
  kind: 'throw' | 'move' | 'capture' | 'home' | 'release' | 'noMove' | 'hold' | 'win';
  text: string;
}

/** Keep the history short enough to save quickly and scan easily. */
export const HISTORY_LIMIT = 80;

let nextId = Date.now();

function pieceName(state: GameState, pieceId: string): string {
  return state.pieces.find((p) => p.id === pieceId)?.kind === 'mother' ? 'Mother' : 'Child';
}

function ownerName(state: GameState, pieceId: string): string {
  const owner = state.pieces.find((p) => p.id === pieceId)?.owner;
  return owner === undefined ? '' : (state.players[owner]?.name ?? '');
}

function describeMove(state: GameState, move: Move): string {
  const piece = pieceName(state, move.pieceId);
  if (move.join) return 'joined 4 + 4 to release the Mother';
  if (move.enters) return move.to > 0 ? `brought a ${piece} in and moved it ${move.to}` : `brought the ${piece} in`;
  return `moved ${piece} ${move.to - move.from}`;
}

/** History lines for a list of engine events. */
export function historyFromEvents(state: GameState, events: GameEvent[]): HistoryEntry[] {
  const out: HistoryEntry[] = [];
  const add = (player: number, kind: HistoryEntry['kind'], text: string) => out.push({ id: nextId++, player, kind, text });
  for (const e of events) {
    switch (e.type) {
      case 'throw': {
        const open = e.result.open;
        add(e.player, 'throw', isEight(open) ? `threw 8 (${open === 0 ? 'none' : 'all'} open)` : `threw ${open}`);
        break;
      }
      case 'hold':
        add(e.player, 'hold', 'kept the throw and threw again');
        break;
      case 'noMove':
        add(e.player, 'noMove', 'could not move');
        break;
      case 'move':
        add(e.player, e.move.join || (e.move.enters && pieceName(state, e.move.pieceId) === 'Mother') ? 'release' : 'move', describeMove(state, e.move));
        break;
      case 'capture': {
        const victim = ownerName(state, e.pieceId);
        add(e.player, 'capture', `captured ${victim === 'You' ? 'your' : `${victim}'s`} ${pieceName(state, e.pieceId)}`);
        break;
      }
      case 'home':
        add(e.player, 'home', `got a ${pieceName(state, e.pieceId)} home`);
        break;
      case 'win':
        e.winners.forEach((w) => add(w, 'win', 'won the game!'));
        break;
      case 'extraTurn':
        break;
    }
  }
  return out;
}

/** The events produced by the most recent move (everything from the last 'move'). */
export function lastMoveEvents(state: GameState): GameEvent[] {
  for (let i = state.events.length - 1; i >= 0; i--) {
    if (state.events[i]!.type === 'move') return state.events.slice(i);
  }
  return [];
}

/** Prepend new entries (newest first), trimmed to the limit. */
export function addHistory(history: HistoryEntry[], entries: HistoryEntry[]): HistoryEntry[] {
  if (entries.length === 0) return history;
  return [...entries.reverse(), ...history].slice(0, HISTORY_LIMIT);
}
