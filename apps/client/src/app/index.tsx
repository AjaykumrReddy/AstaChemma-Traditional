import type { BotLevel, GameConfig, GameMode, Seat } from '@asta/engine';
import { Link, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Segmented } from '../components/Segmented';
import { useGameStore } from '../store/game';
import { colors, radius, seatColors, space } from '../theme';

type SeatKind = 'human' | BotLevel;

interface SeatSetup {
  name: string;
  kind: SeatKind;
}

const SEAT_LABELS: Record<Seat, string> = { 0: 'Bottom', 1: 'Right', 2: 'Top', 3: 'Left' };

/** Which seats are used: two players always sit opposite each other. */
function seatsFor(count: number): Seat[] {
  if (count === 2) return [0, 2];
  if (count === 3) return [0, 1, 2];
  return [0, 1, 2, 3];
}

const DEFAULT_SEATS: Record<Seat, SeatSetup> = {
  0: { name: 'You', kind: 'human' },
  1: { name: 'Computer 1', kind: 'medium' },
  2: { name: 'Computer 2', kind: 'medium' },
  3: { name: 'Computer 3', kind: 'medium' },
};

const KIND_OPTIONS: { value: SeatKind; label: string }[] = [
  { value: 'human', label: 'Human' },
  { value: 'easy', label: 'Easy' },
  { value: 'medium', label: 'Medium' },
  { value: 'hard', label: 'Hard' },
];

export default function SetupScreen() {
  const router = useRouter();
  const startGame = useGameStore((s) => s.startGame);
  const autoMove = useGameStore((s) => s.autoMove);
  const setAutoMove = useGameStore((s) => s.setAutoMove);

  const [mode, setMode] = useState<GameMode>('individual');
  const [count, setCount] = useState(2);
  const [seats, setSeats] = useState(DEFAULT_SEATS);

  const playerCount = mode === 'team' ? 4 : count;
  const active = seatsFor(playerCount);

  const updateSeat = (seat: Seat, patch: Partial<SeatSetup>) =>
    setSeats((prev) => ({ ...prev, [seat]: { ...prev[seat], ...patch } }));

  const start = () => {
    const config: GameConfig = {
      mode,
      players: active.map((seat) => {
        const s = seats[seat];
        const name = s.name.trim() || `${seatColors[seat].name}`;
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
            <Text style={styles.title}>Asta Chemma</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Game</Text>
            <Segmented
              options={[
                { value: 'individual', label: 'Individual' },
                { value: 'team', label: 'Teams (2 v 2)' },
              ]}
              value={mode}
              onChange={setMode}
            />
            {mode === 'individual' ? (
              <View style={styles.field}>
                <Text style={styles.label}>Players</Text>
                <Segmented
                  options={[2, 3, 4].map((n) => ({ value: n, label: `${n} players` }))}
                  value={count}
                  onChange={setCount}
                />
              </View>
            ) : (
              <Text style={styles.hint}>
                Opposite players are partners: {seatColors[0].name} & {seatColors[2].name} against {seatColors[1].name} &{' '}
                {seatColors[3].name}. A team wins when both partners have all pieces home.
              </Text>
            )}
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Players</Text>
            {active.map((seat) => (
              <View key={seat} style={styles.seat}>
                <View style={styles.seatHeader}>
                  <View style={[styles.dot, { backgroundColor: seatColors[seat].fill }]} />
                  <Text style={styles.seatLabel}>
                    {seatColors[seat].name} · {SEAT_LABELS[seat]}
                    {mode === 'team' ? ` · Team ${seat % 2 === 0 ? 'A' : 'B'}` : ''}
                  </Text>
                </View>
                <TextInput
                  value={seats[seat].name}
                  onChangeText={(name) => updateSeat(seat, { name })}
                  placeholder={seatColors[seat].name}
                  placeholderTextColor={colors.textMuted}
                  maxLength={16}
                  style={styles.input}
                  accessibilityLabel={`${seatColors[seat].name} player name`}
                />
                <Segmented compact options={KIND_OPTIONS} value={seats[seat].kind} onChange={(kind) => updateSeat(seat, { kind })} />
              </View>
            ))}
          </View>

          <View style={[styles.card, styles.row]}>
            <View style={{ flex: 1 }}>
              <Text style={styles.toggleTitle}>Auto-move</Text>
              <Text style={styles.hint}>Move for you when a throw allows only one choice.</Text>
            </View>
            <Switch
              value={autoMove}
              onValueChange={setAutoMove}
              trackColor={{ true: colors.accent, false: colors.surfaceRaised }}
              thumbColor={colors.chalk}
            />
          </View>

          <Pressable style={({ pressed }) => [styles.primary, pressed && styles.pressed]} onPress={start} accessibilityRole="button">
            <Text style={styles.primaryText}>Start game</Text>
          </Pressable>
          <Link href="/rules" asChild>
            <Pressable style={styles.secondary} accessibilityRole="link">
              <Text style={styles.secondaryText}>How to play</Text>
            </Pressable>
          </Link>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  scroll: { flexGrow: 1, paddingHorizontal: space.lg, paddingBottom: space.xxl },
  container: { width: '100%', maxWidth: 520, alignSelf: 'center', gap: space.lg },
  hero: { paddingTop: space.xxl, paddingBottom: space.sm, alignItems: 'center' },
  title: { color: colors.chalk, fontSize: 38, fontWeight: '800', letterSpacing: 0.5 },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: space.lg, gap: space.md },
  cardTitle: { color: colors.text, fontSize: 17, fontWeight: '700' },
  field: { gap: space.sm },
  label: { color: colors.textMuted, fontSize: 13, fontWeight: '600' },
  hint: { color: colors.textMuted, fontSize: 13, lineHeight: 19 },
  seat: { gap: space.sm, paddingTop: space.xs },
  seatHeader: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  dot: { width: 14, height: 14, borderRadius: 7 },
  seatLabel: { color: colors.text, fontSize: 14, fontWeight: '600' },
  input: {
    backgroundColor: colors.background,
    color: colors.text,
    borderRadius: radius.sm,
    paddingHorizontal: space.md,
    paddingVertical: 10,
    fontSize: 15,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  toggleTitle: { color: colors.text, fontSize: 15, fontWeight: '600', marginBottom: 2 },
  primary: { backgroundColor: colors.accent, borderRadius: radius.md, paddingVertical: 16, alignItems: 'center' },
  pressed: { opacity: 0.8 },
  primaryText: { color: '#2A2208', fontSize: 17, fontWeight: '800' },
  secondary: { paddingVertical: 12, alignItems: 'center' },
  secondaryText: { color: colors.chalk, fontSize: 15, fontWeight: '600', textDecorationLine: 'underline' },
});
