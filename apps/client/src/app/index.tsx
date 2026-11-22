import { HOME_INDEX, type Player, type Seat } from '@asta/engine';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Defs, Ellipse, RadialGradient, Stop } from 'react-native-svg';
import { useAccountStore } from '../account/store';
import { Avatar } from '../components/Avatar';
import { CoinIcon } from '../components/CoinIcon';
import { Backdrop } from '../components/Backdrop';
import { BoardDrawing } from '../components/BoardDrawing';
import { GRID_END, MID, VIEW_PAD, VIEW_TOTAL, cellCentre, rotateToSeat } from '../components/boardGeometry';
import { IconButton, Popup } from '../components/Chrome';
import { ComputerIcon, LearnIcon, OnlineIcon, PassPlayIcon } from '../components/ModeIcons';
import { ModeTile } from '../components/ModeTile';
import { SeatMark } from '../components/SeatMark';
import { SettingsPanel } from '../components/SettingsPanel';
import { Cowrie } from '../components/Shells';
import { STRINGS, useStrings, withDisplayNames } from '../i18n';
import { PRIVACY_URL } from '../online/config';
import { useOnlineStore } from '../online/store';
import { useGameStore } from '../store/game';
import { colors, radius, seatColors, space } from '../theme';

const useNativeDriver = Platform.OS !== 'web';

/**
 * Popups offered once per app launch: the saved game and the online seat.
 * After they're closed, a small button in the top bar brings them back.
 */
let resumeOffered = false;
let rejoinOffered = false;
let dailyOffered = false;

/** Four seats for the decorative board on the start screen. */
const HERO_PLAYERS: Player[] = ([0, 1, 2, 3] as Seat[]).map((seat) => ({ index: seat, name: '', seat }));

/** A few marbles on the decorative board: two waiting in each starting area, one out on the route. */
function HeroMarbles({ size }: { size: number }) {
  const marbles: { seat: Seat; x: number; y: number; r: number }[] = [];
  for (const seat of [0, 1, 2, 3] as Seat[]) {
    for (const dx of [-0.32, 0.32]) {
      const p = rotateToSeat({ x: MID + dx, y: GRID_END + 0.45 }, seat);
      marbles.push({ seat, ...p, r: 0.24 });
    }
  }
  const onBoard: [Seat, number, number][] = [
    [0, 4, 3],
    [1, 1, 4],
    [2, 0, 1],
    [3, 3, 0],
  ];
  for (const [seat, row, col] of onBoard) marbles.push({ seat, ...cellCentre({ row, col }), r: 0.3 });

  return (
    <Svg width={size} height={size} viewBox={`${-VIEW_PAD} ${-VIEW_PAD} ${VIEW_TOTAL} ${VIEW_TOTAL}`} style={StyleSheet.absoluteFill}>
      <Defs>
        {([0, 1, 2, 3] as Seat[]).map((seat) => (
          <RadialGradient key={seat} id={`heroMarble${seat}`} cx="35%" cy="30%" r="75%">
            <Stop offset="0" stopColor={seatColors[seat].light} />
            <Stop offset="0.45" stopColor={seatColors[seat].fill} />
            <Stop offset="1" stopColor={seatColors[seat].dark} />
          </RadialGradient>
        ))}
      </Defs>
      {marbles.map((m, i) => (
        <Circle key={`s${i}`} cx={m.x + 0.04} cy={m.y + 0.07} r={m.r} fill="#000" fillOpacity={0.35} />
      ))}
      {marbles.map((m, i) => (
        <Circle key={`m${i}`} cx={m.x} cy={m.y} r={m.r} fill={`url(#heroMarble${m.seat})`} />
      ))}
      {marbles.map((m, i) => (
        <Ellipse key={`h${i}`} cx={m.x - m.r * 0.3} cy={m.y - m.r * 0.38} rx={m.r * 0.32} ry={m.r * 0.2} fill="#FFFFFF" fillOpacity={0.55} />
      ))}
    </Svg>
  );
}

/** Five cowries that bob gently, in front of the board. */
function FloatingShells({ size }: { size: number }) {
  const [bob] = useState(() => new Animated.Value(0));
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(bob, { toValue: 1, duration: 1400, easing: Easing.inOut(Easing.sin), useNativeDriver }),
        Animated.timing(bob, { toValue: 0, duration: 1400, easing: Easing.inOut(Easing.sin), useNativeDriver }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [bob]);
  const shells = [
    { open: true, rotate: '-18deg', lift: 1 },
    { open: false, rotate: '10deg', lift: -1 },
    { open: true, rotate: '-4deg', lift: 1.4 },
    { open: false, rotate: '16deg', lift: -1.2 },
    { open: true, rotate: '-10deg', lift: 0.8 },
  ];
  return (
    <View style={styles.shells}>
      {shells.map((s, i) => (
        <Animated.View
          key={i}
          style={{
            transform: [
              { translateY: bob.interpolate({ inputRange: [0, 1], outputRange: [0, -5 * s.lift] }) },
              { rotate: s.rotate },
            ],
          }}
        >
          <Cowrie open={s.open} size={size} />
        </Animated.View>
      ))}
    </View>
  );
}

export default function HomeScreen() {
  const router = useRouter();
  const t = useStrings();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const language = useGameStore((s) => s.language);
  const setLanguage = useGameStore((s) => s.setLanguage);
  const startTutorial = useGameStore((s) => s.startTutorial);
  const tutorialDone = useGameStore((s) => s.tutorialDone);
  const hydrated = useGameStore((s) => s.hydrated);
  const profile = useAccountStore((s) => s.profile);
  const session = useOnlineStore((s) => s.session);
  const onlineRoom = useOnlineStore((s) => s.room);
  const onlineStatus = useOnlineStore((s) => s.status);

  const [settingsOpen, setSettingsOpen] = useState(false);
  /** This screen stays mounted under the others; its popups must only show while it's in front. */
  const [focused, setFocused] = useState(true);
  /** 'auto': show the popup by itself if there's something to offer (first visit this launch). */
  const [resumeChoice, setResumeChoice] = useState<'auto' | 'open' | 'closed'>(() => (resumeOffered ? 'closed' : 'auto'));
  const [rejoinChoice, setRejoinChoice] = useState<'auto' | 'open' | 'closed'>(() => (rejoinOffered ? 'closed' : 'auto'));
  const [dailyChoice, setDailyChoice] = useState<'auto' | 'open' | 'closed'>(() => (dailyOffered ? 'closed' : 'auto'));
  /** Coins just collected from the daily bonus (shown in the popup), or null before collecting. */
  const [collected, setCollected] = useState<number | null>(null);
  const [collecting, setCollecting] = useState(false);

  // Coming back here ends a guided game and restores the player's own game.
  // An online game is only set aside: the seat stays connected and can be rejoined.
  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      const { tutorial, endTutorial, mode, exitOnline } = useGameStore.getState();
      if (tutorial) endTutorial(false);
      if (mode === 'online') exitOnline();
      return () => setFocused(false);
    }, []),
  );

  const savedGame = useGameStore((s) =>
    s.hydrated && s.mode === 'local' && !s.tutorial && s.game && s.game.phase !== 'finished' ? s.game : null,
  );
  const saved = savedGame ? withDisplayNames(t, savedGame) : null;

  // Offer the online seat first (friends are waiting), then the saved game; each once per launch.
  // Friends waiting come first, then the daily bonus, then the saved game.
  const rejoinOpen = focused && !!session && (rejoinChoice === 'open' || rejoinChoice === 'auto');
  const dailyOpen =
    focused && !rejoinOpen && (dailyChoice === 'open' || (dailyChoice === 'auto' && !!profile?.daily.available));
  const resumeOpen =
    focused && !!saved && !rejoinOpen && !dailyOpen && (resumeChoice === 'open' || (resumeChoice === 'auto' && !session));
  const setDailyOpen = (open: boolean) => {
    if (!open) {
      dailyOffered = true;
      setCollected(null);
    }
    setDailyChoice(open ? 'open' : 'closed');
  };
  const collectDaily = async () => {
    // Keep the popup up to show what was collected (the bonus stops being "available").
    setDailyChoice('open');
    setCollecting(true);
    const coins = await useAccountStore.getState().claimDaily();
    setCollecting(false);
    if (coins === null) setDailyOpen(false);
    else setCollected(coins);
  };
  const setRejoinOpen = (open: boolean) => {
    if (!open) rejoinOffered = true;
    setRejoinChoice(open ? 'open' : 'closed');
  };
  const setResumeOpen = (open: boolean) => {
    if (!open) resumeOffered = true;
    setResumeChoice(open ? 'open' : 'closed');
  };

  const continueSaved = () => {
    setResumeOpen(false);
    router.push('/game');
  };
  const rejoinOnline = () => {
    setRejoinOpen(false);
    const online = useOnlineStore.getState();
    // Still connected: go straight back; otherwise reconnect first (the lobby waits).
    if (online.status !== 'open' || !online.room) online.rejoin();
    router.push('/lobby');
  };
  const leaveOnline = () => {
    setRejoinOpen(false);
    useOnlineStore.getState().leave();
  };
  const playTutorial = () => {
    startTutorial();
    router.push('/game');
  };

  // Everything fits on one screen: the tiles take what they need, the board art the rest.
  const available = height - insets.top - insets.bottom;
  const tileHeight = Math.round(Math.max(104, Math.min(150, available * 0.165)));
  const iconSize = Math.round(tileHeight * 0.42);
  const reserved = 56 /* top bar */ + 64 /* title */ + tileHeight * 2 + space.md + space.lg * 2 + 18; /* shells overhang */
  const heroSize = Math.round(Math.max(110, Math.min(width * 0.8, 400, available - reserved)));
  const otherTitle = language === 'te' ? STRINGS.en.appTitle : STRINGS.te.appTitle;

  return (
    <View style={styles.screen}>
      <Backdrop />
      <SafeAreaView style={styles.safe}>
        <View style={styles.container}>
          {/* Top bar */}
          <View style={styles.topBar}>
            <Pressable
              onPress={() => router.push('/profile')}
              hitSlop={6}
              accessibilityRole="button"
              accessibilityLabel={t.profileA11y(profile?.name ?? '')}
              style={({ pressed }) => pressed && styles.pressed}
            >
              {profile ? (
                <Avatar name={profile.name} seed={profile.id} size={44} />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <Text style={styles.iconGlyph}>👤</Text>
                </View>
              )}
            </Pressable>
            {profile && (
              <Pressable
                onPress={() => (profile.daily.available ? setDailyOpen(true) : router.push('/shop'))}
                style={({ pressed }) => [styles.coinChip, pressed && styles.pressed]}
                accessibilityRole="button"
                accessibilityLabel={t.coinsA11y(profile.coins)}
              >
                <CoinIcon size={22} />
                <Text style={styles.coinText} numberOfLines={1}>
                  {profile.coins.toLocaleString('en-IN')}
                </Text>
                {profile.daily.available && <View style={styles.coinDot} />}
              </Pressable>
            )}
            <View style={styles.pills}>
              {session && !rejoinOpen ? (
                <Pressable style={({ pressed }) => [styles.pill, pressed && styles.pressed]} onPress={() => setRejoinOpen(true)} accessibilityRole="button">
                  <Text style={styles.pillText}>▶ {t.rejoin}</Text>
                </Pressable>
              ) : saved && !resumeOpen ? (
                <Pressable style={({ pressed }) => [styles.pill, pressed && styles.pressed]} onPress={() => setResumeOpen(true)} accessibilityRole="button">
                  <Text style={styles.pillText}>▶ {t.continuePill}</Text>
                </Pressable>
              ) : null}
            </View>
            <IconButton label={language === 'te' ? 'English' : 'తెలుగు'} onPress={() => setLanguage(language === 'te' ? 'en' : 'te')}>
              <Text style={styles.langGlyph}>{language === 'te' ? 'EN' : 'తె'}</Text>
            </IconButton>
            <IconButton label={t.settings} onPress={() => setSettingsOpen(true)}>
              <Text style={styles.gearGlyph}>⚙</Text>
            </IconButton>
          </View>

          {/* Title and board art */}
          <View style={styles.hero}>
            <Text style={styles.title} numberOfLines={1} adjustsFontSizeToFit>
              {t.appTitle}
            </Text>
            <Text style={styles.subtitle}>{otherTitle}</Text>
            <View style={[styles.boardArt, { width: heroSize, height: heroSize }]}>
              <BoardDrawing players={HERO_PLAYERS} currentSeat={null} destinations={[]} strong={false} size={heroSize} />
              <HeroMarbles size={heroSize} />
            </View>
            <View style={{ marginTop: -Math.round(heroSize * 0.05) }}>
              <FloatingShells size={Math.round(Math.max(20, heroSize * 0.085))} />
            </View>
          </View>

          {/* Modes */}
          <View style={styles.tiles}>
            <View style={styles.tileRow}>
              <ModeTile
                id="online"
                title={t.modeOnline}
                subtitle={t.modeOnlineSub}
                icon={<OnlineIcon size={iconSize} />}
                colours={{ top: '#4F8DFF', bottom: '#1F4FC2', base: '#14327E' }}
                onPress={() => router.push(session ? '/lobby' : '/online')}
                height={tileHeight}
              />
              <ModeTile
                id="computer"
                title={t.modeComputer}
                subtitle={t.modeComputerSub}
                icon={<ComputerIcon size={iconSize} />}
                colours={{ top: '#F2625E', bottom: '#B3262B', base: '#74161A' }}
                onPress={() => router.push('/setup?kind=computer')}
                height={tileHeight}
              />
            </View>
            <View style={styles.tileRow}>
              <ModeTile
                id="friends"
                title={t.modePassPlay}
                subtitle={t.modePassPlaySub}
                icon={<PassPlayIcon size={iconSize} />}
                colours={{ top: '#3DBE7E', bottom: '#1A7A4C', base: '#0F4D2F' }}
                onPress={() => router.push('/setup?kind=friends')}
                height={tileHeight}
              />
              <ModeTile
                id="learn"
                title={t.modeLearn}
                subtitle={t.modeLearnSub}
                icon={<LearnIcon size={iconSize} />}
                colours={{ top: '#F7C948', bottom: '#C98A12', base: '#80560A' }}
                badge={hydrated && !tutorialDone ? t.newBadge : undefined}
                onPress={playTutorial}
                height={tileHeight}
              />
            </View>
          </View>
        </View>
      </SafeAreaView>

      {/* Settings */}
      <Popup visible={focused && settingsOpen} onClose={() => setSettingsOpen(false)} closeLabel={t.close} title={t.settings}>
        <ScrollView style={{ maxHeight: height * 0.58 }} bounces={false}>
          <SettingsPanel />
        </ScrollView>
        <Pressable
          style={styles.secondary}
          onPress={() => {
            setSettingsOpen(false);
            router.push('/rules');
          }}
          accessibilityRole="link"
        >
          <Text style={styles.secondaryText}>{t.howToPlay}</Text>
        </Pressable>
        <Pressable style={styles.secondary} onPress={() => void Linking.openURL(PRIVACY_URL)} accessibilityRole="link">
          <Text style={[styles.secondaryText, styles.smallLink]}>{t.privacyPolicy}</Text>
        </Pressable>
        <Pressable style={({ pressed }) => [styles.primary, pressed && styles.pressed]} onPress={() => setSettingsOpen(false)} accessibilityRole="button">
          <Text style={styles.primaryText}>{t.done}</Text>
        </Pressable>
      </Popup>

      {/* Daily bonus */}
      <Popup visible={dailyOpen && !!profile} onClose={() => setDailyOpen(false)} closeLabel={t.close} title={t.dailyTitle}>
        {profile && (
          <View style={styles.daily}>
            <CoinIcon size={72} />
            {collected === null ? (
              <>
                <Text style={styles.dailyAmount}>+{profile.daily.amount}</Text>
                <Text style={styles.hint}>{t.dailyStreak(profile.daily.streak + 1)}</Text>
                <Pressable
                  style={({ pressed }) => [styles.primary, styles.stretch, (pressed || collecting) && styles.pressed]}
                  onPress={() => void collectDaily()}
                  disabled={collecting}
                  accessibilityRole="button"
                >
                  {collecting ? <ActivityIndicator color="#2A2208" /> : <Text style={styles.primaryText}>{t.dailyCollect}</Text>}
                </Pressable>
              </>
            ) : (
              <>
                <Text style={styles.dailyAmount}>{t.rewardEarned(collected)}</Text>
                <Text style={styles.hint}>{t.dailyNext(profile.daily.amount)}</Text>
                <Pressable
                  style={({ pressed }) => [styles.primary, styles.stretch, pressed && styles.pressed]}
                  onPress={() => setDailyOpen(false)}
                  accessibilityRole="button"
                >
                  <Text style={styles.primaryText}>{t.done}</Text>
                </Pressable>
              </>
            )}
          </View>
        )}
      </Popup>

      {/* Continue the saved game */}
      <Popup visible={resumeOpen} onClose={() => setResumeOpen(false)} closeLabel={t.close} title={t.continueTitle}>
        {saved && (
          <>
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
            <Pressable style={({ pressed }) => [styles.primary, pressed && styles.pressed]} onPress={continueSaved} accessibilityRole="button">
              <Text style={styles.primaryText}>{t.continueGame}</Text>
            </Pressable>
          </>
        )}
      </Popup>

      {/* Back to the online game */}
      <Popup visible={rejoinOpen} onClose={() => setRejoinOpen(false)} closeLabel={t.close} title={t.rejoinTitle}>
        {session && (
          <>
            <Text style={styles.hint}>{t.rejoinHint(session.code)}</Text>
            <Pressable style={({ pressed }) => [styles.primary, pressed && styles.pressed]} onPress={rejoinOnline} accessibilityRole="button">
              <Text style={styles.primaryText}>{onlineStatus === 'open' && onlineRoom ? t.continueGame : t.rejoin}</Text>
            </Pressable>
            <Pressable style={styles.secondary} onPress={leaveOnline} accessibilityRole="button">
              <Text style={styles.secondaryText}>{onlineRoom?.status === 'lobby' ? t.leaveRoom : t.leaveGame}</Text>
            </Pressable>
          </>
        )}
      </Popup>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  safe: { flex: 1 },
  container: { flex: 1, width: '100%', maxWidth: 560, alignSelf: 'center', paddingHorizontal: space.lg, paddingBottom: space.lg },
  topBar: { height: 56, flexDirection: 'row', alignItems: 'center', gap: space.sm },
  pills: { flex: 1, alignItems: 'center' },
  pill: {
    backgroundColor: colors.accent,
    borderRadius: radius.pill,
    paddingHorizontal: space.lg,
    paddingVertical: 8,
    borderBottomWidth: 3,
    borderBottomColor: '#B8913A',
  },
  pillText: { color: '#2A2208', fontSize: 14, fontWeight: '900' },
  langGlyph: { color: colors.chalk, fontSize: 15, fontWeight: '800' },
  coinChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 36,
    paddingLeft: 6,
    paddingRight: 12,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderWidth: 1.5,
    borderColor: 'rgba(246, 215, 123, 0.55)',
  },
  coinText: { color: '#F6D77B', fontSize: 15, fontWeight: '900', fontVariant: ['tabular-nums'] },
  coinDot: {
    position: 'absolute',
    top: -3,
    right: -3,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#E5484D',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  daily: { alignItems: 'center', gap: space.sm },
  dailyAmount: {
    color: '#F6D77B',
    fontSize: 40,
    fontWeight: '900',
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  stretch: { alignSelf: 'stretch' },
  avatarPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1.5,
    borderColor: 'rgba(246, 215, 123, 0.55)',
  },
  iconGlyph: { color: colors.chalk, fontSize: 21, fontWeight: '900' },
  gearGlyph: { color: colors.chalk, fontSize: 22, marginTop: -2 },
  hero: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  title: {
    color: '#F6D77B',
    fontSize: 40,
    fontWeight: '900',
    letterSpacing: 0.5,
    textShadowColor: 'rgba(0,0,0,0.55)',
    textShadowOffset: { width: 0, height: 3 },
    textShadowRadius: 6,
  },
  subtitle: { color: colors.chalkDim, fontSize: 15, fontWeight: '700', letterSpacing: 1, marginBottom: space.sm },
  boardArt: { position: 'relative' },
  shells: { flexDirection: 'row', alignItems: 'flex-end', gap: 2 },
  tiles: { gap: space.md },
  tileRow: { flexDirection: 'row', gap: space.md },
  resumePlayers: { gap: space.sm },
  resumePlayer: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  resumeName: { color: colors.text, fontSize: 15, fontWeight: '600', flex: 1 },
  resumeTurn: { fontWeight: '800', color: colors.accent },
  hint: { color: colors.textMuted, fontSize: 13.5, lineHeight: 20 },
  primary: {
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: space.xs,
    borderBottomWidth: 4,
    borderBottomColor: '#B8913A',
  },
  primaryText: { color: '#2A2208', fontSize: 17, fontWeight: '900' },
  pressed: { opacity: 0.8 },
  secondary: { paddingVertical: 8, alignItems: 'center' },
  secondaryText: { color: colors.chalk, fontSize: 15, fontWeight: '600', textDecorationLine: 'underline' },
  smallLink: { fontSize: 13, color: colors.textMuted },
});
