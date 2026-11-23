import { useEffect, useState } from 'react';
import { Animated, Easing, Platform, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, Ellipse, G, Line, Path } from 'react-native-svg';
import { shellStyle, useLook } from '../cosmetics';
import { useStrings } from '../i18n';
import { colors } from '../theme';

const useNativeDriver = Platform.OS !== 'web';

/** One cowrie shell: the open side shows the toothed slit, the closed side the dome. */
/** Where the painted style's dots sit on the back of the shell. */
const DOTS = [
  { x: 0, y: -0.6, r: 0.13 },
  { x: -0.38, y: -0.1, r: 0.11 },
  { x: 0.38, y: -0.1, r: 0.11 },
  { x: 0, y: 0.25, r: 0.15 },
  { x: -0.3, y: 0.65, r: 0.1 },
  { x: 0.3, y: 0.65, r: 0.1 },
];

/** `look`: a shell style to draw (the shop's previews); otherwise the player's own. */
export function Cowrie({ open, size, look }: { open: boolean; size: number; look?: string }) {
  const own = useLook().shells;
  const s = shellStyle(look ?? own);
  const teeth = [-0.42, -0.25, -0.08, 0.08, 0.25, 0.42];
  return (
    <Svg width={size} height={size * 1.3} viewBox="-1 -1.3 2 2.6">
      <Ellipse cx={0.05} cy={0.08} rx={0.82} ry={1.12} fill="#000" fillOpacity={0.25} />
      {open ? (
        <>
          <Ellipse cx={0} cy={0} rx={0.82} ry={1.12} fill={s.open} stroke={s.line} strokeWidth={0.06} />
          <Path d="M 0 -0.95 C 0.12 -0.4, -0.12 0.4, 0 0.95" stroke={s.line} strokeWidth={0.14} fill="none" strokeLinecap="round" />
          {teeth.map((t) => (
            <G key={t}>
              <Line x1={-0.04} y1={t * 1.8} x2={-0.2} y2={t * 1.8} stroke={s.line} strokeWidth={0.05} strokeLinecap="round" />
              <Line x1={0.04} y1={t * 1.8} x2={0.2} y2={t * 1.8} stroke={s.line} strokeWidth={0.05} strokeLinecap="round" />
            </G>
          ))}
        </>
      ) : (
        <>
          <Ellipse cx={0} cy={0} rx={0.82} ry={1.12} fill={s.back} stroke={s.line} strokeWidth={0.06} />
          {s.dots &&
            DOTS.map((d, i) => <Circle key={i} cx={d.x} cy={d.y} r={d.r} fill={s.dots![i % s.dots!.length]} stroke={s.line} strokeWidth={0.03} />)}
          <Ellipse cx={-0.2} cy={-0.35} rx={0.3} ry={0.45} fill="#FFFFFF" fillOpacity={s.shine} />
        </>
      )}
    </Svg>
  );
}

/** Where a shell comes to rest on the mat: its centre and angle. */
interface Spot {
  x: number;
  y: number;
  angle: number;
}

/** A small seeded random generator (the resting layout before the first throw stays put). */
function seeded(seed: number): () => number {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Five resting spots spread over the mat at random, never overlapping much. */
function scatter(width: number, height: number, size: number, random: () => number): Spot[] {
  const spots: Spot[] = [];
  const minGap = size * 1.12;
  const left = size * 0.62;
  const right = Math.max(left, width - size * 0.62);
  const top = size * 0.72;
  const bottom = Math.max(top, height - size * 0.72);
  for (let i = 0; i < 5; i++) {
    let best: Spot | null = null;
    let bestGap = -1;
    // Keep the candidate furthest from the others (good enough after a few tries).
    for (let tries = 0; tries < 40; tries++) {
      const c = { x: left + random() * (right - left), y: top + random() * (bottom - top), angle: random() * 360 - 180 };
      const gap = spots.length === 0 ? Infinity : Math.min(...spots.map((s) => Math.hypot(s.x - c.x, s.y - c.y)));
      if (gap > bestGap) {
        best = c;
        bestGap = gap;
      }
      if (gap >= minGap) break;
    }
    spots.push(best!);
  }
  return spots;
}

/** How one shell flies: from the hand to its spot, spinning, with a little bounce. */
interface Flight {
  /** Start, relative to the resting spot. */
  dx: number;
  dy: number;
  /** Height of the arc above the straight line. */
  arc: number;
  startAngle: number;
  delay: number;
}

/** `p` runs 0 → 1 in the air, then 1 → P_END for the bounce on landing. */
const P_END = 1.2;

const STILL: Flight = { dx: 0, dy: 0, arc: 0, startAngle: 0, delay: 0 };

/**
 * One shell: drawn at its resting spot and moved back along its flight while
 * in the air. If it lands open it pops and glows.
 */
function FlyingCowrie({
  open,
  spot,
  flight,
  progress,
  reveal,
  index,
  size,
}: {
  open: boolean;
  spot: Spot;
  flight: Flight;
  progress: Animated.Value;
  reveal: boolean;
  index: number;
  size: number;
}) {
  const [pop] = useState(() => new Animated.Value(0));
  const [glow] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (!reveal) {
      glow.setValue(0);
      return;
    }
    const anim = Animated.sequence([
      Animated.delay(120 + index * 80),
      Animated.parallel([
        Animated.sequence([
          Animated.timing(pop, { toValue: 1, duration: 120, easing: Easing.out(Easing.quad), useNativeDriver }),
          Animated.spring(pop, { toValue: 0, useNativeDriver, speed: 14, bounciness: 14 }),
        ]),
        Animated.timing(glow, { toValue: 1, duration: 240, useNativeDriver }),
      ]),
    ]);
    anim.start();
    return () => anim.stop();
  }, [reveal, index, pop, glow]);

  const { dx, dy, arc, startAngle } = flight;
  const p = progress;
  // A parabola through the air (sampled), then a small hop on landing.
  const translateX = p.interpolate({ inputRange: [0, 0.5, 1, P_END], outputRange: [dx, dx * 0.32, 0, 0] });
  const translateY = p.interpolate({
    inputRange: [0, 0.25, 0.5, 0.75, 1, 1.1, P_END],
    outputRange: [dy, dy * 0.75 - arc * 0.75, dy * 0.5 - arc, dy * 0.25 - arc * 0.75, 0, -size * 0.14, 0],
  });
  const rotate = p.interpolate({
    inputRange: [0, 1, 1.1, P_END],
    outputRange: [`${startAngle}deg`, `${spot.angle + 8}deg`, `${spot.angle - 4}deg`, `${spot.angle}deg`],
  });
  // Nearer the eye at the top of the arc.
  const scale = p.interpolate({ inputRange: [0, 0.5, 1, 1.1, P_END], outputRange: [0.8, 1.38, 1, 1.05, 1] });
  // Its shadow on the mat grows as it comes down.
  const shadowOpacity = p.interpolate({ inputRange: [0, 0.7, 1, P_END], outputRange: [0, 0.08, 0.28, 0.28] });
  const shadowScale = p.interpolate({ inputRange: [0, 1, P_END], outputRange: [0.4, 1, 1] });
  const w = size;
  const h = size * 1.3;

  return (
    <>
      <Animated.View
        style={[
          styles.shadow,
          {
            left: spot.x - w * 0.42,
            top: spot.y - h * 0.3,
            width: w * 0.84,
            height: h * 0.66,
            borderRadius: w,
            opacity: shadowOpacity,
            transform: [{ translateX: w * 0.06 }, { translateY: h * 0.06 }, { rotate: `${spot.angle}deg` }, { scale: shadowScale }],
          },
        ]}
      />
      <Animated.View
        style={[
          styles.glow,
          {
            left: spot.x - w * 0.65,
            top: spot.y - w * 0.65,
            width: w * 1.3,
            height: w * 1.3,
            borderRadius: w,
            opacity: glow.interpolate({ inputRange: [0, 1], outputRange: [0, 0.4] }),
            transform: [{ scale: glow.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1.15] }) }],
          },
        ]}
      />
      <Animated.View
        style={{
          position: 'absolute',
          left: spot.x - w / 2,
          top: spot.y - h / 2,
          transform: [
            { translateX },
            { translateY },
            { rotate },
            { scale },
            { scale: pop.interpolate({ inputRange: [0, 1], outputRange: [1, 1.28] }) },
          ],
        }}
      >
        <Cowrie open={open} size={size} />
      </Animated.View>
    </>
  );
}

export interface ShellsProps {
  /** Last result (true = open), or null before the first throw. */
  shells: boolean[] | null;
  rolling: boolean;
  size?: number;
  /** How long a throw takes (the shells are in the air for most of it). */
  rollMs?: number;
}

/**
 * The five cowries on a mat. A throw tosses them from the player's side of
 * the panel: each flies its own arc, spinning and flipping, and lands with a
 * small bounce somewhere new on the mat, at its own angle.
 */
export function Shells({ shells, rolling, size = 34, rollMs = 650 }: ShellsProps) {
  const t = useStrings();
  const height = Math.round(size * 2.15);
  const [width, setWidth] = useState(size * 9);
  const [spots, setSpots] = useState<Spot[]>(() => scatter(size * 9, height, size, seeded(7)));
  const [flights, setFlights] = useState<Flight[]>(() => [STILL, STILL, STILL, STILL, STILL]);
  const [progress] = useState(() => Array.from({ length: 5 }, () => new Animated.Value(P_END)));
  const [flicker, setFlicker] = useState<boolean[]>([false, false, false, false, false]);
  const [wasRolling, setWasRolling] = useState(rolling);
  // Each throw scatters differently: a seed picked once, plus a throw counter.
  const [seedBase] = useState(() => Math.floor(Math.random() * 1e9));
  const [throwCount, setThrowCount] = useState(0);

  // A new throw (rolling just switched on): pick where each shell lands and how
  // it gets there. Done while rendering, so the very first frame is already the
  // new throw, with every shell still in the hand.
  if (rolling !== wasRolling) {
    setWasRolling(rolling);
    if (rolling) {
      const random = seeded(seedBase + throwCount * 7919);
      setThrowCount(throwCount + 1);
      const next = scatter(width, height, size, random);
      // The hand is on the player's side of the panel (below the mat).
      const hand = { x: width / 2 + (random() - 0.5) * size, y: height + size * 0.35 };
      setSpots(next);
      setFlights(
        next.map((spot) => {
          const turns = (1 + Math.floor(random() * 3)) * (random() < 0.5 ? -1 : 1);
          return {
            dx: hand.x + (random() - 0.5) * size * 0.8 - spot.x,
            dy: hand.y - spot.y,
            arc: size * (0.9 + random() * 0.9),
            startAngle: spot.angle - turns * 360,
            delay: random() * Math.min(110, rollMs * 0.15),
          };
        }),
      );
    }
  }

  // Fly them (and flip their faces in the air) once the new throw is drawn.
  useEffect(() => {
    if (!rolling) return;
    const air = Math.max(220, rollMs * 0.82);
    progress.forEach((p) => p.setValue(0));
    const anim = Animated.parallel(
      progress.map((p, i) =>
        Animated.sequence([
          Animated.delay(flights[i]!.delay),
          Animated.timing(p, { toValue: 1, duration: air - flights[i]!.delay, easing: Easing.out(Easing.quad), useNativeDriver }),
          Animated.timing(p, { toValue: P_END, duration: 170, easing: Easing.out(Easing.quad), useNativeDriver }),
        ]),
      ),
    );
    anim.start();
    const id = setInterval(() => setFlicker(Array.from({ length: 5 }, () => Math.random() < 0.5)), 90);
    return () => clearInterval(id);
    // Only when a throw starts (`flights` is set in the same render).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rolling]);

  const onLayout = (e: LayoutChangeEvent) => {
    const w = Math.round(e.nativeEvent.layout.width);
    if (w > 0 && Math.abs(w - width) > 2) {
      setWidth(w);
      // Keep resting shells on the mat when its width changes.
      if (!rolling) setSpots(scatter(w, height, size, seeded(7)));
    }
  };

  const shown = rolling ? flicker : (shells ?? [false, false, false, false, false]);
  const label = shells && !rolling ? t.shellsOpenA11y(shells.filter(Boolean).length) : t.shellsA11y;
  return (
    <View style={[styles.mat, { height }, !shells && !rolling && styles.idle]} onLayout={onLayout} accessibilityLabel={label}>
      {spots.map((spot, i) => (
        <FlyingCowrie
          key={i}
          open={shown[i] ?? false}
          spot={spot}
          flight={flights[i] ?? STILL}
          progress={progress[i]!}
          reveal={!!shells && !rolling && !!shown[i]}
          index={i}
          size={size}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  mat: {
    alignSelf: 'stretch',
    borderRadius: 18,
    backgroundColor: 'rgba(0, 0, 0, 0.16)',
    borderWidth: 1,
    borderColor: 'rgba(246, 215, 123, 0.14)',
  },
  idle: { opacity: 0.6 },
  glow: { position: 'absolute', backgroundColor: colors.highlight },
  shadow: { position: 'absolute', backgroundColor: '#000' },
});
