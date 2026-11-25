# Launching on Google Play – checklist

The order matters: the **closed test (12 testers, 14 days)** is the long pole for a new
personal developer account, so start it as early as possible. Everything else can be done
while it runs. Google changes these rules from time to time; if the Console asks for
something different, the Console wins.

Related: store texts and images in [`store/`](store/listing.md), data-safety answers in
[`play-data-safety.md`](play-data-safety.md).

---

## 1. Developer account (you)

- [ ] Create the account at <https://play.google.com/console/signup> – one-time US$25 fee.
  - **Personal** account: needs ID verification (a few days), and **must run a closed test
    with at least 12 testers for 14 days in a row** before it can publish to everyone.
  - **Organisation** account: needs a D-U-N-S number for the business, but skips the
    12-tester rule. Only worth it if the business is registered and you want the
    developer name to be the business.
- [ ] Developer name shown on the store, contact email `mail.businessworks@gmail.com`
  (the same as the privacy policy), and verify the contact phone number.

## 2. Create the app (you, ~10 minutes)

- [ ] **Create app** → name **Asta Chemma Traditional**, default language English (India),
  **Game**, **Free**, accept the declarations.
- [ ] Package name is fixed by the first upload: `com.astachemma.app` (it can never change).

## 3. App content (Policy → App content)

Answers are ready; copy them in:

| Section | Answer |
|---|---|
| Privacy policy | `https://asta-chemma-server.asta-server.workers.dev/privacy` |
| App access | All functionality available without special access (a guest account is made automatically) |
| Ads | No ads |
| Content rating (IARC questionnaire) | Category **Game**; no violence, no sexual content, no profanity, no drugs; **users can interact** (online play, player names; no chat); **no real-money gambling**, no simulated gambling (it's a traditional race game with cowrie throws, no betting). Expect *3+ / Everyone*. |
| Target audience | **13 and over** (avoids the Families programme rules) |
| News app / Government app / Financial features / Health | No / No / None / None |
| Data safety | See [`play-data-safety.md`](play-data-safety.md) |
| Account deletion | URL `https://asta-chemma-server.asta-server.workers.dev/delete-account`; in-app: Profile → Delete account |

## 4. Store listing (Grow → Store presence → Main store listing)

From [`store/listing.md`](store/listing.md):

- [ ] App name, short and full description (English; add Telugu as a translation).
- [ ] App icon: `store/icon-512.png`. Feature graphic: `store/feature-graphic.png`.
- [ ] Phone screenshots: `store/screenshots-en/*` (and `screenshots-te/*` for the Telugu listing).
- [ ] Category **Board**, tags (board, family, Indian, traditional), contact email.

## 5. Build and upload (me + you)

- [ ] Build the store bundle (`.aab`; version numbers go up automatically):

  ```
  cd apps/client
  npx eas-cli@latest build --platform android --profile production
  ```

- [ ] **First upload is by hand**: Test and release → Testing → **Closed testing** → create a
  track (e.g. "Family and friends") → Create release → upload the `.aab` from the EAS build
  page. Accept **Play App Signing** (Google keeps the signing key; EAS keeps the upload key).
- [ ] Release notes, e.g. "First release: play Asta Chemma online, against the computer, or
  with family on one phone."
- [ ] Countries: India (add others any time).

## 6. Google sign-in for store installs (me, after step 5)

Apps installed from Play are signed with **Google's** key, not the one our test APKs use, so
Google sign-in needs that key's fingerprint too, or it fails with "Couldn't sign in".

- [ ] Console → **Protected with Play → Play Store protection → Play app signing** (Google
  keeps moving it; it was once under Setup → App signing) → copy the **App signing key
  certificate SHA-1** – not the "Upload key" one shown on the same page. For this app it is
  `2D:6D:4C:8D:AF:1D:A1:87:5B:2F:AA:94:61:F0:C4:4F:1E:DA:6A:4A`.
  - Not sure? Check the app Play actually ships: Latest releases and bundles → a bundle →
    **Downloads → Signed, universal APK**, then
    `apksigner verify --print-certs <file>.apk` (Android SDK build-tools; needs Java) and use
    its "Signer #1 certificate SHA-1". Sign-in error **10 (DEVELOPER_ERROR)** in Sentry means
    this fingerprint is missing or wrong.
- [ ] Google Cloud Console → APIs & Services → Credentials → **Create OAuth client ID** →
  Android, package `com.astachemma.app`, that SHA-1. (Keep the existing Android client for
  the test APKs, and the Web client whose id is in `wrangler.jsonc`.)
- [ ] OAuth consent screen → **Publish app** (move from Testing to In production). We only ask
  for the basic `openid`, `email` and `profile` scopes, so Google doesn't require a review;
  until it's published, only listed test users can sign in.

## 7. The closed test (you, 14 days)

- [ ] Add at least **12 testers** (more is safer – people drop out): Testers tab → email list
  of their Gmail addresses, or a Google Group.
- [ ] Send them the **opt-in link** from the Testers tab. Each tester must accept on the web,
  then install from the Play Store (not the APK) and keep it installed.
- [ ] Keep at least 12 opted in for **14 days in a row**. Ask them to actually play – Google
  looks for real use – and collect feedback (it helps the production application).
- [ ] Ship an update or two during the test if you fix things (`eas build --profile production`,
  then upload to the same track).

## 8. Production (after day 14)

- [ ] Dashboard → **Apply for production**: a short form about the test (how testers were
  recruited, what feedback you got, what changed). Review takes up to about a week.
- [ ] When approved: Production → Create release → promote the tested release → roll out
  (a staged rollout of 20% first is a good idea).

## Later, for each update

- Server first (`npm run deploy` in `apps/server`; it stays compatible with older apps), then
  a new production build uploaded to the track. Never reuse a version number – EAS handles it.
- Optional: automate uploads with `eas submit` (needs a Google Play service account key).
