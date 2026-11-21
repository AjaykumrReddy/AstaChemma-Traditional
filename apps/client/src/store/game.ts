import {
  applyMove,
  applyThrow,
  createGame,
  makeThrow,
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
import type { Lang } from '../i18n/strings';
import { TUTORIAL_CONFIG, TUTORIAL_THROWS } from '../tutorial/steps';

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
  /**
   * A note shown instead of the last action's events: at the start of a game,
   * or after resuming one. Messages are built from events at display time so
   * they always follow the current language.
   */
  note: 'start' | 'welcome' | null;
  /** Move automatically when a throw allows only one distinct move. */
  autoMove: boolean;
  speed: Speed;
  sound: boolean;
  language: Lang;
  /** Show a shape per player on marbles and markers, for colour-blind players. */
  markers: boolean;
  /** Short-lived effects on the board (bursts, shockwaves). */
  effects: BoardEffect[];
  /** Bumped to shake the board. */
  shakeKey: number;
  /** True once the saved game (if any) has been loaded from the device. */
  hydrated: boolean;
  /** The guided first game in progress: which step, and how many scripted throws are used. */
  tutorial: { step: number; throwIndex: number } | null;
  /** The player's own game, set aside while the guided game runs (and saved in its place). */
  stash: { config: GameConfig | null; game: GameState | null } | null;
  /** The player has finished or skipped the guided game once. */
  tutorialDone: boolean;
  /**
   * The game as it was before each recent human decision (newest last), for
   * Undo. Kept in memory only, so it adds nothing to the saved game.
   */
  undoStack: GameState[];

  startGame(config: GameConfig): void;
  startTutorial(): void;
  nextTutorialStep(): void;
  /** Leave the guided game: keep playing it as a normal game, or restore the player's own game. */
  endTutorial(keepPlaying: boolean): void;
  removeEffect(id: number): void;
  restart(): void;
  quit(): void;
  throwShells(): void;
  select(pieceId: string | null): void;
  /**
   * Make a legal move, by Move id. `forced` marks moves the app made for the
   * player (auto-move with a single choice); Undo skips past those.
   */
  move(moveId: string, forced?: boolean): void;
  /** Take back the last human decision (and any computer turns since). */
  undo(): void;
  setAutoMove(on: boolean): void;
  setSpeed(speed: Speed): void;
  setSound(on: boolean): void;
  setLanguage(language: Lang): void;
  setMarkers(on: boolean): void;
}

// Incremented on every new game so stale timers from an old game do nothing.
let generation = 0;

/** How many decisions Undo can take back in a row. */
const UNDO_LIMIT = 30;

/** What is saved on the device: enough to resume exactly where the game stopped. */
type SavedGame = Pick<GameStore, 'config' | 'game' | 'autoMove' | 'speed' | 'sound' | 'language' | 'markers' | 'tutorialDone'>;

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

      /**
       * Remember the game before a human decision, so Undo can return to it.
       * Not in the guided game, and not for computer players.
       */
      const snapshot = (game: GameState) => {
        const { tutorial } = get();
        if (tutorial || game.players[game.current]?.bot) return;
        set((s) => ({ undoStack: [...s.undoStack, game].slice(-UNDO_LIMIT) }));
      };

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
        note: null,
        autoMove: true,
        speed: 'normal',
        sound: true,
        language: 'en',
        markers: false,
        effects: [],
        shakeKey: 0,
        hydrated: false,
        tutorial: null,
        stash: null,
        tutorialDone: false,
        undoStack: [],

        startGame(config) {
          generation++;
          set({
            config,
            game: createGame(config, randomSeed()),
            rolling: false,
            animation: null,
            selected: null,
            note: 'start',
            effects: [],
            tutorial: null,
            stash: null,
            undoStack: [],
          });
        },

        startTutorial() {
          generation++;
          const { config, game, stash } = get();
          set({
            // Keep the player's own game safe (unless one is already set aside).
            stash: stash ?? { config, game },
            config: TUTORIAL_CONFIG,
            game: createGame(TUTORIAL_CONFIG, randomSeed()),
            rolling: false,
            animation: null,
            selected: null,
            note: null,
            effects: [],
            tutorial: { step: 0, throwIndex: 0 },
            undoStack: [],
          });
        },

        nextTutorialStep() {
          set((s) => (s.tutorial ? { tutorial: { ...s.tutorial, step: s.tutorial.step + 1 } } : s));
        },

        endTutorial(keepPlaying) {
          const { stash } = get();
          if (keepPlaying) {
            // The guided game becomes the player's game.
            set({ tutorial: null, stash: null, tutorialDone: true });
            return;
          }
          generation++;
          set({
            tutorial: null,
            stash: null,
            tutorialDone: true,
            config: stash?.config ?? null,
            game: stash?.game ?? null,
            rolling: false,
            animation: null,
            selected: null,
            effects: [],
            note: stash?.game ? 'welcome' : null,
            undoStack: [],
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
          set({ game: null, rolling: false, animation: null, selected: null, note: null, effects: [], undoStack: [] });
        },

        throwShells() {
          const { game, rolling, animation } = get();
          if (!game || rolling || animation) return;
          // A throw is due, or the player keeps their 4/8 and throws again.
          const canThrow = game.phase === 'awaitingThrow' || (game.phase === 'awaitingMove' && game.canHold);
          if (!canThrow) return;
          // Keeping a 4/8 is a decision Undo can take back.
          if (game.phase === 'awaitingMove') snapshot(game);
          const gen = generation;
          set({ rolling: true, selected: null });
          playSound('shake');
          setTimeout(() => {
            if (gen !== generation) return;
            const { game: current, tutorial } = get();
            if (!current) return;
            // The guided game uses scripted results until its script runs out.
            const scripted = tutorial ? TUTORIAL_THROWS[tutorial.throwIndex] : undefined;
            const next =
              scripted === undefined
                ? engineThrow(current)
                : applyThrow(current, makeThrow(Array.from({ length: 5 }, (_, i) => i < scripted)));
            set({
              game: next,
              rolling: false,
              note: null,
              tutorial: tutorial && scripted !== undefined ? { ...tutorial, throwIndex: tutorial.throwIndex + 1 } : tutorial,
            });
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

        move(moveId, forced = false) {
          const { game, animation } = get();
          if (!game || game.phase !== 'awaitingMove' || animation) return;
          const move = game.legalMoves.find((m) => m.id === moveId);
          if (!move) return;
          if (!forced) snapshot(game);
          const pieceId = move.pieceId;
          const after = applyMove(game, moveId);
          const stepMs = timings().step;

          const finish = () => {
            const gen = generation;
            set({
              game: after,
              animation: null,
              selected: null,
              note: null,
            });
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

        undo() {
          const { undoStack, rolling, animation, tutorial } = get();
          const previous = undoStack[undoStack.length - 1];
          if (!previous || rolling || animation || tutorial) return;
          // Stop anything still in flight from the moves being undone.
          generation++;
          playSound('select');
          haptic('tap');
          set({
            game: previous,
            undoStack: undoStack.slice(0, -1),
            selected: null,
            effects: [],
            note: null,
          });
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

        setLanguage(language) {
          set({ language });
        },

        setMarkers(on) {
          set({ markers: on });
        },
      };
    },
    {
      name: 'asta-chemma/saved-game',
      version: SAVE_VERSION,
      storage: createJSONStorage(() => AsyncStorage),
      // Only the game and settings are saved, never animations, effects or rolls in progress.
      // During the guided game the player's own game is saved, not the guided one.
      partialize: (s): SavedGame => ({
        config: s.stash ? s.stash.config : s.config,
        game: s.stash ? s.stash.game : s.game,
        tutorialDone: s.tutorialDone,
        autoMove: s.autoMove,
        speed: s.speed,
        sound: s.sound,
        language: s.language,
        markers: s.markers,
      }),
      // A save from an incompatible version is dropped rather than risking a crash.
      migrate: (): SavedGame => ({
        config: null,
        game: null,
        autoMove: true,
        speed: 'normal',
        sound: true,
        language: 'en',
        markers: false,
        tutorialDone: false,
      }),
      merge: (persisted, current) => {
        const saved = (persisted ?? {}) as Partial<SavedGame>;
        const game = isGameState(saved.game) ? saved.game : null;
        const sound = typeof saved.sound === 'boolean' ? saved.sound : current.sound;
        setSoundEnabled(sound);
        return {
          ...current,
          game,
          config: game ? (saved.config ?? game.config) : null,
          autoMove: typeof saved.autoMove === 'boolean' ? saved.autoMove : current.autoMove,
          speed: isSpeed(saved.speed) ? saved.speed : current.speed,
          sound,
          language: saved.language === 'te' || saved.language === 'en' ? saved.language : current.language,
          tutorialDone: saved.tutorialDone === true,
          markers: saved.markers === true,
          note: game ? 'welcome' : current.note,
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
