import { BOARDS, cellKey, isSafeCell, type Board, type Cell, type Seat } from '@asta/engine';

/**
 * Drawing space for a board: one square is one unit. The grid spans
 * ORIGIN … ORIGIN + size, with a one-unit margin all round for each player's
 * starting area (a half-circle outside the middle of their side). So the
 * 5×5 board is a 7×7 drawing and the 7×7 board a 9×9 one; both scale to fit.
 */
export const ORIGIN = 1;
export const YARD_RADIUS = 0.95;
/** Breathing room around the drawing so starting-area outlines and glows are never clipped. */
export const VIEW_PAD = 0.14;

export interface Point {
  x: number;
  y: number;
}

export interface Geometry {
  board: Board;
  size: number;
  /** Width (and height) of the drawing, starting areas included. */
  view: number;
  /** Centre of the drawing. */
  mid: number;
  /** Where the grid ends (its bottom and right edge). */
  gridEnd: number;
  /** The whole drawing including the padding. */
  total: number;
  cellCentre(cell: Cell): Point;
  /** Rotate a point about the board centre to the given seat (bottom → right → top → left). */
  rotateToSeat(p: Point, seat: Seat): Point;
  /** Where a real square appears when viewing from `view` (a quarter turn clockwise per seat). */
  viewCell(cell: Cell, view: Seat): Cell;
  /** Where a board point appears when viewing from `view`. */
  viewPoint(p: Point, view: Seat): Point;
  /** SVG path for a seat's half-circle starting area. */
  yardPath(seat: Seat, radius?: number): string;
  /** How far in a square is: 0 = outer ring, 1 = next ring … `rings` = the centre. */
  ringOf(cell: Cell): number;
  /** Number of rings around the centre (2 on 5×5, 3 on 7×7). */
  rings: number;
  /** Small arrows showing the direction of travel round each ring. */
  routeHints: { cell: Cell; dir: Point }[];
}

/*
 * Viewing the board from a seat: everything turns so that seat sits at the
 * bottom (online, each player sees their own side nearest them). Only the
 * picture turns; the game itself always uses the real squares.
 */

/** Where a seat's side appears when viewing from `view`. */
export function viewSeat(seat: Seat, view: Seat): Seat {
  return ((seat - view + 4) % 4) as Seat;
}

/** A direction of travel as seen from `view`. */
export function viewDirection(d: Point, view: Seat): Point {
  let { x, y } = d;
  for (let i = 0; i < view; i++) [x, y] = [-y, x];
  return { x, y };
}

/**
 * One arrow per side of each ring: on the middle square of the side (or the
 * next one along when the middle is an X square), pointing the way pieces go.
 */
function routeHintsFor(board: Board): { cell: Cell; dir: Point }[] {
  const route = board.routes[0];
  const size = board.size;
  const mid = (size - 1) / 2;
  const depth = (c: Cell) => Math.min(c.row, c.col, size - 1 - c.row, size - 1 - c.col);
  const isSideMiddle = (c: Cell) => c.row === mid || c.col === mid;
  const hints: { cell: Cell; dir: Point }[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < board.home; i++) {
    const cell = route[i]!;
    if (!isSideMiddle(cell)) continue;
    // Skip past X squares to the next square of the same ring.
    let j = i;
    while (j < board.home && isSafeCell(board, route[j]!) && depth(route[j]!) === depth(cell)) j++;
    const at = route[j]!;
    if (j >= board.home || depth(at) !== depth(cell) || seen.has(cellKey(at))) continue;
    seen.add(cellKey(at));
    // The way pieces travel through it: from the square before (or, on the first
    // square of a ring, towards the square after).
    const firstOfRing = j === 0 || depth(route[j - 1]!) !== depth(at);
    const from = firstOfRing ? at : route[j - 1]!;
    const to = firstOfRing ? route[j + 1]! : at;
    hints.push({ cell: at, dir: { x: to.col - from.col, y: to.row - from.row } });
  }
  return hints;
}

const cache = new Map<string, Geometry>();

/** Drawing geometry for a board (shared, built once per board). */
export function geometryFor(board: Board): Geometry {
  const cached = cache.get(board.id);
  if (cached) return cached;
  const size = board.size;
  const view = size + 2 * ORIGIN;
  const mid = view / 2;
  const gridEnd = ORIGIN + size;
  const rotateToSeat = (p: Point, seat: Seat): Point => {
    let dx = p.x - mid;
    let dy = p.y - mid;
    for (let i = 0; i < seat; i++) [dx, dy] = [dy, -dx];
    return { x: mid + dx, y: mid + dy };
  };
  const geo: Geometry = {
    board,
    size,
    view,
    mid,
    gridEnd,
    total: view + VIEW_PAD * 2,
    cellCentre: (cell) => ({ x: ORIGIN + cell.col + 0.5, y: ORIGIN + cell.row + 0.5 }),
    rotateToSeat,
    viewCell: (cell, v) => {
      let { row, col } = cell;
      for (let i = 0; i < v; i++) [row, col] = [col, size - 1 - row];
      return { row, col };
    },
    viewPoint: (p, v) => rotateToSeat(p, viewSeat(0, v)),
    yardPath: (seat, radius = YARD_RADIUS) => {
      const a = rotateToSeat({ x: mid - radius, y: gridEnd }, seat);
      const b = rotateToSeat({ x: mid + radius, y: gridEnd }, seat);
      return `M ${a.x} ${a.y} A ${radius} ${radius} 0 0 0 ${b.x} ${b.y}`;
    },
    ringOf: (cell) => Math.min(cell.row, cell.col, size - 1 - cell.row, size - 1 - cell.col),
    rings: (size - 1) / 2,
    routeHints: routeHintsFor(board),
  };
  cache.set(board.id, geo);
  return geo;
}

/** The classic board's geometry (the home screen art, rules pictures and shop previews). */
export const CLASSIC = geometryFor(BOARDS['5x5']);
