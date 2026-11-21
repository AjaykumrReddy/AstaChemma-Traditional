import { COINS, MAX_NAME_LENGTH, dailyBonus } from '@asta/protocol';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { DEFAULT_GUEST_NAME, useAccountStore } from '../account/store';
import { Avatar } from '../components/Avatar';
import { Backdrop } from '../components/Backdrop';
import { CoinIcon } from '../components/CoinIcon';
import { TopBar } from '../components/Chrome';
import { useStrings } from '../i18n';
import { colors, radius, space } from '../theme';

/** The player's profile: name, and how they've done online. */
export default function ProfileScreen() {
  const router = useRouter();
  const t = useStrings();
  const profile = useAccountStore((s) => s.profile);
  const status = useAccountStore((s) => s.status);
  const rename = useAccountStore((s) => s.rename);

  /** What's typed; null shows the saved name. */
  const [draft, setDraft] = useState<string | null>(null);
  const [saving, setSaving] = useState<'idle' | 'saving' | 'saved' | 'failed'>('idle');

  // Fresh stats each time the screen opens (e.g. after an online game).
  useFocusEffect(
    useCallback(() => {
      void useAccountStore.getState().ensure();
    }, []),
  );

  if (!profile) {
    return (
      <View style={[styles.screen, styles.centered]}>
        <Backdrop />
        {status === 'offline' ? <Text style={styles.hint}>{t.accountOffline}</Text> : <ActivityIndicator color={colors.chalk} />}
      </View>
    );
  }

  const shownName = profile.name === DEFAULT_GUEST_NAME ? '' : profile.name;
  const value = draft ?? shownName;
  const trimmed = value.trim();
  const canSave = trimmed.length > 0 && trimmed !== profile.name && saving !== 'saving';
  const save = async () => {
    setSaving('saving');
    const ok = await rename(trimmed);
    setSaving(ok ? 'saved' : 'failed');
    if (ok) setDraft(null);
  };
  const winRate = profile.gamesPlayed > 0 ? `${Math.round((profile.gamesWon / profile.gamesPlayed) * 100)}%` : '–';

  return (
    <View style={styles.screen}>
      <Backdrop />
      <SafeAreaView style={styles.safe}>
        <TopBar title={t.profileTitle} onBack={() => router.back()} backLabel={t.back} />
        <ScrollView contentContainerStyle={styles.scroll} bounces={false} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <Avatar name={trimmed || profile.name} seed={profile.id} size={88} />
            {profile.guest && <Text style={styles.badge}>{t.guestAccount}</Text>}
          </View>

          <View style={styles.card}>
            <Text style={styles.label}>{t.yourName}</Text>
            <View style={styles.nameRow}>
              <TextInput
                value={value}
                onChangeText={(v) => {
                  setDraft(v);
                  setSaving('idle');
                }}
                placeholder={t.yourName}
                placeholderTextColor={colors.textMuted}
                maxLength={MAX_NAME_LENGTH}
                style={styles.input}
                accessibilityLabel={t.yourName}
                returnKeyType="done"
                onSubmitEditing={() => canSave && void save()}
              />
              <Pressable
                style={({ pressed }) => [styles.saveButton, (!canSave || pressed) && styles.dim]}
                disabled={!canSave}
                onPress={() => void save()}
                accessibilityRole="button"
              >
                {saving === 'saving' ? <ActivityIndicator color="#2A2208" /> : <Text style={styles.saveText}>{t.save}</Text>}
              </Pressable>
            </View>
            {saving === 'saved' && <Text style={styles.ok}>✓ {t.saved}</Text>}
            {saving === 'failed' && <Text style={styles.error}>{t.saveFailed}</Text>}
          </View>

          <View style={[styles.card, styles.coinCard]} accessibilityLabel={t.coinsA11y(profile.coins)}>
            <CoinIcon size={44} />
            <View>
              <Text style={styles.coinValue}>{profile.coins.toLocaleString('en-IN')}</Text>
              <Text style={styles.label}>{t.coins}</Text>
            </View>
          </View>

          <View style={styles.stats}>
            <Stat label={t.statsOnlineGames} value={String(profile.gamesPlayed)} />
            <Stat label={t.statsWins} value={String(profile.gamesWon)} />
            <Stat label={t.statsWinRate} value={winRate} />
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>{t.howToEarn}</Text>
            {[
              t.earnDaily(dailyBonus(1), dailyBonus(COINS.dailyMaxSteps + 1)),
              t.earnWin(COINS.winBase, COINS.winPerHuman),
              t.earnPlayed(COINS.played),
            ].map((line) => (
              <View key={line} style={styles.earnRow}>
                <CoinIcon size={16} />
                <Text style={styles.earnText}>{line}</Text>
              </View>
            ))}
            <Text style={styles.note}>{t.coinsNote}</Text>
          </View>

          {status === 'offline' && <Text style={[styles.hint, styles.center]}>{t.accountOffline}</Text>}
          {profile.guest && <Text style={[styles.hint, styles.center]}>{t.guestHint}</Text>}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel} numberOfLines={2}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  centered: { alignItems: 'center', justifyContent: 'center', padding: space.xl },
  safe: { flex: 1 },
  scroll: { paddingHorizontal: space.lg, paddingBottom: space.xl, gap: space.lg, width: '100%', maxWidth: 520, alignSelf: 'center' },
  header: { alignItems: 'center', gap: space.sm, paddingTop: space.sm },
  badge: {
    color: colors.textMuted,
    fontSize: 12.5,
    fontWeight: '800',
    letterSpacing: 0.5,
    paddingHorizontal: space.md,
    paddingVertical: 3,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: 'rgba(246, 215, 123, 0.4)',
    overflow: 'hidden',
  },
  card: {
    backgroundColor: 'rgba(14, 38, 32, 0.78)',
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: 'rgba(246, 215, 123, 0.35)',
    padding: space.lg,
    gap: space.sm,
  },
  label: { color: colors.textMuted, fontSize: 13, fontWeight: '700' },
  cardTitle: { color: colors.text, fontSize: 16, fontWeight: '800', marginBottom: 2 },
  coinCard: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  coinValue: { color: '#F6D77B', fontSize: 30, fontWeight: '900', fontVariant: ['tabular-nums'] },
  earnRow: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm },
  earnText: { flex: 1, color: colors.text, fontSize: 14, lineHeight: 20 },
  note: { color: colors.textMuted, fontSize: 12.5, lineHeight: 18, marginTop: space.xs, fontStyle: 'italic' },
  nameRow: { flexDirection: 'row', gap: space.sm },
  input: {
    flex: 1,
    minWidth: 0,
    backgroundColor: 'rgba(0,0,0,0.25)',
    color: colors.text,
    borderRadius: radius.sm,
    paddingHorizontal: space.md,
    paddingVertical: 11,
    fontSize: 16,
  },
  saveButton: {
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingHorizontal: space.lg,
    justifyContent: 'center',
    borderBottomWidth: 3,
    borderBottomColor: '#B8913A',
    minWidth: 84,
    alignItems: 'center',
  },
  saveText: { color: '#2A2208', fontSize: 15, fontWeight: '900' },
  dim: { opacity: 0.5 },
  ok: { color: '#7EE2A8', fontSize: 13, fontWeight: '700' },
  error: { color: colors.danger, fontSize: 13 },
  stats: { flexDirection: 'row', gap: space.sm },
  stat: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
    backgroundColor: 'rgba(14, 38, 32, 0.78)',
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: 'rgba(246, 215, 123, 0.35)',
    paddingVertical: space.lg,
    paddingHorizontal: space.xs,
  },
  statValue: { color: '#F6D77B', fontSize: 28, fontWeight: '900' },
  statLabel: { color: colors.textMuted, fontSize: 12.5, fontWeight: '700', textAlign: 'center' },
  hint: { color: colors.textMuted, fontSize: 13, lineHeight: 19 },
  center: { textAlign: 'center' },
});
