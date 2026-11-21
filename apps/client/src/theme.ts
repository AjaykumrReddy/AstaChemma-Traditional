import type { Seat } from '@asta/engine';

/** Chalk-on-green palette, after the traditional chalk-drawn board. */
export const colors = {
  background: '#1E3A33',
  surface: '#28493F',
  surfaceRaised: '#325A4E',
  board: '#2E5A4D',
  chalk: '#F1EFE6',
  chalkDim: 'rgba(241, 239, 230, 0.55)',
  chalkFaint: 'rgba(241, 239, 230, 0.18)',
  text: '#F7F5EE',
  textMuted: '#B9C9C2',
  accent: '#F2C94C',
  danger: '#FF8A80',
  highlight: '#FFE58A',
  shellOpen: '#F6E7C8',
  shellBack: '#C9A777',
  shellLine: '#5B4630',
};

/** The game board: a wooden frame around inlaid green tiles with gold detailing. */
export const boardColors = {
  shadow: '#000000',
  frameLight: '#A8743F',
  frameMid: '#7A4E26',
  frameDark: '#4A2E15',
  frameEdge: '#2E1B0B',
  grout: '#163028',
  outerTileLight: '#3B7563',
  outerTileDark: '#2B5C4D',
  innerTileLight: '#31665A',
  innerTileDark: '#224C40',
  gold: '#E9C977',
  goldLight: '#FFF0C2',
  goldDeep: '#A87F32',
};

/** Glass-marble colours per seat: bottom, right, top, left. */
export const seatColors: Record<Seat, { fill: string; light: string; dark: string }> = {
  0: { fill: '#F2C94C', light: '#FFF1B8', dark: '#9A7A12' },
  1: { fill: '#E5484D', light: '#FFB4B6', dark: '#8C1D21' },
  2: { fill: '#3E7BFA', light: '#B7CEFF', dark: '#173E94' },
  3: { fill: '#30A46C', light: '#B2EBCB', dark: '#14583A' },
};

export const radius = { sm: 8, md: 12, lg: 18, pill: 999 };
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };
