import { HOME_INDEX, cellAt, cellKey, chooseBotAction, type Cell, type GameState, type Move } from '@asta/engine';
import { Link, Redirect, Stack, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Animated, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Board } from '../components/Board';
import { Confetti } from '../components/Effects';
import { CoachCard } from '../components/CoachCard';
import { SeatMark } from '../components/SeatMark';
import { SettingsPanel } from '../components/SettingsPanel';
import { Shells } from '../components/Shells';
import { useStrings, withDisplayNames, type Strings } from '../i18n';
import { displayState, useGameStore, useTimings } from '../store/game';
import { TUTORIAL_STEPS } from '../tutorial/steps';
import { describeEvents, describeOpen, describeScore, throwValue } from '../store/messages';
import { colors, radius, seatColors, space } from '../theme';

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

function PlayerChip({ state, index, t }: { state: GameState; index: number; t: Strings }) {
  const player = state.players[index]!;
  const pieces = state.pieces.filter((p) => p.owner === index);
  const isCurrent = state.current === index && state.phase !== 'finished';
  const isWinner = state.winners.includes(index);
  const seat = seatColors[player.seat];
  return (
    <View style={[styles.chip, isCurrent && { borderColor: seat.fill, backgroundColor: colors.surfaceRaised }]}>
      <SeatMark seat={player.seat} size={16} />
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
            {player.bot ? t.cpuTag(player.bot) : t.humanTag}
            {player.team !== undefined ? ` · ${t.team(player.team === 0 ? 'A' : 'B')}` : ''}
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
  const t = useStrings();
  const game = useGameStore((s) => s.game);
  const rolling = useGameStore((s) => s.rolling);
  const animation = useGameStore((s) => s.animation);
  const selected = useGameStore((s) => s.selected);
  const note = useGameStore((s) => s.note);
  const autoMove = useGameStore((s) => s.autoMove);
  const throwShells = useGameStore((s) => s.throwShells);
  const move = useGameStore((s) => s.move);
  const select = useGameStore((s) => s.select);
  const restart = useGameStore((s) => s.restart);
  const effects = useGameStore((s) => s.effects);
  const shakeKey = useGameStore((s) => s.shakeKey);
  const removeEffect = useGameStore((s) => s.removeEffect);
  const hydrated = useGameStore((s) => s.hydrated);
  const tutorial = useGameStore((s) => s.tutorial);
  const undoCount = useGameStore((s) => s.undoStack.length);
  const undo = useGameStore((s) => s.undo);
  const nextTutorialStep = useGameStore((s) => s.nextTutorialStep);
  const endTutorial = useGameStore((s) => s.endTutorial);
  const timings = useTimings();
  const [settingsOpen, setSettingsOpen] = useState(false);

  /** The guided game's current step, if one is running. */
  const step = tutorial ? (TUTORIAL_STEPS[tutorial.step] ?? null) : null;

  const current = game?.players[game.current];
  const busy = rolling || animation !== null;
  const humanTurn = !!game && !current?.bot && game.phase !== 'finished';
  const movable = useMemo(() => {
    if (!game || !humanTurn || busy || game.phase !== 'awaitingMove') return [];
    // In the guided game only the move the step asks for glows.
    if (step) return step.allowMove ? game.legalMoves.filter((m) => step.allowMove!(m, game)) : [];
    return game.legalMoves;
  }, [game, humanTurn, busy, step]);

  // Guided game: move on to the next step once its goal is reached.
  useEffect(() => {
    if (!game || !step?.done || busy) return;
    if (step.done(game)) nextTutorialStep();
  }, [game, step, busy, nextTutorialStep]);

  // Computer players, and auto-move for humans with a single real choice.
  // Paused while the settings are open, so nothing happens behind them.
  useEffect(() => {
    if (!game || game.phase === 'finished' || busy || !current || settingsOpen) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    if (current.bot && tutorial) {
      // Guided game: the computer throws its scripted shells and makes the first legal move.
      const first = game.legalMoves[0];
      timer =
        game.phase === 'awaitingThrow' || !first
          ? setTimeout(throwShells, timings.botThrow)
          : setTimeout(() => move(first.id), timings.botMove);
    } else if (current.bot) {
      const action = chooseBotAction(game, current.bot);
      timer =
        action.type === 'throw'
          ? setTimeout(throwShells, timings.botThrow)
          : setTimeout(() => move(action.move.id), timings.botMove);
    } else if (autoMove && !tutorial && game.phase === 'awaitingMove' && !game.canHold) {
      // Never auto-use a 4 the player might want to keep for joining.
      const options = distinctMoves(game, game.legalMoves);
      // Forced: Undo skips past moves the app made for the player.
      if (options.length === 1) timer = setTimeout(() => move(options[0]!.id, true), timings.autoMove);
    }
    return () => clearTimeout(timer);
  }, [game, busy, current, autoMove, throwShells, move, timings, settingsOpen, tutorial]);

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

  // Player names for display: default names ("You", "Computer 2") follow the language.
  const named = withDisplayNames(t, game);
  const currentName = named.players[game.current]!.name;

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
  if (game.phase === 'finished') status = t.gameOver;
  else if (current.bot) status = t.isPlaying(currentName);
  else if (rolling) status = t.throwing;
  else if (animation) status = t.moving;
  else if (game.phase === 'awaitingThrow' && game.pending.length > 0) status = t.keptThrowAgain(keptLabel);
  else if (game.phase === 'awaitingThrow') status = t.throwPrompt(currentName);
  else if (selected) {
    const options = movable.filter((m) => m.pieceId === selected).length;
    status = options > 1 ? t.tapSquare : t.tapAgain;
  } else if (game.canHold && (!step || step.allowHold)) status = t.useOrKeep(keptLabel, game.pending.length > 1);
  else status = t.tapGlowing;

  // Built at display time from the game's events, so it follows the language.
  const messages = note === 'start' ? [t.startHint] : note === 'welcome' ? [t.welcomeBack] : describeEvents(t, named, game.events);

  const winners = game.winners.map((i) => named.players[i]!.name);
  const joinMove = humanTurn && !busy ? movable.find((m) => m.join) : undefined;
  // Undo: not mid-roll or mid-move, not in the guided game, and not once the game is won.
  const canUndo = undoCount > 0 && !busy && !tutorial && game.phase !== 'finished';

  // In the guided game only the action the step asks for is offered.
  const showHold = humanTurn && !busy && game.phase === 'awaitingMove' && game.canHold && (!step || !!step.allowHold);
  const showThrow = humanTurn && game.phase === 'awaitingThrow' && (!step || !!step.allowThrow);

  const coach =
    step && tutorial ? (
      <CoachCard
        t={t}
        step={step}
        index={tutorial.step}
        total={TUTORIAL_STEPS.length}
        onNext={nextTutorialStep}
        onSkip={() => {
          endTutorial(false);
          router.back();
        }}
        onKeepPlaying={() => endTutorial(true)}
        onBackToStart={() => {
          endTutorial(false);
          router.back();
        }}
      />
    ) : null;

  const players = (
    <View style={[styles.players, wide && styles.playersWide]}>
      {game.players.map((p) => (
        <PlayerChip key={p.index} state={named} index={p.index} t={t} />
      ))}
    </View>
  );

  const panel = (
    <View style={[styles.panel, { borderColor: game.phase === 'finished' ? colors.accent : seat.fill }]}>
      <View style={styles.statusRow}>
        <SeatMark seat={current.seat} size={16} />
        <Text style={styles.status} numberOfLines={2}>
          {status}
        </Text>
        {canUndo && (
          <Pressable
            onPress={undo}
            hitSlop={8}
            style={({ pressed }) => [styles.undo, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel={t.undoA11y}
          >
            <Text style={styles.undoText}>↶ {t.undo}</Text>
          </Pressable>
        )}
      </View>
      <Shells shells={game.lastThrow?.shells ?? null} rolling={rolling} size={wide ? 40 : 34} />
      <Text style={styles.score}>
        {rolling
          ? ' '
          : game.lastThrow
            ? `${describeOpen(t, game.lastThrow.open)} · ${describeScore(t, game.lastThrow.open)}`
            : t.countOpenHint}
      </Text>
      {game.pending.length > 1 && !rolling && (
        <View style={styles.pendingRow} accessibilityLabel={t.throwsToUseA11y}>
          <Text style={styles.pendingLabel}>{t.toUse}</Text>
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
          <Text style={styles.throwText}>{t.joinFours}</Text>
        </Pressable>
      )}
      {showHold && (
        <Pressable
          onPress={throwShells}
          style={({ pressed }) => [styles.secondaryButton, { borderColor: seat.fill }, pressed && styles.pressed]}
          accessibilityRole="button"
        >
          <Text style={styles.secondaryText}>{t.keepThrow(keptLabel)}</Text>
        </Pressable>
      )}
      {showThrow && (
        <Pressable
          onPress={throwShells}
          disabled={busy}
          style={({ pressed }) => [styles.throwButton, { backgroundColor: seat.fill }, (pressed || busy) && styles.pressed]}
          accessibilityRole="button"
        >
          <Text style={styles.throwText}>{rolling ? t.throwing : t.throwShells}</Text>
        </Pressable>
      )}
    </View>
  );

  return (
    <View style={styles.screen}>
      <Stack.Screen
        options={{
          title: t.appTitle,
          headerRight: () => (
            <View style={styles.headerActions}>
              <Link href="/rules" asChild>
                <Pressable hitSlop={10} accessibilityRole="link">
                  <Text style={styles.headerLink}>{t.rules}</Text>
                </Pressable>
              </Link>
              <Pressable hitSlop={10} onPress={() => setSettingsOpen(true)} accessibilityRole="button" accessibilityLabel={t.settings}>
                <Text style={styles.headerIcon}>⚙</Text>
              </Pressable>
            </View>
          ),
        }}
      />
      <ScrollView
        contentContainerStyle={[
          wide ? styles.contentWide : styles.content,
          { paddingBottom: insets.bottom + space.lg },
        ]}
      >
        {/* On phones the coach takes the player chips' place, so the board and buttons stay in view. */}
        {!wide && (coach ?? players)}
        <View style={{ width: boardSize, height: boardSize }}>
          <Board
            state={shown}
            size={boardSize}
            movable={movable}
            selected={selected}
            movingPieceId={animation?.pieceId ?? null}
            stepMs={timings.step}
            onPiecePress={onPiecePress}
            onCellPress={onCellPress}
            effects={effects}
            onEffectDone={removeEffect}
            shakeKey={shakeKey}
          />
        </View>
        {wide ? (
          <View style={styles.side}>
            {coach}
            {players}
            {panel}
          </View>
        ) : (
          panel
        )}
      </ScrollView>

      <Modal visible={settingsOpen} transparent animationType="fade" onRequestClose={() => setSettingsOpen(false)}>
        <Pressable style={styles.overlay} onPress={() => setSettingsOpen(false)} accessibilityLabel={t.closeSettings}>
          {/* Taps inside the sheet must not close it. */}
          <Pressable style={styles.dialog} onPress={() => {}}>
            <Text style={styles.sheetTitle}>{t.settings}</Text>
            <View style={styles.sheetBody}>
              <SettingsPanel />
            </View>
            <Pressable
              style={[styles.throwButton, { backgroundColor: colors.accent }]}
              onPress={() => setSettingsOpen(false)}
              accessibilityRole="button"
            >
              <Text style={styles.throwText}>{t.done}</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {game.phase === 'finished' && !animation && (
        <View style={styles.overlay}>
          <Confetti width={width} height={height} seed={game.turn} />
          <View style={styles.dialog}>
            <BouncingTrophy />
            <Text style={styles.dialogTitle}>{t.won(winners.join(' & '))}</Text>
            <Text style={styles.dialogText}>{game.config.mode === 'team' ? t.winTeam : t.winSolo}</Text>
            <Pressable style={[styles.throwButton, { backgroundColor: colors.accent }]} onPress={restart}>
              <Text style={styles.throwText}>{t.playAgain}</Text>
            </Pressable>
            <Pressable style={styles.dialogSecondary} onPress={() => router.back()}>
              <Text style={styles.dialogSecondaryText}>{t.newSetup}</Text>
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
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  headerIcon: { color: colors.chalk, fontSize: 22, paddingHorizontal: space.sm },
  sheetTitle: { color: colors.text, fontSize: 20, fontWeight: '800', alignSelf: 'flex-start' },
  sheetBody: { alignSelf: 'stretch', marginVertical: space.md },
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
  undo: {
    borderWidth: 1.5,
    borderColor: colors.chalkDim,
    borderRadius: radius.pill,
    paddingHorizontal: space.md,
    paddingVertical: 5,
  },
  undoText: { color: colors.chalk, fontSize: 13.5, fontWeight: '700' },
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
