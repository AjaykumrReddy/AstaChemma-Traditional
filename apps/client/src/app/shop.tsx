import type { Player, Seat } from '@asta/engine';
import { SHOP_ITEMS, type ShopItem, type ShopKind } from '@asta/protocol';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, Defs, Ellipse, RadialGradient, Stop } from 'react-native-svg';
import { useAccountStore } from '../account/store';
import { Backdrop } from '../components/Backdrop';
import { BoardDrawing } from '../components/BoardDrawing';
import { Popup, TopBar } from '../components/Chrome';
import { CoinIcon } from '../components/CoinIcon';
import { Segmented } from '../components/Segmented';
import { Cowrie } from '../components/Shells';
import { useSvgId } from '../components/svgId';
import { marbleFinish } from '../cosmetics';
import { useStrings } from '../i18n';
import { colors, radius, seatColors, space } from '../theme';

const PREVIEW = 104;
const PREVIEW_PLAYERS: Player[] = ([0, 1, 2, 3] as Seat[]).map((seat) => ({ index: seat, name: '', seat }));
const fmt = (n: number) => n.toLocaleString('en-IN');

/** Four marbles, one per colour, in a finish. */
function MarblePreview({ finishId, size }: { finishId: string; size: number }) {
  const u = useSvgId();
  const finish = marbleFinish(finishId);
  const spots = [
    { seat: 0 as Seat, x: -0.55, y: 0.5 },
    { seat: 1 as Seat, x: 0.55, y: 0.5 },
    { seat: 2 as Seat, x: -0.55, y: -0.55 },
    { seat: 3 as Seat, x: 0.55, y: -0.55 },
  ];
  return (
    <Svg width={size} height={size} viewBox="-1.25 -1.25 2.5 2.5">
      <Defs>
        {spots.map(({ seat }) => (
          <RadialGradient key={seat} id={`m${seat}${u}`} cx="35%" cy="30%" r="75%">
            {finish.stops(seatColors[seat]).map((s) => (
              <Stop key={s.offset} offset={s.offset} stopColor={s.color} stopOpacity={s.opacity ?? 1} />
            ))}
          </RadialGradient>
        ))}
      </Defs>
      {spots.map(({ seat, x, y }) => {
        const r = 0.46;
        return (
          <Circle key={`s${seat}`} cx={x + 0.04} cy={y + 0.07} r={r} fill="#000" fillOpacity={0.35} />
        );
      })}
      {spots.map(({ seat, x, y }) => {
        const r = 0.46;
        return (
          <Circle key={`b${seat}`} cx={x} cy={y} r={r} fill={`url(#m${seat}${u})`} />
        );
      })}
      {finish.rim &&
        spots.map(({ seat, x, y }) => (
          <Circle
            key={`r${seat}`}
            cx={x}
            cy={y}
            r={0.46 - (finish.rim!.width * 0.46) / 2}
            fill="none"
            stroke={finish.rim!.color}
            strokeOpacity={finish.rim!.opacity}
            strokeWidth={finish.rim!.width * 0.46}
          />
        ))}
      {spots.map(({ seat, x, y }) => (
        <Ellipse
          key={`h${seat}`}
          cx={x - 0.15}
          cy={y - 0.19}
          rx={finish.highlight.rx * 0.46}
          ry={finish.highlight.ry * 0.46}
          fill="#FFFFFF"
          fillOpacity={finish.highlight.opacity}
        />
      ))}
    </Svg>
  );
}

function Preview({ item }: { item: ShopItem }) {
  if (item.kind === 'board') {
    return <BoardDrawing players={PREVIEW_PLAYERS} currentSeat={null} destinations={[]} strong={false} size={PREVIEW} theme={item.id} />;
  }
  if (item.kind === 'marbles') return <MarblePreview finishId={item.id} size={PREVIEW} />;
  return (
    <View style={styles.shellPreview}>
      <Cowrie open size={28} look={item.id} />
      <Cowrie open={false} size={28} look={item.id} />
      <Cowrie open size={28} look={item.id} />
    </View>
  );
}

export default function ShopScreen() {
  const router = useRouter();
  const t = useStrings();
  const profile = useAccountStore((s) => s.profile);
  const status = useAccountStore((s) => s.status);
  const [kind, setKind] = useState<ShopKind>('board');
  const [buying, setBuying] = useState<ShopItem | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);

  const kinds: { value: ShopKind; label: string }[] = [
    { value: 'board', label: t.shopKinds.board },
    { value: 'marbles', label: t.shopKinds.marbles },
    { value: 'shells', label: t.shopKinds.shells },
  ];

  if (!profile) {
    return (
      <View style={[styles.screen, styles.centered]}>
        <Backdrop />
        {status === 'offline' ? <Text style={styles.hint}>{t.shopFailed}</Text> : <ActivityIndicator color={colors.chalk} />}
      </View>
    );
  }

  const use = async (item: ShopItem) => {
    setBusy(item.id);
    setMessage(null);
    const ok = await useAccountStore.getState().use(item.id);
    setBusy(null);
    if (!ok) setMessage({ text: t.shopFailed, ok: false });
  };
  const buy = async (item: ShopItem) => {
    setBusy(item.id);
    setMessage(null);
    const result = await useAccountStore.getState().buy(item.id);
    setBusy(null);
    setBuying(null);
    const name = t.shopItems[item.id]?.name ?? item.id;
    if (result === 'ok') setMessage({ text: t.shopBought(name), ok: true });
    else if (result === 'not-enough-coins') setMessage({ text: t.shopNeedMore(fmt(item.price - profile.coins)), ok: false });
    else setMessage({ text: t.shopFailed, ok: false });
  };

  return (
    <View style={styles.screen}>
      <Backdrop />
      <SafeAreaView style={styles.safe}>
        <TopBar
          title={t.shop}
          onBack={() => router.back()}
          backLabel={t.back}
          right={
            <View style={styles.balance} accessibilityLabel={t.coinsA11y(profile.coins)}>
              <CoinIcon size={22} />
              <Text style={styles.balanceText}>{fmt(profile.coins)}</Text>
            </View>
          }
        />
        <ScrollView contentContainerStyle={styles.scroll} bounces={false}>
          <Segmented options={kinds} value={kind} onChange={setKind} />
          {message && <Text style={message.ok ? styles.ok : styles.error}>{message.text}</Text>}
          {SHOP_ITEMS.filter((i) => i.kind === kind).map((item) => {
            const text = t.shopItems[item.id] ?? { name: item.id, hint: '' };
            const owned = item.price === 0 || profile.owned.includes(item.id);
            const inUse = profile.equipped[item.kind] === item.id;
            const short = !owned && profile.coins < item.price;
            return (
              <View key={item.id} style={[styles.card, inUse && styles.cardInUse]}>
                <View style={styles.preview}>
                  <Preview item={item} />
                </View>
                <View style={styles.info}>
                  <Text style={styles.name}>{text.name}</Text>
                  <Text style={styles.hint}>{text.hint}</Text>
                  {inUse ? (
                    <View style={[styles.pill, styles.pillInUse]}>
                      <Text style={styles.pillInUseText}>✓ {t.shopInUse}</Text>
                    </View>
                  ) : owned ? (
                    <Pressable
                      style={({ pressed }) => [styles.pill, styles.pillUse, (pressed || busy === item.id) && styles.dim]}
                      onPress={() => void use(item)}
                      disabled={busy !== null}
                      accessibilityRole="button"
                    >
                      {busy === item.id ? <ActivityIndicator color="#2A2208" /> : <Text style={styles.pillUseText}>{t.shopUse}</Text>}
                    </Pressable>
                  ) : (
                    <>
                      <Pressable
                        style={({ pressed }) => [styles.pill, styles.pillBuy, (pressed || short) && styles.dim]}
                        onPress={() =>
                          short
                            ? setMessage({ text: t.shopNeedMore(fmt(item.price - profile.coins)), ok: false })
                            : setBuying(item)
                        }
                        disabled={busy !== null}
                        accessibilityRole="button"
                        accessibilityLabel={`${t.shopBuy} ${text.name}, ${t.coinsA11y(item.price)}`}
                      >
                        <CoinIcon size={18} />
                        <Text style={styles.pillBuyText}>{fmt(item.price)}</Text>
                      </Pressable>
                      {short && <Text style={styles.need}>{t.shopNeedMore(fmt(item.price - profile.coins))}</Text>}
                    </>
                  )}
                  {owned && !inUse && item.price > 0 && <Text style={styles.ownedTag}>{t.shopOwned}</Text>}
                </View>
              </View>
            );
          })}
          <Text style={[styles.hint, styles.center]}>{t.coinsNote}</Text>
        </ScrollView>
      </SafeAreaView>

      <Popup
        visible={buying !== null}
        onClose={() => busy === null && setBuying(null)}
        closeLabel={t.close}
        title={buying ? t.shopBuyTitle(t.shopItems[buying.id]?.name ?? buying.id) : ''}
      >
        {buying && (
          <>
            <View style={styles.confirmPreview}>
              <Preview item={buying} />
            </View>
            <Text style={styles.body}>{t.shopBuyBody(fmt(buying.price), fmt(profile.coins - buying.price))}</Text>
            <Pressable
              style={({ pressed }) => [styles.buyButton, (pressed || busy !== null) && styles.dim]}
              onPress={() => void buy(buying)}
              disabled={busy !== null}
              accessibilityRole="button"
            >
              {busy ? (
                <ActivityIndicator color="#2A2208" />
              ) : (
                <>
                  <CoinIcon size={22} />
                  <Text style={styles.buyText}>
                    {t.shopBuy} · {fmt(buying.price)}
                  </Text>
                </>
              )}
            </Pressable>
            <Pressable style={styles.cancel} onPress={() => setBuying(null)} disabled={busy !== null} accessibilityRole="button">
              <Text style={styles.cancelText}>{t.cancel}</Text>
            </Pressable>
          </>
        )}
      </Popup>
    </View>
  );
}

const GLASS = 'rgba(14, 38, 32, 0.78)';
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  centered: { alignItems: 'center', justifyContent: 'center', padding: space.xl },
  safe: { flex: 1 },
  scroll: { paddingHorizontal: space.lg, paddingBottom: space.xl, gap: space.md, width: '100%', maxWidth: 560, alignSelf: 'center' },
  balance: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 36,
    paddingLeft: 6,
    paddingRight: 12,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderWidth: 1.5,
    borderColor: 'rgba(246, 215, 123, 0.55)',
  },
  balanceText: { color: '#F6D77B', fontSize: 15, fontWeight: '900', fontVariant: ['tabular-nums'] },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    backgroundColor: GLASS,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: 'rgba(246, 215, 123, 0.3)',
    padding: space.md,
  },
  cardInUse: { borderColor: '#F6D77B', borderWidth: 2 },
  preview: { width: PREVIEW, height: PREVIEW, alignItems: 'center', justifyContent: 'center' },
  shellPreview: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  info: { flex: 1, gap: 4, alignItems: 'flex-start' },
  name: { color: colors.text, fontSize: 18, fontWeight: '900' },
  hint: { color: colors.textMuted, fontSize: 13, lineHeight: 18 },
  center: { textAlign: 'center' },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: space.xs,
    minWidth: 96,
    justifyContent: 'center',
    paddingHorizontal: space.md,
    paddingVertical: 8,
    borderRadius: radius.pill,
  },
  pillBuy: { backgroundColor: colors.accent, borderBottomWidth: 3, borderBottomColor: '#B8913A' },
  pillBuyText: { color: '#2A2208', fontSize: 15, fontWeight: '900', fontVariant: ['tabular-nums'] },
  pillUse: { backgroundColor: '#F1EFE6', borderBottomWidth: 3, borderBottomColor: '#B9B5A5' },
  pillUseText: { color: '#2A2208', fontSize: 15, fontWeight: '900' },
  pillInUse: { borderWidth: 1.5, borderColor: '#7EE2A8' },
  pillInUseText: { color: '#7EE2A8', fontSize: 14, fontWeight: '800' },
  ownedTag: { color: colors.textMuted, fontSize: 12, fontWeight: '700' },
  need: { color: colors.textMuted, fontSize: 12 },
  dim: { opacity: 0.55 },
  ok: { color: '#7EE2A8', fontSize: 14, fontWeight: '700', textAlign: 'center' },
  error: { color: colors.danger, fontSize: 14, textAlign: 'center' },
  confirmPreview: { alignItems: 'center' },
  body: { color: colors.text, fontSize: 15, lineHeight: 22 },
  buyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingVertical: 14,
    borderBottomWidth: 4,
    borderBottomColor: '#B8913A',
  },
  buyText: { color: '#2A2208', fontSize: 17, fontWeight: '900' },
  cancel: { alignSelf: 'center', paddingVertical: space.sm, paddingHorizontal: space.lg },
  cancelText: { color: colors.chalk, fontSize: 15, fontWeight: '600', textDecorationLine: 'underline' },
});
