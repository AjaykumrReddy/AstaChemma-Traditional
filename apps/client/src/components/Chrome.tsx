import type { ReactNode } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, space } from '../theme';

/**
 * Shared pieces of the menu screens: round glass icon buttons, a top bar with
 * a back button, and a popup card with a close button in its corner.
 */

export function IconButton({
  label,
  onPress,
  children,
  size = 44,
}: {
  label: string;
  onPress: () => void;
  children: ReactNode;
  size?: number;
}) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.iconButton, { width: size, height: size, borderRadius: size / 2 }, pressed && styles.pressed]}
    >
      {children}
    </Pressable>
  );
}

/** A screen's top bar: back button, title, and anything on the right. */
export function TopBar({ title, onBack, right, backLabel }: { title: string; onBack: () => void; right?: ReactNode; backLabel: string }) {
  return (
    <View style={styles.topBar}>
      <IconButton label={backLabel} onPress={onBack} size={40}>
        <Text style={styles.backGlyph}>‹</Text>
      </IconButton>
      <Text style={styles.topTitle} numberOfLines={1}>
        {title}
      </Text>
      <View style={styles.topRight}>{right}</View>
    </View>
  );
}

/** A centred popup card, closed with the ✕ in its corner or by tapping outside. */
export function Popup({
  visible,
  onClose,
  closeLabel,
  title,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  closeLabel: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose} accessibilityLabel={closeLabel}>
        {/* Taps inside the card must not close it. */}
        <Pressable style={styles.card} onPress={() => {}}>
          <Text style={styles.cardTitle}>{title}</Text>
          {children}
          <Pressable onPress={onClose} hitSlop={10} style={styles.close} accessibilityRole="button" accessibilityLabel={closeLabel}>
            <Text style={styles.closeGlyph}>✕</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  iconButton: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1.5,
    borderColor: 'rgba(246, 215, 123, 0.55)',
  },
  pressed: { opacity: 0.6 },
  topBar: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, paddingVertical: space.sm },
  backGlyph: { color: colors.chalk, fontSize: 30, lineHeight: 32, marginTop: -3, marginLeft: -2 },
  topTitle: { flex: 1, color: colors.text, fontSize: 20, fontWeight: '800' },
  topRight: { flexDirection: 'row', gap: space.sm },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(5, 15, 12, 0.72)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: space.xl,
  },
  card: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: colors.surface,
    borderRadius: radius.lg + 4,
    borderWidth: 2,
    borderColor: '#F6D77B',
    padding: space.xl,
    paddingTop: space.xl + 4,
    gap: space.md,
  },
  cardTitle: { color: colors.text, fontSize: 20, fontWeight: '800', paddingRight: space.xl },
  close: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  closeGlyph: { color: colors.chalk, fontSize: 17, fontWeight: '800' },
});
