import type { Leaderboard, LeaderboardEntry, LeaderboardPeriod } from '@asta/protocol';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { loadLeaderboard, useAccountStore } from '../account/store';
import { Avatar } from '../components/Avatar';
import { Backdrop } from '../components/Backdrop';
import { TopBar } from '../components/Chrome';
import { Segmented } from '../components/Segmented';
import { TrophyIcon } from '../components/TrophyIcon';
import { useStrings, type Strings } from '../i18n';
import { colors, radius, space } from '../theme';

const MEDALS: Record<number, { fill: string; ring: string; text: string }> = {
  1: { fill: '#F2C94C', ring: '#FFF1B8', text: '#5A3E00' },
  2: { fill: '#C9CED8', ring: '#F3F6FF', text: '#2F3542' },
  3: { fill: '#CD8A4B', ring: '#F5D2B0', text: '#4A2508' },
};

function Rank({ rank }: { rank: number }) {
  const medal = MEDALS[rank];
  if (!medal) return <Text style={styles.rankPlain}>{rank}</Text>;
  return (
    <View style={[styles.medal, { backgroundColor: medal.fill, borderColor: medal.ring }]}>
      <Text style={[styles.medalText, { color: medal.text }]}>{rank}</Text>
    </View>
  );
}

function Row({ entry, mine, t }: { entry: LeaderboardEntry; mine: boolean; t: Strings }) {
  return (
    <View style={[styles.row, mine && styles.rowMine]} accessibilityLabel={`#${entry.rank} ${entry.name}, ${t.lbWins(entry.wins)}`}>
      <View style={styles.rankBox}>
        <Rank rank={entry.rank} />
      </View>
      <Avatar name={entry.name} seed={entry.id} size={36} />
      <View style={styles.who}>
        <Text style={styles.name} numberOfLines={1}>
          {entry.name}
          {mine ? <Text style={styles.you}> · {t.lbYou}</Text> : null}
        </Text>
        <Text style={styles.played}>{t.lbPlayed(entry.played)}</Text>
      </View>
      <Text style={styles.wins}>{t.lbWins(entry.wins)}</Text>
    </View>
  );
}

export default function LeaderboardScreen() {
  const router = useRouter();
  const t = useStrings();
  const myId = useAccountStore((s) => s.profile?.id ?? null);
  const [period, setPeriod] = useState<LeaderboardPeriod>('week');
  /** Loaded boards by period; null = couldn't load. */
  const [boards, setBoards] = useState<Partial<Record<LeaderboardPeriod, Leaderboard | null>>>({});

  // Fresh each time the screen opens or the tab changes.
  useFocusEffect(
    useCallback(() => {
      let live = true;
      void loadLeaderboard(period).then((board) => {
        if (live) setBoards((prev) => ({ ...prev, [period]: board }));
      });
      return () => {
        live = false;
      };
    }, [period]),
  );

  const board = boards[period];
  const meListed = !!board?.me && board.entries.some((e) => e.id === board.me!.id);

  return (
    <View style={styles.screen}>
      <Backdrop />
      <SafeAreaView style={styles.safe}>
        <TopBar title={t.leaderboard} onBack={() => router.back()} backLabel={t.back} right={<TrophyIcon size={34} />} />
        <View style={styles.body}>
          <Segmented
            options={[
              { value: 'week', label: t.lbWeek },
              { value: 'all', label: t.lbAll },
            ]}
            value={period}
            onChange={setPeriod}
          />
          {board === undefined ? (
            <ActivityIndicator color={colors.chalk} style={styles.loading} />
          ) : board === null ? (
            <Text style={[styles.hint, styles.center]}>{t.lbFailed}</Text>
          ) : (
            <ScrollView contentContainerStyle={styles.list} bounces={false}>
              {board.entries.length === 0 && (
                <Text style={[styles.empty, styles.center]}>{period === 'week' ? t.lbEmptyWeek : t.lbEmptyAll}</Text>
              )}
              {board.entries.map((entry) => (
                <Row key={entry.id} entry={entry} mine={entry.id === myId} t={t} />
              ))}
              <Text style={[styles.hint, styles.center, styles.rule]}>{t.lbRule}</Text>
            </ScrollView>
          )}
          {/* Where you stand, when you're not in the list above. */}
          {board && !meListed && (
            <View style={styles.footer}>
              {board.me ? (
                <>
                  <Text style={styles.footerTitle}>{t.lbYourRank(board.me.rank)}</Text>
                  <Row entry={board.me} mine t={t} />
                </>
              ) : (
                <Text style={[styles.hint, styles.center]}>{t.lbNotOnBoard}</Text>
              )}
            </View>
          )}
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  safe: { flex: 1 },
  body: { flex: 1, paddingHorizontal: space.lg, paddingBottom: space.lg, gap: space.md, width: '100%', maxWidth: 560, alignSelf: 'center' },
  loading: { marginTop: space.xxl },
  list: { gap: space.sm, paddingBottom: space.md },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    backgroundColor: 'rgba(14, 38, 32, 0.78)',
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: 'rgba(246, 215, 123, 0.25)',
    paddingVertical: space.sm,
    paddingHorizontal: space.md,
  },
  rowMine: { borderColor: '#F6D77B', borderWidth: 2, backgroundColor: 'rgba(90, 70, 15, 0.55)' },
  rankBox: { width: 32, alignItems: 'center' },
  rankPlain: { color: colors.textMuted, fontSize: 16, fontWeight: '800', fontVariant: ['tabular-nums'] },
  medal: { width: 30, height: 30, borderRadius: 15, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  medalText: { fontSize: 15, fontWeight: '900' },
  who: { flex: 1, minWidth: 0 },
  name: { color: colors.text, fontSize: 16, fontWeight: '800' },
  you: { color: '#F6D77B', fontWeight: '800' },
  played: { color: colors.textMuted, fontSize: 12.5, marginTop: 1 },
  wins: { color: '#F6D77B', fontSize: 16, fontWeight: '900', fontVariant: ['tabular-nums'] },
  empty: { color: colors.text, fontSize: 15, marginTop: space.xl },
  hint: { color: colors.textMuted, fontSize: 13, lineHeight: 19 },
  rule: { marginTop: space.sm },
  center: { textAlign: 'center' },
  footer: { gap: space.xs, borderTopWidth: 1, borderTopColor: 'rgba(246, 215, 123, 0.25)', paddingTop: space.md },
  footerTitle: { color: colors.textMuted, fontSize: 13, fontWeight: '800', marginLeft: space.xs },
});
