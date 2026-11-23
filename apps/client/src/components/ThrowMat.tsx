import { useEffect, useState } from 'react';
import { Animated, Easing, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius } from '../theme';
import { Shells } from './Shells';

const useNativeDriver = Platform.OS !== 'web';

export interface ThrowMatProps {
  /** The player's colours: the mat is always theirs. */
  fill: string;
  dark: string;
  /** Text colour on `fill` (dark on yellow, white on the others). */
  ink: string;
  /** Whose turn it is: this mat is live (otherwise it's faded and can't be tapped). */
  active: boolean;
  /** Tapping the mat throws now (a throw is due, or a 4/8 may be kept and thrown again). */
  canThrow: boolean;
  onThrow: () => void;
  /** Shown big in the corner: the last throw's value, and any kept throws. */
  value: string | number | null;
  kept: (string | number)[];
  shells: boolean[] | null;
  rolling: boolean;
  rollMs: number;
  seed: number;
  height: number;
  onUndo?: () => void;
  undoLabel: string;
  throwLabel: string;
  /** Text-free a11y description of the throw, e.g. "2 shells open". */
  resultLabel: string;
}

/**
 * Pass & Play, players facing each other: each one's own throwing mat, in
 * their colour, with no words. Tap the mat to throw; the shells scatter
 * across it, and the throw's value shows as a big number.
 */
export function ThrowMat({
  fill,
  dark,
  ink,
  active,
  canThrow,
  onThrow,
  value,
  kept,
  shells,
  rolling,
  rollMs,
  seed,
  height,
  onUndo,
  undoLabel,
  throwLabel,
  resultLabel,
}: ThrowMatProps) {
  const [pulse] = useState(() => new Animated.Value(0));
  const inviting = active && canThrow && !rolling;

  // A slow breathing glow while the mat is waiting to be tapped.
  useEffect(() => {
    if (!inviting) {
      pulse.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 750, easing: Easing.inOut(Easing.sin), useNativeDriver }),
        Animated.timing(pulse, { toValue: 0, duration: 750, easing: Easing.inOut(Easing.sin), useNativeDriver }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [inviting, pulse]);

  const shellSize = Math.round(Math.min(34, Math.max(22, height * 0.2)));
  return (
    <Pressable
      onPress={inviting ? onThrow : undefined}
      disabled={!inviting}
      accessibilityRole="button"
      accessibilityLabel={inviting ? throwLabel : resultLabel}
      accessibilityState={{ disabled: !inviting }}
      style={[styles.mat, { height, backgroundColor: `${dark}D9`, borderColor: fill }, !active && styles.idle]}
    >
      {/* Breathing outer glow while it's waiting for a throw. */}
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          styles.passThrough,
          styles.glow,
          { borderColor: fill, shadowColor: fill, opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.15, 0.85] }) },
        ]}
      />
      {/* A woven inner border, like a cloth spread for the shells. */}
      <View style={[StyleSheet.absoluteFill, styles.weave, styles.passThrough]} />
      <Shells shells={shells} rolling={rolling} rollMs={rollMs} seed={seed} size={shellSize} height={height - 16} bare />

      {/* The throw's value, big; kept throws as small numbers beside it. */}
      {value !== null && !rolling && (
        <View style={[styles.valueBox, styles.passThrough]}>
          {kept.map((k, i) => (
            <View key={i} style={[styles.kept, { borderColor: fill }]}>
              <Text style={styles.keptText}>{k}</Text>
            </View>
          ))}
          <View style={[styles.value, { backgroundColor: fill }]}>
            <Text style={[styles.valueText, { color: ink }]}>{value}</Text>
          </View>
        </View>
      )}

      {onUndo && (
        <Pressable onPress={onUndo} hitSlop={8} style={styles.undo} accessibilityRole="button" accessibilityLabel={undoLabel}>
          <Text style={styles.undoText}>↶</Text>
        </Pressable>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  mat: {
    width: '100%',
    borderRadius: radius.lg + 4,
    borderWidth: 2.5,
    padding: 8,
    overflow: 'visible',
  },
  idle: { opacity: 0.45 },
  passThrough: { pointerEvents: 'none' },
  glow: {
    borderRadius: radius.lg + 4,
    borderWidth: 3,
    margin: -3,
    shadowOpacity: 0.9,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 0 },
  },
  weave: {
    margin: 6,
    borderRadius: radius.lg,
    borderWidth: 1.2,
    borderStyle: 'dashed',
    borderColor: 'rgba(246, 215, 123, 0.35)',
  },
  valueBox: { position: 'absolute', top: 8, right: 10, flexDirection: 'row', alignItems: 'center', gap: 6 },
  value: {
    minWidth: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.65)',
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  valueText: { fontSize: 24, fontWeight: '900' },
  kept: { minWidth: 28, height: 28, borderRadius: 14, borderWidth: 2, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.35)' },
  keptText: { color: colors.text, fontSize: 14, fontWeight: '800' },
  undo: {
    position: 'absolute',
    left: 10,
    top: 8,
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderWidth: 1,
    borderColor: 'rgba(246, 215, 123, 0.45)',
  },
  undoText: { color: colors.chalk, fontSize: 18, fontWeight: '800', marginTop: -2 },
});
