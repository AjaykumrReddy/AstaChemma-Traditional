import { BOARD_SIZE, type Cell, type Seat } from '@asta/engine';

/**
 * The 5×5 board lives in a 7×7 unit space: the grid spans 1…6 and each
 * player's starting area is a half-circle outside the middle of their side.
 */
export const VIEW = 7;
export const ORIGIN = 1;
export const MID = VIEW / 2;
export const YARD_RADIUS = 0.95;
export const GRID_END = ORIGIN + BOARD_SIZE;
/** Breathing room around the 7×7 space so starting-area outlines and glows are never clipped. */
export const VIEW_PAD = 0.14;
export const VIEW_TOTAL = VIEW + VIEW_PAD * 2;

export interface Point {
  x: number;
  y: number;
}

export function cellCentre(cell: Cell): Point {
  return { x: ORIGIN + cell.col + 0.5, y: ORIGIN + cell.row + 0.5 };
}

/** Rotate a point about the board centre to the given seat (bottom → right → top → left). */
export function rotateToSeat(p: Point, seat: Seat): Point {
  let dx = p.x - MID;
  let dy = p.y - MID;
  for (let i = 0; i < seat; i++) [dx, dy] = [dy, -dx];
  return { x: MID + dx, y: MID + dy };
}

/** SVG path for a seat's half-circle starting area. */
export function yardPath(seat: Seat, radius = YARD_RADIUS): string {
  const a = rotateToSeat({ x: MID - radius, y: GRID_END }, seat);
  const b = rotateToSeat({ x: MID + radius, y: GRID_END }, seat);
  return `M ${a.x} ${a.y} A ${radius} ${radius} 0 0 0 ${b.x} ${b.y}`;
}

/** Ring a square belongs to: 0 = outer ring, 1 = inner ring, 2 = centre. */
export function ringOf(cell: Cell): 0 | 1 | 2 {
  const d = Math.min(cell.row, cell.col, BOARD_SIZE - 1 - cell.row, BOARD_SIZE - 1 - cell.col);
  return d as 0 | 1 | 2;
}
