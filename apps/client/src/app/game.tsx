import { boardOf, cellAt, cellKey, chooseBotAction, type Cell, type GameState, type Move, type Seat } from '@asta/engine';
import { Redirect, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Backdrop } from '../components/Backdrop';
import { Board } from '../components/Board';
import { CoinIcon } from '../components/CoinIcon';
import { IconButton, Popup, TopBar } from '../components/Chrome';
import { Confetti } from '../components/Effects';
import { CoachCard } from '../components/CoachCard';
import { SeatMark } from '../components/SeatMark';
import { SettingsPanel } from '../components/SettingsPanel';
import { Shells } from '../components/Shells';
import { ThrowMat } from '../components/ThrowMat';
import { useStrings, withDisplayNames, type Strings } from '../i18n';
import { haptic } from '../feedback/haptics';
import { useOnlineStore } from '../online/store';
import { displayState, useGameStore, useTimings } from '../store/game';
import { TUTORIAL_STEPS } from '../tutorial/steps';
import { describeEvents, describeOpen, describeScore, throwValue } from '../store/messages';
import { colors, radius, seatColors, space } from '../theme';

/** Wide screens put the board on the left and the controls on the right. */
const WIDE_BREAKPOINT = 820;
const SIDE_WIDTH = 340;
const HEADER_ALLOWANCE = 72;
/** Two-sided Pass & Play: a rough mat height, until the real space is measured. */
const MAT_ESTIMATE = 160;
/** Cards float over the background as dark glass with a faint gold rim. */
const GLASS = 'rgba(10, 30, 25, 0.72)';
const GOLD_RIM = '#F6D77B';

function destinationOf(state: GameState, move: Move): Cell | null {
  const piece = state.pieces.find((p) => p.id === move.pieceId);
  if (!piece) return null;
  return cellAt(boardOf(state), state.players[piece.owner]!.seat, move.to);
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

function PlayerChip({
  state,
  index,
  t,
  presence,
  compact,
}: {
  state: GameState;
  index: number;
  t: Strings;
  presence?: string | null;
  /** Phones: all players in one row, so only the name and pieces. */
  compact?: boolean;
}) {
  const player = state.players[index]!;
  const pieces = state.pieces.filter((p) => p.owner === index);
  const isCurrent = state.current === index && state.phase !== 'finished';
  const isWinner = state.winners.includes(index);
  const seat = seatColors[player.seat];
  return (
    <View
      style={[
        styles.chip,
        compact && styles.chipCompact,
        // Whose turn it is: lit up in their colour.
        isCurrent && { borderColor: seat.fill, backgroundColor: `${seat.dark}CC`, shadowColor: seat.fill, shadowOpacity: 0.7, shadowRadius: 10, shadowOffset: { width: 0, height: 0 } },
      ]}
    >
      {!compact && <SeatMark seat={player.seat} size={16} />}
      <View style={{ flexShrink: 1, minWidth: 0 }}>
        <Text style={[styles.chipName, compact && styles.chipNameCompact]} numberOfLines={1}>
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
                p.progress === boardOf(state).home && { backgroundColor: seat.fill },
              ]}
            />
          ))}
          {compact ? (
            player.team !== undefined && (
              <Text style={styles.chipTag} numberOfLines={1}>
                {t.team(player.team === 0 ? 'A' : 'B')}
              </Text>
            )
          ) : (
            <Text style={styles.chipTag} numberOfLines={1}>
              {player.bot ? t.cpuTag(player.bot) : t.humanTag}
              {player.team !== undefined ? ` · ${t.team(player.team === 0 ? 'A' : 'B')}` : ''}
            </Text>
          )}
        </View>
        {/* Online: a friend who dropped out, or whose turns the computer is playing. */}
        {presence ? (
          <Text style={styles.presence} numberOfLines={1}>
            {presence}
          </Text>
        ) : null}
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

/** Quick match: seconds left in the current turn (the server acts when it runs out). */
function TurnTimer({ mine, label }: { mine: boolean; label: (s: number) => string }) {
  const deadline = useOnlineStore((s) => s.turnDeadline);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (deadline === null) return;
    const timer = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(timer);
  }, [deadline]);
  const left = deadline === null ? null : Math.max(0, Math.ceil((deadline - now) / 1000));
  const urgent = left !== null && left <= 5;
  // A nudge when your own time is nearly up.
  useEffect(() => {
    if (mine && urgent && left === 5) haptic('big');
  }, [mine, urgent, left]);
  if (left === null) return null;
  return (
    <View style={[styles.timer, urgent && styles.timerUrgent]} accessibilityLabel={label(left)}>
      <Text style={[styles.timerText, urgent && styles.timerTextUrgent]}>⏱ {label(left)}</Text>
    </View>
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
  const mode = useGameStore((s) => s.mode);
  const mySeat = useGameStore((s) => s.mySeat);
  const waiting = useGameStore((s) => s.waiting);
  const onlineSeats = useOnlineStore((s) => s.room?.seats);
  const onlineStatus = useOnlineStore((s) => s.status);
  const roomCode = useOnlineStore((s) => s.room?.code ?? null);
  const quick = useOnlineStore((s) => !!s.room?.quick);
  /** Coins this online game paid (arrives just after it ends). */
  const reward = useOnlineStore((s) => s.reward);
  const leaveOnline = useOnlineStore((s) => s.leave);
  const timings = useTimings();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const online = mode === 'online';

  /** The guided game's current step, if one is running. */
  const step = tutorial ? (TUTORIAL_STEPS[tutorial.step] ?? null) : null;

  const current = game?.players[game.current];
  // Online, an action is waiting for the server's answer: hold further input.
  const busy = rolling || animation !== null || waiting;
  // Whose hands are on the controls: online only this device's seat; locally any human.
  const humanTurn =
    !!game && !!current && game.phase !== 'finished' && (online ? current.seat === mySeat : !current.bot);

  // Pass & Play on a phone with someone sitting at the top: the phone lies flat
  // between the players, so each side gets its own panel, the top one facing
  // them. (Not on the web, and not on tablets or computers.)
  const humans = game ? game.players.filter((p) => !p.bot).length : 0;
  const topIsHuman = !!game?.players.some((p) => p.seat === 2 && !p.bot);
  const twoSidedGame = Platform.OS !== 'web' && !online && !tutorial && humans >= 2 && topIsHuman;
  /** Two-sided layout: the space left for the board between the panels. */
  const [boardArea, setBoardArea] = useState<{ width: number; height: number } | null>(null);

  // Online: a buzz when your turn begins (the others' turns can take a while).
  const myTurnStarts = online && humanTurn && game?.phase === 'awaitingThrow' && game.pending.length === 0 ? game.turn : null;
  useEffect(() => {
    if (myTurnStarts !== null) haptic('success');
  }, [myTurnStarts]);
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
    if (online) {
      // The server plays computers and other players; only auto-move on our own turn.
      if (humanTurn && autoMove && game.phase === 'awaitingMove' && !game.canHold) {
        const options = distinctMoves(game, game.legalMoves);
        if (options.length === 1) timer = setTimeout(() => move(options[0]!.id, true), timings.autoMove);
      }
    } else if (current.bot && tutorial) {
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
  }, [game, busy, current, autoMove, throwShells, move, timings, settingsOpen, tutorial, online, humanTurn]);

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
  if (!hydrated)
    return (
      <View style={styles.screen}>
        <Backdrop />
      </View>
    );
  // Online, the first update from the server may still be on its way.
  if (online && (!game || !current)) {
    return (
      <View style={[styles.screen, styles.centered]}>
        <Backdrop />
        <ActivityIndicator color={colors.chalk} />
        <Text style={styles.message}>{onlineStatus === 'reconnecting' ? t.reconnecting : t.connecting}</Text>
      </View>
    );
  }
  if (!game || !current) return <Redirect href="/" />;

  /** Online presence for a player: dropped out, or away with the computer playing for them. */
  const presenceOf = (seatNo: number): string | null => {
    if (!online) return null;
    const s = onlineSeats?.find((x) => x.seat === seatNo);
    if (s?.kind !== 'human') return null;
    if (s.away) return t.awayTag;
    if (s.connected === false) return t.offline;
    return null;
  };
  const leaveOnlineGame = () => {
    setSettingsOpen(false);
    leaveOnline();
    router.replace('/');
  };
  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/'));

  // Player names for display: default names ("You", "Computer 2") follow the language.
  const named = withDisplayNames(t, game);
  const currentName = named.players[game.current]!.name;

  const wide = width >= WIDE_BREAKPOINT;
  const twoSided = twoSidedGame && !wide;
  const available = height - HEADER_ALLOWANCE - insets.top - insets.bottom;
  // The throwing mat (every mode except the guided game, which keeps its worded panel).
  const useMat = !tutorial;
  const singleMatHeight = Math.round(Math.min(wide ? 220 : 190, Math.max(130, (height - insets.top - insets.bottom) * 0.22)));
  const boardSize = Math.floor(
    twoSided
      ? // Whatever the two panels leave (measured), before that a fair guess.
        boardArea
        ? Math.max(200, Math.min(boardArea.width, boardArea.height))
        : Math.max(200, Math.min(width - space.md * 2, height - insets.top - insets.bottom - 2 * MAT_ESTIMATE - 40))
      : wide
        ? Math.min(available - space.lg, width - SIDE_WIDTH - space.xl * 3, 820)
        : // Phones: the board takes what the chip row (~60) and the panel (~250) leave.
          Math.max(230, Math.min(width - space.md * 2, available - (useMat ? singleMatHeight + 90 : 330), 620)),
  );
  // Two-sided: the top panel is for the top player's turns, the bottom one for everyone else's.
  const topActive = current.seat === 2 && !current.bot;

  const shown = displayState(game, animation);
  const seat = seatColors[current.seat];
  /** The throws being kept, e.g. "4", "8" or "4 + 4". */
  const keptLabel = game.pending.map((t) => throwValue(t.open)).join(' + ');

  let status: string;
  if (game.phase === 'finished') status = t.gameOver;
  else if (!humanTurn) status = t.isPlaying(currentName);
  else if (rolling) status = t.throwing;
  else if (animation) status = t.moving;
  else if (game.phase === 'awaitingThrow' && game.pending.length > 0) status = t.keptThrowAgain(keptLabel);
  else if (game.phase === 'awaitingThrow') status = online ? t.yourTurn : t.throwPrompt(currentName);
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
  // Never online: the dice are the server's.
  const canUndo = !online && undoCount > 0 && !busy && !tutorial && game.phase !== 'finished';

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
    <View style={[styles.players, wide ? styles.playersWide : styles.playersRow]}>
      {game.players.map((p) => (
        <PlayerChip key={p.index} state={named} index={p.index} t={t} presence={presenceOf(p.seat)} compact={!wide} />
      ))}
    </View>
  );

  // Chunky buttons in the current player's colour; dark text on yellow, white on the others.
  const seatButton = { backgroundColor: seat.fill, borderBottomColor: seat.dark };
  const seatButtonText = current.seat === 0 ? styles.darkText : styles.lightText;

  /**
   * The throw panel. In the two-sided layout there are two: the one on the
   * side whose turn it is is `active`; the other shows the same throw, faded.
   */
  const renderPanel = (active = true) => (
    <View
      style={[
        styles.panel,
        ((height < 700 && !wide) || twoSided) && styles.panelTight,
        { borderColor: game.phase === 'finished' ? colors.accent : seat.fill },
        !active && styles.panelIdle,
        { pointerEvents: active ? 'auto' : 'none' },
      ]}
      accessibilityElementsHidden={!active}
      importantForAccessibility={active ? 'auto' : 'no-hide-descendants'}
    >
      <View style={styles.statusRow}>
        <SeatMark seat={current.seat} size={16} />
        <Text style={styles.status} numberOfLines={2}>
          {status}
        </Text>
        {online && quick && game.phase !== 'finished' && <TurnTimer mine={humanTurn} label={t.turnSecondsLeft} />}
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
      <Shells
        shells={game.lastThrow?.shells ?? null}
        rolling={rolling}
        rollMs={timings.roll}
        size={twoSided ? (height < 700 ? 22 : 28) : wide ? 40 : height < 700 ? 28 : 34}
        // Different for every throw (the game moves on between throws), the same for both panels.
        seed={game.rng ^ (game.turn * 131 + game.events.length * 17 + game.pending.length)}
      />
      {/* Two-sided: one line of news instead of two, to leave the board room. */}
      {!twoSided && (
        <Text style={styles.score}>
          {rolling
            ? ' '
            : game.lastThrow
              ? `${describeOpen(t, game.lastThrow.open)} · ${describeScore(t, game.lastThrow.open)}`
              : t.countOpenHint}
        </Text>
      )}
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
      <Text style={styles.message} numberOfLines={twoSided ? 2 : 3}>
        {twoSided && game.lastThrow && !rolling
          ? [`${describeOpen(t, game.lastThrow.open)} · ${describeScore(t, game.lastThrow.open)}`, ...messages].join(' · ')
          : messages.join(' · ')}
      </Text>
      {joinMove && (
        <Pressable
          onPress={() => move(joinMove.id)}
          style={({ pressed }) => [styles.bigButton, seatButton, pressed && styles.pressed]}
          accessibilityRole="button"
        >
          <Text style={[styles.bigButtonText, seatButtonText]}>{t.joinFours}</Text>
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
          style={({ pressed }) => [styles.bigButton, seatButton, (pressed || busy) && styles.pressed]}
          accessibilityRole="button"
        >
          <View style={styles.gloss} />
          <Text style={[styles.bigButtonText, seatButtonText]}>{rolling ? t.throwing : t.throwShells}</Text>
        </Pressable>
      )}
    </View>
  );

  const board = (
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
      view={online && mySeat !== null ? mySeat : 0}
    />
  );

  const settingsPopup = (
    <Popup visible={settingsOpen} onClose={() => setSettingsOpen(false)} closeLabel={t.close} title={t.settings}>
      <ScrollView style={{ maxHeight: height * 0.6 }} bounces={false}>
        <SettingsPanel />
      </ScrollView>
      <Pressable
        style={({ pressed }) => [styles.bigButton, styles.goldButton, pressed && styles.pressed]}
        onPress={() => setSettingsOpen(false)}
        accessibilityRole="button"
      >
        <Text style={styles.bigButtonText}>{t.done}</Text>
      </Pressable>
    </Popup>
  );

  // Pass & Play with players facing each other: a word-free throwing mat each.
  const matHeight = Math.round(Math.min(175, Math.max(120, (height - insets.top - insets.bottom) * 0.2)));
  const renderMat = (matSeat: Seat, active: boolean, height = matHeight) => {
    const colours = seatColors[matSeat];
    return (
      <ThrowMat
        fill={colours.fill}
        dark={colours.dark}
        ink={matSeat === 0 ? '#2A2208' : '#FFFFFF'}
        active={active}
        canThrow={showThrow || showHold}
        onThrow={throwShells}
        value={game.lastThrow ? throwValue(game.lastThrow.open) : null}
        kept={game.pending.length > 1 ? game.pending.slice(0, -1).map((p) => throwValue(p.open)) : []}
        shells={game.lastThrow?.shells ?? null}
        rolling={rolling}
        rollMs={timings.roll}
        seed={game.rng ^ (game.turn * 131 + game.events.length * 17 + game.pending.length)}
        height={height}
        onUndo={active && canUndo ? undo : undefined}
        corner={online && quick && game.phase !== 'finished' ? <TurnTimer mine={humanTurn} label={t.turnSecondsLeft} /> : undefined}
        undoLabel={t.undoA11y}
        throwLabel={t.throwShells}
        resultLabel={game.lastThrow ? t.shellsOpenA11y(game.lastThrow.open) : t.shellsA11y}
      />
    );
  };

  if (twoSided) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top + space.sm, paddingBottom: insets.bottom + space.sm }]}>
        <Backdrop />
        <View style={styles.twoSided}>
          {/* The top player's mat, turned to face them. */}
          <View style={[styles.panelWrap, styles.facingTop]}>{renderMat(2, topActive)}</View>
          <View
            style={styles.boardArea}
            onLayout={(e) => {
              const { width: w, height: h } = e.nativeEvent.layout;
              if (!boardArea || Math.abs(boardArea.width - w) > 1 || Math.abs(boardArea.height - h) > 1) setBoardArea({ width: w, height: h });
            }}
          >
            <View style={{ width: boardSize, height: boardSize }}>
              {board}
              {/* Back and settings in the board's empty corners (no title bar in this layout). */}
              <View style={[styles.cornerButton, styles.cornerLeft]}>
                <IconButton label={t.back} onPress={goBack} size={34}>
                  <Text style={styles.cornerGlyph}>‹</Text>
                </IconButton>
              </View>
              <View style={[styles.cornerButton, styles.cornerRight]}>
                <IconButton label={t.settings} onPress={() => setSettingsOpen(true)} size={34}>
                  <Text style={styles.gearGlyph}>⚙</Text>
                </IconButton>
              </View>
            </View>
          </View>
          <View style={styles.panelWrap}>{renderMat(topActive ? 0 : current.seat, !topActive)}</View>
        </View>
        {settingsPopup}
        {game.phase === 'finished' && !animation && (
          <View style={styles.overlay}>
            <Confetti width={width} height={height} seed={game.turn} />
            <View style={styles.dialog}>
              <BouncingTrophy />
              <Text style={styles.dialogTitle}>{t.won(winners.join(' & '))}</Text>
              <Text style={styles.dialogText}>{game.config.mode === 'team' ? t.winTeam : t.winSolo}</Text>
              <Pressable style={({ pressed }) => [styles.bigButton, styles.goldButton, pressed && styles.pressed]} onPress={restart}>
                <Text style={styles.bigButtonText}>{t.playAgain}</Text>
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

  return (
    <View style={styles.screen}>
      <Backdrop />
      <View style={{ paddingTop: insets.top }}>
        <TopBar
          // Online, the room code stays in view so it can be told to a friend who dropped out.
          title={online && quick ? t.quickMatchTag : online && roomCode ? t.rejoinHint(roomCode) : t.appTitle}
          onBack={goBack}
          backLabel={t.back}
          right={
            <>
              <IconButton label={t.rules} onPress={() => router.push('/rules')} size={40}>
                <Text style={styles.iconGlyph}>?</Text>
              </IconButton>
              <IconButton label={t.settings} onPress={() => setSettingsOpen(true)} size={40}>
                <Text style={styles.gearGlyph}>⚙</Text>
              </IconButton>
            </>
          }
        />
      </View>
      <ScrollView
        contentContainerStyle={[
          wide ? styles.contentWide : styles.content,
          { paddingBottom: insets.bottom + space.lg },
        ]}
      >
        {online && onlineStatus === 'reconnecting' && (
          <Text style={[styles.banner, wide && styles.bannerWide]}>{t.reconnecting}</Text>
        )}
        {/* On phones the coach takes the player chips' place, so the board and buttons stay in view. */}
        {!wide && (coach ?? players)}
        <View style={{ width: boardSize, height: boardSize }}>{board}</View>
        {wide ? (
          <View style={styles.side}>
            {coach}
            {players}
            {useMat ? renderMat(current.seat, true, singleMatHeight) : renderPanel()}
          </View>
        ) : (
          <>
            {/* The panel sits at the bottom, near the thumb; spare height goes above it. */}
            <View style={styles.spacer} />
            {useMat ? renderMat(current.seat, true, singleMatHeight) : renderPanel()}
          </>
        )}
      </ScrollView>

      <Popup visible={settingsOpen} onClose={() => setSettingsOpen(false)} closeLabel={t.close} title={t.settings}>
        <ScrollView style={{ maxHeight: height * 0.6 }} bounces={false}>
          <SettingsPanel />
        </ScrollView>
        {online && (
          <View style={styles.leaveBox}>
            <Text style={styles.dialogText}>{t.leaveGameHint}</Text>
            <Pressable style={styles.dialogSecondary} onPress={leaveOnlineGame} accessibilityRole="button">
              <Text style={[styles.dialogSecondaryText, { color: colors.danger }]}>{t.leaveGame}</Text>
            </Pressable>
          </View>
        )}
        <Pressable
          style={({ pressed }) => [styles.bigButton, styles.goldButton, pressed && styles.pressed]}
          onPress={() => setSettingsOpen(false)}
          accessibilityRole="button"
        >
          <Text style={styles.bigButtonText}>{t.done}</Text>
        </Pressable>
      </Popup>

      {game.phase === 'finished' && !animation && (
        <View style={styles.overlay}>
          <Confetti width={width} height={height} seed={game.turn} />
          <View style={styles.dialog}>
            <BouncingTrophy />
            <Text style={styles.dialogTitle}>{t.won(winners.join(' & '))}</Text>
            <Text style={styles.dialogText}>{game.config.mode === 'team' ? t.winTeam : t.winSolo}</Text>
            {online && reward && (
              <View style={styles.rewardRow} accessibilityLabel={t.rewardEarned(reward.coins)}>
                <CoinIcon size={30} />
                <Text style={styles.rewardText}>{t.rewardEarned(reward.coins)}</Text>
              </View>
            )}
            {online ? (
              <Pressable style={({ pressed }) => [styles.bigButton, styles.goldButton, pressed && styles.pressed]} onPress={leaveOnlineGame}>
                <Text style={styles.bigButtonText}>{t.backToStart}</Text>
              </Pressable>
            ) : (
              <>
                <Pressable style={({ pressed }) => [styles.bigButton, styles.goldButton, pressed && styles.pressed]} onPress={restart}>
                  <Text style={styles.bigButtonText}>{t.playAgain}</Text>
                </Pressable>
                <Pressable style={styles.dialogSecondary} onPress={() => router.back()}>
                  <Text style={styles.dialogSecondaryText}>{t.newSetup}</Text>
                </Pressable>
              </>
            )}
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  centered: { alignItems: 'center', justifyContent: 'center', gap: space.md },
  banner: {
    alignSelf: 'stretch',
    color: colors.background,
    backgroundColor: colors.highlight,
    borderRadius: radius.sm,
    padding: space.sm,
    textAlign: 'center',
    fontWeight: '700',
  },
  bannerWide: { position: 'absolute', top: space.sm, left: space.xl, right: space.xl, zIndex: 10 },
  presence: { color: colors.highlight, fontSize: 11.5, fontWeight: '700', marginTop: 2 },
  leaveBox: { alignSelf: 'stretch', alignItems: 'center', marginBottom: space.md },
  content: { flexGrow: 1, paddingHorizontal: space.md, paddingTop: space.sm, gap: space.md, alignItems: 'center' },
  spacer: { flexGrow: 1, marginTop: -space.md },
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
  players: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, width: '100%', maxWidth: 620, justifyContent: 'center' },
  playersWide: { maxWidth: undefined },
  playersRow: { flexWrap: 'nowrap' },
  chipCompact: { minWidth: 0, flexBasis: 0, flexGrow: 1, paddingHorizontal: space.sm, paddingVertical: 6 },
  chipNameCompact: { fontSize: 13 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radius.md + 2,
    borderWidth: 2,
    borderColor: 'rgba(246, 215, 123, 0.22)',
    backgroundColor: GLASS,
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
    backgroundColor: GLASS,
    borderRadius: radius.lg + 2,
    borderWidth: 2,
    padding: space.lg,
    gap: space.sm,
    alignItems: 'center',
  },
  panelTight: { padding: space.md, gap: 6 },
  /** Holds a panel in the two-sided Pass & Play layout. */
  panelWrap: { width: '100%', maxWidth: 620, alignSelf: 'center' },
  /** The top player's panel reads from their side of the phone. */
  facingTop: { transform: [{ rotate: '180deg' }] },
  /** The panel of the side whose turn it isn't. */
  panelIdle: { opacity: 0.42 },
  twoSided: { flex: 1, paddingHorizontal: space.md, gap: space.sm },
  boardArea: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 0 },
  cornerButton: { position: 'absolute' },
  cornerLeft: { left: 2, bottom: 2 },
  cornerRight: { right: 2, bottom: 2 },
  cornerGlyph: { color: colors.chalk, fontSize: 24, fontWeight: '700', marginTop: -3 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, alignSelf: 'stretch' },
  undo: {
    borderWidth: 1.5,
    borderColor: colors.chalkDim,
    borderRadius: radius.pill,
    paddingHorizontal: space.md,
    paddingVertical: 5,
  },
  undoText: { color: colors.chalk, fontSize: 13.5, fontWeight: '700' },
  timer: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.pill, backgroundColor: 'rgba(0,0,0,0.3)' },
  timerUrgent: { backgroundColor: colors.danger },
  timerText: { color: colors.chalk, fontSize: 13, fontWeight: '800', fontVariant: ['tabular-nums'] },
  timerTextUrgent: { color: '#fff' },
  status: { color: colors.text, fontSize: 16, fontWeight: '700', flex: 1 },
  score: { color: colors.chalk, fontSize: 14, fontWeight: '600', textAlign: 'center' },
  message: { color: colors.textMuted, fontSize: 13, textAlign: 'center', minHeight: 18 },
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
    borderRadius: radius.lg + 4,
    borderWidth: 2,
    borderColor: GOLD_RIM,
    padding: space.xl,
    alignItems: 'center',
    gap: space.sm,
  },
  /** Chunky raised button: a darker bottom edge and a glossy top half. */
  bigButton: {
    alignSelf: 'stretch',
    borderRadius: radius.md + 2,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: space.xs,
    borderBottomWidth: 5,
    overflow: 'hidden',
  },
  goldButton: { backgroundColor: colors.accent, borderBottomColor: '#B8913A' },
  gloss: {
    position: 'absolute',
    left: 6,
    right: 6,
    top: 3,
    height: '42%',
    borderRadius: radius.md,
    backgroundColor: 'rgba(255,255,255,0.22)',
  },
  bigButtonText: { color: '#2A2208', fontSize: 17, fontWeight: '900', letterSpacing: 0.3 },
  darkText: { color: '#2A2208' },
  lightText: { color: '#FFFFFF', textShadowColor: 'rgba(0,0,0,0.4)', textShadowOffset: { width: 0, height: 1.5 }, textShadowRadius: 2 },
  iconGlyph: { color: colors.chalk, fontSize: 19, fontWeight: '900' },
  gearGlyph: { color: colors.chalk, fontSize: 20, marginTop: -2 },
  dialogEmoji: { fontSize: 44 },
  rewardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderWidth: 1.5,
    borderColor: 'rgba(246, 215, 123, 0.55)',
    marginBottom: space.sm,
  },
  rewardText: { color: '#F6D77B', fontSize: 22, fontWeight: '900' },
  dialogTitle: { color: colors.text, fontSize: 24, fontWeight: '800', textAlign: 'center' },
  dialogText: { color: colors.textMuted, fontSize: 14, textAlign: 'center', marginBottom: space.sm },
  dialogSecondary: { paddingVertical: space.md },
  dialogSecondaryText: { color: colors.chalk, fontSize: 15, fontWeight: '600', textDecorationLine: 'underline' },
});
