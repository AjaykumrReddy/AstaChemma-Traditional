import { HOME_INDEX, SAFE_CELLS, cellAt, type Player } from '@asta/engine';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Path, Polygon } from 'react-native-svg';
import { BoardDrawing } from './BoardDrawing';
import { VIEW_PAD, VIEW_TOTAL, cellCentre, type Point } from './boardGeometry';
import { Cowrie } from './Shells';

/** Drawings for the "How to play" page, made from the real game artwork. */

const BOTTOM_PLAYER: Player[] = [{ index: 0, name: '', seat: 0 }];
const viewBox = `${-VIEW_PAD} ${-VIEW_PAD} ${VIEW_TOTAL} ${VIEW_TOTAL}`;

/** Five cowries, three landed open. */
export function ThrowArt() {
  const open = [true, false, true, true, false];
  return (
    <View style={styles.shells}>
      {open.map((o, i) => (
        <View key={i} style={{ transform: [{ rotate: `${[-12, 8, -4, 14, -8][i]}deg` }] }}>
          <Cowrie open={o} size={30} />
        </View>
      ))}
    </View>
  );
}

/** The bottom player's route: in at the X, round the outer ring, then the inner ring, then home. */
export function RouteArt({ size }: { size: number }) {
  const points: Point[] = [];
  for (let p = 0; p <= HOME_INDEX; p++) points.push(cellCentre(cellAt(0, p)!));
  const d = points.map((pt, i) => `${i === 0 ? 'M' : 'L'} ${pt.x} ${pt.y}`).join(' ');
  // Arrowheads part-way along each stretch, pointing the way.
  const arrows = [2, 6, 10, 14, 18, 21].map((i) => {
    const a = points[i]!;
    const b = points[i + 1]!;
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy) || 1;
    const ux = dx / len;
    const uy = dy / len;
    const tip = { x: mid.x + ux * 0.16, y: mid.y + uy * 0.16 };
    const back = { x: mid.x - ux * 0.12, y: mid.y - uy * 0.12 };
    return `${tip.x},${tip.y} ${back.x - uy * 0.14},${back.y + ux * 0.14} ${back.x + uy * 0.14},${back.y - ux * 0.14}`;
  });
  const start = points[0]!;
  return (
    <View style={{ width: size, height: size }}>
      <BoardDrawing players={BOTTOM_PLAYER} currentSeat={null} destinations={[]} strong={false} size={size} />
      <Svg width={size} height={size} viewBox={viewBox} style={StyleSheet.absoluteFill}>
        <Path d={d} fill="none" stroke="#000" strokeOpacity={0.35} strokeWidth={0.16} strokeLinejoin="round" />
        <Path d={d} fill="none" stroke="#F2C94C" strokeWidth={0.09} strokeLinejoin="round" strokeLinecap="round" />
        {arrows.map((pts, i) => (
          <Polygon key={i} points={pts} fill="#F2C94C" stroke="#7A5208" strokeWidth={0.02} />
        ))}
        <Circle cx={start.x} cy={start.y} r={0.17} fill="#F2C94C" stroke="#FFFFFF" strokeWidth={0.05} />
      </Svg>
    </View>
  );
}

/** The five safe squares, glowing. */
export function SafeArt({ size }: { size: number }) {
  return (
    <View style={{ width: size, height: size }}>
      <BoardDrawing players={BOTTOM_PLAYER} currentSeat={null} destinations={[]} strong={false} size={size} />
      <Svg width={size} height={size} viewBox={viewBox} style={StyleSheet.absoluteFill}>
        {SAFE_CELLS.map((cell) => {
          const c = cellCentre(cell);
          return <Circle key={`${cell.row}${cell.col}`} cx={c.x} cy={c.y} r={0.46} fill="#7EE2A8" fillOpacity={0.22} stroke="#7EE2A8" strokeWidth={0.06} />;
        })}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  shells: { flexDirection: 'row', justifyContent: 'center', gap: 6, paddingVertical: 4 },
});
