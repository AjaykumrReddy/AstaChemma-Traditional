import { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, Path, Pattern, RadialGradient, Rect, Stop } from 'react-native-svg';
import { backdrop as c } from '../theme';
import { useSvgId } from './svgId';

/**
 * The menu screens' background: a deep green glow, brightest at the top, with
 * a faint gold lattice of kolam dots and the board's X marks.
 */
function BackdropImpl() {
  // Gradient ids are document-wide on the web, and screens underneath stay
  // mounted (hidden), so each copy needs its own ids.
  const uid = useSvgId();
  const glow = `bdGlow${uid}`;
  const lattice = `bdLattice${uid}`;
  const vignette = `bdVignette${uid}`;
  return (
    <View style={[StyleSheet.absoluteFill, { pointerEvents: 'none' }]}>
      <Svg width="100%" height="100%">
        <Defs>
          <RadialGradient id={glow} cx="50%" cy="18%" rx="95%" ry="75%" fx="50%" fy="18%">
            <Stop offset="0" stopColor={c.glow} />
            <Stop offset="0.55" stopColor={c.mid} />
            <Stop offset="1" stopColor={c.edge} />
          </RadialGradient>
          <Pattern id={lattice} width={56} height={56} patternUnits="userSpaceOnUse">
            {/* diamond lattice */}
            <Path d="M 28 0 L 56 28 L 28 56 L 0 28 Z" fill="none" stroke={c.gold} strokeOpacity={0.07} strokeWidth={1} />
            {/* the board's safe-square X, small, in each diamond */}
            <Path d="M 23 23 L 33 33 M 33 23 L 23 33" stroke={c.gold} strokeOpacity={0.09} strokeWidth={1.4} strokeLinecap="round" />
            {/* kolam dots at the corners */}
            <Circle cx={0} cy={0} r={1.8} fill={c.gold} fillOpacity={0.14} />
            <Circle cx={56} cy={0} r={1.8} fill={c.gold} fillOpacity={0.14} />
            <Circle cx={0} cy={56} r={1.8} fill={c.gold} fillOpacity={0.14} />
            <Circle cx={56} cy={56} r={1.8} fill={c.gold} fillOpacity={0.14} />
          </Pattern>
          <RadialGradient id={vignette} cx="50%" cy="50%" r="75%">
            <Stop offset="0.6" stopColor="#000" stopOpacity={0} />
            <Stop offset="1" stopColor="#000" stopOpacity={0.35} />
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${glow})`} />
        <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${lattice})`} />
        <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${vignette})`} />
      </Svg>
    </View>
  );
}

export const Backdrop = memo(BackdropImpl);
