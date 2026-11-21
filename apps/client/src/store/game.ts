import {
  applyMove,
  createGame,
  randomSeed,
  throwShells as engineThrow,
  type GameConfig,
  type GameState,
} from '@asta/engine';
import { create } from 'zustand';
import { feedbackForMove, feedbackForThrow, type BoardEffect, type Feedback } from '../feedback/effects';
import { haptic } from '../feedback/haptics';
import { describeEvents } from './messages';

const ROLL_MS = 650;
/** Time per square when a piece walks its route; pieces glide over the same time. */
export const STEP_MS = 190;

/** A move being animated square by square before the new state is shown. */
export interface MoveAnimation {
  /** State before the move; drawn while the animation runs. */
  before: GameState;
  /** State after the move; shown when the animation ends. */
  after: GameState;
  pieceId: string;
  /** Route index the moving piece is currently drawn at. */
  step: number;
}

interface GameStore {
  config: GameConfig | null;
  game: GameState | null;
  rolling: boolean;
  animation: MoveAnimation | null;
  selected: string | null;
  messages: string[];
  /** Move automatically when a throw allows only one distinct move. */
  autoMove: boolean;
  /** Short-lived effects on the board (bursts, shockwaves). */
  effects: BoardEffect[];
  /** Bumped to shake the board. */
  shakeKey: number;

  startGame(config: GameConfig): void;
  removeEffect(id: number): void;
  restart(): void;
  quit(): void;
  throwShells(): void;
  select(pieceId: string | null): void;
  /** Make a legal move, by Move id. */
  move(moveId: string): void;
  setAutoMove(on: boolean): void;
}

// Incremented on every new game so stale timers from an old game do nothing.
let generation = 0;

export const useGameStore = create<GameStore>((set, get) => {
  /** Show effects, a shake and a vibration for something that just happened. */
  const play = (feedback: Feedback) => {
    if (feedback.haptic) haptic(feedback.haptic);
    set((s) => ({
      effects: feedback.effects.length ? [...s.effects, ...feedback.effects] : s.effects,
      shakeKey: feedback.shake ? s.shakeKey + 1 : s.shakeKey,
    }));
  };

  return {
  config: null,
  game: null,
  rolling: false,
  animation: null,
  selected: null,
  messages: [],
  autoMove: true,
  effects: [],
  shakeKey: 0,

  startGame(config) {
    generation++;
    set({
      config,
      game: createGame(config, randomSeed()),
      rolling: false,
      animation: null,
      selected: null,
      messages: ['Throw the shells to begin'],
      effects: [],
    });
  },

  removeEffect(id) {
    set((s) => ({ effects: s.effects.filter((e) => e.id !== id) }));
  },

  restart() {
    const { config } = get();
    if (config) get().startGame(config);
  },

  quit() {
    generation++;
    set({ game: null, rolling: false, animation: null, selected: null, messages: [], effects: [] });
  },

  throwShells() {
    const { game, rolling, animation } = get();
    if (!game || rolling || animation) return;
    // A throw is due, or the player keeps their 4 and throws again.
    const canThrow = game.phase === 'awaitingThrow' || (game.phase === 'awaitingMove' && game.canHold);
    if (!canThrow) return;
    const gen = generation;
    set({ rolling: true, selected: null });
    setTimeout(() => {
      if (gen !== generation) return;
      const current = get().game;
      if (!current) return;
      const next = engineThrow(current);
      set({ game: next, rolling: false, messages: describeEvents(next, next.events) });
      play(feedbackForThrow(next));
    }, ROLL_MS);
  },

  select(pieceId) {
    if (pieceId) haptic('tap');
    set({ selected: pieceId });
  },

  move(moveId) {
    const { game, animation } = get();
    if (!game || game.phase !== 'awaitingMove' || animation) return;
    const move = game.legalMoves.find((m) => m.id === moveId);
    if (!move) return;
    const pieceId = move.pieceId;
    const after = applyMove(game, moveId);
    const finish = () => {
      const gen = generation;
      set({
        game: after,
        animation: null,
        selected: null,
        messages: describeEvents(after, after.events),
      });
      // Celebrate as the piece touches down on its last square.
      setTimeout(() => {
        if (gen === generation) play(feedbackForMove(after));
      }, STEP_MS * 0.8);
    };

    // Entering pieces appear on their entry square, then walk any bonus steps.
    const start = move.enters ? 0 : move.from;
    if (start === move.to) {
      finish();
      return;
    }
    const gen = generation;
    set({ animation: { before: game, after, pieceId, step: start }, selected: null });
    const tick = () => {
      if (gen !== generation) return;
      const anim = get().animation;
      if (!anim) return;
      if (anim.step + 1 >= move.to) {
        finish();
        return;
      }
      set({ animation: { ...anim, step: anim.step + 1 } });
      setTimeout(tick, STEP_MS);
    };
    setTimeout(tick, STEP_MS);
  },

  setAutoMove(on) {
    set({ autoMove: on });
  },
  };
});

/** The state to draw: mid-animation positions while a move is animating. */
export function displayState(game: GameState, animation: MoveAnimation | null): GameState {
  if (!animation) return game;
  return {
    ...animation.before,
    phase: 'awaitingThrow',
    legalMoves: [],
    pieces: animation.before.pieces.map((p) =>
      p.id === animation.pieceId ? { ...p, progress: animation.step } : p,
    ),
  };
}
