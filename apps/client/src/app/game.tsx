import { HOME_INDEX, cellAt, cellKey, chooseBotAction, type Cell, type GameState, type Move } from '@asta/engine';
import { Link, Redirect, Stack, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Animated, Platform, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Board } from '../components/Board';
import { Confetti } from '../components/Effects';
import { Shells } from '../components/Shells';
import { STEP_MS, displayState, useGameStore } from '../store/game';
import { describeOpen, describeScore, throwValue } from '../store/messages';
import { colors, radius, seatColors, space } from '../theme';

const BOT_THROW_MS = 750;
const BOT_MOVE_MS = 600;
const AUTO_MOVE_MS = 450;

/** Wide screens put the board on the left and the controls on the right. */
const WIDE_BREAKPOINT = 820;
const SIDE_WIDTH = 340;
const HEADER_ALLOWANCE = 72;

function destinationOf(state: GameState, move: Move): Cell | null {
  const piece = state.pieces.find((p) => p.id === move.pieceId);
  if (!piece) return null;
  return cellAt(state.players[piece.owner]!.seat, move.to);
}

/** Moves that lead to genuinely different positions (two waiting Children are interchangeable). */
function distinctMoves(state: GameState, moves: Move[]): Move[] {
  const seen = new Set<string>();
  return moves.filter((m) => {
    const piece = state.pieces.find((p) => p.id === m.pieceId);
    const key = `${piece?.owner}|${piece?.kind}|${m.from}|${m.to}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function PlayerChip({ state, index }: { state: GameState; index: number }) {
  const player = state.players[index]!;
  const pieces = state.pieces.filter((p) => p.owner === index);
  const isCurrent = state.current === index && state.phase !== 'finished';
  const isWinner = state.winners.includes(index);
  const seat = seatColors[player.seat];
  return (
    <View style={[styles.chip, isCurrent && { borderColor: seat.fill, backgroundColor: colors.surfaceRaised }]}>
      <View style={[styles.chipDot, { backgroundColor: seat.fill }]} />
      <View style={{ flexShrink: 1 }}>
        <Text style={styles.chipName} numberOfLines={1}>
          {isWinner ? '🏆 ' : ''}
          {player.name}
        </Text>
        <View style={styles.chipMeta}>
          {pieces.map((p) => (
            <View
              key={p.id}
              style={[
                p.kind === 'mother' ? styles.homeMother : styles.homeChild,
                { borderColor: seat.fill },
                p.progress === HOME_INDEX && { backgroundColor: seat.fill },
              ]}
            />
          ))}
          <Text style={styles.chipTag} numberOfLines={1}>
            {player.bot ? `CPU ${player.bot}` : 'Human'}
            {player.team !== undefined ? ` · Team ${player.team === 0 ? 'A' : 'B'}` : ''}
          </Text>
        </View>
      </View>
    </View>
  );
}

/** The trophy springs in and keeps bouncing. */
function BouncingTrophy() {
  const [anim] = useState(() => new Animated.Value(0));
  useEffect(() => {
    const native = Platform.OS !== 'web';
    const seq = Animated.sequence([
      Animated.spring(anim, { toValue: 1, useNativeDriver: native, speed: 6, bounciness: 18 }),
      Animated.loop(
        Animated.sequence([
          Animated.timing(anim, { toValue: 1.12, duration: 420, useNativeDriver: native }),
          Animated.timing(anim, { toValue: 1, duration: 420, useNativeDriver: native }),
        ]),
      ),
    ]);
    seq.start();
    return () => seq.stop();
  }, [anim]);
  return (
    <Animated.Text
      style={[
        styles.dialogEmoji,
        {
          transform: [
            { scale: anim },
            { rotate: anim.interpolate({ inputRange: [0, 1, 1.12], outputRange: ['-30deg', '0deg', '6deg'] }) },
          ],
        },
      ]}
    >
      🏆
    </Animated.Text>
  );
}

export default function GameScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const game = useGameStore((s) => s.game);
  const rolling = useGameStore((s) => s.rolling);
  const animation = useGameStore((s) => s.animation);
  const selected = useGameStore((s) => s.selected);
  const messages = useGameStore((s) => s.messages);
  const autoMove = useGameStore((s) => s.autoMove);
  const throwShells = useGameStore((s) => s.throwShells);
  const move = useGameStore((s) => s.move);
  const select = useGameStore((s) => s.select);
  const restart = useGameStore((s) => s.restart);
  const effects = useGameStore((s) => s.effects);
  const shakeKey = useGameStore((s) => s.shakeKey);
  const removeEffect = useGameStore((s) => s.removeEffect);
  const hydrated = useGameStore((s) => s.hydrated);

  const current = game?.players[game.current];
  const busy = rolling || animation !== null;
  const humanTurn = !!game && !current?.bot && game.phase !== 'finished';
  const movable = useMemo(
    () => (game && humanTurn && !busy && game.phase === 'awaitingMove' ? game.legalMoves : []),
    [game, humanTurn, busy],
  );

  // Computer players, and auto-move for humans with a single real choice.
  useEffect(() => {
    if (!game || game.phase === 'finished' || busy || !current) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    if (current.bot) {
      const action = chooseBotAction(game, current.bot);
      timer =
        action.type === 'throw'
          ? setTimeout(throwShells, BOT_THROW_MS)
          : setTimeout(() => move(action.move.id), BOT_MOVE_MS);
    } else if (autoMove && game.phase === 'awaitingMove' && !game.canHold) {
      // Never auto-use a 4 the player might want to keep for joining.
      const options = distinctMoves(game, game.legalMoves);
      if (options.length === 1) timer = setTimeout(() => move(options[0]!.id), AUTO_MOVE_MS);
    }
    return () => clearTimeout(timer);
  }, [game, busy, current, autoMove, throwShells, move]);

  // First tap selects a piece and shows where it can go; a second tap moves it
  // when it has a single option, otherwise the player taps the square.
  const onPiecePress = useCallback(
    (pieceId: string) => {
      if (selected !== pieceId) return select(pieceId);
      const options = movable.filter((m) => m.pieceId === pieceId);
      if (options.length === 1) move(options[0]!.id);
    },
    [selected, movable, move, select],
  );

  const onCellPress = useCallback(
    (cell: Cell) => {
      if (!game) return;
      const here = movable.filter((m) => {
        const dest = destinationOf(game, m);
        return dest !== null && cellKey(dest) === cellKey(cell);
      });
      const chosen = selected ? here.find((m) => m.pieceId === selected) : distinctMoves(game, here).length === 1 ? here[0] : undefined;
      if (chosen) move(chosen.id);
    },
    [game, movable, selected, move],
  );

  // Wait for a saved game to load before deciding there is no game to show.
  if (!hydrated) return <View style={styles.screen} />;
  if (!game || !current) return <Redirect href="/" />;

  const wide = width >= WIDE_BREAKPOINT;
  const available = height - HEADER_ALLOWANCE - insets.top - insets.bottom;
  const boardSize = Math.floor(
    wide
      ? Math.min(available - space.lg, width - SIDE_WIDTH - space.xl * 3, 820)
      : Math.max(280, Math.min(width - space.md * 2, available - 300, 620)),
  );

  const shown = displayState(game, animation);
  const seat = seatColors[current.seat];
  /** The throws being kept, e.g. "4", "8" or "4 + 4". */
  const keptLabel = game.pending.map((t) => throwValue(t.open)).join(' + ');

  let status: string;
  if (game.phase === 'finished') status = 'Game over';
  else if (current.bot) status = `${current.name} is playing…`;
  else if (rolling) status = 'Throwing…';
  else if (animation) status = 'Moving…';
  else if (game.phase === 'awaitingThrow' && game.pending.length > 0) status = `Your ${keptLabel} kept – throw again`;
  else if (game.phase === 'awaitingThrow') status = `${current.name}, throw the shells`;
  else if (selected) {
    const options = movable.filter((m) => m.pieceId === selected).length;
    status = options > 1 ? 'Tap a highlighted square to move' : 'Tap the piece again or its square to move';
  } else if (game.canHold) {
    status = `Use the ${keptLabel} now, or keep ${game.pending.length > 1 ? 'them' : 'it'} and throw again`;
  }
  else status = 'Tap a glowing piece';

  const winners = game.winners.map((i) => game.players[i]!.name);
  const joinMove = humanTurn && !busy ? movable.find((m) => m.join) : undefined;
  const showHold = humanTurn && !busy && game.phase === 'awaitingMove' && game.canHold;
  const showThrow = humanTurn && game.phase === 'awaitingThrow';

  const players = (
    <View style={[styles.players, wide && styles.playersWide]}>
      {game.players.map((p) => (
        <PlayerChip key={p.index} state={game} index={p.index} />
      ))}
    </View>
  );

  const panel = (
    <View style={[styles.panel, { borderColor: game.phase === 'finished' ? colors.accent : seat.fill }]}>
      <View style={styles.statusRow}>
        <View style={[styles.chipDot, { backgroundColor: seat.fill }]} />
        <Text style={styles.status} numberOfLines={2}>
          {status}
        </Text>
      </View>
      <Shells shells={game.lastThrow?.shells ?? null} rolling={rolling} size={wide ? 40 : 34} />
      <Text style={styles.score}>
        {rolling
          ? ' '
          : game.lastThrow
            ? `${describeOpen(game.lastThrow.open)} · ${describeScore(game.lastThrow.open)}`
            : 'Five cowries: count the open ones'}
      </Text>
      {game.pending.length > 1 && !rolling && (
        <View style={styles.pendingRow} accessibilityLabel="Throws to use">
          <Text style={styles.pendingLabel}>To use:</Text>
          {game.pending.map((t, i) => (
            <View key={i} style={[styles.pendingChip, { borderColor: seat.fill }]}>
              <Text style={styles.pendingText}>{throwValue(t.open)}</Text>
            </View>
          ))}
        </View>
      )}
      <Text style={styles.message} numberOfLines={3}>
        {messages.join(' · ')}
      </Text>
      {joinMove && (
        <Pressable
          onPress={() => move(joinMove.id)}
          style={({ pressed }) => [styles.throwButton, { backgroundColor: seat.fill }, pressed && styles.pressed]}
          accessibilityRole="button"
        >
          <Text style={styles.throwText}>Join 4 + 4 · Release Mother</Text>
        </Pressable>
      )}
      {showHold && (
        <Pressable
          onPress={throwShells}
          style={({ pressed }) => [styles.secondaryButton, { borderColor: seat.fill }, pressed && styles.pressed]}
          accessibilityRole="button"
        >
          <Text style={styles.secondaryText}>Keep {keptLabel} · Throw again</Text>
        </Pressable>
      )}
      {showThrow && (
        <Pressable
          onPress={throwShells}
          disabled={busy}
          style={({ pressed }) => [styles.throwButton, { backgroundColor: seat.fill }, (pressed || busy) && styles.pressed]}
          accessibilityRole="button"
        >
          <Text style={styles.throwText}>{rolling ? 'Throwing…' : 'Throw shells'}</Text>
        </Pressable>
      )}
    </View>
  );

  return (
    <View style={styles.screen}>
      <Stack.Screen
        options={{
          headerRight: () => (
            <Link href="/rules" asChild>
              <Pressable hitSlop={10} accessibilityRole="link">
                <Text style={styles.headerLink}>Rules</Text>
              </Pressable>
            </Link>
          ),
        }}
      />
      <ScrollView
        contentContainerStyle={[
          wide ? styles.contentWide : styles.content,
          { paddingBottom: insets.bottom + space.lg },
        ]}
      >
        {!wide && players}
        <View style={{ width: boardSize, height: boardSize }}>
          <Board
            state={shown}
            size={boardSize}
            movable={movable}
            selected={selected}
            movingPieceId={animation?.pieceId ?? null}
            stepMs={STEP_MS}
            onPiecePress={onPiecePress}
            onCellPress={onCellPress}
            effects={effects}
            onEffectDone={removeEffect}
            shakeKey={shakeKey}
          />
        </View>
        {wide ? (
          <View style={styles.side}>
            {players}
            {panel}
          </View>
        ) : (
          panel
        )}
      </ScrollView>

      {game.phase === 'finished' && !animation && (
        <View style={styles.overlay}>
          <Confetti width={width} height={height} seed={game.turn} />
          <View style={styles.dialog}>
            <BouncingTrophy />
            <Text style={styles.dialogTitle}>{winners.join(' & ')} won!</Text>
            <Text style={styles.dialogText}>
              {game.config.mode === 'team' ? 'Both partners brought all their pieces home.' : 'All three pieces are home.'}
            </Text>
            <Pressable style={[styles.throwButton, { backgroundColor: colors.accent }]} onPress={restart}>
              <Text style={styles.throwText}>Play again</Text>
            </Pressable>
            <Pressable style={styles.dialogSecondary} onPress={() => router.back()}>
              <Text style={styles.dialogSecondaryText}>New game setup</Text>
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: space.md, paddingTop: space.sm, gap: space.md, alignItems: 'center' },
  contentWide: {
    flexGrow: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: space.xl,
    paddingHorizontal: space.xl,
    paddingTop: space.sm,
  },
  side: { width: SIDE_WIDTH, gap: space.md },
  headerLink: { color: colors.chalk, fontSize: 16, fontWeight: '600', paddingHorizontal: space.sm },
  players: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, width: '100%', maxWidth: 620, justifyContent: 'center' },
  playersWide: { maxWidth: undefined },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: 'transparent',
    backgroundColor: colors.surface,
    minWidth: 150,
    flexGrow: 1,
    flexBasis: 150,
  },
  chipDot: { width: 14, height: 14, borderRadius: 7 },
  chipName: { color: colors.text, fontSize: 14, fontWeight: '700' },
  chipMeta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
  homeMother: { width: 11, height: 11, borderRadius: 6, borderWidth: 2 },
  homeChild: { width: 8, height: 8, borderRadius: 4, borderWidth: 1.5 },
  chipTag: { color: colors.textMuted, fontSize: 11.5, marginLeft: 4 },
  panel: {
    width: '100%',
    maxWidth: 620,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 2,
    padding: space.lg,
    gap: space.sm,
    alignItems: 'center',
  },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, alignSelf: 'stretch' },
  status: { color: colors.text, fontSize: 16, fontWeight: '700', flex: 1 },
  score: { color: colors.chalk, fontSize: 14, fontWeight: '600', textAlign: 'center' },
  message: { color: colors.textMuted, fontSize: 13, textAlign: 'center', minHeight: 18 },
  throwButton: { alignSelf: 'stretch', borderRadius: radius.md, paddingVertical: 14, alignItems: 'center', marginTop: space.xs },
  throwText: { color: '#1C1C1C', fontSize: 16, fontWeight: '800' },
  secondaryButton: {
    alignSelf: 'stretch',
    borderRadius: radius.md,
    borderWidth: 2,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: space.xs,
  },
  secondaryText: { color: colors.text, fontSize: 15, fontWeight: '700' },
  pendingRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  pendingLabel: { color: colors.textMuted, fontSize: 13, fontWeight: '600' },
  pendingChip: {
    minWidth: 34,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.sm,
    borderWidth: 2,
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  pendingText: { color: colors.text, fontSize: 15, fontWeight: '800' },
  pressed: { opacity: 0.7 },
  overlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(10, 22, 19, 0.72)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: space.xl,
  },
  dialog: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: space.xl,
    alignItems: 'center',
    gap: space.sm,
  },
  dialogEmoji: { fontSize: 44 },
  dialogTitle: { color: colors.text, fontSize: 24, fontWeight: '800', textAlign: 'center' },
  dialogText: { color: colors.textMuted, fontSize: 14, textAlign: 'center', marginBottom: space.sm },
  dialogSecondary: { paddingVertical: space.md },
  dialogSecondaryText: { color: colors.chalk, fontSize: 15, fontWeight: '600', textDecorationLine: 'underline' },
});
