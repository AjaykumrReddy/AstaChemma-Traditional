import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius } from '../theme';

export interface SegmentedProps<T extends string | number> {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  compact?: boolean;
}

export function Segmented<T extends string | number>({ options, value, onChange, compact }: SegmentedProps<T>) {
  return (
    <View style={styles.track} accessibilityRole="radiogroup">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={String(o.value)}
            onPress={() => onChange(o.value)}
            accessibilityRole="radio"
            accessibilityState={{ selected: active }}
            style={[styles.option, compact && styles.compact, active && styles.active]}
          >
            <Text style={[styles.label, compact && styles.compactLabel, active && styles.activeLabel]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    backgroundColor: colors.background,
    borderRadius: radius.md,
    padding: 3,
    gap: 3,
  },
  option: {
    flex: 1,
    paddingVertical: 9,
    paddingHorizontal: 6,
    borderRadius: radius.sm + 1,
    alignItems: 'center',
  },
  compact: { paddingVertical: 7, paddingHorizontal: 4 },
  active: { backgroundColor: colors.chalk },
  label: { color: colors.textMuted, fontWeight: '600', fontSize: 14 },
  compactLabel: { fontSize: 12.5 },
  activeLabel: { color: colors.background },
});
