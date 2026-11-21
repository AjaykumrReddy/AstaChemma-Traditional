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
- **Move history:** every throw, move, capture and homecoming, newest first, saved with the game.
- **Settings** (speed, sound, auto-move) on the start screen and from the ⚙ button during a game.

## Run it

```sh
npm install            # once, from the repo root
npm run web            # open in the browser
npm run client         # Expo dev server: scan the QR code with Expo Go (Android/iOS)
npm test               # engine tests
```

Inside `apps/client`: `npm run typecheck`, `npm run lint`, `npm run export:web` (static web build in `dist/`).

## Rules engine

The rules live in `packages/engine/src/rules.ts` and the route and safe squares in `board.ts`. Every function is pure: it takes a `GameState` and returns a new one. Shell throws use a seeded random number generator, so a game can be replayed exactly from its seed. That lets the same engine later run on an online game server.

The computer opponent (`bot.ts`) rates each move by its effect on each side's expected turns left. Those numbers come from an exact solution of the solo race (`race.ts`, 17,576 positions, worked out once in about 50 ms), adjusted for the chance of being captured on the next throw.

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
