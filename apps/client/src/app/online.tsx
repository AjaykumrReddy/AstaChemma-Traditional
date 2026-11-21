import type { GameMode } from '@asta/engine';
import { CODE_LENGTH, MAX_NAME_LENGTH } from '@asta/protocol';
import { Stack, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Segmented } from '../components/Segmented';
import { useStrings } from '../i18n';
import { useOnlineStore } from '../online/store';
import { colors, radius, space } from '../theme';

export default function OnlineScreen() {
  const router = useRouter();
  const t = useStrings();
  const name = useOnlineStore((s) => s.name);
  const setName = useOnlineStore((s) => s.setName);
  const create = useOnlineStore((s) => s.create);
  const join = useOnlineStore((s) => s.join);
  const status = useOnlineStore((s) => s.status);
  const error = useOnlineStore((s) => s.error);
  const clearError = useOnlineStore((s) => s.clearError);
  const session = useOnlineStore((s) => s.session);
  const room = useOnlineStore((s) => s.room);

  const [mode, setMode] = useState<GameMode>('individual');
  const [players, setPlayers] = useState<2 | 3 | 4>(2);
  const [code, setCode] = useState('');
  const [nameMissing, setNameMissing] = useState(false);

  useEffect(() => clearError(), [clearError]);

  // In a room: go to the lobby (it moves on to the game once it starts).
  useEffect(() => {
    if (session && room) router.replace('/lobby');
  }, [session, room, router]);

  const busy = status === 'connecting';
  const withName = (action: () => void) => {
    if (!name.trim()) {
      setNameMissing(true);
      return;
    }
    setNameMissing(false);
    action();
  };

  return (
    <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
      <Stack.Screen options={{ title: t.playOnline }} />
      <View style={styles.container}>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t.yourName}</Text>
          <TextInput
            value={name}
            onChangeText={(v) => {
              setName(v);
              setNameMissing(false);
            }}
            placeholder={t.yourName}
            placeholderTextColor={colors.textMuted}
            maxLength={MAX_NAME_LENGTH}
            style={[styles.input, nameMissing && styles.inputError]}
            accessibilityLabel={t.yourName}
          />
          {nameMissing && <Text style={styles.errorText}>{t.nameNeeded}</Text>}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t.createRoom}</Text>
          <Text style={styles.hint}>{t.createRoomHint}</Text>
          <Segmented
            options={[
              { value: 'individual', label: t.individual },
              { value: 'team', label: t.teams2v2 },
            ]}
            value={mode}
            onChange={setMode}
          />
          {mode === 'individual' && (
            <Segmented
              options={([2, 3, 4] as const).map((n) => ({ value: n, label: t.playersCount(n) }))}
              value={players}
              onChange={setPlayers}
            />
          )}
          <Pressable
            style={({ pressed }) => [styles.primary, (pressed || busy) && styles.pressed]}
            disabled={busy}
            onPress={() => withName(() => create(mode, mode === 'team' ? 4 : players))}
            accessibilityRole="button"
          >
            <Text style={styles.primaryText}>{t.create}</Text>
          </Pressable>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t.joinRoom}</Text>
          <Text style={styles.hint}>{t.joinRoomHint}</Text>
          <View style={styles.joinRow}>
            <TextInput
              value={code}
              onChangeText={(v) => setCode(v.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, CODE_LENGTH))}
              placeholder="ABCD"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={CODE_LENGTH}
              style={[styles.input, styles.codeInput]}
              accessibilityLabel={t.roomCode}
            />
            <Pressable
              style={({ pressed }) => [styles.joinButton, (pressed || busy || code.length !== CODE_LENGTH) && styles.pressed]}
              disabled={busy || code.length !== CODE_LENGTH}
              onPress={() => withName(() => join(code))}
              accessibilityRole="button"
            >
              <Text style={styles.primaryText}>{t.join}</Text>
            </Pressable>
          </View>
        </View>

        {busy && (
          <View style={styles.statusRow}>
            <ActivityIndicator color={colors.chalk} />
            <Text style={styles.hint}>{t.connecting}</Text>
          </View>
        )}
        {error && <Text style={[styles.errorText, styles.center]}>{t.onlineError[error]}</Text>}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: space.lg, paddingBottom: space.xxl },
  container: { width: '100%', maxWidth: 520, alignSelf: 'center', gap: space.lg },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: space.lg, gap: space.md },
  cardTitle: { color: colors.text, fontSize: 17, fontWeight: '700' },
  hint: { color: colors.textMuted, fontSize: 13, lineHeight: 19 },
  input: {
    backgroundColor: colors.background,
    color: colors.text,
    borderRadius: radius.sm,
    paddingHorizontal: space.md,
    paddingVertical: 12,
    fontSize: 16,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  inputError: { borderColor: colors.danger },
  joinRow: { flexDirection: 'row', gap: space.sm },
  codeInput: { flex: 1, fontSize: 22, fontWeight: '800', letterSpacing: 6, textAlign: 'center' },
  joinButton: { backgroundColor: colors.accent, borderRadius: radius.md, paddingHorizontal: space.xl, justifyContent: 'center' },
  primary: { backgroundColor: colors.accent, borderRadius: radius.md, paddingVertical: 14, alignItems: 'center' },
  primaryText: { color: '#2A2208', fontSize: 16, fontWeight: '800' },
  pressed: { opacity: 0.6 },
  statusRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.sm },
  errorText: { color: colors.danger, fontSize: 14, lineHeight: 20 },
  center: { textAlign: 'center' },
});
