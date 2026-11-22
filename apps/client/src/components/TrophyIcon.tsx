import Svg, { Defs, Ellipse, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import { useSvgId } from './svgId';

/** A gold trophy cup (the leaderboard). */
export function TrophyIcon({ size = 24 }: { size?: number }) {
  const u = useSvgId();
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32">
      <Defs>
        <LinearGradient id={`cup${u}`} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#FFF4B8" />
          <Stop offset="0.5" stopColor="#F2C94C" />
          <Stop offset="1" stopColor="#B07A12" />
        </LinearGradient>
      </Defs>
      {/* handles */}
      <Path d="M 8 7 C 2 7, 2 15, 9 16" fill="none" stroke="#C99A2E" strokeWidth={2.4} strokeLinecap="round" />
      <Path d="M 24 7 C 30 7, 30 15, 23 16" fill="none" stroke="#C99A2E" strokeWidth={2.4} strokeLinecap="round" />
      {/* cup */}
      <Path d="M 8 4 H 24 V 10 C 24 16, 20 19, 16 19 C 12 19, 8 16, 8 10 Z" fill={`url(#cup${u})`} stroke="#8A5A0B" strokeWidth={1.2} />
      <Ellipse cx={12.5} cy={8} rx={2} ry={3} fill="#FFFFFF" fillOpacity={0.5} />
      {/* stem and base */}
      <Rect x={14.2} y={19} width={3.6} height={5} fill="#C99A2E" />
      <Rect x={10} y={24} width={12} height={4} rx={1.2} fill={`url(#cup${u})`} stroke="#8A5A0B" strokeWidth={1} />
    </Svg>
  );
}
