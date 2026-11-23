/**
 * Public web pages the app stores ask for. Plain HTML, English and Telugu.
 *
 *   GET /delete-account   How to delete your account and data (Google Play's
 *                         "account deletion" link).
 *   GET /privacy          The privacy policy.
 *
 * Both name the contact address from SUPPORT_EMAIL (wrangler.jsonc).
 */

/** When the privacy policy last changed (shown on the page; update with every change). */
export const PRIVACY_UPDATED = '23 November 2026';

const STYLE = `
  :root { color-scheme: dark; }
  body { margin: 0; background: #0f2a23; color: #f7f5ee; font: 16px/1.6 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
  main { max-width: 640px; margin: 0 auto; padding: 32px 20px 48px; }
  h1 { color: #f6d77b; font-size: 28px; margin: 0 0 4px; }
  h2 { color: #f6d77b; font-size: 19px; margin: 28px 0 8px; }
  .sub { color: #b9c9c2; margin: 0 0 24px; }
  ol, ul { padding-left: 22px; }
  li { margin: 4px 0; }
  .card { background: rgba(255,255,255,0.06); border: 1px solid rgba(246,215,123,0.35); border-radius: 14px; padding: 4px 18px 12px; margin-top: 16px; }
  a { color: #f6d77b; }
  hr { border: 0; border-top: 1px solid rgba(246,215,123,0.25); margin: 36px 0; }
`;

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

export function deleteAccountPage(supportEmail: string | undefined): Response {
  const email = supportEmail ? escapeHtml(supportEmail) : null;
  const contact = (en: boolean) =>
    email
      ? en
        ? `<p>No longer have the app? Email <a href="mailto:${email}?subject=Delete%20my%20Asta%20Chemma%20account">${email}</a> from the Google address you signed in with, and we will delete the account within 30 days.</p>`
        : `<p>యాప్ ఇప్పుడు లేదా? మీరు సైన్ ఇన్ చేసిన Google చిరునామా నుండి <a href="mailto:${email}?subject=Delete%20my%20Asta%20Chemma%20account">${email}</a> కి ఈమెయిల్ చేయండి. 30 రోజుల్లో ఖాతాను తొలగిస్తాం.</p>`
      : '';
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Delete your Asta Chemma account</title>
<style>${STYLE}</style>
</head>
<body>
<main>
  <h1>Delete your Asta Chemma account</h1>
  <p class="sub">Asta Chemma (అష్ట చెమ్మ) – the traditional board game</p>

  <div class="card">
    <h2>In the app</h2>
    <ol>
      <li>Open Asta Chemma.</li>
      <li>Tap your avatar (top-left of the start screen) to open your <b>Profile</b>.</li>
      <li>Tap <b>Delete account</b> at the bottom, then <b>Delete my account</b>.</li>
    </ol>
    <p>It happens straight away. The app then carries on with a new guest account.</p>
    ${contact(true)}
  </div>

  <h2>What is deleted</h2>
  <ul>
    <li>Your account and name</li>
    <li>Your coins and coin history</li>
    <li>Your online stats (games and wins), and your place on the leaderboard</li>
    <li>Your Google sign-in link and email address</li>
    <li>All sign-ins on all your phones</li>
  </ul>

  <h2>What is kept</h2>
  <ul>
    <li>Results of finished online games, so other players' history stays correct – with your name and account removed, so they no longer identify you.</li>
    <li>Short-lived server logs and database backups expire on their own.</li>
  </ul>
  <p>Games you play on your own phone (against the computer or friends on the same phone) are stored only on that phone; uninstalling the app removes them.</p>

  <hr>

  <h1>మీ అష్ట చెమ్మ ఖాతాను తొలగించడం</h1>
  <div class="card">
    <h2>యాప్‌లో</h2>
    <ol>
      <li>అష్ట చెమ్మ యాప్ తెరవండి.</li>
      <li>మొదటి పేజీలో పైన ఎడమవైపు ఉన్న మీ అవతార్‌ను నొక్కి <b>ప్రొఫైల్</b> తెరవండి.</li>
      <li>కిందన ఉన్న <b>ఖాతాను తొలగించండి</b> నొక్కి, ఆపై <b>నా ఖాతాను తొలగించు</b> నొక్కండి.</li>
    </ol>
    <p>వెంటనే తొలగిపోతుంది. తర్వాత యాప్ కొత్త అతిథి ఖాతాతో కొనసాగుతుంది.</p>
    ${contact(false)}
  </div>
  <h2>ఏమి తొలగిపోతుంది</h2>
  <ul>
    <li>మీ ఖాతా, పేరు</li>
    <li>మీ నాణేలు, నాణేల చరిత్ర</li>
    <li>మీ ఆన్‌లైన్ వివరాలు (ఆటలు, గెలుపులు)</li>
    <li>మీ Google సైన్ ఇన్ లింక్, ఈమెయిల్ చిరునామా</li>
  </ul>
  <h2>ఏమి ఉంటుంది</h2>
  <ul>
    <li>ముగిసిన ఆన్‌లైన్ ఆటల ఫలితాలు – మీ పేరు, ఖాతా లేకుండా, మిమ్మల్ని గుర్తించలేని విధంగా.</li>
  </ul>
</main>
</body>
</html>`;
  return new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'public, max-age=3600' } });
}

export function privacyPage(supportEmail: string | undefined): Response {
  const email = supportEmail ? escapeHtml(supportEmail) : null;
  const mail = email ? `<a href="mailto:${email}">${email}</a>` : 'the address in the app’s store listing';
  const mailTe = email ? `<a href="mailto:${email}">${email}</a>` : 'యాప్ స్టోర్ పేజీలోని చిరునామా';
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Asta Chemma – Privacy policy</title>
<style>${STYLE}</style>
</head>
<body>
<main>
  <h1>Privacy policy</h1>
  <p class="sub">Asta Chemma (అష్ట చెమ్మ) · Last updated ${PRIVACY_UPDATED} · <a href="#te">తెలుగు</a></p>

  <div class="card">
    <h2>In short</h2>
    <ul>
      <li>We keep only what the game needs: your player name, your coins and your online results – plus your email address if you sign in with Google.</li>
      <li>No ads, no tracking, no analytics, and we never sell or share your data.</li>
      <li>Coins are play money only: they can't be bought, sold or exchanged for money.</li>
      <li>You can delete your account and data at any time, in the app.</li>
      <li>If the app crashes, it sends us a crash report (what went wrong, the app version and the phone model) so we can fix it – never your name or account.</li>
    </ul>
  </div>

  <h2>What we collect, and why</h2>
  <ul>
    <li><b>Your account.</b> When you first open the app it creates a guest account for you: a random account number and the player name you choose (until then, "Player"). This is how your coins and stats are kept.</li>
    <li><b>Google sign-in (optional).</b> If you sign in with Google, we receive your Google account ID, your email address (only if Google has verified it) and your first name, which we use as your starting player name. We use these only to sign you in and to keep your account across phones. We never receive your Google password.</li>
    <li><b>Coins and shop.</b> Your coin balance, a record of each change (daily bonus, game rewards, shop purchases) and the looks you own and use.</li>
    <li><b>Online games.</b> For each finished online game: the room code, when it was played, each player's name and seat, who won and the coins earned. While a game is in progress, the game server also keeps the room itself (seats, names and moves); it is removed shortly after the game ends or the room is left.</li>
    <li><b>Activity dates.</b> When your account was created and, at most hourly, when it was last used – so inactive accounts could be tidied up in future.</li>
    <li><b>Sign-in sessions.</b> Your phone holds a secret sign-in key in its secure storage. We store only a scrambled (hashed) form of it, so it is useless to anyone who sees our database.</li>
    <li><b>Crash reports.</b> If the app crashes or hits an error, it sends a report: the error and where in the app it happened, the app version, the phone model and operating system version, and (for a small sample of sessions) how long screens took to load. Reports don't include your name, email, account number, IP address or anything you typed, and they are deleted after 90 days.</li>
  </ul>
  <p>Other players in an online game see your player name and how you are playing. Once you have won an online game against another person, your player name and your number of online wins and games also appear on the leaderboard, which every player can see. Choose a name you're happy for others to see.</p>

  <h2>What stays on your phone</h2>
  <p>Games against the computer or with friends on the same phone, your settings (language, speed, sound) and the guided game are stored only on your phone. We never receive them. Uninstalling the app removes them.</p>

  <h2>What we don't collect</h2>
  <p>We don't collect your location, contacts, photos, microphone, phone number, advertising ID or payment details, and the app contains no advertising or analytics tools (crash reports, above, are used only to fix problems).</p>

  <h2>Who processes the data</h2>
  <ul>
    <li><b>Cloudflare</b> runs our game server. Like any website host, it processes your IP address to deliver the service and to stop abuse (for example, limiting how quickly new accounts can be made from one address). We don't store IP addresses; Cloudflare's technical logs are kept for a few days.</li>
    <li><b>Neon</b> hosts our database (in Singapore).</li>
    <li><b>Google</b> handles Google sign-in, under Google's own privacy policy.</li>
    <li><b>Sentry</b> (Functional Software, Inc.) receives and stores crash reports.</li>
  </ul>
  <p>They act on our behalf only. We don't sell, rent or share your data with anyone else, and we don't use it for advertising.</p>

  <h2>Security</h2>
  <p>All traffic between the app and our server is encrypted (HTTPS). Coins and purchases are checked by the server, and sign-in keys are stored only in hashed form.</p>

  <h2>How long we keep it</h2>
  <p>Until you delete your account. When you do, your account, name, email, Google link, coins, coin history, purchases and sign-ins are deleted straight away. Results of finished online games stay so other players' history adds up, but with your name and account removed, so they no longer identify you. Short-term logs and backups expire on their own.</p>

  <h2>Your choices</h2>
  <ul>
    <li><b>See</b> your data: your name, coins, stats and purchases are on the Profile screen.</li>
    <li><b>Change</b> your player name at any time on the Profile screen.</li>
    <li><b>Delete</b> your account: Profile → Delete account. See <a href="/delete-account">how to delete your account</a>.</li>
    <li><b>Questions or requests:</b> write to ${mail}.</li>
  </ul>

  <h2>Children</h2>
  <p>Asta Chemma is a traditional family board game. It is not directed at children under 13, and online play shows only the player names people choose. If you believe a child has given us personal information, contact us and we will delete it.</p>

  <h2>Changes</h2>
  <p>If this policy changes, we will update this page and the date at the top.</p>

  <hr>

  <h1 id="te">గోప్యతా విధానం</h1>
  <p class="sub">అష్ట చెమ్మ · చివరిగా మార్చింది ${PRIVACY_UPDATED}</p>
  <div class="card">
    <h2>క్లుప్తంగా</h2>
    <ul>
      <li>ఆటకు కావలసినవి మాత్రమే ఉంచుకుంటాం: మీ ఆటగాడి పేరు, నాణేలు, ఆన్‌లైన్ ఫలితాలు – Google తో సైన్ ఇన్ చేస్తే మీ ఈమెయిల్ కూడా.</li>
      <li>ప్రకటనలు లేవు, ట్రాకింగ్ లేదు, మీ వివరాలను ఎవరికీ అమ్మం, పంచం.</li>
      <li>నాణేలు సరదా కోసమే: వాటిని కొనలేరు, అమ్మలేరు, డబ్బుగా మార్చలేరు.</li>
      <li>మీ ఖాతాను, వివరాలను ఎప్పుడైనా యాప్‌లోనే తొలగించవచ్చు.</li>
    </ul>
  </div>
  <h2>ఏమి సేకరిస్తాం, ఎందుకు</h2>
  <ul>
    <li><b>మీ ఖాతా:</b> ఒక యాదృచ్ఛిక ఖాతా సంఖ్య, మీరు ఎంచుకున్న ఆటగాడి పేరు – మీ నాణేలు, వివరాలు ఉంచడానికి.</li>
    <li><b>Google సైన్ ఇన్ (ఐచ్ఛికం):</b> మీ Google ఖాతా ID, ఈమెయిల్ (Google ధృవీకరించినది మాత్రమే), మొదటి పేరు – సైన్ ఇన్ చేయడానికి, ఫోన్ మారినా ఖాతా ఉండటానికి మాత్రమే. మీ Google పాస్‌వర్డ్ మాకు ఎప్పుడూ రాదు.</li>
    <li><b>నాణేలు, దుకాణం:</b> నాణేల నిల్వ, ప్రతి మార్పు రికార్డు, మీరు కొన్నవి, వాడుతున్నవి.</li>
    <li><b>ఆన్‌లైన్ ఆటలు:</b> గది కోడ్, సమయం, ఆటగాళ్ల పేర్లు, ఎవరు గెలిచారు, సంపాదించిన నాణేలు.</li>
    <li><b>క్రాష్ నివేదికలు:</b> యాప్ ఆగిపోతే లేదా లోపం వస్తే – ఏ లోపం, యాప్ వెర్షన్, ఫోన్ మోడల్, OS వెర్షన్ – సరిచేయడానికి మాత్రమే. మీ పేరు, ఈమెయిల్, ఖాతా సంఖ్య, IP చిరునామా ఉండవు; 90 రోజుల తర్వాత తొలగిపోతాయి.</li>
  </ul>
  <p>ఆన్‌లైన్ ఆటలో ఇతరులు మీ ఆటగాడి పేరు చూస్తారు. మరొక వ్యక్తితో ఆన్‌లైన్ ఆట గెలిచాక, మీ పేరు, గెలుపుల సంఖ్య అందరూ చూసే లీడర్‌బోర్డ్‌లో కనిపిస్తాయి.</p>
  <p>కంప్యూటర్‌తో లేదా ఒకే ఫోన్‌లో ఆడే ఆటలు, సెట్టింగ్‌లు మీ ఫోన్‌లోనే ఉంటాయి – మాకు రావు. మీ లొకేషన్, కాంటాక్ట్‌లు, ఫోటోలు, ఫోన్ నంబర్, చెల్లింపు వివరాలు సేకరించం.</p>
  <h2>ఎవరు నిర్వహిస్తారు</h2>
  <p>మా సర్వర్‌ను Cloudflare, డేటాబేస్‌ను Neon (సింగపూర్), సైన్ ఇన్‌ను Google, క్రాష్ నివేదికలను Sentry నిర్వహిస్తాయి – మా తరపున మాత్రమే. IP చిరునామాలను మేము నిల్వ చేయం.</p>
  <h2>ఎంతకాలం ఉంచుతాం</h2>
  <p>మీరు ఖాతాను తొలగించే వరకు. తొలగిస్తే మీ ఖాతా, పేరు, ఈమెయిల్, నాణేలు, కొనుగోళ్లు వెంటనే తొలగిపోతాయి. ముగిసిన ఆటల ఫలితాలు మీ పేరు లేకుండా ఉంటాయి.</p>
  <h2>మీ ఎంపికలు</h2>
  <p>ప్రొఫైల్‌లో మీ వివరాలు చూడండి, పేరు మార్చండి, లేదా ఖాతాను తొలగించండి (<a href="/delete-account">ఎలా తొలగించాలి</a>). ప్రశ్నలకు: ${mailTe}.</p>
</main>
</body>
</html>`;
  return new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'public, max-age=3600' } });
}
