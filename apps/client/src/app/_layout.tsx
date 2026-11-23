import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { AppState } from 'react-native';
import { useAccountStore } from '../account/store';
import { useStrings } from '../i18n';
import { useOnlineStore } from '../online/store';
import { colors } from '../theme';

/** Every install has an account (a guest one to start with); keep its profile fresh. */
function useAccount() {
  useEffect(() => {
    const ensure = () => void useAccountStore.getState().ensure(useOnlineStore.getState().name);
    ensure();
    const sub = AppState.addEventListener('change', (state) => state === 'active' && ensure());
    return () => sub.remove();
  }, []);
}

export default function RootLayout() {
  const t = useStrings();
  useAccount();
  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.text,
          headerTitleStyle: { fontWeight: '700' },
          headerShadowVisible: false,
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <Stack.Screen name="index" options={{ title: t.appTitle, headerShown: false }} />
        <Stack.Screen name="game" options={{ headerShown: false }} />
        <Stack.Screen name="rules" options={{ headerShown: false }} />
        {/* Menu screens draw their own background and top bar. */}
        <Stack.Screen name="setup" options={{ headerShown: false }} />
        <Stack.Screen name="online" options={{ headerShown: false }} />
        <Stack.Screen name="lobby" options={{ headerShown: false }} />
        <Stack.Screen name="match" options={{ headerShown: false }} />
        <Stack.Screen name="profile" options={{ headerShown: false }} />
        <Stack.Screen name="shop" options={{ headerShown: false }} />
        <Stack.Screen name="leaderboard" options={{ headerShown: false }} />
      </Stack>
    </>
  );
}
