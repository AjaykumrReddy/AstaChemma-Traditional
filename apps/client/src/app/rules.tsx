import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, radius, space } from '../theme';

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
  return (
    <ScrollView contentContainerStyle={styles.scroll}>
      <View style={styles.container}>
        <Section title="Goal">
          <Text style={styles.body}>
            Bring all three of your pieces – one Mother and two Children – to the centre square. The first player to do so
            wins. In team mode, opposite players are partners and win when both have all pieces home.
          </Text>
        </Section>

        <Section title="Throwing the shells">
          <Text style={styles.body}>Throw five cowries and count how many land open.</Text>
          <View style={styles.table}>
            <View style={[styles.tr, styles.thead]}>
              {['Open', 'Score', 'Child', 'Mother'].map((h) => (
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
          <Text style={styles.note}>All five open or none open both count as 8. The Mother cannot move on 1 or 3.</Text>
        </Section>

        <Section title="Entering the board">
          <Bullet>A Child enters on a 4 (onto your X square), or on an 8 and then moves 4 more steps.</Bullet>
          <Bullet>The Mother enters only on an 8, onto your X square, with no extra steps.</Bullet>
          <Bullet>You choose which waiting piece enters.</Bullet>
        </Section>

        <Section title="Keeping a 4 or 8 (4 + 4 = 8)">
          <Bullet>When you throw a 4 or an 8 you may use it straight away, or keep it and throw again.</Bullet>
          <Bullet>Then use the kept throw and the new one separately, in any order – for example move a Child out of the way first, then the Mother.</Bullet>
          <Bullet>If you kept a 4 and throw another 4, you may join them into one 8 – only to release your Mother. Only two 4s join; nothing else combines.</Bullet>
          <Bullet>A kept throw that still cannot be used when your throws run out is lost.</Bullet>
        </Section>

        <Section title="The route">
          <Bullet>Start on the X in the middle of your side.</Bullet>
          <Bullet>Go counter-clockwise round the outer ring, then clockwise round the inner ring, then into the centre.</Bullet>
          <Bullet>It is 24 steps from your X to home, and you need the exact count to finish.</Bullet>
        </Section>

        <Section title="Turns">
          <Bullet>A 4 or an 8 gives you another throw.</Bullet>
          <Bullet>Bringing a piece home also gives you another throw.</Bullet>
          <Bullet>If no piece can move, the turn is simply lost.</Bullet>
        </Section>

        <Section title="Capturing and safe squares">
          <Bullet>Captures are like for like: only a Child captures a Child, and only a Mother captures a Mother.</Bullet>
          <Bullet>Land on an opponent piece of the same kind to send it back to its starting area. Every such piece on that square goes back.</Bullet>
          <Bullet>No two pieces ever share a plain square – not even your own. You can land there only by capturing what is there.</Bullet>
          <Bullet>So you cannot land on your own piece, your partner’s, or an opponent of the other kind on a plain square.</Bullet>
          <Bullet>X squares and home can hold any number of pieces, yours and opponents’, and nobody can be captured there.</Bullet>
          <Bullet>A captured piece re-enters by the normal rules: a Child on a 4 or 8, the Mother only on an 8.</Bullet>
        </Section>

        <Section title="Teams">
          <Bullet>Once you have all your pieces home, you use your throws to move your partner’s pieces.</Bullet>
        </Section>

        <Section title="Playing in the app">
          <Bullet>Tap a glowing piece to see where it will land, then tap it again (or the highlighted square) to move.</Bullet>
          <Bullet>After a 4 or 8, use “Keep · Throw again” to hold it; “Join 4 + 4” appears when you can release the Mother.</Bullet>
          <Bullet>The Mother is the marble with the white ring.</Bullet>
        </Section>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: space.lg, paddingBottom: space.xxl },
  container: { width: '100%', maxWidth: 600, alignSelf: 'center', gap: space.md },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: space.lg, gap: space.sm },
  heading: { color: colors.text, fontSize: 17, fontWeight: '700' },
  body: { color: colors.textMuted, fontSize: 15, lineHeight: 22, flex: 1 },
  note: { color: colors.textMuted, fontSize: 13 },
  bullet: { flexDirection: 'row', gap: space.sm },
  bulletDot: { color: colors.accent, fontSize: 15, lineHeight: 22 },
  table: { borderRadius: radius.sm, overflow: 'hidden', borderWidth: 1, borderColor: colors.chalkFaint },
  tr: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: colors.chalkFaint },
  thead: { borderTopWidth: 0, backgroundColor: colors.surfaceRaised },
  td: { flex: 1, color: colors.text, fontSize: 15, paddingVertical: 8, textAlign: 'center', fontVariant: ['tabular-nums'] },
  th: { fontWeight: '700', color: colors.chalk },
});
