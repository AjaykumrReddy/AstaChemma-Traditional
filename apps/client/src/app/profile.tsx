import { COINS, MAX_NAME_LENGTH, dailyBonus, isAcceptableName } from '@asta/protocol';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Constants from 'expo-constants';
import { sendTestReport } from '../crash';
import { PRIVACY_URL } from '../online/config';
import { SafeAreaView } from 'react-native-safe-area-context';
import { googleSignInAvailable } from '../account/google';
import { DEFAULT_GUEST_NAME, useAccountStore } from '../account/store';
import { GoogleButton } from '../components/GoogleButton';
import { TrophyIcon } from '../components/TrophyIcon';
import { Avatar } from '../components/Avatar';
import { Backdrop } from '../components/Backdrop';
import { CoinIcon } from '../components/CoinIcon';
import { Popup, TopBar } from '../components/Chrome';
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
  const [versionTaps, setVersionTaps] = useState(0);
  const [testSent, setTestSent] = useState<'sent' | 'off' | null>(null);
  const [saving, setSaving] = useState<'idle' | 'saving' | 'saved' | 'failed' | 'bad-name'>('idle');
  const [signing, setSigning] = useState(false);
  const [signInMessage, setSignInMessage] = useState<{ text: string; ok: boolean } | null>(null);

  const signIn = async () => {
    setSigning(true);
    setSignInMessage(null);
    const outcome = await useAccountStore.getState().signInWithGoogle();
    setSigning(false);
    if (outcome === 'cancelled') return;
    if (outcome === 'failed') setSignInMessage({ text: t.signInFailed, ok: false });
    else setSignInMessage({ text: outcome === 'existing' ? t.signInExisting : t.signInUpgraded, ok: true });
    setDraft(null);
  };
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const removeAccount = async () => {
    setDeleting(true);
    const ok = await useAccountStore.getState().deleteAccount();
    setDeleting(false);
    setConfirmDelete(false);
    setDraft(null);
    setSignInMessage({ text: ok ? t.deleted : t.deleteFailed, ok });
  };
  const signOut = async () => {
    setSigning(true);
    setSignInMessage(null);
    await useAccountStore.getState().signOut();
    setSigning(false);
    setDraft(null);
  };

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
    if (!isAcceptableName(trimmed)) {
      setSaving('bad-name');
      return;
    }
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
            {saving === 'bad-name' && <Text style={styles.error}>{t.onlineError['bad-name']}</Text>}
          </View>

          {/* Sign-in: keeps the account when changing phones. */}
          <View style={styles.card}>
            {profile.guest ? (
              <>
                <Text style={styles.earnText}>{t.guestHint}</Text>
                {googleSignInAvailable() ? (
                  <GoogleButton label={t.signInGoogle} busy={signing} onPress={() => void signIn()} />
                ) : (
                  <Text style={styles.hint}>{t.googleUnavailable}</Text>
                )}
              </>
            ) : (
              <>
                <Text style={styles.earnText}>{t.signedInAs(profile.email)}</Text>
                <Pressable onPress={() => void signOut()} disabled={signing} style={styles.signOut} accessibilityRole="button">
                  <Text style={styles.signOutText}>{t.signOut}</Text>
                </Pressable>
                <Text style={styles.hint}>{t.signOutHint}</Text>
              </>
            )}
            {signInMessage && <Text style={signInMessage.ok ? styles.ok : styles.error}>{signInMessage.text}</Text>}
          </View>

          <View style={[styles.card, styles.coinCard]} accessibilityLabel={t.coinsA11y(profile.coins)}>
            <CoinIcon size={44} />
            <View style={{ flex: 1 }}>
              <Text style={styles.coinValue}>{profile.coins.toLocaleString('en-IN')}</Text>
              <Text style={styles.label}>{t.coins}</Text>
            </View>
            <Pressable
              style={({ pressed }) => [styles.shopButton, pressed && styles.dim]}
              onPress={() => router.push('/shop')}
              accessibilityRole="button"
            >
              <Text style={styles.shopButtonText}>{t.shop} ›</Text>
            </Pressable>
          </View>

          <View style={styles.stats}>
            <Stat label={t.statsOnlineGames} value={String(profile.gamesPlayed)} />
            <Stat label={t.statsWins} value={String(profile.gamesWon)} />
            <Stat label={t.statsWinRate} value={winRate} />
          </View>
          <Pressable
            style={({ pressed }) => [styles.card, styles.lbLink, pressed && styles.dim]}
            onPress={() => router.push('/leaderboard')}
            accessibilityRole="button"
          >
            <TrophyIcon size={30} />
            <Text style={styles.lbLinkText}>{t.leaderboard}</Text>
            <Text style={styles.lbChevron}>›</Text>
          </Pressable>

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

          <View style={styles.footerLinks}>
            <Pressable onPress={() => void Linking.openURL(PRIVACY_URL)} style={styles.deleteLink} accessibilityRole="link">
              <Text style={styles.privacyText}>{t.privacyPolicy}</Text>
            </Pressable>
            <Pressable onPress={() => setConfirmDelete(true)} style={styles.deleteLink} accessibilityRole="button">
              <Text style={styles.deleteLinkText}>{t.deleteAccount}</Text>
            </Pressable>
          </View>
          <Pressable
            onPress={() => {
              const n = versionTaps + 1;
              setVersionTaps(n);
              if (n === 7) setTestSent(sendTestReport() ? 'sent' : 'off');
            }}
            accessibilityRole="text"
          >
            <Text style={styles.version}>
              {t.version(Constants.expoConfig?.version ?? '')}
              {testSent === 'sent' ? ' · ✓ test report sent' : testSent === 'off' ? ' · reports off' : ''}
            </Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>

      <Popup visible={confirmDelete} onClose={() => !deleting && setConfirmDelete(false)} closeLabel={t.close} title={t.deleteTitle}>
        <Text style={styles.earnText}>{t.deleteBody}</Text>
        <Pressable
          style={({ pressed }) => [styles.deleteButton, (pressed || deleting) && styles.dim]}
          onPress={() => void removeAccount()}
          disabled={deleting}
          accessibilityRole="button"
        >
          {deleting ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.deleteButtonText}>{t.deleteConfirm}</Text>}
        </Pressable>
        <Pressable style={styles.cancel} onPress={() => setConfirmDelete(false)} disabled={deleting} accessibilityRole="button">
          <Text style={styles.cancelText}>{t.cancel}</Text>
        </Pressable>
      </Popup>
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
  shopButton: {
    backgroundColor: colors.accent,
    borderRadius: radius.pill,
    paddingHorizontal: space.lg,
    paddingVertical: 9,
    borderBottomWidth: 3,
    borderBottomColor: '#B8913A',
  },
  shopButtonText: { color: '#2A2208', fontSize: 15, fontWeight: '900' },
  lbLink: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md },
  lbLinkText: { flex: 1, color: colors.text, fontSize: 16, fontWeight: '800' },
  lbChevron: { color: '#F6D77B', fontSize: 26, fontWeight: '700', marginTop: -2 },
  footerLinks: { flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap' },
  version: { color: colors.textMuted, fontSize: 12, textAlign: 'center', opacity: 0.7, paddingVertical: space.sm },
  privacyText: { color: colors.textMuted, fontSize: 14, fontWeight: '600', textDecorationLine: 'underline' },
  deleteLink: { alignSelf: 'center', paddingVertical: space.sm, paddingHorizontal: space.lg },
  deleteLinkText: { color: colors.danger, fontSize: 14, fontWeight: '700', textDecorationLine: 'underline' },
  deleteButton: {
    backgroundColor: '#B42318',
    borderRadius: radius.md,
    paddingVertical: 14,
    alignItems: 'center',
    borderBottomWidth: 4,
    borderBottomColor: '#7A1A12',
  },
  deleteButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '900' },
  cancel: { alignSelf: 'center', paddingVertical: space.sm, paddingHorizontal: space.lg },
  cancelText: { color: colors.chalk, fontSize: 15, fontWeight: '600', textDecorationLine: 'underline' },
  signOut: { alignSelf: 'flex-start', paddingVertical: 4 },
  signOutText: { color: colors.danger, fontSize: 15, fontWeight: '700', textDecorationLine: 'underline' },
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
