/**
 * Writes the app icon artwork as SVG files in assets/icon-src. They are then
 * rendered to the PNGs in assets/ (any SVG renderer at the listed sizes works;
 * see the README). The design is the game board in miniature: a wooden frame
 * around a 3x3 grid with gold-X tiles, the lotus at home, two marbles and a
 * cowrie shell, in the same colours as the in-game board.
 *
 *   node scripts/generate-icons.mjs
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'icon-src');
const SIZE = 1024;
const C = SIZE / 2;

const col = {
  bgLight: '#2F6152',
  bgDark: '#132A24',
  frameLight: '#B07A43',
  frameMid: '#7A4E26',
  frameDark: '#4A2E15',
  frameEdge: '#2E1B0B',
  grout: '#163028',
  tileLight: '#3B7563',
  tileDark: '#2B5C4D',
  homeLight: '#4F2F55',
  homeDark: '#2A1830',
  gold: '#E9C977',
  goldLight: '#FFF0C2',
  goldDeep: '#A87F32',
  petalPink: '#F2B3C6',
  shellOpen: '#F6E7C8',
  shellLine: '#5B4630',
};

const f = (n) => Number(n.toFixed(2));

/** A pointed petal from radius r0 to r1 along `angle` around (cx, cy). */
function petal(cx, cy, angle, r0, r1, width) {
  const ux = Math.cos(angle);
  const uy = Math.sin(angle);
  const vx = -uy;
  const vy = ux;
  const rm = (r0 + r1) / 2;
  const p0 = [cx + ux * r0, cy + uy * r0];
  const p1 = [cx + ux * r1, cy + uy * r1];
  const q1 = [cx + ux * rm + vx * width, cy + uy * rm + vy * width];
  const q2 = [cx + ux * rm - vx * width, cy + uy * rm - vy * width];
  return `M ${f(p0[0])} ${f(p0[1])} Q ${f(q1[0])} ${f(q1[1])} ${f(p1[0])} ${f(p1[1])} Q ${f(q2[0])} ${f(q2[1])} ${f(p0[0])} ${f(p0[1])} Z`;
}

const defs = `
  <defs>
    <radialGradient id="bg" cx="50%" cy="42%" r="75%">
      <stop offset="0" stop-color="${col.bgLight}"/>
      <stop offset="1" stop-color="${col.bgDark}"/>
    </radialGradient>
    <linearGradient id="frame" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${col.frameLight}"/>
      <stop offset="0.5" stop-color="${col.frameMid}"/>
      <stop offset="1" stop-color="${col.frameDark}"/>
    </linearGradient>
    <linearGradient id="sheen" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#fff" stop-opacity="0.28"/>
      <stop offset="0.5" stop-color="#fff" stop-opacity="0"/>
    </linearGradient>
    <linearGradient id="tile" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${col.tileLight}"/>
      <stop offset="1" stop-color="${col.tileDark}"/>
    </linearGradient>
    <radialGradient id="home" cx="50%" cy="50%" r="70%">
      <stop offset="0" stop-color="${col.homeLight}"/>
      <stop offset="1" stop-color="${col.homeDark}"/>
    </radialGradient>
    <linearGradient id="petal" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${col.goldLight}"/>
      <stop offset="1" stop-color="${col.gold}"/>
    </linearGradient>
    <radialGradient id="disc" cx="35%" cy="35%" r="70%">
      <stop offset="0" stop-color="${col.goldLight}"/>
      <stop offset="1" stop-color="${col.goldDeep}"/>
    </radialGradient>
    <radialGradient id="yellow" cx="35%" cy="30%" r="75%">
      <stop offset="0" stop-color="#FFF1B8"/><stop offset="0.45" stop-color="#F2C94C"/><stop offset="1" stop-color="#9A7A12"/>
    </radialGradient>
    <radialGradient id="red" cx="35%" cy="30%" r="75%">
      <stop offset="0" stop-color="#FFB4B6"/><stop offset="0.45" stop-color="#E5484D"/><stop offset="1" stop-color="#8C1D21"/>
    </radialGradient>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="14" stdDeviation="16" flood-color="#000" flood-opacity="0.45"/>
    </filter>
    <filter id="soft" x="-30%" y="-30%" width="160%" height="160%">
      <feDropShadow dx="4" dy="8" stdDeviation="6" flood-color="#000" flood-opacity="0.4"/>
    </filter>
  </defs>`;

/**
 * The board emblem, `span` pixels wide, centred on the canvas.
 * `mono` draws a single-colour silhouette for Android themed icons.
 */
function emblem(span, { mono = false, shell = true } = {}) {
  const frame = span;
  const border = frame * 0.085;
  const x0 = C - frame / 2;
  const y0 = C - frame / 2;
  const inner = frame - border * 2;
  const cell = inner / 3;
  const gap = cell * 0.06;
  const parts = [];

  if (mono) {
    // Frame ring, tile outlines, X marks, lotus and marbles in solid white.
    const w = '#FFFFFF';
    parts.push(`<rect x="${f(x0)}" y="${f(y0)}" width="${f(frame)}" height="${f(frame)}" rx="${f(frame * 0.09)}" fill="none" stroke="${w}" stroke-width="${f(border * 0.9)}"/>`);
    for (let r = 0; r < 3; r++)
      for (let c = 0; c < 3; c++) {
        const x = x0 + border + c * cell + gap;
        const y = y0 + border + r * cell + gap;
        const s = cell - gap * 2;
        parts.push(`<rect x="${f(x)}" y="${f(y)}" width="${f(s)}" height="${f(s)}" rx="${f(s * 0.1)}" fill="none" stroke="${w}" stroke-width="${f(cell * 0.05)}"/>`);
      }
    const cc = C;
    for (let i = 0; i < 8; i++) parts.push(`<path d="${petal(cc, cc, (i * Math.PI) / 4, cell * 0.06, cell * 0.42, cell * 0.11)}" fill="${w}"/>`);
    for (const [cx, cy] of [[x0 + border + cell * 0.5, y0 + border + cell * 2.5], [x0 + border + cell * 2.5, y0 + border + cell * 0.5]])
      parts.push(`<circle cx="${f(cx)}" cy="${f(cy)}" r="${f(cell * 0.3)}" fill="${w}"/>`);
    return parts.join('\n  ');
  }

  // Wooden frame.
  parts.push(`<g filter="url(#shadow)"><rect x="${f(x0)}" y="${f(y0)}" width="${f(frame)}" height="${f(frame)}" rx="${f(frame * 0.09)}" fill="url(#frame)" stroke="${col.frameEdge}" stroke-width="${f(frame * 0.008)}"/></g>`);
  parts.push(`<rect x="${f(x0)}" y="${f(y0)}" width="${f(frame)}" height="${f(frame)}" rx="${f(frame * 0.09)}" fill="url(#sheen)"/>`);
  parts.push(`<rect x="${f(x0 + border - gap)}" y="${f(y0 + border - gap)}" width="${f(inner + gap * 2)}" height="${f(inner + gap * 2)}" rx="${f(cell * 0.12)}" fill="${col.grout}" stroke="${col.gold}" stroke-width="${f(frame * 0.007)}" stroke-opacity="0.85"/>`);

  // Tiles: corners plain, edges with the gold X, centre is home with the lotus.
  for (let r = 0; r < 3; r++)
    for (let c = 0; c < 3; c++) {
      const x = x0 + border + c * cell + gap;
      const y = y0 + border + r * cell + gap;
      const s = cell - gap * 2;
      const centre = r === 1 && c === 1;
      parts.push(`<rect x="${f(x)}" y="${f(y)}" width="${f(s)}" height="${f(s)}" rx="${f(s * 0.12)}" fill="url(#${centre ? 'home' : 'tile'})"/>`);
      parts.push(`<rect x="${f(x + s * 0.06)}" y="${f(y + s * 0.04)}" width="${f(s * 0.88)}" height="${f(s * 0.06)}" rx="${f(s * 0.03)}" fill="#fff" fill-opacity="0.08"/>`);
      const edge = (r + c) % 2 === 1;
      if (edge) {
        const i = s * 0.2;
        parts.push(`<path d="M ${f(x + i)} ${f(y + i)} L ${f(x + s - i)} ${f(y + s - i)} M ${f(x + s - i)} ${f(y + i)} L ${f(x + i)} ${f(y + s - i)}" stroke="${col.gold}" stroke-width="${f(s * 0.07)}" stroke-linecap="round" stroke-opacity="0.9"/>`);
        parts.push(`<circle cx="${f(x + s / 2)}" cy="${f(y + s / 2)}" r="${f(s * 0.07)}" fill="${col.goldLight}" stroke="${col.goldDeep}" stroke-width="${f(s * 0.02)}"/>`);
      }
    }

  // Lotus at home.
  const outer = Array.from({ length: 8 }, (_, i) => (i * Math.PI) / 4);
  for (const a of outer) parts.push(`<path d="${petal(C, C, a, cell * 0.06, cell * 0.42, cell * 0.1)}" fill="url(#petal)" stroke="${col.goldDeep}" stroke-width="${f(cell * 0.012)}"/>`);
  for (const a of outer) parts.push(`<path d="${petal(C, C, a + Math.PI / 8, cell * 0.05, cell * 0.3, cell * 0.075)}" fill="${col.petalPink}" stroke="${col.goldDeep}" stroke-width="${f(cell * 0.01)}"/>`);
  parts.push(`<circle cx="${C}" cy="${C}" r="${f(cell * 0.1)}" fill="url(#disc)" stroke="${col.goldDeep}" stroke-width="${f(cell * 0.015)}"/>`);

  // Two glass marbles on corner tiles.
  const marble = (cx, cy, grad, mother) => {
    const r = cell * 0.3;
    const out = [
      `<g filter="url(#soft)"><circle cx="${f(cx)}" cy="${f(cy)}" r="${f(r)}" fill="url(#${grad})"/></g>`,
      `<ellipse cx="${f(cx - r * 0.32)}" cy="${f(cy - r * 0.42)}" rx="${f(r * 0.32)}" ry="${f(r * 0.2)}" fill="#fff" fill-opacity="0.6"/>`,
    ];
    if (mother) out.push(`<circle cx="${f(cx)}" cy="${f(cy)}" r="${f(r * 0.45)}" fill="none" stroke="#fff" stroke-opacity="0.92" stroke-width="${f(r * 0.18)}"/>`);
    return out.join('');
  };
  parts.push(marble(x0 + border + cell * 0.5, y0 + border + cell * 2.5, 'yellow', true));
  parts.push(marble(x0 + border + cell * 2.5, y0 + border + cell * 0.5, 'red', false));

  // A cowrie shell resting on the frame's bottom-right corner, open side up.
  if (shell) {
    const sx = x0 + frame * 0.91;
    const sy = y0 + frame * 0.91;
    const rx = frame * 0.095;
    const ry = frame * 0.13;
    // Short teeth either side of a thin slit, like a real cowrie's mouth.
    const teeth = [-0.5, -0.3, -0.1, 0.1, 0.3, 0.5]
      .map((t) => {
        const y = t * ry * 1.25;
        return `<path d="M ${f(-rx * 0.07)} ${f(y)} L ${f(-rx * 0.24)} ${f(y)} M ${f(rx * 0.07)} ${f(y)} L ${f(rx * 0.24)} ${f(y)}" stroke="${col.shellLine}" stroke-width="${f(rx * 0.075)}" stroke-linecap="round" stroke-opacity="0.85"/>`;
      })
      .join('');
    parts.push(
      `<defs><radialGradient id="shellBody" cx="40%" cy="35%" r="70%">` +
        `<stop offset="0" stop-color="#FFF8E6"/><stop offset="0.6" stop-color="${col.shellOpen}"/><stop offset="1" stop-color="#C9A777"/>` +
        `</radialGradient></defs>` +
        `<g transform="translate(${f(sx)} ${f(sy)}) rotate(-28)" filter="url(#soft)">` +
        // Egg-shaped body: rounder at the top, narrower at the bottom.
        `<path d="M 0 ${f(-ry)} C ${f(rx * 1.15)} ${f(-ry)}, ${f(rx * 1.05)} ${f(ry * 0.85)}, 0 ${f(ry)} C ${f(-rx * 1.05)} ${f(ry * 0.85)}, ${f(-rx * 1.15)} ${f(-ry)}, 0 ${f(-ry)} Z" fill="url(#shellBody)" stroke="${col.shellLine}" stroke-width="${f(rx * 0.06)}"/>` +
        `<path d="M 0 ${f(-ry * 0.78)} C ${f(rx * 0.12)} ${f(-ry * 0.3)}, ${f(-rx * 0.12)} ${f(ry * 0.3)}, 0 ${f(ry * 0.8)}" stroke="${col.shellLine}" stroke-width="${f(rx * 0.1)}" fill="none" stroke-linecap="round"/>` +
        teeth +
        `<ellipse cx="${f(-rx * 0.45)}" cy="${f(-ry * 0.45)}" rx="${f(rx * 0.18)}" ry="${f(ry * 0.12)}" fill="#fff" fill-opacity="0.55"/>` +
        `</g>`,
    );
  }
  return parts.join('\n  ');
}

const svg = (body, background = '') =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}">${defs}\n  ${background}\n  ${body}\n</svg>\n`;

const fullBackground = `<rect width="${SIZE}" height="${SIZE}" fill="url(#bg)"/>`;

const files = {
  // iOS / general icon: full-bleed, no transparency.
  'icon.svg': svg(emblem(SIZE * 0.66), fullBackground),
  // Android adaptive icon: the whole board, corners included, must sit inside the
  // central safe circle (66 of 108 dp), so its half-diagonal stays under 30.5%.
  'android-icon-foreground.svg': svg(emblem(SIZE * 0.41)),
  'android-icon-background.svg': svg('', fullBackground),
  'android-icon-monochrome.svg': svg(emblem(SIZE * 0.41, { mono: true })),
  // Splash: the emblem on a transparent background (the splash colour fills behind it).
  'splash-icon.svg': svg(emblem(SIZE * 0.78)),
};

mkdirSync(OUT, { recursive: true });
for (const [name, content] of Object.entries(files)) {
  writeFileSync(join(OUT, name), content);
  console.log(`assets/icon-src/${name}`);
}
