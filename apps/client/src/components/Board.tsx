import { boardOf, cellAt, cellKey, type Cell, type GameState, type Move, type Piece, type Seat } from '@asta/engine';
import { memo, useEffect, useMemo, useState } from 'react';
import { Animated, Easing, Platform, Pressable, StyleSheet, View } from 'react-native';
import type { BoardEffect } from '../feedback/effects';
import { useStrings } from '../i18n';
import { useGameStore } from '../store/game';
import { seatColors, seatShapes } from '../theme';
import { BoardDrawing } from './BoardDrawing';
import { BoardEffects } from './Effects';
import { ORIGIN, VIEW_PAD, YARD_RADIUS, geometryFor, viewSeat, type Geometry, type Point } from './boardGeometry';
import { PieceView } from './PieceView';

/**
 * The playable board: static artwork underneath, with pieces and tap targets
 * as ordinary views on top so they animate smoothly and handle touches the
 * same way on Android, iOS and the web.
 */

/** Offsets (in square units) and radius for n pieces sharing one square. */
function slots(n: number): { offsets: Point[]; r: number } {
  const grid = (cols: number, rows: number, gap: number, r: number) => {
    const offsets: Point[] = [];
    for (let row = 0; row < rows; row++)
      for (let col = 0; col < cols; col++)
        offsets.push({ x: (col - (cols - 1) / 2) * gap, y: (row - (rows - 1) / 2) * gap });
    return { offsets, r };
  };
  if (n <= 1) return { offsets: [{ x: 0, y: 0 }], r: 0.3 };
  if (n === 2) return { offsets: [{ x: -0.2, y: 0 }, { x: 0.2, y: 0 }], r: 0.19 };
  if (n === 3) return { offsets: [{ x: -0.2, y: -0.16 }, { x: 0.2, y: -0.16 }, { x: 0, y: 0.18 }], r: 0.17 };
  if (n === 4) return grid(2, 2, 0.4, 0.17);
  if (n <= 6) return grid(3, 2, 0.28, 0.13);
  if (n <= 9) return grid(3, 3, 0.28, 0.12);
  return grid(4, 3, 0.22, 0.1);
}

interface PlacedPiece {
  piece: Piece;
  seat: Seat;
  at: Point;
  r: number;
}

/** Where each piece is drawn, seen from the `view` seat. */
function placePieces(state: GameState, view: Seat, geo: Geometry): PlacedPiece[] {
  const board = geo.board;
  const placed: PlacedPiece[] = [];
  const byCell = new Map<string, { cell: Cell; pieces: Piece[] }>();
  const yards = new Map<number, Piece[]>();
  const seatOf = (p: Piece) => state.players[p.owner]!.seat;

  for (const piece of state.pieces) {
    if (piece.progress < 0) {
      yards.set(piece.owner, [...(yards.get(piece.owner) ?? []), piece]);
      continue;
    }
    const cell = cellAt(board, seatOf(piece), piece.progress)!;
    const key = cellKey(cell);
    const entry = byCell.get(key) ?? { cell, pieces: [] };
    entry.pieces.push(piece);
    byCell.set(key, entry);
  }

  for (const { cell, pieces } of byCell.values()) {
    pieces.sort((a, b) => a.owner - b.owner || a.id.localeCompare(b.id));
    const { offsets, r } = slots(pieces.length);
    const c = geo.cellCentre(geo.viewCell(cell, view));
    pieces.forEach((piece, i) => {
      const o = offsets[i] ?? { x: 0, y: 0 };
      placed.push({ piece, seat: seatOf(piece), at: { x: c.x + o.x, y: c.y + o.y }, r });
    });
  }

  for (const [owner, pieces] of yards) {
    const seat = state.players[owner]!.seat;
    pieces.sort((a, b) => a.id.localeCompare(b.id));
    pieces.forEach((piece, i) => {
      // Laid out for the bottom starting area, then rotated to the player's side.
      const base = { x: geo.mid + (i - (pieces.length - 1) / 2) * 0.48, y: geo.gridEnd + 0.5 };
      placed.push({ piece, seat, at: geo.rotateToSeat(base, viewSeat(seat, view)), r: 0.22 });
    });
  }
  return placed;
}

/**
 * Whose turn it is: a soft glow in the player's colour pulsing around their
 * starting area, behind the board (so it shows as a halo round the half-circle).
 */
function TurnGlow({ seat, view, geo, unit, px }: { seat: Seat; view: Seat; geo: Geometry; unit: number; px: (v: number) => number }) {
  const [pulse] = useState(() => new Animated.Value(0));
  useEffect(() => {
    pulse.setValue(0);
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 850, easing: Easing.inOut(Easing.sin), useNativeDriver }),
        Animated.timing(pulse, { toValue: 0, duration: 850, easing: Easing.inOut(Easing.sin), useNativeDriver }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse, seat]);
  const c = geo.rotateToSeat({ x: geo.mid, y: geo.gridEnd }, viewSeat(seat, view));
  const fill = seatColors[seat].fill;
  // Three soft rings, strongest nearest the yard.
  const rings = [
    { r: YARD_RADIUS + 0.2, opacity: [0.6, 0.95] },
    { r: YARD_RADIUS + 0.5, opacity: [0.3, 0.6] },
    { r: YARD_RADIUS + 0.85, opacity: [0.12, 0.3] },
  ];
  return (
    <>
      {rings.map(({ r, opacity }) => {
        const radius = r * unit;
        return (
          <Animated.View
            key={r}
            style={{
              position: 'absolute',
              pointerEvents: 'none',
              left: px(c.x) - radius,
              top: px(c.y) - radius,
              width: radius * 2,
              height: radius * 2,
              borderRadius: radius,
              backgroundColor: fill,
              opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: opacity }),
              transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.97, 1.06] }) }],
            }}
          />
        );
      })}
    </>
  );
}

export interface BoardProps {
  state: GameState;
  size: number;
  /** Pieces the current human player may move now. */
  movable: Move[];
  selected: string | null;
  /** The piece currently walking along its route, drawn above the others. */
  movingPieceId?: string | null;
  /** Milliseconds for each animated glide between squares. */
  stepMs: number;
  onPiecePress?: (pieceId: string) => void;
  onCellPress?: (cell: Cell) => void;
  /** Active bursts and shockwaves. */
  effects?: BoardEffect[];
  onEffectDone?: (id: number) => void;
  /** Change this number to shake the board (captures). */
  shakeKey?: number;
  /** The seat shown at the bottom (online: your own). Defaults to the bottom seat. */
  view?: Seat;
}

const useNativeDriver = Platform.OS !== 'web';
const noop = () => {};

function BoardView({
  state,
  size,
  movable,
  selected,
  movingPieceId,
  stepMs,
  onPiecePress,
  onCellPress,
  effects = [],
  onEffectDone = noop,
  shakeKey = 0,
  view = 0,
}: BoardProps) {
  const t = useStrings();
  const markers = useGameStore((s) => s.markers);
  const board = boardOf(state);
  const geo = geometryFor(board);
  const unit = size / geo.total;
  const [shake] = useState(() => new Animated.Value(0));

  // A quick shudder when a capture lands.
  useEffect(() => {
    if (shakeKey === 0) return;
    shake.setValue(0);
    const anim = Animated.sequence(
      [1, -1, 0.8, -0.8, 0.4, -0.4, 0].map((v) =>
        Animated.timing(shake, { toValue: v, duration: 45, easing: Easing.linear, useNativeDriver }),
      ),
    );
    anim.start();
    return () => anim.stop();
  }, [shakeKey, shake]);
  /** Board units → pixels, accounting for the padding around the drawing. */
  const px = (v: number) => (v + VIEW_PAD) * unit;
  const placed = useMemo(() => placePieces(state, view, geo), [state, view, geo]);
  const shownEffects = useMemo(
    () => (view === 0 ? effects : effects.map((e) => ({ ...e, cell: geo.viewCell(e.cell, view) }))),
    [effects, view, geo],
  );
  const movableIds = useMemo(() => new Set(movable.map((m) => m.pieceId)), [movable]);
  const currentSeat = state.phase === 'finished' ? null : (state.players[state.current]?.seat ?? null);

  // Destination squares to highlight: the selected piece's, or all of them.
  const destinations = useMemo(() => {
    const shown = selected ? movable.filter((m) => m.pieceId === selected) : movable;
    const cells: Cell[] = [];
    for (const m of shown) {
      const piece = state.pieces.find((p) => p.id === m.pieceId);
      if (!piece) continue;
      const cell = cellAt(board, state.players[piece.owner]!.seat, m.to);
      if (cell && !cells.some((c) => cellKey(c) === cellKey(cell))) cells.push(cell);
    }
    return cells;
  }, [movable, selected, state, board]);

  // Stable order (by id) keeps each piece's view mounted so it can glide.
  const ordered = useMemo(() => [...placed].sort((a, b) => a.piece.id.localeCompare(b.piece.id)), [placed]);

  const shakeX = shake.interpolate({ inputRange: [-1, 1], outputRange: [-unit * 0.12, unit * 0.12] });

  return (
    <Animated.View style={{ width: size, height: size, transform: [{ translateX: shakeX }] }}>
      {/* Behind the drawing: the glow around the starting area of whoever's turn it is. */}
      {currentSeat !== null && <TurnGlow seat={currentSeat} view={view} geo={geo} unit={unit} px={px} />}
      {/* Its own layer, so the glow stays behind it on every platform. */}
      <View style={[StyleSheet.absoluteFill, { pointerEvents: 'none' }]}>
        <BoardDrawing
          players={state.players}
          currentSeat={currentSeat}
          destinations={destinations}
          strong={selected !== null}
          size={size}
          view={view}
          board={board}
        />
      </View>
      <View style={[StyleSheet.absoluteFill, { pointerEvents: 'box-none' }]}>
        {ordered.map(({ piece, seat, at, r }) => (
          <PieceView
            key={piece.id}
            id={piece.id}
            kind={piece.kind}
            label={t.pieceA11y(t.colour[seat], t.piece[piece.kind])}
            shape={markers ? seatShapes[seat] : null}
            seat={seat}
            x={px(at.x)}
            y={px(at.y)}
            radius={(piece.kind === 'mother' ? r : r * 0.82) * unit}
            unit={unit}
            home={piece.progress === board.home}
            movable={movableIds.has(piece.id)}
            selected={selected === piece.id}
            raised={piece.id === movingPieceId}
            stepMs={stepMs}
            onPress={onPiecePress}
          />
        ))}
        {/* Tap targets for landing squares. Once a piece is selected they sit
            above other pieces, so a square occupied by one of your own pieces
            still moves the selected piece instead of selecting the other one. */}
        {onCellPress &&
          destinations.map((cell) => {
            // Drawn where the viewer sees the square; reports the real square.
            const shown = geo.viewCell(cell, view);
            return (
            <Pressable
              key={`tap${cellKey(cell)}`}
              onPress={() => onCellPress(cell)}
              accessibilityRole="button"
              accessibilityLabel={t.moveToA11y(shown.row + 1, shown.col + 1)}
              style={{
                position: 'absolute',
                left: px(ORIGIN + shown.col),
                top: px(ORIGIN + shown.row),
                width: unit,
                height: unit,
                zIndex: selected ? 40 : 0,
              }}
            />
            );
          })}
      </View>
      <BoardEffects effects={shownEffects} px={px} unit={unit} onDone={onEffectDone} />
    </Animated.View>
  );
}

export const Board = memo(BoardView);
