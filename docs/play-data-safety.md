# Google Play – Data safety answers (draft)

Answers for the Play Console **App content → Data safety** form, based on what the app and
server actually do (v4). Check them again if features change, and keep them consistent with
the privacy policy (`/privacy` on the game server).

- Privacy policy URL: `https://asta-chemma-server.asta-server.workers.dev/privacy`
  (move to your own domain before launch)
- Account deletion URL: `https://asta-chemma-server.asta-server.workers.dev/delete-account`
- Contact email: **placeholder** `support@astachemma.example` – set `SUPPORT_EMAIL` in
  `apps/server/wrangler.jsonc` to the real address and redeploy before submitting.

## Data collection and security

| Question | Answer |
|---|---|
| Does your app collect or share any of the required user data types? | **Yes** |
| Is all of the user data collected by your app encrypted in transit? | **Yes** (HTTPS / secure WebSockets only) |
| Do you provide a way for users to request that their data is deleted? | **Yes** – in the app (Profile → Delete account) and the account deletion URL above |
| Does your app allow users to create an account? | **Yes** (a guest account automatically; optional Google sign-in) |

## Data types

Nothing is **shared** with third parties (Cloudflare, Neon and Google process data only on our
behalf as service providers, which the form does not count as sharing). Nothing is used for
advertising or analytics.

| Category → type | Collected | Shared | Required / optional | Purposes |
|---|---|---|---|---|
| Personal info → **Name** (player name) | Yes | No | Optional (players may keep the default "Player") | App functionality, Account management |
| Personal info → **Email address** | Yes | No | Optional (only with Google sign-in) | Account management |
| Personal info → **User IDs** (account ID; Google account ID when signed in) | Yes | No | Required | App functionality, Account management |
| App activity → **Other actions** (online game results, coins, coin history, shop purchases) | Yes | No | Required | App functionality |

**Not collected:** location (precise or approximate), contacts, photos/videos, audio, files,
calendar, messages, health, financial info / purchase history (there are no real-money
purchases), web browsing, installed apps, device or advertising IDs, crash logs, diagnostics.

Note on IP addresses: our host (Cloudflare) sees IP addresses to deliver traffic and to limit
how fast new accounts can be created from one address; we don't store them or tie them to an
account. If Play's guidance changes to require it, declare "App info and performance →
Other" or "Approximate location" as *processed ephemerally* for *Fraud prevention, security*.

## Other App content answers (for reference)

- **Ads:** the app contains no ads.
- **In-app purchases:** none (coins are earned only and can't be bought).
- **Gambling:** no real-money gambling; coins have no cash value and can't be cashed out.
- **Target audience:** 13 and over is the simplest choice (selecting under-13 brings Google's
  Families policy requirements).
- **User-generated content / interaction:** players choose a display name that others see in
  online games; there is no chat.
