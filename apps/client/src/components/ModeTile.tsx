import { useEffect, useState, type ReactNode } from 'react';
import { Animated, Easing, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

const useNativeDriver = Platform.OS !== 'web';

export interface TileColours {
  top: string;
  bottom: string;
  /** Darker band along the bottom edge, for a raised, chunky look. */
  base: string;
}

/**
 * A big glossy start-screen button: coloured gradient, gold rim, a raised
 * bottom edge, and a squash when pressed.
 */
export function ModeTile({
  id,
  title,
  subtitle,
  icon,
  colours,
  badge,
  onPress,
  height,
}: {
  /** Unique per tile (names its gradient). */
  id: string;
  title: string;
  subtitle: string;
  icon: ReactNode;
  colours: TileColours;
  badge?: string;
  onPress: () => void;
  height: number;
}) {
  const [scale] = useState(() => new Animated.Value(1));
  const press = (to: number) => Animated.spring(scale, { toValue: to, useNativeDriver, speed: 40, bounciness: 8 }).start();
  const compact = height < 128;
  const [faceWidth, setFaceWidth] = useState(0);
  const [shine] = useState(() => new Animated.Value(0));

  // Every few seconds a band of light sweeps across the tile (each tile at its own moment).
  useEffect(() => {
    const offset = [...id].reduce((n, ch) => n + ch.charCodeAt(0), 0) % 4;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(900 + offset * 1100),
        Animated.timing(shine, { toValue: 1, duration: 950, easing: Easing.inOut(Easing.quad), useNativeDriver }),
        Animated.delay(4400 - offset * 1100),
        Animated.timing(shine, { toValue: 0, duration: 0, useNativeDriver }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [id, shine]);

  return (
    <Animated.View style={[styles.wrap, { height, transform: [{ scale }] }]}>
      <Pressable
        onPress={onPress}
        onPressIn={() => press(0.95)}
        onPressOut={() => press(1)}
        style={styles.press}
        accessibilityRole="button"
        accessibilityLabel={`${title}. ${subtitle}`}
      >
        {/* Raised base, then the face on top of it */}
        <View style={[styles.base, { backgroundColor: colours.base }]} />
        <View style={styles.face} onLayout={(e) => setFaceWidth(e.nativeEvent.layout.width)}>
          <Svg width="100%" height="100%" style={StyleSheet.absoluteFill} preserveAspectRatio="none" viewBox="0 0 100 100">
            <Defs>
              <LinearGradient id={`tile-${id}`} x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={colours.top} />
                <Stop offset="1" stopColor={colours.bottom} />
              </LinearGradient>
              <LinearGradient id={`gloss-${id}`} x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.38} />
                <Stop offset="1" stopColor="#FFFFFF" stopOpacity={0.04} />
              </LinearGradient>
            </Defs>
            <Rect x="0" y="0" width="100" height="100" fill={`url(#tile-${id})`} />
            <Rect x="4" y="3" width="92" height="40" rx="8" fill={`url(#gloss-${id})`} />
          </Svg>
          {faceWidth > 0 && (
            <Animated.View
              style={[
                styles.shine,
                { transform: [{ translateX: shine.interpolate({ inputRange: [0, 1], outputRange: [-80, faceWidth + 40] }) }, { rotate: '18deg' }] },
              ]}
            />
          )}
          <View style={[styles.icon, compact && styles.iconCompact]}>{icon}</View>
          <Text style={[styles.title, compact && styles.titleCompact]} numberOfLines={1} adjustsFontSizeToFit>
            {title}
          </Text>
          <Text style={styles.subtitle} numberOfLines={1}>
            {subtitle}
          </Text>
        </View>
        {badge ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{badge}</Text>
          </View>
        ) : null}
      </Pressable>
    </Animated.View>
  );
}

const RIM = '#F6D77B';
const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    // Lifted off the background.
    shadowColor: '#000',
    shadowOpacity: 0.45,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
    borderRadius: 20,
  },
  shine: {
    position: 'absolute',
    pointerEvents: 'none',
    top: '-30%',
    bottom: '-30%',
    left: 0,
    width: 34,
    backgroundColor: '#FFFFFF',
    opacity: 0.22,
  },
  press: { flex: 1 },
  base: { position: 'absolute', left: 0, right: 0, top: 8, bottom: 0, borderRadius: 20, borderWidth: 2.5, borderColor: '#B8913A' },
  face: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 7,
    borderRadius: 20,
    borderWidth: 2.5,
    borderColor: RIM,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  icon: { marginBottom: 2 },
  iconCompact: { marginBottom: 0 },
  title: {
    color: '#FFFFFF',
    fontSize: 19,
    fontWeight: '900',
    letterSpacing: 0.3,
    textShadowColor: 'rgba(0,0,0,0.45)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 3,
  },
  titleCompact: { fontSize: 16 },
  subtitle: { color: 'rgba(255,255,255,0.88)', fontSize: 12, fontWeight: '600', marginTop: 1 },
  badge: {
    position: 'absolute',
    top: -6,
    right: -4,
    backgroundColor: '#E5484D',
    borderRadius: 999,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    paddingHorizontal: 8,
    paddingVertical: 2,
    transform: [{ rotate: '8deg' }],
  },
  badgeText: { color: '#FFFFFF', fontSize: 11, fontWeight: '900', letterSpacing: 0.5 },
});
