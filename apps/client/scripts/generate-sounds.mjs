/**
 * Synthesises the game's sound effects as small mono WAV files in
 * assets/sounds. Everything is generated from code (no third-party audio),
 * and a fixed random seed makes the output identical on every run.
 *
 *   node scripts/generate-sounds.mjs
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RATE = 22050;
const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'sounds');

let seed = 20261121;
/** Start a sound's random grains from its own number, so editing one sound never changes another. */
const reseed = (n) => {
  seed = n;
};
const rand = () => {
  seed = (seed * 1103515245 + 12345) % 2147483648;
  return seed / 2147483648;
};

const buffer = (seconds) => new Float32Array(Math.ceil(seconds * RATE));

/** Add a tone with an attack and exponential decay. `harmonics` gives a bell or wood colour. */
function tone(buf, { at = 0, freq, endFreq = freq, length, gain = 0.5, decay = 6, attack = 0.004, harmonics = [[1, 1]] }) {
  const start = Math.floor(at * RATE);
  const n = Math.floor(length * RATE);
  let phase = 0;
  for (let i = 0; i < n && start + i < buf.length; i++) {
    const t = i / RATE;
    const f = freq + (endFreq - freq) * (i / n);
    phase += (2 * Math.PI * f) / RATE;
    const env = Math.min(1, t / attack) * Math.exp(-decay * t);
    let s = 0;
    for (const [mult, amp] of harmonics) s += Math.sin(phase * mult) * amp;
    buf[start + i] += s * env * gain;
  }
}

/** Add a short burst of filtered noise: a click, tap or rattle grain. */
function click(buf, { at = 0, length = 0.012, gain = 0.5, brightness = 0.6, decay = 300 }) {
  const start = Math.floor(at * RATE);
  const n = Math.floor(length * RATE);
  let lp = 0;
  for (let i = 0; i < n && start + i < buf.length; i++) {
    const t = i / RATE;
    lp += brightness * ((rand() * 2 - 1) - lp); // one-pole low-pass
    buf[start + i] += lp * Math.exp(-decay * t) * gain;
  }
}

function writeWav(name, buf, peak = 0.85) {
  // Normalise, then soft-fade the last few milliseconds to avoid clicks.
  let max = 0;
  for (const v of buf) max = Math.max(max, Math.abs(v));
  const scale = max > 0 ? peak / max : 1;
  const fade = Math.floor(0.006 * RATE);
  const data = Buffer.alloc(buf.length * 2);
  for (let i = 0; i < buf.length; i++) {
    const tail = Math.min(1, (buf.length - i) / fade);
    const v = Math.max(-1, Math.min(1, buf[i] * scale * tail));
    data.writeInt16LE(Math.round(v * 32767), i * 2);
  }
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + data.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(1, 22); // mono
  header.writeUInt32LE(RATE, 24);
  header.writeUInt32LE(RATE * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(data.length, 40);
  writeFileSync(join(OUT, `${name}.wav`), Buffer.concat([header, data]));
  console.log(`${name}.wav  ${(buf.length / RATE).toFixed(2)}s`);
}

const WOOD = [[1, 1], [2.7, 0.35], [5.4, 0.12]];
const BELL = [[1, 1], [2.0, 0.4], [3.0, 0.2], [4.2, 0.12]];
const note = (semitonesFromA4) => 440 * 2 ** (semitonesFromA4 / 12);

mkdirSync(OUT, { recursive: true });

/** Air rushing past: noise that swells and fades, darker as it goes. */
function whoosh(buf, { at = 0, length = 0.3, gain = 0.3, brightness = 0.25 }) {
  const start = Math.floor(at * RATE);
  const n = Math.floor(length * RATE);
  let lp = 0;
  for (let i = 0; i < n && start + i < buf.length; i++) {
    const x = i / n;
    const env = Math.sin(Math.PI * x) ** 2;
    lp += brightness * (1 - 0.6 * x) * ((rand() * 2 - 1) - lp);
    buf[start + i] += lp * env * gain;
  }
}

// The toss: a quick rattle in the cupped hand, then the shells whoosh through the air.
{
  reseed(101);
  const b = buffer(0.5);
  for (let i = 0; i < 14; i++) {
    const at = rand() * 0.16;
    click(b, { at, length: 0.018, gain: 0.25 + rand() * 0.3, brightness: 0.35 + rand() * 0.4, decay: 200 + rand() * 200 });
    tone(b, { at, freq: 1800 + rand() * 1600, length: 0.025, gain: 0.07, decay: 130, harmonics: WOOD });
  }
  whoosh(b, { at: 0.12, length: 0.36, gain: 0.5, brightness: 0.22 });
  writeWav('shake', b, 0.6);
}

// Shells landing on a cloth mat, one after another: a soft thud and a bright
// shell click each, a little bounce, and a short slide as they settle.
{
  reseed(202);
  const b = buffer(0.55);
  let at = 0.005;
  for (let i = 0; i < 5; i++) {
    const g = 0.75 + rand() * 0.25;
    click(b, { at, length: 0.035, gain: 0.55 * g, brightness: 0.12, decay: 90 }); // the thud on cloth
    tone(b, { at, freq: 210 + rand() * 70, endFreq: 150, length: 0.07, gain: 0.35 * g, decay: 45, harmonics: [[1, 1], [2, 0.25]] });
    click(b, { at: at + 0.002, length: 0.012, gain: 0.4 * g, brightness: 0.75, decay: 420 }); // the shell itself
    tone(b, { at, freq: 1500 + rand() * 1100, length: 0.05, gain: 0.14 * g, decay: 90, harmonics: WOOD });
    // A small hop, then it slides to rest.
    const hop = at + 0.05 + rand() * 0.03;
    click(b, { at: hop, length: 0.01, gain: 0.18 * g, brightness: 0.6, decay: 500 });
    click(b, { at: hop + 0.01, length: 0.06 + rand() * 0.05, gain: 0.07 * g, brightness: 0.4, decay: 35 });
    at += 0.025 + rand() * 0.045;
  }
  writeWav('land', b, 0.75);
}

// A piece tapping onto a square: a small wooden knock.
{
  reseed(303);
  const b = buffer(0.09);
  click(b, { length: 0.01, gain: 0.5, brightness: 0.7, decay: 500 });
  tone(b, { freq: 820, endFreq: 760, length: 0.08, gain: 0.6, decay: 55, harmonics: WOOD });
  writeWav('hop', b, 0.5);
}

// Selecting a piece: a soft, high tick.
{
  const b = buffer(0.06);
  tone(b, { freq: 1500, length: 0.05, gain: 0.5, decay: 90, harmonics: [[1, 1], [2, 0.2]] });
  writeWav('select', b, 0.4);
}

// Capture: a heavy thud with a falling tone.
{
  reseed(404);
  const b = buffer(0.5);
  click(b, { length: 0.08, gain: 0.9, brightness: 0.18, decay: 40 });
  tone(b, { freq: 180, endFreq: 60, length: 0.45, gain: 0.9, decay: 7, harmonics: [[1, 1], [2, 0.3]] });
  tone(b, { at: 0.02, freq: 520, endFreq: 260, length: 0.25, gain: 0.25, decay: 12, harmonics: WOOD });
  writeWav('capture', b, 0.9);
}

// Reaching home: a rising three-note bell chime.
{
  const b = buffer(1.0);
  [3, 7, 10, 15].forEach((s, i) => tone(b, { at: i * 0.09, freq: note(s + 12), length: 0.85 - i * 0.09, gain: 0.45, decay: 4.5, harmonics: BELL }));
  writeWav('home', b, 0.8);
}

// Mother released: a bright upward sweep into a chord.
{
  const b = buffer(0.9);
  tone(b, { freq: note(3), endFreq: note(15), length: 0.22, gain: 0.35, decay: 2, harmonics: [[1, 1], [2, 0.3]] });
  [15, 19, 22].forEach((s) => tone(b, { at: 0.2, freq: note(s), length: 0.65, gain: 0.35, decay: 4, harmonics: BELL }));
  writeWav('release', b, 0.8);
}

// A 4 or an 8 (extra throw): a cheerful two-note ping.
{
  const b = buffer(0.4);
  tone(b, { freq: note(10), length: 0.2, gain: 0.5, decay: 12, harmonics: BELL });
  tone(b, { at: 0.09, freq: note(17), length: 0.3, gain: 0.5, decay: 9, harmonics: BELL });
  writeWav('bonus', b, 0.65);
}

// Nothing can move: a soft falling pair of low notes.
{
  const b = buffer(0.42);
  tone(b, { freq: note(-2), length: 0.2, gain: 0.5, decay: 9, harmonics: [[1, 1], [2, 0.2]] });
  tone(b, { at: 0.14, freq: note(-7), length: 0.28, gain: 0.5, decay: 8, harmonics: [[1, 1], [2, 0.2]] });
  writeWav('nomove', b, 0.45);
}

// Winning: an arpeggio fanfare ending on a held chord.
{
  reseed(505);
  const b = buffer(1.9);
  [3, 7, 10, 15].forEach((s, i) => tone(b, { at: i * 0.13, freq: note(s), length: 0.4, gain: 0.45, decay: 5, harmonics: BELL }));
  [15, 19, 22, 27].forEach((s) => tone(b, { at: 0.55, freq: note(s), length: 1.3, gain: 0.3, decay: 2.2, harmonics: BELL }));
  for (let i = 0; i < 10; i++) click(b, { at: 0.55 + rand() * 0.9, length: 0.01, gain: 0.15, brightness: 0.9, decay: 600 });
  writeWav('win', b, 0.85);
}
