import { memo, useEffect, useState } from 'react';
import { Animated, Easing, Platform, StyleSheet, View } from 'react-native';
import type { BoardEffect } from '../feedback/effects';
import { boardColors } from '../theme';

const useNativeDriver = Platform.OS !== 'web';

/** Small deterministic random generator so particle layouts are pure and repeatable. */
function seeded(seed: number) {
  let s = seed * 9301 + 49297;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

// ---------------------------------------------------------------------------
// Board effects: bursts of particles and expanding rings at a square
// ---------------------------------------------------------------------------

interface Particle {
  dx: number;
  dy: number;
  size: number;
  color: string;
}

function makeParticles(seed: number, count: number, reach: number, palette: string[]): Particle[] {
  const rand = seeded(seed);
  return Array.from({ length: count }, (_, i) => {
    const angle = (i / count) * Math.PI * 2 + rand() * 0.5;
    const distance = reach * (0.55 + rand() * 0.6);
    return {
      dx: Math.cos(angle) * distance,
      dy: Math.sin(angle) * distance,
      size: 0.07 + rand() * 0.08,
      color: palette[i % palette.length]!,
    };
  });
}

const SETTINGS: Record<BoardEffect['kind'], { particles: number; reach: number; rings: number; duration: number }> = {
  capture: { particles: 16, reach: 1.1, rings: 2, duration: 700 },
  home: { particles: 24, reach: 1.6, rings: 3, duration: 1000 },
  release: { particles: 20, reach: 1.3, rings: 3, duration: 900 },
  enter: { particles: 8, reach: 0.6, rings: 1, duration: 550 },
};

function EffectAtCell({ effect, x, y, unit, onDone }: { effect: BoardEffect; x: number; y: number; unit: number; onDone: (id: number) => void }) {
  const settings = SETTINGS[effect.kind];
  const [progress] = useState(() => new Animated.Value(0));
  const [particles] = useState(() =>
    makeParticles(effect.id, settings.particles, settings.reach, [effect.color, boardColors.gold, '#FFFFFF']),
  );

  useEffect(() => {
    const anim = Animated.timing(progress, {
      toValue: 1,
      duration: settings.duration,
      easing: Easing.out(Easing.cubic),
      useNativeDriver,
    });
    anim.start(() => onDone(effect.id));
    return () => anim.stop();
  }, [progress, settings.duration, effect.id, onDone]);

  const ringSize = unit;
  return (
    <View style={[styles.effect, { left: x, top: y }]}>
      {/* A glow flash at the centre */}
      <Animated.View
        style={[
          styles.centered,
          {
            width: unit * 1.1,
            height: unit * 1.1,
            borderRadius: unit,
            backgroundColor: effect.color,
            opacity: progress.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0, 0.45, 0] }),
            transform: [{ scale: progress.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1.4] }) }],
          },
        ]}
      />
      {/* Expanding shockwave rings, staggered */}
      {Array.from({ length: settings.rings }, (_, i) => {
        const start = i * 0.15;
        return (
          <Animated.View
            key={`ring${i}`}
            style={[
              styles.centered,
              {
                width: ringSize,
                height: ringSize,
                borderRadius: ringSize / 2,
                borderWidth: Math.max(2, unit * 0.05),
                borderColor: i % 2 === 0 ? effect.color : boardColors.gold,
                opacity: progress.interpolate({
                  inputRange: [0, start, Math.min(start + 0.1, 0.99), 1],
                  outputRange: [0, 0, 0.95, 0],
                }),
                transform: [
                  {
                    scale: progress.interpolate({
                      inputRange: [0, start, 1],
                      outputRange: [0.2, 0.2, 2.2 + i * 0.4],
                    }),
                  },
                ],
              },
            ]}
          />
        );
      })}
      {/* Flying particles */}
      {particles.map((p, i) => {
        const size = p.size * unit;
        return (
          <Animated.View
            key={i}
            style={[
              styles.centered,
              {
                width: size,
                height: size,
                borderRadius: size / 2,
                backgroundColor: p.color,
                opacity: progress.interpolate({ inputRange: [0, 0.1, 0.7, 1], outputRange: [0, 1, 1, 0] }),
                transform: [
                  { translateX: progress.interpolate({ inputRange: [0, 1], outputRange: [0, p.dx * unit] }) },
                  // A little gravity: particles rise then fall.
                  {
                    translateY: progress.interpolate({
                      inputRange: [0, 0.6, 1],
                      outputRange: [0, p.dy * unit * 0.9, p.dy * unit + unit * 0.35],
                    }),
                  },
                  { scale: progress.interpolate({ inputRange: [0, 1], outputRange: [1.2, 0.3] }) },
                ],
              },
            ]}
          />
        );
      })}
    </View>
  );
}

export interface BoardEffectsProps {
  effects: BoardEffect[];
  /** Board units → pixels. */
  px: (v: number) => number;
  unit: number;
  onDone: (id: number) => void;
}

/** All active board effects, drawn above the pieces and never catching touches. */
export const BoardEffects = memo(function BoardEffects({ effects, px, unit, onDone }: BoardEffectsProps) {
  return (
    <View style={[StyleSheet.absoluteFill, { pointerEvents: 'none', zIndex: 50 }]}>
      {effects.map((e) => (
        // Board origin is 1; a square's centre is col + 1.5.
        <EffectAtCell key={e.id} effect={e} x={px(e.cell.col + 1.5)} y={px(e.cell.row + 1.5)} unit={unit} onDone={onDone} />
      ))}
    </View>
  );
});

// ---------------------------------------------------------------------------
// Confetti for the winner
// ---------------------------------------------------------------------------

const CONFETTI_COLORS = ['#F2C94C', '#E5484D', '#3E7BFA', '#30A46C', '#FFFFFF', '#E9C977', '#FF8FB1'];

interface Flake {
  x: number;
  delay: number;
  duration: number;
  drift: number;
  spin: number;
  w: number;
  h: number;
  color: string;
}

export const Confetti = memo(function Confetti({ width, height, seed }: { width: number; height: number; seed: number }) {
  const [anim] = useState(() => new Animated.Value(0));
  const [flakes] = useState<Flake[]>(() => {
    const rand = seeded(seed);
    return Array.from({ length: 70 }, (_, i) => ({
      x: rand(),
      delay: rand() * 0.35,
      duration: 0.55 + rand() * 0.45,
      drift: (rand() - 0.5) * 120,
      spin: (rand() - 0.5) * 1440,
      w: 6 + rand() * 6,
      h: 10 + rand() * 8,
      color: CONFETTI_COLORS[i % CONFETTI_COLORS.length]!,
    }));
  });

  useEffect(() => {
    const loop = Animated.loop(Animated.timing(anim, { toValue: 1, duration: 4200, easing: Easing.linear, useNativeDriver }));
    loop.start();
    return () => loop.stop();
  }, [anim]);

  return (
    <View style={[StyleSheet.absoluteFill, { pointerEvents: 'none', overflow: 'hidden' }]}>
      {flakes.map((f, i) => {
        // Each flake falls during its own slice of the shared 0→1 timeline.
        const start = f.delay;
        const end = Math.min(start + f.duration, 1);
        return (
          <Animated.View
            key={i}
            style={{
              position: 'absolute',
              left: f.x * width,
              top: -30,
              width: f.w,
              height: f.h,
              borderRadius: 2,
              backgroundColor: f.color,
              opacity: anim.interpolate({ inputRange: [0, start, start + 0.02, end, 1], outputRange: [0, 0, 1, 1, 0], extrapolate: 'clamp' }),
              transform: [
                { translateY: anim.interpolate({ inputRange: [0, start, end, 1], outputRange: [0, 0, height + 60, height + 60], extrapolate: 'clamp' }) },
                { translateX: anim.interpolate({ inputRange: [0, start, end, 1], outputRange: [0, 0, f.drift, f.drift], extrapolate: 'clamp' }) },
                {
                  rotate: anim.interpolate({
                    inputRange: [0, start, end, 1],
                    outputRange: ['0deg', '0deg', `${f.spin}deg`, `${f.spin}deg`],
                    extrapolate: 'clamp',
                  }),
                },
              ],
            }}
          />
        );
      })}
    </View>
  );
});

const styles = StyleSheet.create({
  effect: { position: 'absolute', width: 0, height: 0, alignItems: 'center', justifyContent: 'center' },
  centered: { position: 'absolute' },
});
