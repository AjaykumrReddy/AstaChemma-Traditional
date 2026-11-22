import { useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Backdrop } from '../components/Backdrop';
import { TopBar } from '../components/Chrome';
import { RouteArt, SafeArt, ThrowArt } from '../components/RulesArt';
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

/**
 * Drawings shown with some sections, by position in `rulesSections` (the same
 * order in every language): 1 throwing the shells, 4 the route, 6 capturing and safe squares.
 */
function artFor(index: number, size: number): ReactNode {
  if (index === 1) return <ThrowArt />;
  if (index === 4) return <RouteArt size={size} />;
  if (index === 6) return <SafeArt size={size} />;
  return null;
}

function Bullet({ children }: { children: ReactNode }) {
  return (
    <View style={styles.bullet}>
      <View style={styles.bulletDot} />
      <Text style={styles.body}>{children}</Text>
    </View>
  );
}

export default function RulesScreen() {
  const router = useRouter();
  const t = useStrings();
  const { width } = useWindowDimensions();
  const artSize = Math.min(220, width - space.lg * 4);
  return (
    <View style={styles.screen}>
      <Backdrop />
      <SafeAreaView style={styles.safe}>
        <TopBar title={t.rulesTitle} onBack={() => (router.canGoBack() ? router.back() : router.replace('/'))} backLabel={t.back} />
        <ScrollView contentContainerStyle={styles.scroll}>
          {t.rulesSections.map((section, index) => {
            const art = artFor(index, artSize);
            return (
              <View key={section.title} style={styles.card}>
                <View style={styles.headingRow}>
                  <Text style={styles.number}>{index + 1}</Text>
                  <Text style={styles.heading}>{section.title}</Text>
                </View>
                {art ? <View style={styles.art}>{art}</View> : null}
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
                    {MOVES.map((row, r) => (
                      <View key={row[0]} style={[styles.tr, r % 2 === 1 && styles.trAlt]}>
                        {row.map((cell, i) => (
                          <Text key={i} style={[styles.td, i === 1 && styles.tdScore]}>
                            {cell}
                          </Text>
                        ))}
                      </View>
                    ))}
                  </View>
                ) : null}
                {section.note ? <Text style={styles.note}>{section.note}</Text> : null}
                {section.bullets?.map((b) => <Bullet key={b}>{b}</Bullet>)}
              </View>
            );
          })}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  safe: { flex: 1 },
  scroll: { paddingHorizontal: space.lg, paddingBottom: space.xxl, gap: space.md, width: '100%', maxWidth: 600, alignSelf: 'center' },
  card: {
    backgroundColor: 'rgba(14, 38, 32, 0.78)',
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: 'rgba(246, 215, 123, 0.3)',
    padding: space.lg,
    gap: space.sm,
  },
  headingRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  number: {
    width: 28,
    height: 28,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#F6D77B',
    color: '#2A2208',
    fontSize: 14,
    fontWeight: '900',
    textAlign: 'center',
    lineHeight: 28,
  },
  heading: { flex: 1, color: '#F6D77B', fontSize: 18, fontWeight: '900' },
  art: { alignItems: 'center', paddingVertical: space.xs },
  body: { color: colors.text, fontSize: 15, lineHeight: 23, flex: 1 },
  note: { color: colors.textMuted, fontSize: 13, lineHeight: 20 },
  bullet: { flexDirection: 'row', gap: space.sm, alignItems: 'flex-start' },
  bulletDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#F6D77B', marginTop: 8 },
  table: { borderRadius: radius.md, overflow: 'hidden', borderWidth: 1.5, borderColor: 'rgba(246, 215, 123, 0.4)' },
  tr: { flexDirection: 'row' },
  trAlt: { backgroundColor: 'rgba(255,255,255,0.04)' },
  thead: { backgroundColor: 'rgba(246, 215, 123, 0.9)' },
  td: { flex: 1, color: colors.text, fontSize: 15, paddingVertical: 9, textAlign: 'center', fontVariant: ['tabular-nums'] },
  tdScore: { color: '#F6D77B', fontWeight: '900' },
  th: { fontWeight: '900', color: '#2A2208', fontSize: 13.5 },
});
