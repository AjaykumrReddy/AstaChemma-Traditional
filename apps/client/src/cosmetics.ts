import { DEFAULT_LOOK, type ShopKind } from '@asta/protocol';
import { useAccountStore } from './account/store';
import { boardColors } from './theme';

/**
 * The looks sold in the coin shop. Ids match SHOP_ITEMS in the protocol; the
 * server records what each player owns and uses, so it follows their account.
 */

// ---------------------------------------------------------------------------
// Boards
// ---------------------------------------------------------------------------

export type BoardPalette = typeof boardColors & {
  homeLight: string;
  homeDark: string;
  petalLight: string;
  petalDark: string;
};

export const BOARD_THEMES: Record<string, BoardPalette> = {
  /** Wooden frame, inlaid green tiles, gold detail. */
  'board.classic': { ...boardColors, homeLight: '#4A2C4F', homeDark: '#2A1830', petalLight: '#FFD9E4', petalDark: '#E89AB3' },
  /** Slate tiles under a silver frame, moonlit. */
  'board.night': {
    shadow: '#000000',
    frameLight: '#D7DCE4',
    frameMid: '#959DAB',
    frameDark: '#565E6C',
    frameEdge: '#23272F',
    grout: '#141820',
    outerTileLight: '#454E60',
    outerTileDark: '#333A49',
    innerTileLight: '#3C4456',
    innerTileDark: '#2A3040',
    gold: '#C9D4EE',
    goldLight: '#F3F6FF',
    goldDeep: '#7E89A8',
    homeLight: '#33306B',
    homeDark: '#17153A',
    petalLight: '#EEF1FF',
    petalDark: '#A9B4E0',
  },
  /** Red lacquer frame, terracotta floor, cream rangoli lines. */
  'board.festive': {
    shadow: '#000000',
    frameLight: '#D24A3A',
    frameMid: '#9C2418',
    frameDark: '#5E0F08',
    frameEdge: '#2E0503',
    grout: '#5A1A0C',
    outerTileLight: '#D9A066',
    outerTileDark: '#C2844A',
    innerTileLight: '#CC8E52',
    innerTileDark: '#AF6D34',
    gold: '#FFF1CC',
    goldLight: '#FFFFFF',
    goldDeep: '#8A4E0C',
    homeLight: '#8E1F14',
    homeDark: '#4E0B06',
    petalLight: '#FFE0EA',
    petalDark: '#F08AA8',
  },
};

// ---------------------------------------------------------------------------
// Marbles
// ---------------------------------------------------------------------------

export interface MarbleColour {
  fill: string;
  light: string;
  dark: string;
}

export interface MarbleFinish {
  /** Radial gradient stops from the lit side outwards. */
  stops: (c: MarbleColour) => { offset: number; color: string; opacity?: number }[];
  /** The bright spot. */
  highlight: { rx: number; ry: number; opacity: number };
  /** A thin rim, for a polished edge. */
  rim?: { color: string; opacity: number; width: number };
}

export const MARBLE_FINISHES: Record<string, MarbleFinish> = {
  'marbles.glass': {
    stops: (c) => [
      { offset: 0, color: c.light },
      { offset: 0.45, color: c.fill },
      { offset: 1, color: c.dark },
    ],
    highlight: { rx: 0.32, ry: 0.2, opacity: 0.55 },
  },
  'marbles.pearl': {
    stops: (c) => [
      { offset: 0, color: '#FFFFFF' },
      { offset: 0.35, color: c.light },
      { offset: 0.8, color: c.fill },
      { offset: 1, color: c.fill },
    ],
    highlight: { rx: 0.45, ry: 0.3, opacity: 0.35 },
    rim: { color: '#FFFFFF', opacity: 0.45, width: 0.07 },
  },
  'marbles.metal': {
    stops: (c) => [
      { offset: 0, color: '#FFFFFF' },
      { offset: 0.18, color: c.light },
      { offset: 0.42, color: c.fill },
      { offset: 0.75, color: c.dark },
      { offset: 0.9, color: c.fill },
      { offset: 1, color: c.dark },
    ],
    highlight: { rx: 0.18, ry: 0.11, opacity: 0.95 },
    rim: { color: '#000000', opacity: 0.35, width: 0.06 },
  },
};

// ---------------------------------------------------------------------------
// Cowries
// ---------------------------------------------------------------------------

export interface ShellStyle {
  open: string;
  back: string;
  line: string;
  /** Painted dots on the back. */
  dots?: string[];
  /** Shine on the back. */
  shine: number;
}

export const SHELL_STYLES: Record<string, ShellStyle> = {
  'shells.natural': { open: '#F6E7C8', back: '#C9A777', line: '#5B4630', shine: 0.35 },
  'shells.golden': { open: '#FFF0B8', back: '#E0AE2A', line: '#7A5208', shine: 0.6 },
  'shells.painted': { open: '#FFF4E0', back: '#B8402F', line: '#4A2412', dots: ['#FFE08A', '#FFFFFF', '#7FD1AE'], shine: 0.3 },
};

// ---------------------------------------------------------------------------

/** The look this player uses (the free defaults until they buy and choose others). */
export function useLook(): Record<ShopKind, string> {
  const equipped = useAccountStore((s) => s.profile?.equipped);
  return equipped ?? DEFAULT_LOOK;
}

export const boardTheme = (id: string | undefined) => BOARD_THEMES[id ?? ''] ?? BOARD_THEMES['board.classic']!;
export const marbleFinish = (id: string | undefined) => MARBLE_FINISHES[id ?? ''] ?? MARBLE_FINISHES['marbles.glass']!;
export const shellStyle = (id: string | undefined) => SHELL_STYLES[id ?? ''] ?? SHELL_STYLES['shells.natural']!;
