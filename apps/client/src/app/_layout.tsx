import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { colors } from '../theme';

export default function RootLayout() {
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
        <Stack.Screen name="index" options={{ title: 'Asta Chemma', headerShown: false }} />
        <Stack.Screen name="game" options={{ title: 'Asta Chemma' }} />
        <Stack.Screen name="rules" options={{ title: 'How to play' }} />
      </Stack>
    </>
  );
}
