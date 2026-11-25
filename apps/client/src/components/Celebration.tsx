import { useEffect, useState } from 'react';
import { Animated, Easing, Platform, StyleSheet, Text, View } from 'react-native';
import { CoinIcon } from './CoinIcon';

const useNativeDriver = Platform.OS !== 'web';

/** Where bursts go off (fractions of the screen) and when, within one cycle. */
const BURSTS = [
  { x: 0.25, y: 0.2, delay: 0 },
  { x: 0.75, y: 0.16, delay: 550 },
  { x: 0.5, y: 0.1, delay: 1100 },
  { x: 0.18, y: 0.42, delay: 1650 },
  { x: 0.82, y: 0.4, delay: 2200 },
];
const SPARKS = 16;
const CYCLE_MS = 2900;

/** One firework: sparks fly out from a point, slow down, and fade. */
function Burst({ x, y, delay, colours, radius }: { x: number; y: number; delay: number; colours: string[]; radius: number }) {
  const [p] = useState(() => new Animated.Value(0));
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(p, { toValue: 1, duration: 1100, easing: Easing.out(Easing.cubic), useNativeDriver }),
        Animated.timing(p, { toValue: 0, duration: 0, useNativeDriver }),
        Animated.delay(Math.max(0, CYCLE_MS - 1100 - delay)),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [p, delay]);
  return (
    <View style={[styles.origin, { left: x, top: y }]}>
      {Array.from({ length: SPARKS }, (_, i) => {
        const a = (i / SPARKS) * Math.PI * 2;
        const r = radius * (i % 2 === 0 ? 1 : 0.72);
        return (
          <Animated.View
            key={i}
            style={[
              styles.spark,
              {
                backgroundColor: colours[i % colours.length],
                opacity: p.interpolate({ inputRange: [0, 0.1, 0.7, 1], outputRange: [0, 1, 0.8, 0] }),
                transform: [
                  { translateX: p.interpolate({ inputRange: [0, 1], outputRange: [0, Math.cos(a) * r] }) },
                  // A little gravity at the end.
                  { translateY: p.interpolate({ inputRange: [0, 1], outputRange: [0, Math.sin(a) * r + radius * 0.25] }) },
                  { scale: p.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0.4, 1.2, 0.5] }) },
                ],
              },
            ]}
          />
        );
      })}
    </View>
  );
}

/** Fireworks over the win screen, in the winner's colour, gold and white. */
export function Fireworks({ width, height, colour }: { width: number; height: number; colour: string }) {
  const colours = [colour, '#F6D77B', '#FFFFFF', colour];
  const radius = Math.min(width, height) * 0.16;
  return (
    <View style={[StyleSheet.absoluteFill, styles.passThrough]}>
      {BURSTS.map((b, i) => (
        <Burst key={i} x={b.x * width} y={b.y * height} delay={b.delay} colours={colours} radius={radius} />
      ))}
    </View>
  );
}

/** "+N coins", counting up from 0 with the coin popping. */
export function CoinCountUp({ coins, label }: { coins: number; label: (n: number) => string }) {
  const [shown, setShown] = useState(0);
  const [pop] = useState(() => new Animated.Value(0));
  useEffect(() => {
    const value = new Animated.Value(0);
    const id = value.addListener(({ value: v }) => setShown(Math.round(v)));
    const anim = Animated.sequence([
      Animated.delay(250),
      Animated.parallel([
        Animated.timing(value, { toValue: coins, duration: 1100, easing: Easing.out(Easing.quad), useNativeDriver: false }),
        Animated.sequence([
          Animated.timing(pop, { toValue: 1, duration: 160, useNativeDriver }),
          Animated.spring(pop, { toValue: 0, useNativeDriver, speed: 10, bounciness: 14 }),
        ]),
      ]),
    ]);
    anim.start();
    return () => {
      anim.stop();
      value.removeListener(id);
    };
  }, [coins, pop]);
  return (
    <View style={styles.reward} accessibilityLabel={label(coins)}>
      <Animated.View style={{ transform: [{ scale: pop.interpolate({ inputRange: [0, 1], outputRange: [1, 1.45] }) }, { rotate: pop.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '-18deg'] }) }] }}>
        <CoinIcon size={34} />
      </Animated.View>
      <Text style={styles.rewardText}>{label(shown)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  passThrough: { pointerEvents: 'none' },
  origin: { position: 'absolute', width: 0, height: 0 },
  spark: { position: 'absolute', width: 7, height: 7, borderRadius: 3.5, left: -3.5, top: -3.5 },
  reward: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    alignSelf: 'center',
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderWidth: 1.5,
    borderColor: 'rgba(246, 215, 123, 0.6)',
    marginVertical: 6,
  },
  rewardText: { color: '#F6D77B', fontSize: 24, fontWeight: '900', fontVariant: ['tabular-nums'] },
});
