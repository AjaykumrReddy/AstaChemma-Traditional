import type { BotLevel } from '@asta/engine';
import type { SeatView } from '@asta/protocol';
import { Redirect, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Backdrop } from '../components/Backdrop';
import { TopBar } from '../components/Chrome';
import { SeatMark } from '../components/SeatMark';
import { Segmented } from '../components/Segmented';
import { useStrings, type Strings } from '../i18n';
import { useOnlineStore } from '../online/store';
import { colors, radius, space } from '../theme';

function SeatRow({ seat, mine, isHost, t }: { seat: SeatView; mine: boolean; isHost: boolean; t: Strings }) {
  const setSeat = useOnlineStore((s) => s.setSeat);
  const levels: { value: BotLevel; label: string }[] = [
    { value: 'easy', label: t.level.easy },
    { value: 'medium', label: t.level.medium },
    { value: 'hard', label: t.level.hard },
  ];

  let title: string;
  if (seat.kind === 'open') title = t.openSeat;
  // A computer's name; its level is shown in the badge beside it.
  else if (seat.kind === 'bot') title = seat.name ?? t.computer(seat.seat);
  else title = seat.name ?? '';

  return (
    <View style={styles.seat}>
      <View style={styles.seatHeader}>
        <SeatMark seat={seat.seat} size={18} />
        <View style={{ flex: 1 }}>
          <Text style={[styles.seatName, seat.kind === 'open' && styles.seatOpen]} numberOfLines={1}>
            {title}
          </Text>
          <View style={styles.badges}>
            <Text style={styles.badgeText}>
              {t.colour[seat.seat]} · {t.seat[seat.seat]}
            </Text>
            {seat.host && <Text style={[styles.badge, styles.badgeHost]}>{t.hostBadge}</Text>}
            {mine && <Text style={[styles.badge, styles.badgeYou]}>{t.youBadge}</Text>}
            {seat.kind === 'bot' && <Text style={styles.badge}>{t.cpuTag(seat.level ?? 'medium')}</Text>}
            {seat.kind === 'human' && seat.connected === false && <Text style={[styles.badge, styles.badgeOff]}>{t.offline}</Text>}
          </View>
        </View>
      </View>

      {isHost && seat.kind === 'open' && (
        <Pressable style={styles.smallButton} onPress={() => setSeat(seat.seat, 'bot', 'medium')} accessibilityRole="button">
          <Text style={styles.smallButtonText}>+ {t.addComputer}</Text>
        </Pressable>
      )}
      {isHost && seat.kind === 'bot' && (
        <View style={styles.botControls}>
          <View style={{ flex: 1 }}>
            <Segmented compact options={levels} value={seat.level ?? 'medium'} onChange={(level) => setSeat(seat.seat, 'bot', level)} />
          </View>
          <Pressable style={styles.removeButton} onPress={() => setSeat(seat.seat, 'open')} accessibilityRole="button">
            <Text style={styles.removeText}>{t.removeComputer}</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

export default function LobbyScreen() {
  const router = useRouter();
  const t = useStrings();
  const room = useOnlineStore((s) => s.room);
  const session = useOnlineStore((s) => s.session);
  const status = useOnlineStore((s) => s.status);
  const error = useOnlineStore((s) => s.error);
  const start = useOnlineStore((s) => s.start);
  const leave = useOnlineStore((s) => s.leave);
  const openGame = useOnlineStore((s) => s.openGame);

  // Once the game starts (or when rejoining one in progress), go to the board.
  useEffect(() => {
    if (room && room.status !== 'lobby') {
      openGame();
      router.replace('/game');
    }
  }, [room, openGame, router]);

  if (!session) return <Redirect href="/online" />;
  if (!room) {
    return (
      <View style={styles.loading}>
        <Backdrop />
        <ActivityIndicator color={colors.chalk} />
        <Text style={styles.hint}>{status === 'reconnecting' ? t.reconnecting : t.connecting}</Text>
      </View>
    );
  }

  const me = room.seats.find((s) => s.seat === session.seat);
  const isHost = !!me?.host;
  const ready = room.seats.every((s) => s.kind !== 'open');

  return (
    <View style={styles.screen}>
      <Backdrop />
      <SafeAreaView style={styles.safe}>
    <TopBar title={t.modeOnline} onBack={() => router.back()} backLabel={t.back} />
    <ScrollView contentContainerStyle={styles.scroll} bounces={false}>
      <View style={styles.container}>
        {status === 'reconnecting' && <Text style={styles.banner}>{t.reconnecting}</Text>}

        <View style={[styles.card, styles.codeCard]}>
          <Text style={styles.codeLabel}>{t.roomCode}</Text>
          <Text style={styles.code} selectable accessibilityLabel={`${t.roomCode} ${room.code.split('').join(' ')}`}>
            {room.code}
          </Text>
          <Pressable
            style={({ pressed }) => [styles.shareButton, pressed && styles.pressed]}
            onPress={() => Share.share({ message: t.shareMessage(room.code) }).catch(() => {})}
            accessibilityRole="button"
          >
            <Text style={styles.primaryText}>{t.shareCode}</Text>
          </Pressable>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>
            {room.mode === 'team' ? t.teams2v2 : t.playersCount(room.seats.length)} · {t.boardName[room.board ?? '5x5']}
          </Text>
          {room.seats.map((seat) => (
            <SeatRow key={seat.seat} seat={seat} mine={seat.seat === session.seat} isHost={isHost} t={t} />
          ))}
        </View>

        {isHost ? (
          <>
            {!ready && <Text style={[styles.hint, styles.center]}>{t.startNeedsSeats}</Text>}
            <Pressable
              style={({ pressed }) => [styles.primary, (pressed || !ready) && styles.pressed]}
              disabled={!ready}
              onPress={start}
              accessibilityRole="button"
            >
              <Text style={styles.primaryText}>{t.start}</Text>
            </Pressable>
          </>
        ) : (
          <View style={styles.waiting}>
            <ActivityIndicator color={colors.chalk} size="small" />
            <Text style={styles.hint}>{t.waitingForHost}</Text>
          </View>
        )}
        {error && error !== 'not-ready' && <Text style={[styles.errorText, styles.center]}>{t.onlineError[error]}</Text>}

        <Pressable
          style={styles.secondary}
          onPress={() => {
            leave();
            router.replace('/');
          }}
          accessibilityRole="button"
        >
          <Text style={styles.secondaryText}>{t.leaveRoom}</Text>
        </Pressable>
      </View>
    </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  safe: { flex: 1 },
  scroll: { paddingHorizontal: space.lg, paddingBottom: space.lg },
  container: { width: '100%', maxWidth: 520, alignSelf: 'center', gap: space.md },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.md, backgroundColor: colors.background },
  banner: {
    color: colors.background,
    backgroundColor: colors.highlight,
    borderRadius: radius.sm,
    padding: space.sm,
    textAlign: 'center',
    fontWeight: '700',
  },
  card: {
    backgroundColor: 'rgba(14, 38, 32, 0.78)',
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: 'rgba(246, 215, 123, 0.35)',
    padding: space.lg,
    gap: space.md,
  },
  codeCard: { alignItems: 'center', borderWidth: 2, borderColor: colors.accent, paddingVertical: space.md },
  codeLabel: { color: colors.textMuted, fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 },
  code: { color: colors.chalk, fontSize: 52, fontWeight: '900', letterSpacing: 12, fontVariant: ['tabular-nums'] },
  shareButton: { backgroundColor: colors.accent, borderRadius: radius.md, paddingVertical: 12, paddingHorizontal: space.xxl },
  cardTitle: { color: colors.text, fontSize: 17, fontWeight: '700' },
  seat: { gap: space.sm, paddingVertical: space.xs },
  seatHeader: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  seatName: { color: colors.text, fontSize: 16, fontWeight: '700' },
  seatOpen: { color: colors.textMuted, fontStyle: 'italic', fontWeight: '500' },
  badges: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6, marginTop: 3 },
  badgeText: { color: colors.textMuted, fontSize: 12 },
  badge: {
    color: colors.text,
    fontSize: 11.5,
    fontWeight: '700',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceRaised,
    overflow: 'hidden',
  },
  badgeHost: { backgroundColor: '#5C4A12', color: colors.highlight },
  badgeYou: { backgroundColor: '#1F4D6B', color: '#CFE8FF' },
  badgeOff: { backgroundColor: '#5A2A2A', color: '#FFD0D0' },
  smallButton: {
    alignSelf: 'flex-start',
    borderWidth: 1.5,
    borderColor: colors.chalkDim,
    borderRadius: radius.pill,
    paddingHorizontal: space.md,
    paddingVertical: 6,
    marginLeft: 30,
  },
  smallButtonText: { color: colors.chalk, fontSize: 13.5, fontWeight: '700' },
  botControls: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginLeft: 30 },
  removeButton: { paddingHorizontal: space.sm, paddingVertical: 6 },
  removeText: { color: colors.danger, fontSize: 13.5, fontWeight: '700' },
  primary: { backgroundColor: colors.accent, borderRadius: radius.md, paddingVertical: 16, alignItems: 'center' },
  primaryText: { color: '#2A2208', fontSize: 16, fontWeight: '800' },
  pressed: { opacity: 0.6 },
  waiting: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.sm },
  hint: { color: colors.textMuted, fontSize: 13, lineHeight: 19 },
  center: { textAlign: 'center' },
  errorText: { color: colors.danger, fontSize: 14 },
  secondary: { paddingVertical: 12, alignItems: 'center' },
  secondaryText: { color: colors.chalk, fontSize: 15, fontWeight: '600', textDecorationLine: 'underline' },
});
