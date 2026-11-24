import { isAcceptableName, isValidCode, normaliseCode } from '@asta/protocol';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { DEFAULT_GUEST_NAME, useAccountStore } from '../../account/store';
import { Backdrop } from '../../components/Backdrop';
import { useStrings } from '../../i18n';
import { useOnlineStore } from '../../online/store';
import { colors, radius, space } from '../../theme';

/**
 * An invite link (astachemma://join/ABCD, opened from https://…/join/ABCD):
 * join that room straight away if we know the player's name, otherwise show
 * Play Online with the code filled in.
 */
export default function JoinScreen() {
  const router = useRouter();
  const t = useStrings();
  const params = useLocalSearchParams<{ code?: string }>();
  const code = normaliseCode(String(params.code ?? ''));
  const session = useOnlineStore((s) => s.session);
  const room = useOnlineStore((s) => s.room);
  const error = useOnlineStore((s) => s.error);
  const [started, setStarted] = useState(false);

  // Once the saved name has loaded: join, or ask for a name first.
  useEffect(() => {
    if (started) return;
    const go = () => {
      setStarted(true);
      if (!isValidCode(code)) {
        router.replace('/online');
        return;
      }
      const store = useOnlineStore.getState();
      const profileName = useAccountStore.getState().profile?.name;
      const name = store.name.trim() || (profileName && profileName !== DEFAULT_GUEST_NAME ? profileName : '');
      if (!name || !isAcceptableName(name)) {
        router.replace({ pathname: '/online', params: { code } });
        return;
      }
      store.setName(name);
      store.join(code);
    };
    if (useOnlineStore.persist.hasHydrated()) go();
    else return useOnlineStore.persist.onFinishHydration(go);
  }, [code, router, started]);

  // In the room: on to the lobby (it moves on to the game if it has started).
  useEffect(() => {
    if (started && session?.code === code && room) router.replace('/lobby');
  }, [started, session, room, code, router]);

  return (
    <View style={styles.screen}>
      <Backdrop />
      {error ? (
        <View style={styles.box}>
          <Text style={styles.error}>{t.onlineError[error]}</Text>
          <Pressable style={({ pressed }) => [styles.button, pressed && styles.pressed]} onPress={() => router.replace('/online')} accessibilityRole="button">
            <Text style={styles.buttonText}>{t.modeOnline}</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.box}>
          <ActivityIndicator color={colors.chalk} size="large" />
          <Text style={styles.text}>{t.connecting}</Text>
          <Text style={styles.code}>{code}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' },
  box: { alignItems: 'center', gap: space.md, paddingHorizontal: space.xl },
  text: { color: colors.textMuted, fontSize: 15 },
  code: { color: colors.chalk, fontSize: 40, fontWeight: '900', letterSpacing: 10 },
  error: { color: colors.danger, fontSize: 16, textAlign: 'center' },
  button: { backgroundColor: colors.accent, borderRadius: radius.md, paddingVertical: 12, paddingHorizontal: space.xl },
  buttonText: { color: '#2A2208', fontSize: 16, fontWeight: '800' },
  pressed: { opacity: 0.6 },
});
