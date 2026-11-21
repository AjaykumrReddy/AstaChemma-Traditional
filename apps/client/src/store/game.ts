import {
  applyMove,
  createGame,
  randomSeed,
  throwShells as engineThrow,
  type GameConfig,
  type GameState,
} from '@asta/engine';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { feedbackForMove, feedbackForThrow, type BoardEffect, type Feedback } from '../feedback/effects';
import { haptic } from '../feedback/haptics';
import { playSound, playSoundAfter, setSoundEnabled } from '../feedback/sounds';
import { addHistory, historyFromEvents, lastMoveEvents, type HistoryEntry } from './history';
import { describeEvents } from './messages';

export type Speed = 'slow' | 'normal' | 'fast';

/** Every game timing, per speed setting (milliseconds). */
export interface Timings {
  /** Shells tumbling before the result shows. */
  roll: number;
  /** One square of a piece's walk (and its hop animation). */
  step: number;
  /** A computer player's pause before throwing. */
  botThrow: number;
  /** A computer player's pause before moving. */
  botMove: number;
  /** Pause before an automatic single-choice move. */
  autoMove: number;
}

export const TIMINGS: Record<Speed, Timings> = {
  slow: { roll: 900, step: 280, botThrow: 1150, botMove: 950, autoMove: 700 },
  normal: { roll: 650, step: 190, botThrow: 750, botMove: 600, autoMove: 450 },
  fast: { roll: 400, step: 115, botThrow: 380, botMove: 300, autoMove: 230 },
};

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
  /** Everything that happened this game, newest first. */
  history: HistoryEntry[];
  /** Move automatically when a throw allows only one distinct move. */
  autoMove: boolean;
  speed: Speed;
  sound: boolean;
  /** Short-lived effects on the board (bursts, shockwaves). */
  effects: BoardEffect[];
  /** Bumped to shake the board. */
  shakeKey: number;
  /** True once the saved game (if any) has been loaded from the device. */
  hydrated: boolean;

  startGame(config: GameConfig): void;
  removeEffect(id: number): void;
  restart(): void;
  quit(): void;
  throwShells(): void;
  select(pieceId: string | null): void;
  /** Make a legal move, by Move id. */
  move(moveId: string): void;
  setAutoMove(on: boolean): void;
  setSpeed(speed: Speed): void;
  setSound(on: boolean): void;
}

// Incremented on every new game so stale timers from an old game do nothing.
let generation = 0;

/** What is saved on the device: enough to resume exactly where the game stopped. */
type SavedGame = Pick<GameStore, 'config' | 'game' | 'history' | 'autoMove' | 'speed' | 'sound'>;

/** Bump when the saved shape changes in a way old saves can't be read. */
const SAVE_VERSION = 1;

/** A light sanity check so a corrupt or outdated save never crashes the app. */
function isGameState(value: unknown): value is GameState {
  const g = value as Partial<GameState> | null;
  return (
    !!g &&
    Array.isArray(g.players) &&
    Array.isArray(g.pieces) &&
    Array.isArray(g.pending) &&
    Array.isArray(g.legalMoves) &&
    typeof g.current === 'number' &&
    typeof g.phase === 'string'
  );
}

const isSpeed = (v: unknown): v is Speed => v === 'slow' || v === 'normal' || v === 'fast';

export const useGameStore = create<GameStore>()(
  persist(
    (set, get) => {
      const timings = () => TIMINGS[get().speed];

      /** Show effects, shake, vibrate and play sounds for something that just happened. */
      const play = (feedback: Feedback) => {
        if (feedback.haptic) haptic(feedback.haptic);
        feedback.sounds.forEach((s) => (s.delay ? playSoundAfter(s.name, s.delay) : playSound(s.name)));
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
        history: [],
        autoMove: true,
        speed: 'normal',
        sound: true,
        effects: [],
        shakeKey: 0,
        hydrated: false,

        startGame(config) {
          generation++;
          set({
            config,
            game: createGame(config, randomSeed()),
            rolling: false,
            animation: null,
            selected: null,
            messages: ['Throw the shells to begin'],
            history: [],
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
          set({ game: null, rolling: false, animation: null, selected: null, messages: [], history: [], effects: [] });
        },

        throwShells() {
          const { game, rolling, animation } = get();
          if (!game || rolling || animation) return;
          // A throw is due, or the player keeps their 4/8 and throws again.
          const canThrow = game.phase === 'awaitingThrow' || (game.phase === 'awaitingMove' && game.canHold);
          if (!canThrow) return;
          const gen = generation;
          set({ rolling: true, selected: null });
          playSound('shake');
          setTimeout(() => {
            if (gen !== generation) return;
            const current = get().game;
            if (!current) return;
            const next = engineThrow(current);
            set((s) => ({
              game: next,
              rolling: false,
              messages: describeEvents(next, next.events),
              history: addHistory(s.history, historyFromEvents(next, next.events)),
            }));
            play(feedbackForThrow(next));
          }, timings().roll);
        },

        select(pieceId) {
          if (pieceId) {
            haptic('tap');
            playSound('select');
          }
          set({ selected: pieceId });
        },

        move(moveId) {
          const { game, animation } = get();
          if (!game || game.phase !== 'awaitingMove' || animation) return;
          const move = game.legalMoves.find((m) => m.id === moveId);
          if (!move) return;
          const pieceId = move.pieceId;
          const after = applyMove(game, moveId);
          const stepMs = timings().step;

          const finish = () => {
            const gen = generation;
            set((s) => ({
              game: after,
              animation: null,
              selected: null,
              messages: describeEvents(after, after.events),
              history: addHistory(s.history, historyFromEvents(after, lastMoveEvents(after))),
            }));
            // Celebrate as the piece touches down on its last square.
            setTimeout(() => {
              if (gen !== generation) return;
              playSound('hop');
              play(feedbackForMove(after));
            }, stepMs * 0.8);
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
            playSound('hop');
            setTimeout(tick, stepMs);
          };
          setTimeout(tick, stepMs);
        },

        setAutoMove(on) {
          set({ autoMove: on });
        },

        setSpeed(speed) {
          set({ speed });
        },

        setSound(on) {
          setSoundEnabled(on);
          set({ sound: on });
        },
      };
    },
    {
      name: 'asta-chemma/saved-game',
      version: SAVE_VERSION,
      storage: createJSONStorage(() => AsyncStorage),
      // Only the game and settings are saved, never animations, effects or rolls in progress.
      partialize: (s): SavedGame => ({
        config: s.config,
        game: s.game,
        history: s.history,
        autoMove: s.autoMove,
        speed: s.speed,
        sound: s.sound,
      }),
      // A save from an incompatible version is dropped rather than risking a crash.
      migrate: (): SavedGame => ({ config: null, game: null, history: [], autoMove: true, speed: 'normal', sound: true }),
      merge: (persisted, current) => {
        const saved = (persisted ?? {}) as Partial<SavedGame>;
        const game = isGameState(saved.game) ? saved.game : null;
        const sound = typeof saved.sound === 'boolean' ? saved.sound : current.sound;
        setSoundEnabled(sound);
        return {
          ...current,
          game,
          config: game ? (saved.config ?? game.config) : null,
          history: game && Array.isArray(saved.history) ? saved.history : [],
          autoMove: typeof saved.autoMove === 'boolean' ? saved.autoMove : current.autoMove,
          speed: isSpeed(saved.speed) ? saved.speed : current.speed,
          sound,
          messages: game ? ['Welcome back'] : current.messages,
        };
      },
      onRehydrateStorage: () => () => useGameStore.setState({ hydrated: true }),
    },
  ),
);

/** The current timings, for components (bot pauses, piece glide speed). */
export function useTimings(): Timings {
  return TIMINGS[useGameStore((s) => s.speed)];
}

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
