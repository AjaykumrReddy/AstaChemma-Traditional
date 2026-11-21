import { StyleSheet, Switch, Text, View } from 'react-native';
import { useGameStore, type Speed } from '../store/game';
import { colors, space } from '../theme';
import { Segmented } from './Segmented';

const SPEED_OPTIONS: { value: Speed; label: string }[] = [
  { value: 'slow', label: 'Slow' },
  { value: 'normal', label: 'Normal' },
  { value: 'fast', label: 'Fast' },
];

function ToggleRow({ title, hint, value, onChange }: { title: string; hint: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <View style={styles.row}>
      <View style={styles.rowText}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.hint}>{hint}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ true: colors.accent, false: colors.surfaceRaised }}
        thumbColor={colors.chalk}
        accessibilityLabel={title}
      />
    </View>
  );
}

/** Game settings: speed, sound and auto-move. Saved on the device. */
export function SettingsPanel() {
  const speed = useGameStore((s) => s.speed);
  const setSpeed = useGameStore((s) => s.setSpeed);
  const sound = useGameStore((s) => s.sound);
  const setSound = useGameStore((s) => s.setSound);
  const autoMove = useGameStore((s) => s.autoMove);
  const setAutoMove = useGameStore((s) => s.setAutoMove);

  return (
    <View style={styles.panel}>
      <View style={styles.field}>
        <Text style={styles.title}>Game speed</Text>
        <Text style={styles.hint}>How fast shells roll, pieces walk and the computer plays.</Text>
        <Segmented options={SPEED_OPTIONS} value={speed} onChange={setSpeed} />
      </View>
      <ToggleRow title="Sound" hint="Shells, steps, captures and celebrations." value={sound} onChange={setSound} />
      <ToggleRow
        title="Auto-move"
        hint="Move for you when a throw allows only one choice."
        value={autoMove}
        onChange={setAutoMove}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { gap: space.lg },
  field: { gap: space.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  rowText: { flex: 1 },
  title: { color: colors.text, fontSize: 15, fontWeight: '600', marginBottom: 2 },
  hint: { color: colors.textMuted, fontSize: 13, lineHeight: 19 },
});
