import { memo, useEffect, useState } from 'react';
import { Animated, Easing, Platform, StyleSheet, View, useWindowDimensions } from 'react-native';
import Svg, { Circle, Defs, G, LinearGradient, Path, Pattern, RadialGradient, Rect, Stop } from 'react-native-svg';
import { backdrop as c } from '../theme';
import { useSvgId } from './svgId';

const useNativeDriver = Platform.OS !== 'web';

/** One ring of rangoli petals around (0, 0). */
function petalRing(count: number, r0: number, r1: number, width: number, turn = 0): string {
  let d = '';
  for (let i = 0; i < count; i++) {
    const a = ((i + turn) / count) * Math.PI * 2;
    const ux = Math.cos(a);
    const uy = Math.sin(a);
    const vx = -uy;
    const vy = ux;
    const rm = (r0 + r1) / 2;
    const p0 = [ux * r0, uy * r0];
    const p1 = [ux * r1, uy * r1];
    const q1 = [ux * rm + vx * width, uy * rm + vy * width];
    const q2 = [ux * rm - vx * width, uy * rm - vy * width];
    d += `M ${p0[0]!.toFixed(1)} ${p0[1]!.toFixed(1)} Q ${q1[0]!.toFixed(1)} ${q1[1]!.toFixed(1)} ${p1[0]!.toFixed(1)} ${p1[1]!.toFixed(1)} Q ${q2[0]!.toFixed(1)} ${q2[1]!.toFixed(1)} ${p0[0]!.toFixed(1)} ${p0[1]!.toFixed(1)} Z `;
  }
  return d;
}

/** Dots evenly round a circle. */
function dotRing(count: number, r: number): { x: number; y: number }[] {
  return Array.from({ length: count }, (_, i) => {
    const a = (i / count) * Math.PI * 2;
    return { x: Math.cos(a) * r, y: Math.sin(a) * r };
  });
}

/** A large, faint gold rangoli behind the home screen's logo and board. */
function Mandala({ size }: { size: number }) {
  const gold = c.gold;
  return (
    <Svg width={size} height={size} viewBox="-100 -100 200 200">
      <G fill="none" stroke={gold}>
        <Circle r={96} strokeOpacity={0.1} strokeWidth={0.6} />
        <Circle r={90} strokeOpacity={0.08} strokeWidth={0.4} strokeDasharray="2 3" />
        <Path d={petalRing(24, 62, 88, 6)} strokeOpacity={0.1} strokeWidth={0.6} />
        <Path d={petalRing(16, 40, 64, 7, 0.5)} strokeOpacity={0.12} strokeWidth={0.6} />
        <Circle r={38} strokeOpacity={0.12} strokeWidth={0.6} />
        <Path d={petalRing(8, 14, 36, 8)} strokeOpacity={0.14} strokeWidth={0.7} />
        <Circle r={12} strokeOpacity={0.14} strokeWidth={0.6} />
      </G>
      {dotRing(24, 93).map((p, i) => (
        <Circle key={`o${i}`} cx={p.x} cy={p.y} r={1.1} fill={gold} fillOpacity={0.16} />
      ))}
      {dotRing(16, 66).map((p, i) => (
        <Circle key={`m${i}`} cx={p.x} cy={p.y} r={1.2} fill={gold} fillOpacity={0.15} />
      ))}
    </Svg>
  );
}

/** A few kolam dots that slowly brighten and fade, like lamps in the dark. */
function Twinkles({ width, height }: { width: number; height: number }) {
  const [phase] = useState(() => new Animated.Value(0));
  useEffect(() => {
    const loop = Animated.loop(Animated.timing(phase, { toValue: 1, duration: 6000, easing: Easing.linear, useNativeDriver }));
    loop.start();
    return () => loop.stop();
  }, [phase]);
  // Fixed spots (fractions of the screen), each on its own part of the cycle.
  const spots = [
    [0.12, 0.08], [0.86, 0.12], [0.08, 0.42], [0.93, 0.38], [0.18, 0.7], [0.82, 0.66], [0.5, 0.04], [0.7, 0.9], [0.3, 0.93],
  ];
  return (
    <>
      {spots.map(([fx, fy], i) => {
        const o = i / spots.length;
        return (
          <Animated.View
            key={i}
            style={[
              styles.twinkle,
              {
                left: fx! * width - 3,
                top: fy! * height - 3,
                opacity: phase.interpolate({
                  inputRange: [0, o, Math.min(1, o + 0.12), Math.min(1, o + 0.24), 1],
                  outputRange: [0.15, 0.15, 0.85, 0.15, 0.15],
                  extrapolate: 'clamp',
                }),
              },
            ]}
          />
        );
      })}
    </>
  );
}

/**
 * Backgrounds.
 *  - `menu` (default): a deep green glow, brightest at the top, a faint gold
 *    lattice of kolam dots and the board's X marks, a large rangoli behind the
 *    top of the screen, and a few twinkling dots.
 *  - `table`: for the game – a dark walnut table with a warm light on the board.
 */
function BackdropImpl({ variant = 'menu' }: { variant?: 'menu' | 'table' }) {
  // Gradient ids are document-wide on the web, and screens underneath stay
  // mounted (hidden), so each copy needs its own ids.
  const uid = useSvgId();
  const { width, height } = useWindowDimensions();
  const glow = `bdGlow${uid}`;
  const lattice = `bdLattice${uid}`;
  const vignette = `bdVignette${uid}`;
  const wood = `bdWood${uid}`;
  const grain = `bdGrain${uid}`;
  const light = `bdLight${uid}`;

  if (variant === 'table') {
    return (
      <View style={[StyleSheet.absoluteFill, { pointerEvents: 'none', backgroundColor: '#24160D' }]}>
        <Svg width="100%" height="100%">
          <Defs>
            <LinearGradient id={wood} x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor="#3B2414" />
              <Stop offset="0.5" stopColor="#2C1A0E" />
              <Stop offset="1" stopColor="#1C1008" />
            </LinearGradient>
            {/* Long wavy grain, like planks of a carrom table. */}
            <Pattern id={grain} width={120} height={46} patternUnits="userSpaceOnUse">
              <Path d="M 0 8 C 30 4, 60 12, 120 8" stroke="#000" strokeOpacity={0.22} strokeWidth={1.2} fill="none" />
              <Path d="M 0 19 C 40 23, 80 15, 120 19" stroke="#C08850" strokeOpacity={0.07} strokeWidth={1} fill="none" />
              <Path d="M 0 31 C 25 27, 70 35, 120 31" stroke="#000" strokeOpacity={0.16} strokeWidth={0.8} fill="none" />
              <Path d="M 0 45.5 L 120 45.5" stroke="#000" strokeOpacity={0.35} strokeWidth={1} />
            </Pattern>
            <RadialGradient id={light} cx="50%" cy="40%" rx="70%" ry="55%" fx="50%" fy="40%">
              <Stop offset="0" stopColor="#FFD9A0" stopOpacity={0.22} />
              <Stop offset="0.6" stopColor="#FFD9A0" stopOpacity={0.05} />
              <Stop offset="1" stopColor="#000" stopOpacity={0} />
            </RadialGradient>
            <RadialGradient id={vignette} cx="50%" cy="45%" r="75%">
              <Stop offset="0.55" stopColor="#000" stopOpacity={0} />
              <Stop offset="1" stopColor="#000" stopOpacity={0.55} />
            </RadialGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${wood})`} />
          <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${grain})`} />
          <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${light})`} />
          <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${vignette})`} />
        </Svg>
      </View>
    );
  }

  const mandala = Math.round(Math.min(Math.max(width, 320) * 1.15, 900));
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
      <View style={[styles.mandala, { width: mandala, height: mandala, left: (width - mandala) / 2, top: Math.round(height * 0.3) - mandala / 2 }]}>
        <Mandala size={mandala} />
      </View>
      <Twinkles width={width} height={height} />
    </View>
  );
}

export const Backdrop = memo(BackdropImpl);

const styles = StyleSheet.create({
  mandala: { position: 'absolute' },
  twinkle: { position: 'absolute', width: 6, height: 6, borderRadius: 3, backgroundColor: '#F6D77B' },
});
