import { BOARD_SIZE, SAFE_CELLS, cellKey, isSafeCell, type Cell, type Player, type Seat } from '@asta/engine';
import { memo } from 'react';
import Svg, { Circle, Defs, G, Line, LinearGradient, Path, RadialGradient, Rect, Stop } from 'react-native-svg';
import { boardColors as b, colors, seatColors } from '../theme';
import {
  GRID_END,
  MID,
  ORIGIN,
  VIEW_PAD,
  VIEW_TOTAL,
  YARD_RADIUS,
  cellCentre,
  ringOf,
  rotateToSeat,
  viewCell,
  viewDirection,
  viewSeat,
  yardPath,
  type Point,
} from './boardGeometry';
import { useSvgId } from './svgId';

const FRAME = 0.2;
const TILE_GAP = 0.035;

/** Direction of travel shown by the small chevrons: outer ring counter-clockwise, inner ring clockwise. */
const ROUTE_HINTS: { cell: Cell; dir: Point }[] = [
  { cell: { row: 4, col: 3 }, dir: { x: 1, y: 0 } },
  { cell: { row: 1, col: 4 }, dir: { x: 0, y: -1 } },
  { cell: { row: 0, col: 1 }, dir: { x: -1, y: 0 } },
  { cell: { row: 3, col: 0 }, dir: { x: 0, y: 1 } },
  { cell: { row: 2, col: 1 }, dir: { x: 0, y: -1 } },
  { cell: { row: 1, col: 2 }, dir: { x: 1, y: 0 } },
  { cell: { row: 2, col: 3 }, dir: { x: 0, y: 1 } },
  { cell: { row: 3, col: 2 }, dir: { x: -1, y: 0 } },
];

const fmt = (n: number) => n.toFixed(4);

function chevron(c: Point, dir: Point, size: number): string {
  const perp = { x: -dir.y, y: dir.x };
  const tip = { x: c.x + dir.x * size * 0.35, y: c.y + dir.y * size * 0.35 };
  const back = { x: c.x - dir.x * size * 0.35, y: c.y - dir.y * size * 0.35 };
  const w1 = { x: back.x + perp.x * size * 0.5, y: back.y + perp.y * size * 0.5 };
  const w2 = { x: back.x - perp.x * size * 0.5, y: back.y - perp.y * size * 0.5 };
  return `M ${fmt(w1.x)} ${fmt(w1.y)} L ${fmt(tip.x)} ${fmt(tip.y)} L ${fmt(w2.x)} ${fmt(w2.y)}`;
}

/** A pointed petal from radius r0 to r1 along `angle` (radians) around centre c. */
function petal(c: Point, angle: number, r0: number, r1: number, width: number): string {
  const u = { x: Math.cos(angle), y: Math.sin(angle) };
  const v = { x: -u.y, y: u.x };
  const rm = (r0 + r1) / 2;
  const p0 = { x: c.x + u.x * r0, y: c.y + u.y * r0 };
  const p1 = { x: c.x + u.x * r1, y: c.y + u.y * r1 };
  const q1 = { x: c.x + u.x * rm + v.x * width, y: c.y + u.y * rm + v.y * width };
  const q2 = { x: c.x + u.x * rm - v.x * width, y: c.y + u.y * rm - v.y * width };
  return `M ${fmt(p0.x)} ${fmt(p0.y)} Q ${fmt(q1.x)} ${fmt(q1.y)} ${fmt(p1.x)} ${fmt(p1.y)} Q ${fmt(q2.x)} ${fmt(q2.y)} ${fmt(p0.x)} ${fmt(p0.y)} Z`;
}

/** The home square's lotus: two rings of petals around a golden centre. */
function Lotus({ c, u }: { c: Point; u: string }) {
  const outer = Array.from({ length: 8 }, (_, i) => (i * Math.PI) / 4);
  const inner = outer.map((a) => a + Math.PI / 8);
  return (
    <G>
      {outer.map((a) => (
        <Path key={`o${a}`} d={petal(c, a, 0.08, 0.42, 0.1)} fill={`url(#petalOuter${u})`} stroke={b.goldDeep} strokeWidth={0.012} />
      ))}
      {inner.map((a) => (
        <Path key={`i${a}`} d={petal(c, a, 0.06, 0.3, 0.075)} fill={`url(#petalInner${u})`} stroke={b.goldDeep} strokeWidth={0.01} />
      ))}
      <Circle cx={c.x} cy={c.y} r={0.1} fill={`url(#goldDisc${u})`} stroke={b.goldDeep} strokeWidth={0.015} />
    </G>
  );
}

/** A safe square: the traditional X, finished with a small gold rosette. */
function SafeMark({ cell }: { cell: Cell }) {
  const x = ORIGIN + cell.col;
  const y = ORIGIN + cell.row;
  const c = cellCentre(cell);
  const inset = 0.16;
  const rosette = Array.from({ length: 4 }, (_, i) => (i * Math.PI) / 2 + Math.PI / 4);
  return (
    <G>
      <Line x1={x + inset} y1={y + inset} x2={x + 1 - inset} y2={y + 1 - inset} stroke={b.gold} strokeOpacity={0.75} strokeWidth={0.045} strokeLinecap="round" />
      <Line x1={x + 1 - inset} y1={y + inset} x2={x + inset} y2={y + 1 - inset} stroke={b.gold} strokeOpacity={0.75} strokeWidth={0.045} strokeLinecap="round" />
      {rosette.map((a) => (
        <Path key={a} d={petal(c, a, 0.03, 0.17, 0.06)} fill={b.gold} fillOpacity={0.9} />
      ))}
      <Circle cx={c.x} cy={c.y} r={0.05} fill={b.goldLight} stroke={b.goldDeep} strokeWidth={0.012} />
    </G>
  );
}

export interface BoardDrawingProps {
  players: Player[];
  currentSeat: Seat | null;
  destinations: Cell[];
  strong: boolean;
  size: number;
  /**
   * The seat drawn at the bottom. Tiles, safe squares and the frame look the
   * same from every side (and keep their lighting); starting areas, route
   * arrows and highlights turn.
   */
  view?: Seat;
}

/** The static board artwork: frame, tiles, safe squares, home, starting areas and move highlights. */
function BoardDrawingImpl({ players, currentSeat, destinations, strong, size, view = 0 }: BoardDrawingProps) {
  const u = useSvgId();
  const tiles: Cell[] = [];
  for (let row = 0; row < BOARD_SIZE; row++) for (let col = 0; col < BOARD_SIZE; col++) tiles.push({ row, col });
  const frameX = ORIGIN - FRAME;
  const frameSize = BOARD_SIZE + FRAME * 2;

  return (
    <Svg width={size} height={size} viewBox={`${-VIEW_PAD} ${-VIEW_PAD} ${VIEW_TOTAL} ${VIEW_TOTAL}`}>
      <Defs>
        <LinearGradient id={`frame${u}`} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={b.frameLight} />
          <Stop offset="0.5" stopColor={b.frameMid} />
          <Stop offset="1" stopColor={b.frameDark} />
        </LinearGradient>
        <LinearGradient id={`frameSheen${u}`} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.22} />
          <Stop offset="0.5" stopColor="#FFFFFF" stopOpacity={0} />
        </LinearGradient>
        <LinearGradient id={`tileOuter${u}`} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={b.outerTileLight} />
          <Stop offset="1" stopColor={b.outerTileDark} />
        </LinearGradient>
        <LinearGradient id={`tileInner${u}`} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={b.innerTileLight} />
          <Stop offset="1" stopColor={b.innerTileDark} />
        </LinearGradient>
        <RadialGradient id={`tileHome${u}`} cx="50%" cy="50%" r="70%">
          <Stop offset="0" stopColor="#4A2C4F" />
          <Stop offset="1" stopColor="#2A1830" />
        </RadialGradient>
        <LinearGradient id={`petalOuter${u}`} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={b.goldLight} />
          <Stop offset="1" stopColor={b.gold} />
        </LinearGradient>
        <LinearGradient id={`petalInner${u}`} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#FFD9E4" />
          <Stop offset="1" stopColor="#E89AB3" />
        </LinearGradient>
        <RadialGradient id={`goldDisc${u}`} cx="35%" cy="35%" r="70%">
          <Stop offset="0" stopColor={b.goldLight} />
          <Stop offset="1" stopColor={b.goldDeep} />
        </RadialGradient>
        {([0, 1, 2, 3] as Seat[]).map((seat) => {
          const inner = rotateToSeat({ x: MID, y: GRID_END }, viewSeat(seat, view));
          return (
            <RadialGradient
              key={seat}
              id={`yard${seat}${u}`}
              cx={inner.x}
              cy={inner.y}
              r={YARD_RADIUS}
              gradientUnits="userSpaceOnUse"
            >
              <Stop offset="0" stopColor={seatColors[seat].dark} stopOpacity={0.55} />
              <Stop offset="1" stopColor={seatColors[seat].dark} stopOpacity={0.95} />
            </RadialGradient>
          );
        })}
      </Defs>

      {/* Starting areas, tucked under the frame */}
      {players.map((p) => {
        const active = p.seat === currentSeat;
        const side = viewSeat(p.seat, view);
        return (
          <G key={`yard${p.seat}`}>
            {active && (
              <Path d={yardPath(side, YARD_RADIUS + 0.04)} fill="none" stroke={seatColors[p.seat].fill} strokeWidth={0.1} strokeOpacity={0.7} />
            )}
            <Path d={yardPath(side)} fill={`url(#yard${p.seat}${u})`} stroke={b.gold} strokeWidth={0.045} />
            <Path d={yardPath(side, YARD_RADIUS - 0.1)} fill="none" stroke={b.gold} strokeOpacity={0.35} strokeWidth={0.015} strokeDasharray="0.05 0.05" />
          </G>
        );
      })}

      {/* Frame with drop shadow */}
      <Rect x={frameX + 0.05} y={frameX + 0.08} width={frameSize} height={frameSize} rx={0.16} fill={b.shadow} fillOpacity={0.4} />
      <Rect x={frameX} y={frameX} width={frameSize} height={frameSize} rx={0.16} fill={`url(#frame${u})`} stroke={b.frameEdge} strokeWidth={0.03} />
      <Rect x={frameX} y={frameX} width={frameSize} height={frameSize} rx={0.16} fill={`url(#frameSheen${u})`} />
      <Rect x={ORIGIN - 0.035} y={ORIGIN - 0.035} width={BOARD_SIZE + 0.07} height={BOARD_SIZE + 0.07} rx={0.05} fill={b.grout} stroke={b.gold} strokeWidth={0.025} strokeOpacity={0.8} />

      {/* Inlaid tiles: outer ring lighter than inner ring, centre is home */}
      {tiles.map((cell) => {
        const ring = ringOf(cell);
        const fill = ring === 0 ? `url(#tileOuter${u})` : ring === 1 ? `url(#tileInner${u})` : `url(#tileHome${u})`;
        return (
          <G key={`t${cellKey(cell)}`}>
            <Rect
              x={ORIGIN + cell.col + TILE_GAP}
              y={ORIGIN + cell.row + TILE_GAP}
              width={1 - TILE_GAP * 2}
              height={1 - TILE_GAP * 2}
              rx={0.07}
              fill={fill}
            />
            {/* soft top highlight for a glazed look */}
            <Rect
              x={ORIGIN + cell.col + TILE_GAP + 0.04}
              y={ORIGIN + cell.row + TILE_GAP + 0.03}
              width={1 - TILE_GAP * 2 - 0.08}
              height={0.05}
              rx={0.025}
              fill="#FFFFFF"
              fillOpacity={0.07}
            />
          </G>
        );
      })}

      {/* Route direction hints */}
      {ROUTE_HINTS.filter((h) => !isSafeCell(h.cell)).map((h) => (
        <Path
          key={`r${cellKey(h.cell)}`}
          d={chevron(cellCentre(viewCell(h.cell, view)), viewDirection(h.dir, view), 0.22)}
          fill="none"
          stroke={b.gold}
          strokeOpacity={0.28}
          strokeWidth={0.035}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}

      {SAFE_CELLS.filter((c) => ringOf(c) !== 2).map((cell) => (
        <SafeMark key={`x${cellKey(cell)}`} cell={cell} />
      ))}
      <Lotus c={{ x: MID, y: MID }} u={u} />

      {/* Legal destinations */}
      {destinations.map((real) => {
        const cell = viewCell(real, view);
        return (
        <Rect
          key={`d${cellKey(cell)}`}
          x={ORIGIN + cell.col + 0.06}
          y={ORIGIN + cell.row + 0.06}
          width={0.88}
          height={0.88}
          rx={0.1}
          fill={colors.highlight}
          fillOpacity={strong ? 0.3 : 0.14}
          stroke={colors.highlight}
          strokeWidth={0.045}
          strokeDasharray={strong ? undefined : '0.12 0.08'}
        />
        );
      })}
    </Svg>
  );
}

export const BoardDrawing = memo(BoardDrawingImpl);
