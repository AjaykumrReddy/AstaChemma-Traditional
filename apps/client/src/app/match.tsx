import { DEFAULT_BOARD, type Seat } from '@asta/engine';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Backdrop } from '../components/Backdrop';
import { TopBar } from '../components/Chrome';
import { Cowrie } from '../components/Shells';
import { useStrings } from '../i18n';
import { useOnlineStore } from '../online/store';
import { useGameStore } from '../store/game';
import { colors, radius, space } from '../theme';

/** After this long alone in line, offer a game against the computer meanwhile. */
const OFFER_COMPUTER_MS = 30_000;

function clock(ms: number): string {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** Four cowries turning over one by one while we look for a player. */
function SearchingShells() {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setTick((n) => n + 1), 450);
    return () => clearInterval(timer);
  }, []);
  return (
    <View style={styles.shells} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {[0, 1, 2, 3].map((i) => (
        <View key={i} style={{ transform: [{ translateY: tick % 4 === i ? -8 : 0 }] }}>
          <Cowrie open={(tick + i) % 3 === 0} size={40} />
        </View>
      ))}
    </View>
  );
}

/** Quick match: waiting in line for another player. */
export default function MatchScreen() {
  const router = useRouter();
  const t = useStrings();
  const search = useOnlineStore((s) => s.search);
  const session = useOnlineStore((s) => s.session);
  const room = useOnlineStore((s) => s.room);
  const error = useOnlineStore((s) => s.error);
  const findMatch = useOnlineStore((s) => s.findMatch);
  const cancelMatch = useOnlineStore((s) => s.cancelMatch);
  const openGame = useOnlineStore((s) => s.openGame);
  const startGame = useGameStore((s) => s.startGame);
  const board = useGameStore((s) => s.board);

  const [now, setNow] = useState(() => Date.now());
  const [offerDismissed, setOfferDismissed] = useState(false);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Leaving this screen while still in line takes us out of it.
  useEffect(
    () => () => {
      if (useOnlineStore.getState().search) useOnlineStore.getState().cancelMatch();
    },
    [],
  );

  // Matched: the room is already playing, so go straight to the board.
  useEffect(() => {
    if (session && room && room.status !== 'lobby') {
      openGame();
      router.replace('/game');
    }
  }, [session, room, openGame, router]);

  const waited = search ? now - search.since : 0;
  const offerComputer = !!search && !offerDismissed && waited >= OFFER_COMPUTER_MS && search.waiting <= 1;
  const matched = !search && !!session;

  const playComputer = () => {
    cancelMatch();
    const name = useOnlineStore.getState().name.trim() || t.you;
    const players: { name: string; seat: Seat; bot?: 'medium' }[] = [
      { name, seat: 0 },
      { name: t.computer(2), seat: 2, bot: 'medium' },
    ];
    startGame({ mode: 'individual', players, ...(board !== DEFAULT_BOARD ? { board } : {}) });
    router.replace('/game');
  };

  const back = () => {
    cancelMatch();
    router.back();
  };

  return (
    <View style={styles.screen}>
      <Backdrop />
      <SafeAreaView style={styles.safe}>
        <TopBar title={t.quickMatch} onBack={back} backLabel={t.back} />
        <View style={styles.container}>
          {search && (
            <>
              <SearchingShells />
              <Text style={styles.title} accessibilityLiveRegion="polite">
                {t.searching}
              </Text>
              <Text style={styles.hint}>
                {t.boardLabel}: {t.boardName[board]}
              </Text>
              <Text style={styles.clock}>{clock(waited)}</Text>
              <Text style={styles.hint}>{t.searchingCount(search.waiting)}</Text>
              {offerComputer && (
                <View style={styles.card}>
                  <Text style={styles.cardText}>{t.noOneYet}</Text>
                  <Pressable style={({ pressed }) => [styles.primary, pressed && styles.pressed]} onPress={() => setOfferDismissed(true)} accessibilityRole="button">
                    <Text style={styles.primaryText}>{t.keepWaiting}</Text>
                  </Pressable>
                  <Pressable style={({ pressed }) => [styles.outline, pressed && styles.pressed]} onPress={playComputer} accessibilityRole="button">
                    <Text style={styles.outlineText}>{t.playComputerInstead}</Text>
                  </Pressable>
                </View>
              )}
              <Pressable style={styles.secondary} onPress={back} accessibilityRole="button">
                <Text style={styles.secondaryText}>{t.cancel}</Text>
              </Pressable>
            </>
          )}

          {matched && (
            <>
              <ActivityIndicator color={colors.chalk} size="large" />
              <Text style={styles.title}>{t.matchFound}</Text>
              <Text style={styles.hint}>{t.connecting}</Text>
            </>
          )}

          {!search && !session && (
            <>
              <Text style={[styles.title, styles.error]}>{error ? t.onlineError[error] : t.onlineError.network}</Text>
              <Pressable style={({ pressed }) => [styles.primary, pressed && styles.pressed]} onPress={findMatch} accessibilityRole="button">
                <Text style={styles.primaryText}>{t.findPlayer}</Text>
              </Pressable>
              <Pressable style={styles.secondary} onPress={() => router.back()} accessibilityRole="button">
                <Text style={styles.secondaryText}>{t.back}</Text>
              </Pressable>
            </>
          )}
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  safe: { flex: 1 },
  container: {
    flex: 1,
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
    alignItems: 'stretch',
    justifyContent: 'center',
    gap: space.md,
    paddingHorizontal: space.lg,
    paddingBottom: space.xxl,
  },
  shells: { flexDirection: 'row', justifyContent: 'center', gap: space.md, height: 64, alignItems: 'flex-end' },
  title: { color: colors.text, fontSize: 22, fontWeight: '800', textAlign: 'center' },
  clock: { color: colors.chalk, fontSize: 36, fontWeight: '900', textAlign: 'center', fontVariant: ['tabular-nums'] },
  hint: { color: colors.textMuted, fontSize: 14, textAlign: 'center' },
  error: { color: colors.danger, fontSize: 17 },
  card: {
    backgroundColor: 'rgba(14, 38, 32, 0.78)',
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: 'rgba(246, 215, 123, 0.35)',
    padding: space.lg,
    gap: space.md,
    marginTop: space.md,
  },
  cardText: { color: colors.text, fontSize: 15, lineHeight: 22, textAlign: 'center' },
  primary: { backgroundColor: colors.accent, borderRadius: radius.md, paddingVertical: 14, alignItems: 'center' },
  primaryText: { color: '#2A2208', fontSize: 16, fontWeight: '800' },
  outline: { borderWidth: 1.5, borderColor: colors.chalkDim, borderRadius: radius.md, paddingVertical: 12, alignItems: 'center' },
  outlineText: { color: colors.chalk, fontSize: 15, fontWeight: '700' },
  pressed: { opacity: 0.6 },
  secondary: { paddingVertical: 12, alignItems: 'center' },
  secondaryText: { color: colors.chalk, fontSize: 15, fontWeight: '600', textDecorationLine: 'underline' },
});
