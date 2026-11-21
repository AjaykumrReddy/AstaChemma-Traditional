import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useStrings } from '../i18n';
import { colors } from '../theme';

export default function RootLayout() {
  const t = useStrings();
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
        <Stack.Screen name="rules" options={{ title: t.rulesTitle }} />
        {/* Menu screens draw their own background and top bar. */}
        <Stack.Screen name="setup" options={{ headerShown: false }} />
        <Stack.Screen name="online" options={{ headerShown: false }} />
        <Stack.Screen name="lobby" options={{ headerShown: false }} />
      </Stack>
    </>
  );
}
