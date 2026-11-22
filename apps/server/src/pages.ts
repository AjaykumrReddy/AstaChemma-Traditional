/**
 * Public web pages the app stores ask for. Plain HTML, English and Telugu.
 *
 *   GET /delete-account   How to delete your account and data (Google Play's
 *                         "account deletion" link).
 */

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
    <li>Your online stats (games and wins)</li>
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
