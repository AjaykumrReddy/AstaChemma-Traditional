import type { PieceKind, Seat } from '@asta/engine';
import { memo, useEffect, useRef, useState } from 'react';
import { Animated, Easing, Platform, Pressable, StyleSheet } from 'react-native';
import Svg, { Circle, Defs, Ellipse, Path, RadialGradient, Stop } from 'react-native-svg';
import { colors, seatColors, type SeatShape } from '../theme';
import { shapePath } from './SeatMark';

/** Largest piece radius, in board units; smaller pieces are scaled down from it. */
const MAX_R = 0.3;
/** Room around the marble for the glow ring. */
const PAD = 1.4;
const useNativeDriver = Platform.OS !== 'web';

export interface PieceViewProps {
  id: string;
  kind: PieceKind;
  seat: Seat;
  /** Screen-reader label, e.g. "Yellow Mother", in the current language. */
  label: string;
  /** The player's shape, drawn on the marble when "Shape markers" is on. */
  shape: SeatShape | null;
  /** Centre position and radius, in pixels. */
  x: number;
  y: number;
  radius: number;
  /** Pixels per board unit (one square). */
  unit: number;
  home: boolean;
  movable: boolean;
  selected: boolean;
  /** Draw above other pieces (the piece that is moving). */
  raised: boolean;
  stepMs: number;
  onPress?: (id: string) => void;
}

/**
 * A glass-marble piece. It hops square to square in an arc (its shadow stays
 * on the board), squashes as it lands, pulses when it can move, bobs when
 * selected, flies back in a high arc when captured and pops on reaching home.
 */
function PieceViewImpl({ id, kind, seat, label, shape, x, y, radius, unit, home, movable, selected, raised, stepMs, onPress }: PieceViewProps) {
  const box = MAX_R * unit * 2 * PAD;
  const baseScale = radius / (MAX_R * unit);
  const targetScale = baseScale * (selected ? 1.12 : 1);
  // Heights are in the piece's own (unscaled) pixels, so divide by its scale.
  const hopHeight = (unit * 0.32) / Math.max(baseScale, 0.3);

  // Animated values are created once and then driven imperatively.
  const [pos] = useState(() => new Animated.ValueXY({ x: x - box / 2, y: y - box / 2 }));
  const [scale] = useState(() => new Animated.Value(targetScale));
  const [lift] = useState(() => new Animated.Value(0)); // 0 = on the board, 1 = top of a hop
  const [arc] = useState(() => new Animated.Value(1)); // hop height multiplier
  const [squash] = useState(() => new Animated.Value(0));
  const [pulse] = useState(() => new Animated.Value(0));
  const [bob] = useState(() => new Animated.Value(0));
  const last = useRef({ x, y, unit, home });

  // Movement: hop one square, fly back after a capture, or settle in place.
  useEffect(() => {
    const prev = last.current;
    last.current = { x, y, unit, home };
    const target = { x: x - box / 2, y: y - box / 2 };

    if (prev.unit !== unit) {
      pos.setValue(target);
      scale.setValue(targetScale);
      return;
    }

    const distance = Math.hypot(x - prev.x, y - prev.y) / unit;
    if (distance < 0.01) {
      Animated.spring(scale, { toValue: targetScale, useNativeDriver, speed: 18, bounciness: 8 }).start();
      return;
    }

    const land = Animated.sequence([
      Animated.timing(squash, { toValue: 1, duration: 70, easing: Easing.out(Easing.quad), useNativeDriver }),
      Animated.spring(squash, { toValue: 0, useNativeDriver, speed: 20, bounciness: 14 }),
    ]);
    const arrivingHome = home && !prev.home;
    const isStep = distance > 0.25 && distance < 1.3;
    let animation: Animated.CompositeAnimation;

    if (isStep) {
      // One square: a hop in an arc, then a squash on landing.
      arc.setValue(1);
      animation = Animated.sequence([
        Animated.parallel([
          Animated.timing(pos, { toValue: target, duration: stepMs, easing: Easing.inOut(Easing.quad), useNativeDriver }),
          Animated.sequence([
            Animated.timing(lift, { toValue: 1, duration: stepMs / 2, easing: Easing.out(Easing.quad), useNativeDriver }),
            Animated.timing(lift, { toValue: 0, duration: stepMs / 2, easing: Easing.in(Easing.quad), useNativeDriver }),
          ]),
          Animated.timing(scale, { toValue: targetScale, duration: stepMs, useNativeDriver }),
        ]),
        land,
      ]);
    } else {
      // A long trip (sent back after a capture, or re-arranging): a high arc.
      const duration = Math.min(850, 260 + distance * 110);
      arc.setValue(distance > 1.5 ? Math.min(3.2, 1 + distance * 0.5) : 0.4);
      animation = Animated.sequence([
        Animated.parallel([
          Animated.timing(pos, { toValue: target, duration, easing: Easing.inOut(Easing.cubic), useNativeDriver }),
          Animated.sequence([
            Animated.timing(lift, { toValue: 1, duration: duration / 2, easing: Easing.out(Easing.quad), useNativeDriver }),
            Animated.timing(lift, { toValue: 0, duration: duration / 2, easing: Easing.in(Easing.quad), useNativeDriver }),
          ]),
          Animated.timing(scale, { toValue: targetScale, duration, useNativeDriver }),
        ]),
        land,
      ]);
    }

    if (arrivingHome) {
      // Reaching home: a bright pop after landing.
      animation = Animated.sequence([
        animation,
        Animated.timing(scale, { toValue: targetScale * 1.7, duration: 160, easing: Easing.out(Easing.quad), useNativeDriver }),
        Animated.spring(scale, { toValue: targetScale, useNativeDriver, speed: 10, bounciness: 16 }),
      ]);
    }
    animation.start();
    return () => animation.stop();
  }, [x, y, unit, home, box, targetScale, stepMs, pos, scale, lift, arc, squash]);

  // A soft glow ring that breathes while the piece can move.
  useEffect(() => {
    if (!movable) {
      pulse.setValue(0);
      return;
    }
    const loop = Animated.loop(Animated.timing(pulse, { toValue: 1, duration: 1100, easing: Easing.out(Easing.quad), useNativeDriver }));
    loop.start();
    return () => loop.stop();
  }, [movable, pulse]);

  // The selected piece bobs gently, waiting for its move.
  useEffect(() => {
    if (!selected) {
      const settle = Animated.timing(bob, { toValue: 0, duration: 150, useNativeDriver });
      settle.start();
      return () => settle.stop();
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(bob, { toValue: 1, duration: 380, easing: Easing.inOut(Easing.sin), useNativeDriver }),
        Animated.timing(bob, { toValue: 0, duration: 380, easing: Easing.inOut(Easing.sin), useNativeDriver }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [selected, bob]);

  const colour = seatColors[seat];
  const gradientId = `glass-${id}`;
  const marble = MAX_R * unit * 2; // diameter in the piece's own pixels
  const ring = marble * 1.24;

  const height = Animated.multiply(lift, arc);
  const bodyY = Animated.add(
    height.interpolate({ inputRange: [0, 1], outputRange: [0, -hopHeight] }),
    bob.interpolate({ inputRange: [0, 1], outputRange: [0, -hopHeight * 0.3] }),
  );

  return (
    <Animated.View
      style={[
        styles.piece,
        {
          width: box,
          height: box,
          zIndex: raised ? 30 : selected ? 20 : movable ? 10 : 1,
          pointerEvents: movable ? 'auto' : 'none',
        },
        { transform: [{ translateX: pos.x }, { translateY: pos.y }, { scale }] },
      ]}
    >
      <Pressable
        onPress={movable && onPress ? () => onPress(id) : undefined}
        disabled={!movable}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ selected, disabled: !movable }}
        style={styles.fill}
      >
        {/* Shadow stays on the board and shrinks as the piece rises */}
        <Animated.View
          style={[
            styles.shadow,
            {
              // A circle squashed into an oval, sitting just under the marble.
              width: marble * 0.95,
              height: marble * 0.95,
              borderRadius: marble,
              left: (box - marble * 0.95) / 2 + marble * 0.04,
              top: (box - marble * 0.95) / 2 + marble * 0.3,
              opacity: height.interpolate({ inputRange: [0, 3], outputRange: [0.32, 0.08], extrapolate: 'clamp' }),
              transform: [
                { scaleY: 0.45 },
                { scale: height.interpolate({ inputRange: [0, 3], outputRange: [1, 0.45], extrapolate: 'clamp' }) },
              ],
            },
          ]}
        />

        {/* Breathing glow ring when the piece can move */}
        {movable && (
          <Animated.View
            style={[
              styles.ring,
              {
                width: ring,
                height: ring,
                borderRadius: ring / 2,
                left: (box - ring) / 2,
                top: (box - ring) / 2,
                borderColor: selected ? colors.chalk : colors.highlight,
                opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.95, 0] }),
                transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1.5] }) }],
              },
            ]}
          />
        )}

        {/* The marble: lifted for hops, squashed on landing */}
        <Animated.View
          style={[
            styles.fill,
            {
              transform: [
                { translateY: bodyY },
                { scaleX: squash.interpolate({ inputRange: [0, 1], outputRange: [1, 1.16] }) },
                { scaleY: squash.interpolate({ inputRange: [0, 1], outputRange: [1, 0.84] }) },
              ],
            },
          ]}
        >
          <Svg width={box} height={box} viewBox={`${-PAD} ${-PAD} ${PAD * 2} ${PAD * 2}`}>
            <Defs>
              <RadialGradient id={gradientId} cx="35%" cy="30%" r="75%">
                <Stop offset="0" stopColor={colour.light} />
                <Stop offset="0.45" stopColor={colour.fill} />
                <Stop offset="1" stopColor={colour.dark} />
              </RadialGradient>
            </Defs>
            {movable && (
              <Circle
                r={1.22}
                fill={selected ? colors.chalk : colors.highlight}
                fillOpacity={0.16}
                stroke={selected ? colors.chalk : colors.highlight}
                strokeWidth={selected ? 0.18 : 0.12}
              />
            )}
            <Circle r={1} fill={`url(#${gradientId})`} opacity={home ? 0.85 : 1} />
            {/* Glassy highlight */}
            <Ellipse cx={-0.32} cy={-0.42} rx={0.32} ry={0.2} fill="#FFFFFF" fillOpacity={0.55} />
            {kind === 'mother' && <Circle r={0.45} fill="none" stroke="#FFFFFF" strokeOpacity={0.92} strokeWidth={0.18} />}
            {/* The player's shape: inside the Mother's ring, or centred on a Child. */}
            {shape && (
              <Path
                d={shapePath(shape, kind === 'mother' ? 0.24 : 0.46)}
                fill="#FFFFFF"
                fillOpacity={0.95}
                stroke={colour.dark}
                strokeWidth={0.07}
                strokeLinejoin="round"
              />
            )}
          </Svg>
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}

export const PieceView = memo(PieceViewImpl);

const styles = StyleSheet.create({
  piece: { position: 'absolute', left: 0, top: 0 },
  fill: { position: 'absolute', left: 0, top: 0, right: 0, bottom: 0 },
  shadow: { position: 'absolute', backgroundColor: '#000' },
  ring: { position: 'absolute', borderWidth: 3 },
});
