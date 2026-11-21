# Asta Chemma (అష్ట చెమ్మ) – traditional local variant

One TypeScript codebase for Android, iOS and Web.

```
packages/engine   Rules engine + computer opponent (pure TypeScript, no UI)
apps/client       Expo app (Expo Router, react-native-svg, Zustand) → iOS, Android, Web
```

Version 1 covers playing on one device (2–4 players, or 2 v 2 teams) and playing against the computer (easy, medium or hard).

Version 2 (in progress) adds:
- **Save and resume:** the current game is saved on the device after every action and offered as "Continue game" on the start screen, even after the app is closed.
- **Sounds:** shells rattling and landing, piece steps, captures, homecomings, the Mother's release and a win fanfare. They are synthesised by `apps/client/scripts/generate-sounds.mjs` (no third-party audio); run `node scripts/generate-sounds.mjs` in `apps/client` to regenerate them.
- **Game speed:** Slow, Normal or Fast for shell rolls, piece walks and computer turns.
- **Settings** (language, speed, sound, auto-move) on the start screen and from the ⚙ button during a game.
- **Guided first game:** a 15-step game against the computer with scripted shell results, so every lesson comes up: entering on a 4, extra throws, keeping a 4 and joining 4 + 4 to release the Mother, the Mother not moving on a 3, the computer's turn, and an 8 that captures. A coach card explains each step and only the asked-for action is available. First-time players see it on the start screen; it's always available from "Play the guided game". The player's own saved game is set aside and kept safe; at the end they can keep playing or go back. Steps and the throw script are in `apps/client/src/tutorial/steps.ts`.
- **Undo:** takes back the last human decision (a move, a 4 + 4 join, or keeping a throw), rewinding any computer turns since, up to 30 in a row. The shell randomness is part of the game state, so undoing never allows a re-roll. Forced auto-moves are skipped; not available in the guided game; kept in memory only.
- **Shape markers** (setting, off by default): each player gets a shape – Yellow ▲, Red ■, Blue ✚, Green ◆ – on their marbles (inside the Mother's ring) and in place of the colour dot on chips, the status line and setup, so players can be told apart without colour. With red-green colour blindness the red and green pieces otherwise look nearly identical.
- **Telugu / English:** every screen, message and the full rules page in both languages, switchable at any time (also from the start screen). All text lives in `apps/client/src/i18n/strings.ts`; both languages share one typed interface, so a missing translation fails the typecheck. Default player names ("You", "Computer 2") follow the language; names you type stay as typed.

## Run it

```sh
npm install            # once, from the repo root
npm run web            # open in the browser
npm run client         # Expo dev server: scan the QR code with Expo Go (Android/iOS)
npm test               # engine tests
```

Inside `apps/client`: `npm run typecheck`, `npm run lint`, `npm run export:web` (static web build in `dist/`).

## Online play (v3)

```
packages/protocol   Messages between the app and the server (shared types + validation)
apps/server         Cloudflare Worker + Durable Objects: one object per room, server-side throws, computer players
```

The live server is **https://asta-chemma-server.asta-server.workers.dev** (`/health` answers `{"ok":true,...}`). Every build of the app uses it, including development, so `npm run client` plus "Play online" works on any phone on any network.

```sh
npm run deploy:server   # run the server tests, then deploy to Cloudflare (after `npx wrangler login`)
npm run logs:server     # live logs from the deployed server
npm test                # engine tests + room logic tests + end-to-end tests against a local Worker
```

**Working on the server itself:** run `npm run server` (local server on port 8787, reachable on your Wi-Fi, with its own local Postgres saved in `apps/server/.data/`) and create `apps/client/.env.local` containing `EXPO_PUBLIC_SERVER_URL=local`, then restart `npm run client`. Any other `ws://` or `wss://` address there points the app at that server instead. Delete the file to go back to the live server.

**Changing the protocol:** phones keep old app versions for a long time, so the deployed server must keep understanding them. Add to messages rather than changing them; if a change truly can't be compatible, bump `PROTOCOL_VERSION` (older apps are then told to update).

**In the app:** "Play online" → enter a name → *Create room* (pick the mode and number of players) or *Join a room* with a 4-letter code. In the lobby the host sees a big room code to share, can fill empty seats with computers (any level), and starts once every seat is filled. During the game only your own pieces and buttons respond, and only on your turn; the other players' throws and moves animate just like local ones. Friends who drop out show as *offline*, then *away · computer playing*. If the app is closed or the connection drops it reconnects by itself, and the start screen offers *Rejoin* for your game. The ⚙ sheet has *Leave game* (the computer takes your seat). Undo is off online.

**Endpoints:** `GET /health`; WebSocket `/rooms/new` to create a room (then send `create`), `/rooms/<CODE>` to join or rejoin (then send `join` / `rejoin`).

**How it runs:** each room is a Durable Object named by its code. It accepts WebSockets with the Hibernation API (idle rooms cost nothing), saves the room to its SQLite-backed storage after every change (so deploys and crashes don't end games), and uses a storage alarm for every timed event: computer turns, the 30-second away grace period, and removing a room abandoned for 10 minutes. The room logic itself (`src/room.ts`) is platform-independent plain data plus an injected clock, so it is unit-tested without any server.

**The server is the referee:** it throws the shells, accepts actions only from the player whose turn it is and only legal moves (checked with the shared engine), runs computer players, and broadcasts the room after every change with the last action so apps can animate it. The random-number state is removed before the game is sent out, so throws can't be predicted. Players rejoin with the secret token from their welcome message; mid-game leavers are replaced by the computer. Apps ping every 25 seconds; a connection silent for 60 seconds (a phone that lost signal never says goodbye) is dropped and the player marked offline. Each connection is limited to 60 messages per 10 seconds.

**Hosting:** Cloudflare Workers + Durable Objects (SQLite storage). Rooms run close to the players, idle rooms cost nothing, and there are no servers to look after.

## Accounts (v4)

Every install gets a **guest account** automatically (no sign-up screen); its session token is kept in the phone's secure storage (Android Keystore / iOS Keychain). The profile screen (avatar, top-left of the start screen) shows the name and online stats. Online games played with an account are recorded when they finish, and count towards each signed-in player's stats. Coming next: Google/Apple sign-in (keep the account across phones) and coins.

**Database:** Postgres on [Neon](https://neon.tech), reached through Cloudflare **Hyperdrive** (pooling close to the database; binding `HYPERDRIVE` in `apps/server/wrangler.jsonc`). The server creates and updates the tables itself the first time it connects (`apps/server/src/db/migrations.ts`: numbered steps, never edited once deployed). Tables: `users`, `sessions` (only a SHA-256 hash of each token), `coin_ledger` (every coin change with its reason; a reward can't be paid twice), `games`, `game_players`.

**Account API** (same server): `POST /v1/auth/guest` → `{ token, profile }`; `GET /v1/me` and `PATCH /v1/me { name }` with `Authorization: Bearer <token>`. New guests are limited to 10 per minute per address. Online rooms accept the token as `account` in `create`/`join` (optional: playing never depends on the database).

**Local and tests:** no cloud database needed. `npm run server` and the tests run a real Postgres in-process (PGlite) and hand it to the Worker the same way Hyperdrive does (`CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE`).

**Setting up Hyperdrive** (once): in Neon, copy the connection string with *connection pooling off*, then in `apps/server` run `npx wrangler hyperdrive create asta-chemma-db --connection-string="…"` and put the printed id in `wrangler.jsonc`. Query caching is turned off (`npx wrangler hyperdrive update <id> --caching-disabled true`) so profiles and coins are never served stale.

## Installable Android app (APK)

Built in the cloud with EAS (a free Expo account is enough). From `apps/client`:

```sh
npx eas-cli@latest login      # once
npm run build:apk             # first run asks to create the EAS project: answer yes
```

When the build finishes, EAS prints a link and a QR code. Open it on the phone to download and install the APK (Android asks to allow installing from that source). The `production` profile in `eas.json` builds the `.aab` that Google Play needs.

## App icon and splash screen

The icon is the game board in miniature. Its SVG sources are generated by `apps/client/scripts/generate-icons.mjs` into `apps/client/assets/icon-src/` and rendered to the PNGs in `apps/client/assets/` at 1024×1024 (the favicon at 48×48). The Android adaptive icon keeps the whole board inside the launcher's safe circle. The splash screen is configured through the `expo-splash-screen` plugin in `app.json`; it shows only in real builds, not in Expo Go.

## Rules engine

The rules live in `packages/engine/src/rules.ts` and the route and safe squares in `board.ts`. Every function is pure: it takes a `GameState` and returns a new one. Shell throws use a seeded random number generator, so a game can be replayed exactly from its seed. That lets the same engine later run on an online game server.

The computer opponent (`bot.ts`) rates positions by each side's expected turns left. Those numbers come from an exact solution of the solo race (`race.ts`, 17,576 positions, worked out once in about 50 ms), adjusted for the chance of being captured on the next throw.

- **Easy and Medium** pick the move that looks best right now (Easy often plays at random).
- **Hard** looks ahead through the rest of its turn. It tries every move, every order of kept throws, and keeping versus using a 4 or 8, and averages over all six results of its next throw. Its own capture risk counts fully and opponents' at half, since opponents move before Hard throws again. Decisions average about 0.2 ms.

Measured in two-player games: Hard beats the earlier greedy Hard 59% of the time (800 games), Medium 55% and Easy 73%; Medium beats Easy 64%.

The rules come from *Asta_Chemma_Traditional_Rules_and_Game_Specification.docx* v1.0, plus these clarifications from the player:

- **Route:** enter on your own side's X, go counter-clockwise round the outer ring (16 squares), then clockwise round the inner ring (8), then the centre. That is 24 steps, and finishing needs the exact count.
- **Score 8 (5 open, or none open):** a Child already on the board moves 8, and a Mother already on the board moves 4. A Child entering moves 4 more steps; a Mother entering moves none.
- **Keeping a 4 or 8:** after a 4 or an 8 the player may use it at once or keep it and throw again, then use the kept and new throws in any order (for example, move a Child off the Mother's landing square first). Two kept 4s may join into one 8, only to release the Mother; only two 4s join. 1/2/3 are used straight away.
- **No capture is needed** before entering the inner ring.
- **Captured pieces** go back to their starting area and re-enter by the normal rules.
- **Extra turns:** 4 or 5 open gives another throw, and so does bringing a piece home. If no piece can move, the turn is lost.
- **Captures are like for like:** only a Child captures a Child, and only a Mother captures a Mother. Landing on a plain square captures every opponent piece of the same kind there; pieces of the other kind stay.
- **Sharing squares:** no two pieces ever share a plain square, not even your own or a partner's; you can land there only by capturing. X squares and home can hold any number of pieces.
- **Teams:** both partners must get all their pieces home. A partner who has finished moves the other partner's pieces.
- **Seating:** two players sit opposite each other. Turns pass counter-clockwise.
