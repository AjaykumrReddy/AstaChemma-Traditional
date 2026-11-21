import Svg, { Circle, Defs, Ellipse, G, Line, Path, RadialGradient, Rect, Stop, Text as SvgText } from 'react-native-svg';

/** Hand-drawn icons for the start screen's mode tiles (64 × 64 units). */

const OUTLINE = '#2B1A08';

/** A globe with two phones linked across it. */
export function OnlineIcon({ size }: { size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64">
      <Defs>
        <RadialGradient id="globe" cx="38%" cy="32%" r="70%">
          <Stop offset="0" stopColor="#B8F0FF" />
          <Stop offset="0.5" stopColor="#3FA7E0" />
          <Stop offset="1" stopColor="#174E8C" />
        </RadialGradient>
      </Defs>
      <Circle cx={32} cy={30} r={19} fill="url(#globe)" stroke={OUTLINE} strokeWidth={2} />
      {/* land */}
      <Path d="M 22 20 q 6 -4 10 0 q 2 4 -3 6 q -5 1 -5 5 q -4 -2 -4 -6 z" fill="#4CC36E" stroke="#1E6B35" strokeWidth={1} />
      <Path d="M 36 32 q 6 -2 9 2 q 0 6 -6 9 q -3 -4 -3 -11 z" fill="#4CC36E" stroke="#1E6B35" strokeWidth={1} />
      <Ellipse cx={32} cy={30} rx={8} ry={19} fill="none" stroke="#FFFFFF" strokeOpacity={0.35} strokeWidth={1.2} />
      <Line x1={13} y1={30} x2={51} y2={30} stroke="#FFFFFF" strokeOpacity={0.35} strokeWidth={1.2} />
      <Ellipse cx={26} cy={21} rx={6} ry={3.5} fill="#FFFFFF" fillOpacity={0.35} />
      {/* phones */}
      <G>
        <Rect x={3} y={38} width={13} height={21} rx={3} fill="#FFD25E" stroke={OUTLINE} strokeWidth={1.8} />
        <Rect x={5.5} y={41} width={8} height={13} rx={1} fill="#2B3A55" />
        <Rect x={48} y={38} width={13} height={21} rx={3} fill="#FFD25E" stroke={OUTLINE} strokeWidth={1.8} />
        <Rect x={50.5} y={41} width={8} height={13} rx={1} fill="#2B3A55" />
      </G>
      <Path d="M 16 50 Q 32 60 48 50" fill="none" stroke="#FFE58A" strokeWidth={2} strokeDasharray="2 3" strokeLinecap="round" />
    </Svg>
  );
}

/** A small screen with "VS" and a computer chip glow. */
export function ComputerIcon({ size }: { size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64">
      <Rect x={8} y={10} width={48} height={34} rx={6} fill="#FFD25E" stroke={OUTLINE} strokeWidth={2} />
      <Rect x={13} y={15} width={38} height={24} rx={3} fill="#2B3A55" />
      <Rect x={13} y={15} width={38} height={8} rx={3} fill="#FFFFFF" fillOpacity={0.12} />
      <SvgText x={32} y={33} textAnchor="middle" fontSize={15} fontWeight="900" fill="#FFE58A">
        VS
      </SvgText>
      <Path d="M 26 44 L 24 52 L 40 52 L 38 44 Z" fill="#E0A93A" stroke={OUTLINE} strokeWidth={1.8} />
      <Rect x={16} y={52} width={32} height={5} rx={2.5} fill="#FFD25E" stroke={OUTLINE} strokeWidth={1.8} />
    </Svg>
  );
}

/** Two friends sharing one phone. */
export function PassPlayIcon({ size }: { size: number }) {
  const person = (x: number, fill: string) => (
    <G>
      <Circle cx={x} cy={18} r={8} fill={fill} stroke={OUTLINE} strokeWidth={1.8} />
      <Path d={`M ${x - 12} 48 Q ${x - 12} 30 ${x} 30 Q ${x + 12} 30 ${x + 12} 48 Z`} fill={fill} stroke={OUTLINE} strokeWidth={1.8} />
      <Ellipse cx={x - 3} cy={15} rx={3} ry={2} fill="#FFFFFF" fillOpacity={0.4} />
    </G>
  );
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64">
      {person(16, '#FFD25E')}
      {person(48, '#FFB347')}
      <Rect x={24} y={34} width={16} height={24} rx={3} fill="#FFE58A" stroke={OUTLINE} strokeWidth={1.8} />
      <Rect x={26.5} y={37} width={11} height={15} rx={1} fill="#2B3A55" />
      <Path d="M 29 44 l 3 -3 l 3 3" fill="none" stroke="#FFE58A" strokeWidth={1.6} strokeLinecap="round" />
    </Svg>
  );
}

/** An open book with a glowing cowrie. */
export function LearnIcon({ size }: { size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64">
      <Defs>
        <RadialGradient id="learnGlow" cx="50%" cy="50%" r="50%">
          <Stop offset="0" stopColor="#FFF4C2" stopOpacity={0.9} />
          <Stop offset="1" stopColor="#FFF4C2" stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Circle cx={32} cy={22} r={18} fill="url(#learnGlow)" />
      <Path d="M 6 30 Q 19 24 32 30 L 32 56 Q 19 50 6 56 Z" fill="#FFF6DD" stroke={OUTLINE} strokeWidth={1.8} />
      <Path d="M 58 30 Q 45 24 32 30 L 32 56 Q 45 50 58 56 Z" fill="#FFEFC4" stroke={OUTLINE} strokeWidth={1.8} />
      <Line x1={11} y1={36} x2={27} y2={34} stroke="#C9A777" strokeWidth={1.4} />
      <Line x1={11} y1={42} x2={27} y2={40} stroke="#C9A777" strokeWidth={1.4} />
      <Line x1={37} y1={34} x2={53} y2={36} stroke="#C9A777" strokeWidth={1.4} />
      <Line x1={37} y1={40} x2={53} y2={42} stroke="#C9A777" strokeWidth={1.4} />
      {/* a cowrie, open side up */}
      <Ellipse cx={32} cy={18} rx={8} ry={11} fill="#F6E7C8" stroke="#5B4630" strokeWidth={1.6} />
      <Path d="M 32 9 C 33.5 14, 30.5 22, 32 27" stroke="#5B4630" strokeWidth={2} fill="none" strokeLinecap="round" />
    </Svg>
  );
}
