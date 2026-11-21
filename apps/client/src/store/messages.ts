import type { GameEvent, GameState } from '@asta/engine';
import { isEight, stepsFor } from '@asta/engine';
import { isDefaultYou, type Strings } from '../i18n/strings';

/** Short name of a throw: "3", or "8" for 5 open / none open. */
export function throwValue(open: number): string {
  return isEight(open) ? '8' : String(open);
}

/** What a throw allows: "Child 3 · Mother can't move". */
export function describeScore(t: Strings, open: number): string {
  const child = stepsFor('child', open);
  const mother = stepsFor('mother', open);
  const parts = [t.moveBy(t.piece.child, child ?? 0), mother === null ? t.motherCantMove : t.moveBy(t.piece.mother, mother)];
  if (open === 4) parts.push(t.childMayEnter);
  if (isEight(open)) parts.push(t.eightEntries);
  return parts.join(' · ');
}

/** "3 open", or "None open = 8" so the special cases are obvious. */
export function describeOpen(t: Strings, open: number): string {
  return open === 0 ? t.noneOpenEight : open === 5 ? t.allOpenEight : t.open(open);
}

function pieceLabel(t: Strings, state: GameState, pieceId: string): string {
  const piece = state.pieces.find((p) => p.id === pieceId);
  const owner = piece ? (state.players[piece.owner]?.name ?? '') : '';
  return t.pieceOf(owner, t.piece[piece?.kind ?? 'child'], isDefaultYou(owner));
}

/** Turn the engine's events for one action into short, human messages. */
export function describeEvents(t: Strings, state: GameState, events: GameEvent[]): string[] {
  const out: string[] = [];
  const name = (i: number) => state.players[i]?.name ?? t.player(i + 1);
  for (const e of events) {
    switch (e.type) {
      case 'throw':
        out.push(t.threw(name(e.player), throwValue(e.result.open)));
        break;
      case 'hold':
        out.push(t.throwKept);
        break;
      case 'noMove':
        out.push(t.noMove);
        break;
      case 'move':
        if (e.move.join) out.push(t.joined);
        break;
      case 'capture':
        out.push(t.captured(pieceLabel(t, state, e.pieceId)));
        break;
      case 'home':
        out.push(t.reachedHome(pieceLabel(t, state, e.pieceId)));
        break;
      case 'extraTurn':
        out.push(t.extraThrow);
        break;
      case 'win':
        out.push(t.wonShort(e.winners.map(name).join(' & ')));
        break;
    }
  }
  // Keep the latest few so a long turn doesn't overflow the panel.
  return out.slice(-4);
}
