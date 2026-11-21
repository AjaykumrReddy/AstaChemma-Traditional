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
        <Stack.Screen name="game" options={{ title: t.appTitle }} />
        <Stack.Screen name="rules" options={{ title: t.rulesTitle }} />
        <Stack.Screen name="online" options={{ title: t.playOnline }} />
        <Stack.Screen name="lobby" options={{ title: t.playOnline }} />
      </Stack>
    </>
  );
}
