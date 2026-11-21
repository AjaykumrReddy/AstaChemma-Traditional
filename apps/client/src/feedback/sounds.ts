import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';

// Bundled audio assets are loaded with require() so Metro includes them.
const SOURCES = {
  shake: require('../../assets/sounds/shake.wav'),
  land: require('../../assets/sounds/land.wav'),
  hop: require('../../assets/sounds/hop.wav'),
  select: require('../../assets/sounds/select.wav'),
  capture: require('../../assets/sounds/capture.wav'),
  home: require('../../assets/sounds/home.wav'),
  release: require('../../assets/sounds/release.wav'),
  bonus: require('../../assets/sounds/bonus.wav'),
  nomove: require('../../assets/sounds/nomove.wav'),
  win: require('../../assets/sounds/win.wav'),
} as const;

export type SoundName = keyof typeof SOURCES;

/** Relative loudness, so frequent sounds (hops) stay in the background. */
const VOLUME: Record<SoundName, number> = {
  shake: 0.7,
  land: 0.8,
  hop: 0.45,
  select: 0.5,
  capture: 1,
  home: 0.9,
  release: 0.9,
  bonus: 0.7,
  nomove: 0.6,
  win: 1,
};

const players: Partial<Record<SoundName, AudioPlayer>> = {};
let enabled = true;
let configured = false;

function configure() {
  if (configured) return;
  configured = true;
  // Mix with the player's own music, and respect the iPhone silent switch.
  setAudioModeAsync({ playsInSilentMode: false, interruptionMode: 'mixWithOthers' }).catch(() => {});
}

export function setSoundEnabled(on: boolean): void {
  enabled = on;
  if (!on) Object.values(players).forEach((p) => p?.pause());
}

/** Play a sound effect from the start. Never throws: sound must not break the game. */
export function playSound(name: SoundName): void {
  if (!enabled) return;
  try {
    configure();
    let player = players[name];
    if (!player) {
      player = createAudioPlayer(SOURCES[name]);
      player.volume = VOLUME[name];
      players[name] = player;
      player.play();
      return;
    }
    const p = player;
    p.seekTo(0)
      .then(() => p.play())
      .catch(() => {});
  } catch {
    // Audio unavailable (e.g. blocked by the browser before a tap): stay silent.
  }
}

/** Play a sound a little later, e.g. a chime after the landing thud. */
export function playSoundAfter(name: SoundName, delayMs: number): void {
  setTimeout(() => playSound(name), delayMs);
}
