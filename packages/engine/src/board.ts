/**
 * Board geometry for the 5×5 Asta Chemma board.
 *
 * Coordinates are [row, col] with row 0 at the top and col 0 at the left,
 * as seen by the player sitting at the bottom (seat 0).
 */

export const BOARD_SIZE = 5;

export type Seat = 0 | 1 | 2 | 3;

/** Seat names in turn order. Turns pass counter-clockwise: bottom → right → top → left. */
export const SEAT_NAMES: Record<Seat, 'bottom' | 'right' | 'top' | 'left'> = {
  0: 'bottom',
  1: 'right',
  2: 'top',
  3: 'left',
};

export interface Cell {
  row: number;
  col: number;
}

export const CENTRE: Cell = { row: 2, col: 2 };

/** X-marked squares. Pieces on these cannot be captured. The centre is also home. */
export const SAFE_CELLS: readonly Cell[] = [
  { row: 0, col: 2 },
  { row: 2, col: 0 },
  { row: 2, col: 2 },
  { row: 2, col: 4 },
  { row: 4, col: 2 },
];

/**
 * Route for the bottom player, from the player's route drawing:
 * enter on own X, go counter-clockwise round the outer ring (16 squares),
 * then clockwise round the inner ring (8 squares), then the centre.
 */
const BOTTOM_ROUTE: readonly Cell[] = [
  // outer ring, counter-clockwise
  { row: 4, col: 2 }, // 0 – entry (safe)
  { row: 4, col: 3 },
  { row: 4, col: 4 },
  { row: 3, col: 4 },
  { row: 2, col: 4 }, // 4 – safe
  { row: 1, col: 4 },
  { row: 0, col: 4 },
  { row: 0, col: 3 },
  { row: 0, col: 2 }, // 8 – safe
  { row: 0, col: 1 },
  { row: 0, col: 0 },
  { row: 1, col: 0 },
  { row: 2, col: 0 }, // 12 – safe
  { row: 3, col: 0 },
  { row: 4, col: 0 },
  { row: 4, col: 1 }, // 15 – last outer square
  // inner ring, clockwise
  { row: 3, col: 1 }, // 16
  { row: 2, col: 1 },
  { row: 1, col: 1 },
  { row: 1, col: 2 },
  { row: 1, col: 3 },
  { row: 2, col: 3 },
  { row: 3, col: 3 },
  { row: 3, col: 2 }, // 23
  // home
  { row: 2, col: 2 }, // 24 – centre
];

/** Path index of the centre. A piece at this index is home. */
export const HOME_INDEX = BOTTOM_ROUTE.length - 1; // 24

/** Path index meaning "waiting in the starting area, not on the board". */
export const YARD_INDEX = -1;

/** Rotate a cell 90° so the bottom player's geometry maps to the next seat (counter-clockwise). */
function rotateToNextSeat(cell: Cell): Cell {
  return { row: BOARD_SIZE - 1 - cell.col, col: cell.row };
}

function rotate(cell: Cell, times: number): Cell {
  let c = cell;
  for (let i = 0; i < times; i++) c = rotateToNextSeat(c);
  return c;
}

const ROUTES: Record<Seat, readonly Cell[]> = {
  0: BOTTOM_ROUTE,
  1: BOTTOM_ROUTE.map((c) => rotate(c, 1)),
  2: BOTTOM_ROUTE.map((c) => rotate(c, 2)),
  3: BOTTOM_ROUTE.map((c) => rotate(c, 3)),
};

/** The full route (entry square … centre) for a seat. */
export function routeFor(seat: Seat): readonly Cell[] {
  return ROUTES[seat];
}

/** Board cell for a piece at `progress` along `seat`'s route, or null if in the yard. */
export function cellAt(seat: Seat, progress: number): Cell | null {
  if (progress < 0 || progress > HOME_INDEX) return null;
  return ROUTES[seat][progress] ?? null;
}

export function sameCell(a: Cell, b: Cell): boolean {
  return a.row === b.row && a.col === b.col;
}

export function isSafeCell(cell: Cell): boolean {
  return SAFE_CELLS.some((s) => sameCell(s, cell));
}

export function cellKey(cell: Cell): string {
  return `${cell.row},${cell.col}`;
}
