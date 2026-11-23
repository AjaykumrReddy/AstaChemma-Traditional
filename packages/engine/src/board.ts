/**
 * Board geometry: the 5×5 and 7×7 Asta Chemma boards.
 *
 * Coordinates are [row, col] with row 0 at the top and col 0 at the left,
 * as seen by the player sitting at the bottom (seat 0).
 */

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

export type BoardId = '5x5' | '7x7';

export const BOARD_IDS: readonly BoardId[] = ['5x5', '7x7'];

/** The board games use when none is chosen (games saved before 7×7 existed). */
export const DEFAULT_BOARD: BoardId = '5x5';

export interface Board {
  id: BoardId;
  /** Squares per side. */
  size: number;
  centre: Cell;
  /** X-marked squares: pieces on these can't be captured, and anyone may share them. The centre is one. */
  safe: readonly Cell[];
  /** Route index of the centre: a piece here is home. */
  home: number;
  /** Each seat's route, entry square … centre. */
  routes: Record<Seat, readonly Cell[]>;
}

/** Route index meaning "waiting in the starting area, not on the board". */
export const YARD_INDEX = -1;

/**
 * The squares of ring `k` (0 = outermost) counter-clockwise as the bottom
 * player sees it, starting at the middle of its bottom side: right along the
 * bottom, up the right side, left along the top, down the left side, and back
 * along the bottom.
 */
function ringCounterClockwise(size: number, k: number): Cell[] {
  const lo = k;
  const hi = size - 1 - k;
  const mid = (size - 1) / 2;
  const cells: Cell[] = [];
  for (let c = mid; c < hi; c++) cells.push({ row: hi, col: c });
  for (let r = hi; r > lo; r--) cells.push({ row: r, col: hi });
  for (let c = hi; c > lo; c--) cells.push({ row: lo, col: c });
  for (let r = lo; r < hi; r++) cells.push({ row: r, col: lo });
  for (let c = lo; c < mid; c++) cells.push({ row: hi, col: c });
  return cells;
}

/**
 * The bottom player's route on a board of `size` squares: enter on the middle
 * of the bottom side, round the outer ring counter-clockwise, then each ring
 * further in, alternating direction (the next ring starts on the square just
 * inside where the last one ended), and finally the centre, one square at a
 * time (the last ring's first square may be passed twice to get there).
 */
function bottomRoute(size: number): Cell[] {
  const route: Cell[] = [];
  const rings = (size - 1) / 2;
  let lastRingStart = 0;
  for (let k = 0; k < rings; k++) {
    lastRingStart = route.length;
    let ring = ringCounterClockwise(size, k);
    if (k % 2 === 1) ring = [ring[0]!, ...ring.slice(1).reverse()]; // clockwise
    if (k > 0) {
      // Start just inside (above) where the previous ring ended.
      const last = route[route.length - 1]!;
      const start = ring.findIndex((c) => c.row === last.row - 1 && c.col === last.col);
      ring = [...ring.slice(start), ...ring.slice(0, start)];
    }
    route.push(...ring);
  }
  const mid = (size - 1) / 2;
  // Into the centre square by square, never diagonally: if the last ring ends
  // beside a corner of the centre (as on 7×7), step back onto that ring's first
  // square, which is just below the centre, and go up from there.
  const last = route[route.length - 1]!;
  if (Math.abs(last.row - mid) + Math.abs(last.col - mid) !== 1) route.push(route[lastRingStart]!);
  route.push({ row: mid, col: mid });
  return route;
}

/** Rotate a cell 90° so the bottom player's geometry maps to the next seat (counter-clockwise). */
function rotateToNextSeat(cell: Cell, size: number): Cell {
  return { row: size - 1 - cell.col, col: cell.row };
}

function rotate(cell: Cell, times: number, size: number): Cell {
  let c = cell;
  for (let i = 0; i < times; i++) c = rotateToNextSeat(c, size);
  return c;
}

function makeBoard(id: BoardId, size: number, safe: Cell[]): Board {
  const bottom = bottomRoute(size);
  const mid = (size - 1) / 2;
  return {
    id,
    size,
    centre: { row: mid, col: mid },
    safe,
    home: bottom.length - 1,
    routes: {
      0: bottom,
      1: bottom.map((c) => rotate(c, 1, size)),
      2: bottom.map((c) => rotate(c, 2, size)),
      3: bottom.map((c) => rotate(c, 3, size)),
    },
  };
}

export const BOARDS: Record<BoardId, Board> = {
  // 24 steps: outer ring (16) counter-clockwise, inner ring (8) clockwise, centre.
  // X squares: the middle of each side, and the centre.
  '5x5': makeBoard('5x5', 5, [
    { row: 0, col: 2 },
    { row: 2, col: 0 },
    { row: 2, col: 2 },
    { row: 2, col: 4 },
    { row: 4, col: 2 },
  ]),
  // 49 steps: outer ring (24) counter-clockwise, middle ring (16) clockwise,
  // inner ring (8) counter-clockwise, back onto the square below the centre
  // (visited twice), then up into the centre. X squares: the middle of each
  // outer side, the four corners of the middle ring, and the centre.
  '7x7': makeBoard('7x7', 7, [
    { row: 0, col: 3 },
    { row: 3, col: 0 },
    { row: 3, col: 6 },
    { row: 6, col: 3 },
    { row: 1, col: 1 },
    { row: 1, col: 5 },
    { row: 5, col: 1 },
    { row: 5, col: 5 },
    { row: 3, col: 3 },
  ]),
};

/** The board for an id (anything unknown or missing is the default 5×5). */
export function boardFor(id: BoardId | string | undefined | null): Board {
  return BOARDS[id as BoardId] ?? BOARDS[DEFAULT_BOARD];
}

export function isBoardId(value: unknown): value is BoardId {
  return typeof value === 'string' && (BOARD_IDS as readonly string[]).includes(value);
}

/** Board cell for a piece at `progress` along `seat`'s route, or null if in the yard. */
export function cellAt(board: Board, seat: Seat, progress: number): Cell | null {
  if (progress < 0 || progress > board.home) return null;
  return board.routes[seat][progress] ?? null;
}

export function sameCell(a: Cell, b: Cell): boolean {
  return a.row === b.row && a.col === b.col;
}

export function isSafeCell(board: Board, cell: Cell): boolean {
  return board.safe.some((s) => sameCell(s, cell));
}

export function cellKey(cell: Cell): string {
  return `${cell.row},${cell.col}`;
}
