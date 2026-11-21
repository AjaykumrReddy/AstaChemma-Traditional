import type { Seat } from '@asta/engine';
import Svg, { Circle, Path } from 'react-native-svg';
import { useGameStore } from '../store/game';
import { seatColors, seatShapes, type SeatShape } from '../theme';

const f = (n: number) => Number(n.toFixed(3));

/** SVG path for a seat shape of half-size `s`, centred on (0, 0). */
export function shapePath(shape: SeatShape, s: number): string {
  switch (shape) {
    case 'triangle':
      // Nudged down so it looks centred.
      return `M 0 ${f(-s * 0.95)} L ${f(s * 0.95)} ${f(s * 0.7)} L ${f(-s * 0.95)} ${f(s * 0.7)} Z`;
    case 'square':
      return `M ${f(-s * 0.72)} ${f(-s * 0.72)} H ${f(s * 0.72)} V ${f(s * 0.72)} H ${f(-s * 0.72)} Z`;
    case 'diamond':
      return `M 0 ${f(-s)} L ${f(s)} 0 L 0 ${f(s)} L ${f(-s)} 0 Z`;
    case 'plus': {
      const a = s * 0.3; // half the bar thickness
      return `M ${f(-a)} ${f(-s)} H ${f(a)} V ${f(-a)} H ${f(s)} V ${f(a)} H ${f(a)} V ${f(s)} H ${f(-a)} V ${f(a)} H ${f(-s)} V ${f(-a)} H ${f(-a)} Z`;
    }
  }
}

/**
 * A player's colour marker: their shape in their colour when "Shape markers"
 * is on, otherwise a plain coloured dot. Used on player chips, the status
 * line and the setup screen.
 */
export function SeatMark({ seat, size = 14 }: { seat: Seat; size?: number }) {
  const markers = useGameStore((s) => s.markers);
  const colour = seatColors[seat];
  return (
    <Svg width={size} height={size} viewBox="-1.1 -1.1 2.2 2.2">
      {markers ? (
        <Path d={shapePath(seatShapes[seat], 1)} fill={colour.fill} stroke={colour.light} strokeWidth={0.12} strokeLinejoin="round" />
      ) : (
        <Circle r={1} fill={colour.fill} />
      )}
    </Svg>
  );
}
