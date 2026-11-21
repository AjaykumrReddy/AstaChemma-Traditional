import type { GameConfig, GameState, Move } from '@asta/engine';

/**
 * The guided first game: a real game against the computer where the shell
 * results are scripted, so every lesson is guaranteed to come up. Each step
 * shows a coach message and allows only the action it asks for.
 *
 * Route check (bottom player route index → square): the Child enters at 0,
 * moves 3 to (3,4); the computer's Child enters at its 0 and moves 3 to
 * (1,0), a plain square that is the bottom route's index 11 = 3 + 8, so the
 * scripted 8 lets your Child capture it.
 */

/** Open-shell counts for every throw in the guided game, in order (yours and the computer's). */
export const TUTORIAL_THROWS: readonly number[] = [
  4, // you: a Child enters
  4, // you: extra throw, kept…
  4, // you: …and joined with this 4 to release the Mother
  3, // you: Child moves 3, the Mother can't move; turn ends
  4, // computer: its Child enters
  3, // computer: its Child moves 3, next to yours
  5, // you: an 8 — your Child captures
];

/** The guided game: you (bottom) against an easy computer (top). */
export const TUTORIAL_CONFIG: GameConfig = {
  mode: 'individual',
  players: [
    { name: 'You', seat: 0 },
    { name: 'Computer 2', seat: 2, bot: 'easy' },
  ],
};

export type TutorialKey =
  | 'welcome'
  | 'pieces'
  | 'route'
  | 'throwFirst'
  | 'enterChild'
  | 'throwAgain'
  | 'keep'
  | 'join'
  | 'throwThree'
  | 'moveChild'
  | 'computer'
  | 'throwEight'
  | 'capture'
  | 'safe'
  | 'finish';

export interface TutorialStep {
  key: TutorialKey;
  /** An explanation the player reads and taps "Next" on. */
  next?: boolean;
  /** The last step: offers "Keep playing" or "Back to start". */
  finish?: boolean;
  allowThrow?: boolean;
  allowHold?: boolean;
  /** Which of the player's moves are allowed (only these glow). */
  allowMove?: (move: Move, state: GameState) => boolean;
  /** Moves on to the next step once this is true (checked when nothing is animating). */
  done?: (state: GameState) => boolean;
}

const YOU = 0;
const pieceOf = (state: GameState, move: Move) => state.pieces.find((p) => p.id === move.pieceId);
const yourChildrenOnBoard = (s: GameState) => s.pieces.filter((p) => p.owner === YOU && p.kind === 'child' && p.progress >= 0);

export const TUTORIAL_STEPS: readonly TutorialStep[] = [
  { key: 'welcome', next: true },
  { key: 'pieces', next: true },
  { key: 'route', next: true },
  { key: 'throwFirst', allowThrow: true, done: (s) => s.phase === 'awaitingMove' },
  {
    key: 'enterChild',
    allowMove: (m, s) => m.enters && pieceOf(s, m)?.kind === 'child',
    done: (s) => yourChildrenOnBoard(s).length > 0,
  },
  { key: 'throwAgain', allowThrow: true, done: (s) => s.phase === 'awaitingMove' },
  { key: 'keep', allowHold: true, done: (s) => s.pending.length === 2 },
  {
    key: 'join',
    allowMove: (m) => m.join,
    done: (s) => s.pieces.some((p) => p.owner === YOU && p.kind === 'mother' && p.progress >= 0),
  },
  { key: 'throwThree', allowThrow: true, done: (s) => s.phase === 'awaitingMove' },
  {
    key: 'moveChild',
    allowMove: (m, s) => !m.enters && pieceOf(s, m)?.kind === 'child',
    done: (s) => s.current !== YOU,
  },
  { key: 'computer', done: (s) => s.current === YOU && s.phase === 'awaitingThrow' },
  { key: 'throwEight', allowThrow: true, done: (s) => s.phase === 'awaitingMove' },
  {
    key: 'capture',
    allowMove: (m) => m.captures.length > 0,
    // Index 11 is reachable only by the capturing 8 in this script.
    done: (s) => yourChildrenOnBoard(s).some((p) => p.progress === 11),
  },
  { key: 'safe', next: true },
  { key: 'finish', finish: true },
];
