import { HOME_INDEX, type BotLevel, type GameConfig, type GameMode, type Seat } from '@asta/engine';
import { Link, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Segmented } from '../components/Segmented';
import { SeatMark } from '../components/SeatMark';
import { SettingsPanel } from '../components/SettingsPanel';
import { STRINGS, useStrings, withDisplayNames, type Lang, type Strings } from '../i18n';
import { useGameStore } from '../store/game';
import { colors, radius, space } from '../theme';

type SeatKind = 'human' | BotLevel;

interface SeatSetup {
  /** What the player typed, or null to use the default name (which follows the language). */
  name: string | null;
  kind: SeatKind;
}

/** Which seats are used: two players always sit opposite each other. */
function seatsFor(count: number): Seat[] {
  if (count === 2) return [0, 2];
  if (count === 3) return [0, 1, 2];
  return [0, 1, 2, 3];
}

const DEFAULT_SEATS: Record<Seat, SeatSetup> = {
  0: { name: null, kind: 'human' },
  1: { name: null, kind: 'medium' },
  2: { name: null, kind: 'medium' },
  3: { name: null, kind: 'medium' },
};

/** "You" for the first human, the colour for other humans, "Computer n" for computers. */
function defaultName(t: Strings, seat: Seat, kind: SeatKind): string {
  if (kind !== 'human') return t.computer(seat);
  return seat === 0 ? t.you : t.colour[seat];
}

const LANGUAGE_OPTIONS: { value: Lang; label: string }[] = [
  { value: 'en', label: STRINGS.en.langName },
  { value: 'te', label: STRINGS.te.langName },
];

export default function SetupScreen() {
  const router = useRouter();
  const t = useStrings();
  const language = useGameStore((s) => s.language);
  const setLanguage = useGameStore((s) => s.setLanguage);
  const startGame = useGameStore((s) => s.startGame);
  const startTutorial = useGameStore((s) => s.startTutorial);
  const tutorialDone = useGameStore((s) => s.tutorialDone);
  const hydrated = useGameStore((s) => s.hydrated);

  // Coming back here (e.g. with the header's back arrow) ends a guided game and
  // restores the player's own game.
  useFocusEffect(
    useCallback(() => {
      const { tutorial, endTutorial } = useGameStore.getState();
      if (tutorial) endTutorial(false);
    }, []),
  );

  const playTutorial = () => {
    startTutorial();
    router.push('/game');
  };
  const savedGame = useGameStore((s) => (s.hydrated && s.game && s.game.phase !== 'finished' ? s.game : null));
  // Default player names in the saved game follow the current language.
  const saved = savedGame ? withDisplayNames(t, savedGame) : null;

  const [mode, setMode] = useState<GameMode>('individual');
  const [count, setCount] = useState(2);
  const [seats, setSeats] = useState(DEFAULT_SEATS);

  const playerCount = mode === 'team' ? 4 : count;
  const active = seatsFor(playerCount);

  const updateSeat = (seat: Seat, patch: Partial<SeatSetup>) =>
    setSeats((prev) => ({ ...prev, [seat]: { ...prev[seat], ...patch } }));

  const kindOptions: { value: SeatKind; label: string }[] = [
    { value: 'human', label: t.level.human },
    { value: 'easy', label: t.level.easy },
    { value: 'medium', label: t.level.medium },
    { value: 'hard', label: t.level.hard },
  ];

  const start = () => {
    const config: GameConfig = {
      mode,
      players: active.map((seat) => {
        const s = seats[seat];
        const name = s.name?.trim() || defaultName(t, seat, s.kind);
        return { name, seat, bot: s.kind === 'human' ? undefined : s.kind };
      }),
    };
    startGame(config);
    router.push('/game');
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.container}>
          <View style={styles.hero}>
            <Text style={styles.title}>{t.appTitle}</Text>
            <View style={styles.heroLanguage}>
              <Segmented compact options={LANGUAGE_OPTIONS} value={language} onChange={setLanguage} />
            </View>
          </View>

          {hydrated && !tutorialDone && !saved && (
            <View style={[styles.card, styles.learnCard]}>
              <Text style={styles.cardTitle}>{t.learnTitle}</Text>
              <Text style={styles.hint}>{t.learnHint}</Text>
              <Pressable
                style={({ pressed }) => [styles.learnButton, pressed && styles.pressed]}
                onPress={playTutorial}
                accessibilityRole="button"
              >
                <Text style={styles.primaryText}>{t.learnButton}</Text>
              </Pressable>
            </View>
          )}

          {saved && (
            <View style={[styles.card, styles.resumeCard]}>
              <Text style={styles.cardTitle}>{t.continueTitle}</Text>
              <View style={styles.resumePlayers}>
                {saved.players.map((p) => {
                  const home = saved.pieces.filter((pc) => pc.owner === p.index && pc.progress === HOME_INDEX).length;
                  const isTurn = p.index === saved.current;
                  return (
                    <View key={p.index} style={styles.resumePlayer}>
                      <SeatMark seat={p.seat} />
                      <Text style={[styles.resumeName, isTurn && styles.resumeTurn]} numberOfLines={1}>
                        {p.name}
                      </Text>
                      <Text style={styles.hint}>{t.homeCount(home)}</Text>
                    </View>
                  );
                })}
              </View>
              <Text style={styles.hint}>
                {t.resumeSummary(
                  saved.config.mode === 'team' ? t.teams : t.playersCount(saved.players.length),
                  saved.turn,
                  saved.players[saved.current]?.name ?? '',
                )}
              </Text>
              <Pressable
                style={({ pressed }) => [styles.primary, pressed && styles.pressed]}
                onPress={() => router.push('/game')}
                accessibilityRole="button"
              >
                <Text style={styles.primaryText}>{t.continueGame}</Text>
              </Pressable>
            </View>
          )}

          <View style={styles.card}>
            <Text style={styles.cardTitle}>{t.gameCard}</Text>
            <Segmented
              options={[
                { value: 'individual', label: t.individual },
                { value: 'team', label: t.teams2v2 },
              ]}
              value={mode}
              onChange={setMode}
            />
            {mode === 'individual' ? (
              <View style={styles.field}>
                <Text style={styles.label}>{t.playersLabel}</Text>
                <Segmented
                  options={[2, 3, 4].map((n) => ({ value: n, label: t.playersCount(n) }))}
                  value={count}
                  onChange={setCount}
                />
              </View>
            ) : (
              <Text style={styles.hint}>{t.teamHint(t.colour[0], t.colour[2], t.colour[1], t.colour[3])}</Text>
            )}
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>{t.playersLabel}</Text>
            {active.map((seat) => (
              <View key={seat} style={styles.seat}>
                <View style={styles.seatHeader}>
                  <SeatMark seat={seat} />
                  <Text style={styles.seatLabel}>
                    {t.colour[seat]} · {t.seat[seat]}
                    {mode === 'team' ? ` · ${t.team(seat % 2 === 0 ? 'A' : 'B')}` : ''}
                  </Text>
                </View>
                <TextInput
                  value={seats[seat].name ?? defaultName(t, seat, seats[seat].kind)}
                  onChangeText={(name) => updateSeat(seat, { name })}
                  placeholder={t.colour[seat]}
                  placeholderTextColor={colors.textMuted}
                  maxLength={16}
                  style={styles.input}
                  accessibilityLabel={t.playerNameA11y(t.colour[seat])}
                />
                <Segmented compact options={kindOptions} value={seats[seat].kind} onChange={(kind) => updateSeat(seat, { kind })} />
              </View>
            ))}
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>{t.settings}</Text>
            <SettingsPanel />
          </View>

          {saved && <Text style={[styles.hint, styles.centerText]}>{t.replaceWarning}</Text>}
          <Pressable style={({ pressed }) => [styles.primary, pressed && styles.pressed]} onPress={start} accessibilityRole="button">
            <Text style={styles.primaryText}>{saved ? t.startNew : t.start}</Text>
          </Pressable>
          <View style={styles.links}>
            <Pressable style={styles.secondary} onPress={playTutorial} accessibilityRole="button">
              <Text style={styles.secondaryText}>{t.learnButton}</Text>
            </Pressable>
            <Link href="/rules" asChild>
              <Pressable style={styles.secondary} accessibilityRole="link">
                <Text style={styles.secondaryText}>{t.howToPlay}</Text>
              </Pressable>
            </Link>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  scroll: { flexGrow: 1, paddingHorizontal: space.lg, paddingBottom: space.xxl },
  container: { width: '100%', maxWidth: 520, alignSelf: 'center', gap: space.lg },
  hero: { paddingTop: space.xxl, paddingBottom: space.sm, alignItems: 'center', gap: space.md },
  heroLanguage: { width: 220 },
  title: { color: colors.chalk, fontSize: 38, fontWeight: '800', letterSpacing: 0.5, textAlign: 'center' },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: space.lg, gap: space.md },
  cardTitle: { color: colors.text, fontSize: 17, fontWeight: '700' },
  field: { gap: space.sm },
  label: { color: colors.textMuted, fontSize: 13, fontWeight: '600' },
  hint: { color: colors.textMuted, fontSize: 13, lineHeight: 19 },
  centerText: { textAlign: 'center' },
  resumeCard: { borderWidth: 2, borderColor: colors.accent },
  learnCard: { borderWidth: 2, borderColor: colors.highlight, backgroundColor: '#2C2A1A' },
  learnButton: { backgroundColor: colors.highlight, borderRadius: radius.md, paddingVertical: 14, alignItems: 'center' },
  links: { alignItems: 'center' },
  resumePlayers: { gap: space.sm },
  resumePlayer: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  resumeName: { color: colors.text, fontSize: 15, fontWeight: '600', flex: 1 },
  resumeTurn: { fontWeight: '800', color: colors.accent },
  seat: { gap: space.sm, paddingTop: space.xs },
  seatHeader: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  seatLabel: { color: colors.text, fontSize: 14, fontWeight: '600' },
  input: {
    backgroundColor: colors.background,
    color: colors.text,
    borderRadius: radius.sm,
    paddingHorizontal: space.md,
    paddingVertical: 10,
    fontSize: 15,
  },
  primary: { backgroundColor: colors.accent, borderRadius: radius.md, paddingVertical: 16, alignItems: 'center' },
  pressed: { opacity: 0.8 },
  primaryText: { color: '#2A2208', fontSize: 17, fontWeight: '800' },
  secondary: { paddingVertical: 12, alignItems: 'center' },
  secondaryText: { color: colors.chalk, fontSize: 15, fontWeight: '600', textDecorationLine: 'underline' },
});
