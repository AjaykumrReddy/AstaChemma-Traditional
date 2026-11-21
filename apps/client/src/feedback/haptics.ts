import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

export type HapticKind = 'tap' | 'land' | 'big' | 'capture' | 'success';

/** Fire-and-forget vibration feedback. Silent on the web and where unsupported. */
export function haptic(kind: HapticKind): void {
  if (Platform.OS === 'web') return;
  const run = (): Promise<void> => {
    switch (kind) {
      case 'tap':
        return Haptics.selectionAsync();
      case 'land':
        return Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      case 'big':
        return Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      case 'capture':
        return Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      case 'success':
        return Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  };
  run().catch(() => {});
}
