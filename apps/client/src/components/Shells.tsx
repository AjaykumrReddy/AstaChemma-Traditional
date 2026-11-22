import { useEffect, useState } from 'react';
import { Animated, Easing, Platform, StyleSheet, View } from 'react-native';
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

/** Resting angles, so the shells look scattered rather than lined up. */
const REST = [-14, 8, -4, 16, -10];

/** Sideways scatter while tumbling, per shell. */
const DRIFT = [-9, 6, -3, 8, -6];

/**
 * A shell that leaps and spins while rolling, drops back with a bounce, and —
 * if it landed open — pops with a glow, one after another.
 */
function TumblingCowrie({
  open,
  rolling,
  reveal,
  index,
  size,
}: {
  open: boolean;
  rolling: boolean;
  /** Celebrate this shell landing open. */
  reveal: boolean;
  index: number;
  size: number;
}) {
  // Animated values are created once and then driven imperatively.
  const [spin] = useState(() => new Animated.Value(REST[index]!));
  const [lift] = useState(() => new Animated.Value(0));
  const [drift] = useState(() => new Animated.Value(0));
  const [pop] = useState(() => new Animated.Value(0));
  const [glow] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (rolling) {
      const direction = index % 2 === 0 ? 1 : -1;
      spin.setValue(REST[index]!);
      pop.setValue(0);
      glow.setValue(0);
      const anim = Animated.parallel([
        Animated.loop(
          Animated.timing(spin, {
            toValue: REST[index]! + direction * 360,
            duration: 300 + index * 45,
            easing: Easing.linear,
            useNativeDriver,
          }),
        ),
        Animated.loop(
          Animated.sequence([
            Animated.timing(lift, { toValue: -(18 + (index % 3) * 6), duration: 170, easing: Easing.out(Easing.quad), useNativeDriver }),
            Animated.timing(lift, { toValue: 0, duration: 170, easing: Easing.in(Easing.quad), useNativeDriver }),
          ]),
        ),
        Animated.loop(
          Animated.sequence([
            Animated.timing(drift, { toValue: DRIFT[index]!, duration: 200, easing: Easing.inOut(Easing.sin), useNativeDriver }),
            Animated.timing(drift, { toValue: -DRIFT[index]! * 0.6, duration: 200, easing: Easing.inOut(Easing.sin), useNativeDriver }),
          ]),
        ),
      ]);
      anim.start();
      return () => anim.stop();
    }
    const settle = Animated.parallel([
      Animated.spring(spin, { toValue: REST[index]!, useNativeDriver, speed: 14, bounciness: 10 }),
      Animated.spring(lift, { toValue: 0, useNativeDriver, speed: 12, bounciness: 16 }),
      Animated.spring(drift, { toValue: 0, useNativeDriver, speed: 14, bounciness: 8 }),
    ]);
    settle.start();
    return () => settle.stop();
  }, [rolling, index, spin, lift, drift, pop, glow]);

  // Open shells pop one after another once they land.
  useEffect(() => {
    if (!reveal) return;
    const anim = Animated.sequence([
      Animated.delay(180 + index * 90),
      Animated.parallel([
        Animated.sequence([
          Animated.timing(pop, { toValue: 1, duration: 130, easing: Easing.out(Easing.quad), useNativeDriver }),
          Animated.spring(pop, { toValue: 0, useNativeDriver, speed: 14, bounciness: 14 }),
        ]),
        Animated.timing(glow, { toValue: 1, duration: 260, useNativeDriver }),
      ]),
    ]);
    anim.start();
    return () => anim.stop();
  }, [reveal, index, pop, glow]);

  const rotate = spin.interpolate({ inputRange: [-720, 720], outputRange: ['-720deg', '720deg'] });
  return (
    <View>
      <Animated.View
        style={[
          styles.glow,
          {
            width: size * 1.25,
            height: size * 1.25,
            borderRadius: size,
            left: -size * 0.125,
            top: size * 0.65 - size * 0.625,
            opacity: glow.interpolate({ inputRange: [0, 1], outputRange: [0, 0.4] }),
            transform: [{ scale: glow.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1.15] }) }],
          },
        ]}
      />
      <Animated.View
        style={{
          transform: [
            { translateX: drift },
            { translateY: lift },
            { rotate },
            { scale: pop.interpolate({ inputRange: [0, 1], outputRange: [1, 1.3] }) },
          ],
        }}
      >
        <Cowrie open={open} size={size} />
      </Animated.View>
    </View>
  );
}

export interface ShellsProps {
  /** Last result (true = open), or null before the first throw. */
  shells: boolean[] | null;
  rolling: boolean;
  size?: number;
}

/** The five cowries; they tumble while a throw is in progress. */
export function Shells({ shells, rolling, size = 34 }: ShellsProps) {
  const t = useStrings();
  const [flicker, setFlicker] = useState<boolean[]>([false, false, false, false, false]);

  // While rolling, flip faces now and then so the shells look like they tumble.
  useEffect(() => {
    if (!rolling) return;
    const id = setInterval(() => setFlicker(Array.from({ length: 5 }, () => Math.random() < 0.5)), 120);
    return () => clearInterval(id);
  }, [rolling]);

  const shown = rolling ? flicker : (shells ?? [false, false, false, false, false]);
  const label = shells && !rolling ? t.shellsOpenA11y(shells.filter(Boolean).length) : t.shellsA11y;
  return (
    <View style={styles.row} accessibilityLabel={label}>
      {shown.map((open, i) => (
        <View key={i} style={!shells && !rolling ? styles.idle : undefined}>
          <TumblingCowrie open={open} rolling={rolling} reveal={!!shells && !rolling && open} index={i} size={size} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', paddingVertical: 4 },
  idle: { opacity: 0.55 },
  glow: { position: 'absolute', backgroundColor: colors.highlight },
});
