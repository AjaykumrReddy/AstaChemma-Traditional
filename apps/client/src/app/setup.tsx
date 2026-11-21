import type { BotLevel, GameConfig, GameMode, Seat } from '@asta/engine';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Backdrop } from '../components/Backdrop';
import { TopBar } from '../components/Chrome';
import { SeatMark } from '../components/SeatMark';
import { Segmented } from '../components/Segmented';
import { useStrings, type Strings } from '../i18n';
import { useGameStore } from '../store/game';
import { colors, radius, space } from '../theme';

/** Which seats are used: two players always sit opposite each other. */
function seatsFor(count: number): Seat[] {
  if (count === 2) return [0, 2];
  if (count === 3) return [0, 1, 2];
  return [0, 1, 2, 3];
}

/**
 * Setting up a game on this device, on one screen:
 *   /setup?kind=computer – you against the computer (one difficulty for all);
 *   /setup?kind=friends  – pass and play, everyone on this phone.
 */
export default function SetupScreen() {
  const router = useRouter();
  const t = useStrings();
  const { kind } = useLocalSearchParams<{ kind?: string }>();
  const vsComputer = kind !== 'friends';
  const startGame = useGameStore((s) => s.startGame);
  const hasSaved = useGameStore((s) => s.hydrated && !!s.game && s.game.phase !== 'finished' && s.mode === 'local' && !s.tutorial);

  const [mode, setMode] = useState<GameMode>('individual');
  const [count, setCount] = useState(2);
  const [level, setLevel] = useState<BotLevel>('medium');
  /** What the player typed per seat; null shows the default name. */
  const [names, setNames] = useState<Record<Seat, string | null>>({ 0: null, 1: null, 2: null, 3: null });

  const active = seatsFor(mode === 'team' ? 4 : count);
  const isBot = (seat: Seat) => vsComputer && seat !== 0;
  const defaultName = (seat: Seat) => (isBot(seat) ? t.computer(seat) : vsComputer || seat === 0 ? t.you : t.colour[seat]);

  const start = () => {
    const config: GameConfig = {
      mode,
      players: active.map((seat) => ({
        name: names[seat]?.trim() || defaultName(seat),
        seat,
        bot: isBot(seat) ? level : undefined,
      })),
    };
    startGame(config);
    router.replace('/game');
  };

  const levels: { value: BotLevel; label: string }[] = [
    { value: 'easy', label: t.level.easy },
    { value: 'medium', label: t.level.medium },
    { value: 'hard', label: t.level.hard },
  ];

  return (
    <View style={styles.screen}>
      <Backdrop />
      <SafeAreaView style={styles.safe}>
        <TopBar title={vsComputer ? t.modeComputer : t.modePassPlay} onBack={() => router.back()} backLabel={t.back} />
        <ScrollView contentContainerStyle={styles.scroll} bounces={false} keyboardShouldPersistTaps="handled">
          <View style={styles.card}>
            <Segmented
              options={[
                { value: 'individual', label: t.individual },
                { value: 'team', label: t.teams2v2 },
              ]}
              value={mode}
              onChange={setMode}
            />
            {mode === 'individual' ? (
              <Segmented options={[2, 3, 4].map((n) => ({ value: n, label: t.playersCount(n) }))} value={count} onChange={setCount} />
            ) : (
              <Text style={styles.hint}>{t.teamHint(t.colour[0], t.colour[2], t.colour[1], t.colour[3])}</Text>
            )}
            {vsComputer && (
              <View style={styles.field}>
                <Text style={styles.label}>{t.difficulty}</Text>
                <Segmented options={levels} value={level} onChange={setLevel} />
              </View>
            )}
          </View>

          <View style={styles.card}>
            {active.map((seat) => (
              <SeatRow
                key={seat}
                seat={seat}
                t={t}
                team={mode === 'team' ? (seat % 2 === 0 ? 'A' : 'B') : null}
                bot={isBot(seat) ? level : null}
                value={names[seat] ?? defaultName(seat)}
                onChange={(name) => setNames((prev) => ({ ...prev, [seat]: name }))}
              />
            ))}
          </View>

          <View style={styles.spacer} />
          {hasSaved && <Text style={[styles.hint, styles.center]}>{t.replaceWarning}</Text>}
          <Pressable style={({ pressed }) => [styles.start, pressed && styles.pressed]} onPress={start} accessibilityRole="button">
            <Text style={styles.startText}>{hasSaved ? t.startNew : t.start}</Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function SeatRow({
  seat,
  t,
  team,
  bot,
  value,
  onChange,
}: {
  seat: Seat;
  t: Strings;
  team: 'A' | 'B' | null;
  bot: BotLevel | null;
  value: string;
  onChange: (name: string) => void;
}) {
  return (
    <View style={styles.row}>
      <SeatMark seat={seat} size={18} />
      {bot ? (
        <Text style={styles.botName} numberOfLines={1}>
          {value}
        </Text>
      ) : (
        <TextInput
          value={value}
          onChangeText={onChange}
          maxLength={16}
          style={styles.input}
          placeholder={t.colour[seat]}
          placeholderTextColor={colors.textMuted}
          accessibilityLabel={t.playerNameA11y(t.colour[seat])}
        />
      )}
      {(bot || team) && (
        <Text style={styles.tag} numberOfLines={1}>
          {[bot ? t.level[bot] : null, team ? t.team(team) : null].filter(Boolean).join(' · ')}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  safe: { flex: 1 },
  scroll: { flexGrow: 1, paddingHorizontal: space.lg, paddingBottom: space.lg, gap: space.md, width: '100%', maxWidth: 520, alignSelf: 'center' },
  card: {
    backgroundColor: 'rgba(14, 38, 32, 0.78)',
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: 'rgba(246, 215, 123, 0.35)',
    padding: space.lg,
    gap: space.md,
  },
  field: { gap: space.sm },
  label: { color: colors.textMuted, fontSize: 13, fontWeight: '700' },
  hint: { color: colors.textMuted, fontSize: 13, lineHeight: 19 },
  center: { textAlign: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 44 },
  input: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.25)',
    color: colors.text,
    borderRadius: radius.sm,
    paddingHorizontal: space.md,
    paddingVertical: 9,
    fontSize: 15,
  },
  botName: { flex: 1, color: colors.text, fontSize: 15, fontWeight: '600', paddingHorizontal: space.md },
  tag: { color: colors.textMuted, fontSize: 12.5, fontWeight: '600', minWidth: 64, textAlign: 'right' },
  spacer: { flexGrow: 1 },
  start: {
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingVertical: 16,
    alignItems: 'center',
    borderBottomWidth: 4,
    borderBottomColor: '#B8913A',
  },
  startText: { color: '#2A2208', fontSize: 18, fontWeight: '900' },
  pressed: { opacity: 0.85 },
});
