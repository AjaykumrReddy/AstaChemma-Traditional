import { StyleSheet, Text, View } from 'react-native';

/** Warm, readable backgrounds; each account always gets the same one. */
const PALETTE = ['#C2410C', '#1D4ED8', '#047857', '#7C3AED', '#B91C1C', '#0E7490', '#A16207', '#BE185D'];

function colourFor(seed: string): string {
  let h = 0;
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return PALETTE[h % PALETTE.length]!;
}

/** A round avatar with the player's initial, ringed in gold. */
export function Avatar({ name, seed, size = 36 }: { name: string; seed: string; size?: number }) {
  const initial = [...name.trim()][0]?.toUpperCase() ?? '?';
  return (
    <View
      style={[
        styles.circle,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: colourFor(seed), borderWidth: Math.max(1.5, size / 18) },
      ]}
    >
      <Text style={[styles.initial, { fontSize: size * 0.46 }]}>{initial}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  circle: { alignItems: 'center', justifyContent: 'center', borderColor: '#F6D77B' },
  initial: { color: '#FFFFFF', fontWeight: '900' },
});
