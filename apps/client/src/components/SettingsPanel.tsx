import { StyleSheet, Switch, Text, View } from 'react-native';
import { STRINGS, useStrings, type Lang } from '../i18n';
import { useGameStore, type Speed } from '../store/game';
import { colors, space } from '../theme';
import { Segmented } from './Segmented';

/** Each language is shown in its own script, so it can be found without reading the other. */
const LANGUAGE_OPTIONS: { value: Lang; label: string }[] = [
  { value: 'en', label: STRINGS.en.langName },
  { value: 'te', label: STRINGS.te.langName },
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

/** Game settings: language, speed, sound, auto-move and shape markers. Saved on the device. */
export function SettingsPanel() {
  const t = useStrings();
  const language = useGameStore((s) => s.language);
  const setLanguage = useGameStore((s) => s.setLanguage);
  const speed = useGameStore((s) => s.speed);
  const setSpeed = useGameStore((s) => s.setSpeed);
  const sound = useGameStore((s) => s.sound);
  const setSound = useGameStore((s) => s.setSound);
  const autoMove = useGameStore((s) => s.autoMove);
  const setAutoMove = useGameStore((s) => s.setAutoMove);
  const markers = useGameStore((s) => s.markers);
  const setMarkers = useGameStore((s) => s.setMarkers);

  const speedOptions: { value: Speed; label: string }[] = [
    { value: 'slow', label: t.speed.slow },
    { value: 'normal', label: t.speed.normal },
    { value: 'fast', label: t.speed.fast },
  ];

  return (
    <View style={styles.panel}>
      <View style={styles.field}>
        <Text style={styles.title}>{t.language}</Text>
        <Segmented options={LANGUAGE_OPTIONS} value={language} onChange={setLanguage} />
      </View>
      <View style={styles.field}>
        <Text style={styles.title}>{t.speedTitle}</Text>
        <Text style={styles.hint}>{t.speedHint}</Text>
        <Segmented options={speedOptions} value={speed} onChange={setSpeed} />
      </View>
      <ToggleRow title={t.sound} hint={t.soundHint} value={sound} onChange={setSound} />
      <ToggleRow title={t.autoMove} hint={t.autoMoveHint} value={autoMove} onChange={setAutoMove} />
      <ToggleRow title={t.markers} hint={t.markersHint} value={markers} onChange={setMarkers} />
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
