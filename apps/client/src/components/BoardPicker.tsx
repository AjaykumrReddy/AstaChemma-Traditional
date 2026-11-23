import { BOARD_IDS } from '@asta/engine';
import { StyleSheet, Text, View } from 'react-native';
import { useStrings } from '../i18n';
import { useGameStore } from '../store/game';
import { colors, space } from '../theme';
import { Segmented } from './Segmented';

/** Choose the board (5×5 or 7×7) for a new game; the choice is remembered. */
export function BoardPicker() {
  const t = useStrings();
  const board = useGameStore((s) => s.board);
  const setBoard = useGameStore((s) => s.setBoard);
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{t.boardLabel}</Text>
      <Segmented options={BOARD_IDS.map((id) => ({ value: id, label: t.boardName[id] }))} value={board} onChange={setBoard} />
      <Text style={styles.hint}>{t.boardHint[board]}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: space.sm },
  label: { color: colors.textMuted, fontSize: 13, fontWeight: '700' },
  hint: { color: colors.textMuted, fontSize: 13, lineHeight: 19 },
});
