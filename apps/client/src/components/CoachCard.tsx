import { useEffect, useState } from 'react';
import { Animated, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import type { Strings } from '../i18n';
import type { TutorialStep } from '../tutorial/steps';
import { boardColors, colors, radius, space } from '../theme';

export interface CoachCardProps {
  t: Strings;
  step: TutorialStep;
  index: number;
  total: number;
  onNext: () => void;
  onSkip: () => void;
  onKeepPlaying: () => void;
  onBackToStart: () => void;
}

/** The guided game's coach: what to do now, with the step's buttons. Pops in on each new step. */
export function CoachCard({ t, step, index, total, onNext, onSkip, onKeepPlaying, onBackToStart }: CoachCardProps) {
  const [pop] = useState(() => new Animated.Value(0));

  useEffect(() => {
    pop.setValue(0);
    const anim = Animated.spring(pop, { toValue: 1, useNativeDriver: Platform.OS !== 'web', speed: 14, bounciness: 8 });
    anim.start();
    return () => anim.stop();
  }, [index, pop]);

  return (
    <Animated.View
      style={[
        styles.card,
        {
          opacity: pop,
          transform: [{ translateY: pop.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }],
        },
      ]}
      accessibilityLiveRegion="polite"
    >
      <View style={styles.header}>
        <Text style={styles.title}>{t.tutorialTitle}</Text>
        <Text style={styles.count}>{t.tutorialStepOf(index + 1, total)}</Text>
      </View>
      <View style={styles.progress}>
        <View style={[styles.progressFill, { width: `${((index + 1) / total) * 100}%` }]} />
      </View>
      <Text style={styles.text}>{t.tutorial[step.key]}</Text>

      {step.finish ? (
        <View style={styles.actions}>
          <Pressable style={({ pressed }) => [styles.primary, pressed && styles.pressed]} onPress={onKeepPlaying} accessibilityRole="button">
            <Text style={styles.primaryText}>{t.keepPlaying}</Text>
          </Pressable>
          <Pressable style={styles.secondary} onPress={onBackToStart} accessibilityRole="button">
            <Text style={styles.secondaryText}>{t.backToStart}</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.row}>
          <Pressable onPress={onSkip} hitSlop={8} accessibilityRole="button">
            <Text style={styles.skip}>{t.tutorialSkip}</Text>
          </Pressable>
          {step.next && (
            <Pressable style={({ pressed }) => [styles.next, pressed && styles.pressed]} onPress={onNext} accessibilityRole="button">
              <Text style={styles.primaryText}>{t.tutorialNext}</Text>
            </Pressable>
          )}
        </View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    maxWidth: 620,
    backgroundColor: '#2C2A1A',
    borderColor: boardColors.gold,
    borderWidth: 2,
    borderRadius: radius.lg,
    padding: space.lg,
    gap: space.sm,
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { color: boardColors.gold, fontSize: 14, fontWeight: '800', letterSpacing: 0.5, textTransform: 'uppercase' },
  count: { color: colors.textMuted, fontSize: 13, fontWeight: '700' },
  progress: { height: 4, borderRadius: 2, backgroundColor: 'rgba(233, 201, 119, 0.2)', overflow: 'hidden' },
  progressFill: { height: 4, backgroundColor: boardColors.gold },
  text: { color: colors.text, fontSize: 15.5, lineHeight: 23 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: space.xs },
  skip: { color: colors.textMuted, fontSize: 14, fontWeight: '600', textDecorationLine: 'underline' },
  next: { backgroundColor: boardColors.gold, borderRadius: radius.md, paddingVertical: 10, paddingHorizontal: space.xl },
  actions: { gap: space.xs, marginTop: space.xs },
  primary: { backgroundColor: boardColors.gold, borderRadius: radius.md, paddingVertical: 13, alignItems: 'center' },
  primaryText: { color: '#2A2208', fontSize: 15, fontWeight: '800' },
  secondary: { paddingVertical: 10, alignItems: 'center' },
  secondaryText: { color: colors.chalk, fontSize: 14, fontWeight: '600', textDecorationLine: 'underline' },
  pressed: { opacity: 0.8 },
});
