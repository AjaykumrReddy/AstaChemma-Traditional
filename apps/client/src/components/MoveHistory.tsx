import type { GameState } from '@asta/engine';
import { memo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { HistoryEntry } from '../store/history';
import { colors, radius, seatColors, space } from '../theme';

const COLLAPSED = 6;

/** A marker per kind, so captures and homecomings stand out while scanning. */
const MARK: Record<HistoryEntry['kind'], string> = {
  throw: '🐚',
  hold: '✋',
  move: '➜',
  release: '★',
  capture: '⚔',
  home: '⌂',
  noMove: '–',
  win: '🏆',
};

/** Everything that happened this game, newest first. */
export const MoveHistory = memo(function MoveHistory({ history, players }: { history: HistoryEntry[]; players: GameState['players'] }) {
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? history : history.slice(0, COLLAPSED);

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.heading}>History</Text>
        {history.length > COLLAPSED && (
          <Pressable onPress={() => setExpanded((e) => !e)} hitSlop={8} accessibilityRole="button">
            <Text style={styles.toggle}>{expanded ? 'Show less' : `Show all (${history.length})`}</Text>
          </Pressable>
        )}
      </View>
      {history.length === 0 ? (
        <Text style={styles.empty}>Moves will appear here.</Text>
      ) : (
        shown.map((entry, i) => {
          const player = players[entry.player];
          const colour = player ? seatColors[player.seat].fill : colors.textMuted;
          const strong = entry.kind === 'capture' || entry.kind === 'home' || entry.kind === 'release' || entry.kind === 'win';
          return (
            <View key={entry.id} style={[styles.row, i === 0 && styles.latest]}>
              <View style={[styles.dot, { backgroundColor: colour }]} />
              <Text style={styles.mark}>{MARK[entry.kind]}</Text>
              <Text style={[styles.text, strong && styles.strong]} numberOfLines={2}>
                <Text style={[styles.name, { color: colour }]}>{player?.name ?? 'Player'}</Text> {entry.text}
              </Text>
            </View>
          );
        })
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  card: {
    width: '100%',
    maxWidth: 620,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: space.lg,
    gap: 6,
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  heading: { color: colors.text, fontSize: 16, fontWeight: '700' },
  toggle: { color: colors.accent, fontSize: 13, fontWeight: '700' },
  empty: { color: colors.textMuted, fontSize: 13 },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: 3, paddingHorizontal: 6, borderRadius: radius.sm },
  latest: { backgroundColor: colors.surfaceRaised },
  dot: { width: 8, height: 8, borderRadius: 4 },
  mark: { width: 20, textAlign: 'center', color: colors.textMuted, fontSize: 13 },
  text: { flex: 1, color: colors.textMuted, fontSize: 13.5, lineHeight: 19 },
  strong: { color: colors.text, fontWeight: '600' },
  name: { fontWeight: '800' },
});
