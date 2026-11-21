import { Stack } from 'expo-router';
import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useStrings } from '../i18n';
import { colors, radius, space } from '../theme';

/** Open shells → score → Child steps → Mother steps. */
const MOVES: [string, string, string, string][] = [
  ['1', '1', '1', '–'],
  ['2', '2', '2', '1'],
  ['3', '3', '3', '–'],
  ['4', '4', '4', '2'],
  ['5', '8', '8', '4'],
  ['0', '8', '8', '4'],
];

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.card}>
      <Text style={styles.heading}>{title}</Text>
      {children}
    </View>
  );
}

function Bullet({ children }: { children: ReactNode }) {
  return (
    <View style={styles.bullet}>
      <Text style={styles.bulletDot}>•</Text>
      <Text style={styles.body}>{children}</Text>
    </View>
  );
}

export default function RulesScreen() {
  const t = useStrings();
  return (
    <ScrollView contentContainerStyle={styles.scroll}>
      <Stack.Screen options={{ title: t.rulesTitle }} />
      <View style={styles.container}>
        {t.rulesSections.map((section) => (
          <Section key={section.title} title={section.title}>
            {section.body ? <Text style={styles.body}>{section.body}</Text> : null}
            {section.table ? (
              <View style={styles.table}>
                <View style={[styles.tr, styles.thead]}>
                  {t.tableHead.map((h) => (
                    <Text key={h} style={[styles.td, styles.th]}>
                      {h}
                    </Text>
                  ))}
                </View>
                {MOVES.map((row) => (
                  <View key={row[0]} style={styles.tr}>
                    {row.map((cell, i) => (
                      <Text key={i} style={styles.td}>
                        {cell}
                      </Text>
                    ))}
                  </View>
                ))}
              </View>
            ) : null}
            {section.note ? <Text style={styles.note}>{section.note}</Text> : null}
            {section.bullets?.map((b) => <Bullet key={b}>{b}</Bullet>)}
          </Section>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: space.lg, paddingBottom: space.xxl },
  container: { width: '100%', maxWidth: 600, alignSelf: 'center', gap: space.md },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: space.lg, gap: space.sm },
  heading: { color: colors.text, fontSize: 17, fontWeight: '700' },
  body: { color: colors.textMuted, fontSize: 15, lineHeight: 23, flex: 1 },
  note: { color: colors.textMuted, fontSize: 13, lineHeight: 20 },
  bullet: { flexDirection: 'row', gap: space.sm },
  bulletDot: { color: colors.accent, fontSize: 15, lineHeight: 23 },
  table: { borderRadius: radius.sm, overflow: 'hidden', borderWidth: 1, borderColor: colors.chalkFaint },
  tr: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: colors.chalkFaint },
  thead: { borderTopWidth: 0, backgroundColor: colors.surfaceRaised },
  td: { flex: 1, color: colors.text, fontSize: 15, paddingVertical: 8, textAlign: 'center', fontVariant: ['tabular-nums'] },
  th: { fontWeight: '700', color: colors.chalk, fontSize: 14 },
});
