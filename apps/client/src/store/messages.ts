import type { GameEvent, GameState } from '@asta/engine';
import { isEight, stepsFor } from '@asta/engine';

function pieceLabel(state: GameState, pieceId: string): string {
  const piece = state.pieces.find((p) => p.id === pieceId);
  const owner = piece ? state.players[piece.owner]?.name ?? '' : '';
  const kind = piece?.kind === 'mother' ? 'Mother' : 'Child';
  return owner === 'You' ? `your ${kind}` : `${owner}'s ${kind}`;
}

const capitalise = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Short name of a throw: "3", or "8" for 5 open / none open. */
export function throwValue(open: number): string {
  return isEight(open) ? '8' : String(open);
}

/** What a throw allows: "Child 3 · Mother can't move". */
export function describeScore(open: number): string {
  const child = stepsFor('child', open);
  const mother = stepsFor('mother', open);
  const parts = [`Child ${child}`, mother === null ? "Mother can't move" : `Mother ${mother}`];
  if (open === 4) parts.push('Child may enter');
  if (isEight(open)) parts.push('Child enters +4 · Mother enters');
  return parts.join(' · ');
}

/** "3 open", or "0 open = 8" so the special case is obvious. */
export function describeOpen(open: number): string {
  return open === 0 ? 'None open = 8' : open === 5 ? '5 open = 8' : `${open} open`;
}

/** Turn the engine's events for one action into short, human messages. */
export function describeEvents(state: GameState, events: GameEvent[]): string[] {
  const out: string[] = [];
  const name = (i: number) => state.players[i]?.name ?? `Player ${i + 1}`;
  for (const e of events) {
    switch (e.type) {
      case 'throw':
        out.push(`${name(e.player)} threw ${throwValue(e.result.open)}`);
        break;
      case 'hold':
        out.push('Throw kept');
        break;
      case 'noMove':
        out.push('No piece can move');
        break;
      case 'move':
        if (e.move.join) out.push('4 + 4 joined: Mother released');
        break;
      case 'capture':
        out.push(`Captured ${pieceLabel(state, e.pieceId)}!`);
        break;
      case 'home':
        out.push(capitalise(`${pieceLabel(state, e.pieceId)} reached home`));
        break;
      case 'extraTurn':
        out.push('Extra throw');
        break;
      case 'win':
        out.push(`${e.winners.map(name).join(' & ')} won!`);
        break;
    }
  }
  // Keep the latest few so a long turn doesn't overflow the panel.
  return out.slice(-4);
}
