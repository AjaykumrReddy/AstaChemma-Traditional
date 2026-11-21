import Svg, { Circle, Defs, Ellipse, Path, RadialGradient, Stop } from 'react-native-svg';
import { useSvgId } from './svgId';

/** A gold coin stamped with a cowrie: the game's play money. */
export function CoinIcon({ size = 20 }: { size?: number }) {
  const u = useSvgId();
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32">
      <Defs>
        <RadialGradient id={`coin${u}`} cx="38%" cy="32%" r="70%">
          <Stop offset="0" stopColor="#FFF4B8" />
          <Stop offset="0.5" stopColor="#F2C94C" />
          <Stop offset="1" stopColor="#B07A12" />
        </RadialGradient>
      </Defs>
      <Circle cx={16} cy={16} r={15} fill="#8A5A0B" />
      <Circle cx={16} cy={15.2} r={14} fill={`url(#coin${u})`} />
      <Circle cx={16} cy={15.2} r={10.5} fill="none" stroke="#B07A12" strokeWidth={1.2} strokeOpacity={0.7} />
      {/* cowrie */}
      <Ellipse cx={16} cy={15.2} rx={5} ry={6.8} fill="#FFF8DC" stroke="#8A5A0B" strokeWidth={1} />
      <Path d="M 16 9.6 C 17 12.5, 15 17.5, 16 20.8" stroke="#8A5A0B" strokeWidth={1.4} fill="none" strokeLinecap="round" />
      <Ellipse cx={11} cy={9.5} rx={3.5} ry={2} fill="#FFFFFF" fillOpacity={0.45} />
    </Svg>
  );
}
