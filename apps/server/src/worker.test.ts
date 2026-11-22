import {
  COINS,
  PROTOCOL_VERSION,
  dailyBonus,
  gameReward,
  type ClientMessage,
  type Profile,
  type RoomView,
  type ServerMessage,
} from '@asta/protocol';
import { createPrivateKey, sign } from 'node:crypto';
import pg from 'pg';
import { claimDaily, credit, recordGame } from './db/accounts';
import { withDb } from './db/db';
import { describe, expect, inject, it } from 'vitest';
import { WebSocket } from 'ws';

/**
 * End-to-end tests: the real Worker and Durable Objects running in Cloudflare's
 * local runtime (started by test/global-setup.ts with tiny timings), driven by
 * real WebSocket clients.
 */

const port = inject('port');
const P = PROTOCOL_VERSION;

/** A test player connected to /rooms/<path>, with helpers to send and wait for messages. */
async function connect(path: string) {
  const socket = new WebSocket(`ws://127.0.0.1:${port}/rooms/${path}`);
  const inbox: ServerMessage[] = [];
  const waiters: { match: (m: ServerMessage) => boolean; resolve: (m: ServerMessage) => void }[] = [];
  let latest: RoomView | null = null;
  const actions: RoomView['lastAction'][] = [];
  let lastMessageAt = Date.now();
  socket.on('message', (data) => {
    const message = JSON.parse(data.toString()) as ServerMessage;
    lastMessageAt = Date.now();
    if (message.t === 'room') {
      latest = message.room;
      if (message.room.lastAction) actions.push(message.room.lastAction);
    }
    const i = waiters.findIndex((w) => w.match(message));
    if (i >= 0) waiters.splice(i, 1)[0]!.resolve(message);
    else inbox.push(message);
  });
  await new Promise<void>((resolve, reject) => {
    socket.once('open', () => resolve());
    socket.once('error', reject);
  });
  // Keep-alive, like the app (which pings every 25 s against the server's 60 s limit).
  const pinger = setInterval(() => socket.readyState === WebSocket.OPEN && socket.send('{"t":"ping"}'), 500);
  socket.on('close', () => clearInterval(pinger));
  const next = <T extends ServerMessage>(match: (m: ServerMessage) => m is T, timeoutMs = 5000): Promise<T> => {
    const i = inbox.findIndex(match);
    if (i >= 0) return Promise.resolve(inbox.splice(i, 1)[0] as T);
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('timed out waiting for a message')), timeoutMs);
      waiters.push({
        match,
        resolve: (m) => {
          clearTimeout(timer);
          resolve(m as T);
        },
      });
    });
  };
  return {
    socket,
    send: (message: ClientMessage | Record<string, unknown>) => socket.send(JSON.stringify(message)),
    room: async (condition: (r: RoomView) => boolean = () => true, timeoutMs?: number) =>
      (await next((m): m is Extract<ServerMessage, { t: 'room' }> => m.t === 'room' && condition(m.room), timeoutMs)).room,
    /** Wait until updates stop arriving, then return the newest room. */
    settled: async (): Promise<RoomView> => {
      while (Date.now() - lastMessageAt < 40) await new Promise((r) => setTimeout(r, 10));
      return latest!;
    },
    actions,
    welcome: () => next((m): m is Extract<ServerMessage, { t: 'welcome' }> => m.t === 'welcome'),
    reward: () => next((m): m is Extract<ServerMessage, { t: 'reward' }> => m.t === 'reward', 10_000),
    error: () => next((m): m is Extract<ServerMessage, { t: 'error' }> => m.t === 'error'),
    close: () => socket.close(),
    /** Go quiet without closing, like a phone that lost signal. */
    goSilent: () => clearInterval(pinger),
  };
}
type TestClient = Awaited<ReturnType<typeof connect>>;

async function createRoom(name: string, players: 2 | 3 | 4 = 2, account?: string) {
  const host = await connect('new');
  host.send({ t: 'create', protocol: P, name, mode: 'individual', players, ...(account ? { account } : {}) });
  const welcome = await host.welcome();
  return { host, welcome };
}

async function joinRoom(code: string, name: string, account?: string) {
  const guest = await connect(code);
  guest.send({ t: 'join', protocol: P, code, name, ...(account ? { account } : {}) });
  return { guest, welcome: await guest.welcome() };
}

/** Call the account API. */
async function api(method: string, path: string, opts: { token?: string; body?: unknown; ip?: string } = {}) {
  const res = await fetch(`http://127.0.0.1:${port}${path}`, {
    method,
    headers: {
      // Locally the test can say which address it comes from (Cloudflare sets this itself in production).
      ...(opts.ip ? { 'cf-connecting-ip': opts.ip } : {}),
      ...(opts.token ? { authorization: `Bearer ${opts.token}` } : {}),
      ...(opts.body !== undefined ? { 'content-type': 'application/json' } : {}),
    },
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
  return { status: res.status, body: (await res.json()) as Record<string, any> };
}

async function newGuest(name: string): Promise<{ token: string; profile: Profile }> {
  const { status, body } = await api('POST', '/v1/auth/guest', { body: { name } });
  expect(status).toBe(201);
  return body as { token: string; profile: Profile };
}

/** A host and a guest in a started 2-player game. */
async function twoPlayerGame() {
  const { host, welcome: hostWelcome } = await createRoom('Asha');
  const { guest, welcome: guestWelcome } = await joinRoom(hostWelcome.code.toLowerCase(), 'Ravi');
  host.send({ t: 'start' });
  const started = await host.room((r) => r.status === 'playing');
  return { host, guest, hostWelcome, guestWelcome, started };
}

/**
 * Play turns for the given seats (each through its own client), acting on the
 * latest room state, until `done` is true. Seats not listed are played by the
 * server (computer players or stand-ins).
 */
async function play(
  observer: TestClient,
  players: Partial<Record<number, TestClient>>,
  done: (room: RoomView) => boolean,
  limit = 400,
): Promise<RoomView> {
  for (let i = 0; i < limit; i++) {
    const room = await observer.settled();
    if (done(room)) return room;
    if (room.status !== 'playing') break;
    const game = room.game!;
    const client = players[game.players[game.current]!.seat];
    if (client) {
      if (game.phase === 'awaitingThrow') client.send({ t: 'throw' });
      else client.send({ t: 'move', moveId: game.legalMoves[0]!.id });
    }
    await observer.room((r) => r.version > room.version);
  }
  const final = await observer.settled();
  if (!done(final)) throw new Error('the expected action never happened');
  return final;
}

describe('worker', () => {
  it('answers its health check', async () => {
    const res = await fetch(`http://127.0.0.1:${port}/health`);
    expect(await res.json()).toEqual({ ok: true, protocol: P });
  });
});

describe('rooms', () => {
  it('creates a room with a code and seats the host at the bottom', async () => {
    const { host, welcome } = await createRoom('Asha');
    expect(welcome.code).toMatch(/^[A-HJ-NP-Z2-9]{4}$/);
    expect(welcome.seat).toBe(0);
    const room = await host.room();
    expect(room.status).toBe('lobby');
    expect(room.seats.map((s) => [s.seat, s.kind])).toEqual([
      [0, 'human'],
      [2, 'open'],
    ]);
    expect(room.seats[0]).toMatchObject({ name: 'Asha', host: true, connected: true });
  });

  it('lets a friend join by code (any case) into the next open seat', async () => {
    const { guestWelcome, started } = await twoPlayerGame();
    expect(guestWelcome.seat).toBe(2);
    expect(started.seats.map((s) => s.name)).toEqual(['Asha', 'Ravi']);
  });

  it('rejects unknown codes and games already started', async () => {
    const lost = await connect('ZZZZ');
    lost.send({ t: 'join', protocol: P, code: 'ZZZZ', name: 'X' });
    expect((await lost.error()).code).toBe('no-room');

    const { hostWelcome } = await twoPlayerGame();
    const late = await connect(hostWelcome.code);
    late.send({ t: 'join', protocol: P, code: hostWelcome.code, name: 'Late' });
    expect((await late.error()).code).toBe('already-started');
  });

  it('turns away old app versions and malformed messages', async () => {
    const client = await connect('new');
    client.send({ t: 'create', protocol: P + 1, name: 'A', mode: 'individual', players: 2 });
    expect((await client.error()).code).toBe('version');
    client.send({ t: 'move' });
    expect((await client.error()).code).toBe('bad-message');
    client.socket.send('not json');
    expect((await client.error()).code).toBe('bad-message');
  });

  it('only lets the host change seats and start, and only when every seat is filled', async () => {
    const { host, welcome } = await createRoom('Asha', 3);
    const { guest } = await joinRoom(welcome.code, 'Ravi');
    guest.send({ t: 'start' });
    expect((await guest.error()).code).toBe('not-host');
    host.send({ t: 'start' });
    expect((await host.error()).code).toBe('not-ready');
    host.send({ t: 'seat', seat: 2, kind: 'bot', level: 'easy' });
    const room = await host.room((r) => r.seats.some((s) => s.kind === 'bot'));
    expect(room.seats.find((s) => s.seat === 2)).toMatchObject({ kind: 'bot', level: 'easy' });
    host.send({ t: 'seat', seat: 1, kind: 'bot' });
    expect((await host.error()).code).toBe('illegal');
  });

  it('frees a lobby seat when a player leaves, and passes on the host role', async () => {
    const { host, welcome } = await createRoom('Asha');
    const { guest } = await joinRoom(welcome.code, 'Ravi');
    host.send({ t: 'leave' });
    const room = await guest.room((r) => r.seats.filter((s) => s.kind === 'human').length === 1);
    expect(room.seats.find((s) => s.seat === 0)?.kind).toBe('open');
    expect(room.seats.find((s) => s.seat === 2)).toMatchObject({ name: 'Ravi', host: true });
  });
});

describe('play', () => {
  it('hides the random-number state from players', async () => {
    const { started } = await twoPlayerGame();
    expect(started.game?.rng).toBe(0);
  });

  it('only accepts actions from the player whose turn it is, and only legal moves', async () => {
    const { host, guest } = await twoPlayerGame();
    guest.send({ t: 'throw' });
    expect((await guest.error()).code).toBe('not-your-turn');
    host.send({ t: 'move', moveId: '0-C1:0' });
    expect((await host.error()).code).toBe('illegal');
    host.send({ t: 'throw' });
    const room = await guest.room((r) => r.lastAction?.type === 'throw');
    expect(room.lastAction).toEqual({ type: 'throw', by: 0 });
    expect(room.game?.lastThrow).not.toBeNull();
  });

  it('broadcasts each move with its id so apps can animate it', async () => {
    const { host, guest } = await twoPlayerGame();
    await play(host, { 0: host, 2: guest }, () => host.actions.some((a) => a?.type === 'move' && a.by === 0));
    const move = host.actions.find((a) => a?.type === 'move' && a.by === 0);
    expect(move).toMatchObject({ type: 'move', by: 0, moveId: expect.any(String) });
    const seen = await guest.room((r) => JSON.stringify(r.lastAction) === JSON.stringify(move));
    expect(seen.lastAction).toEqual(move);
  });

  it('lets computer players take their own turns (via alarms)', async () => {
    const { host } = await createRoom('Asha');
    host.send({ t: 'seat', seat: 2, kind: 'bot', level: 'hard' });
    await host.room((r) => r.seats.some((s) => s.kind === 'bot'));
    host.send({ t: 'start' });
    await host.room((r) => r.status === 'playing');
    await play(host, { 0: host }, () => host.actions.some((a) => a && 'by' in a && a.by === 2));
  });

  it('plays a whole game to the end', async () => {
    const { host, guest } = await twoPlayerGame();
    const final = await play(host, { 0: host, 2: guest }, (r) => r.status === 'finished', 4000);
    expect(final.game?.winners).toHaveLength(1);
    // The finished state reached the guest too.
    expect((await guest.settled()).status).toBe('finished');
  }, 180_000);
});

describe('connections', () => {
  it('lets a disconnected player rejoin with their token, and refuses a wrong token', async () => {
    const { host, guest, guestWelcome } = await twoPlayerGame();
    guest.close();
    await host.room((r) => r.seats.find((s) => s.seat === 2)?.connected === false);

    const impostor = await connect(guestWelcome.code);
    impostor.send({ t: 'rejoin', protocol: P, code: guestWelcome.code, playerId: guestWelcome.playerId, token: 'wrong' });
    expect((await impostor.error()).code).toBe('bad-token');

    const back = await connect(guestWelcome.code);
    back.send({ t: 'rejoin', protocol: P, code: guestWelcome.code, playerId: guestWelcome.playerId, token: guestWelcome.token });
    expect((await back.welcome()).seat).toBe(2);
    const room = await host.room((r) => r.seats.find((s) => s.seat === 2)?.connected === true);
    expect(room.seats.find((s) => s.seat === 2)).toMatchObject({ connected: true, away: false });
  });

  it('notices a player whose connection went quiet without closing, and lets them rejoin', async () => {
    const { host, guest, guestWelcome } = await twoPlayerGame();
    guest.goSilent();
    const room = await host.room((r) => r.seats.find((s) => s.seat === 2)?.connected === false, 10_000);
    expect(room.seats.find((s) => s.seat === 0)?.connected).toBe(true); // the host kept pinging
    await new Promise<void>((resolve) => (guest.socket.readyState === WebSocket.CLOSED ? resolve() : guest.socket.once('close', () => resolve())));

    const back = await connect(guestWelcome.code);
    back.send({ t: 'rejoin', protocol: P, code: guestWelcome.code, playerId: guestWelcome.playerId, token: guestWelcome.token });
    expect((await back.welcome()).seat).toBe(2);
    await host.room((r) => r.seats.find((s) => s.seat === 2)?.connected === true);
  });

  it('lets the computer stand in for a player who stays away, so the game never stalls', async () => {
    const { host, guest } = await twoPlayerGame();
    guest.close();
    await host.room((r) => r.seats.find((s) => s.seat === 2)?.away === true, 10_000);
    await play(host, { 0: host }, () => host.actions.some((a) => a && 'by' in a && a.by === 2));
  });
});

const dbUrl = inject('dbUrl');
/** A different made-up address per call, so the per-address limits don't get in the way of other tests. */
let ipCounter = 0;
const nextIp = () => `10.0.${Math.floor(++ipCounter / 250)}.${ipCounter % 250}`;
const googleKey = createPrivateKey(inject('googleKey'));

function claimsFor(claims: Record<string, unknown>) {
  const now = Math.floor(Date.now() / 1000);
  return { iss: 'https://accounts.google.com', aud: 'test-web-client', iat: now, exp: now + 3600, email_verified: true, ...claims };
}

/** An ID token signed the way Google signs them, by the test's stand-in Google. */
function googleToken(claims: Record<string, unknown>, header: Record<string, unknown> = {}): string {
  const part = (v: unknown) => Buffer.from(JSON.stringify(v)).toString('base64url');
  const unsigned = `${part({ alg: 'RS256', typ: 'JWT', kid: 'test-key', ...header })}.${part(claimsFor(claims))}`;
  return `${unsigned}.${sign('RSA-SHA256', Buffer.from(unsigned), googleKey).toString('base64url')}`;
}

describe('accounts', () => {
  it('creates a guest account, reads it back with its token, and renames it', async () => {
    const { token, profile } = await newGuest('  Asha   K ');
    expect(token.length).toBeGreaterThan(30);
    expect(profile).toMatchObject({
      name: 'Asha K',
      guest: true,
      coins: COINS.welcome,
      gamesPlayed: 0,
      gamesWon: 0,
      daily: { available: true, streak: 0, amount: COINS.dailyBase },
    });

    const me = await api('GET', '/v1/me', { token });
    expect(me.status).toBe(200);
    expect(me.body.profile).toEqual(profile);

    const renamed = await api('PATCH', '/v1/me', { token, body: { name: 'Asha' } });
    expect(renamed.body.profile).toMatchObject({ id: profile.id, name: 'Asha' });
  });

  it('refuses unknown tokens, missing tokens and bad names', async () => {
    expect((await api('GET', '/v1/me')).status).toBe(401);
    expect((await api('GET', '/v1/me', { token: 'not-a-real-token' })).status).toBe(401);
    const { token } = await newGuest('Ravi');
    expect((await api('PATCH', '/v1/me', { token, body: { name: '   ' } })).status).toBe(400);
    expect((await api('POST', '/v1/auth/guest', { body: { name: 42 } })).status).toBe(400);
  });

  it('stores only a hash of the session token', async () => {
    const { token, profile } = await newGuest('Hash');
    const client = new pg.Client({ connectionString: dbUrl });
    await client.connect();
    try {
      const { rows } = await client.query('SELECT token_hash FROM sessions WHERE user_id = $1', [profile.id]);
      expect(rows).toHaveLength(1);
      expect(rows[0].token_hash).not.toContain(token);
      expect(rows[0].token_hash).toMatch(/^[0-9a-f]{64}$/);
    } finally {
      await client.end();
    }
  });

  it('records a finished online game once, and counts it for signed-in players only', async () => {
    const asha = await newGuest('Asha');
    const { host, welcome } = await createRoom('Asha', 2, asha.token);
    const { guest } = await joinRoom(welcome.code, 'Anon'); // not signed in
    host.send({ t: 'start' });
    await host.room((r) => r.status === 'playing');
    const final = await play(host, { 0: host, 2: guest }, (r) => r.status === 'finished', 4000);
    const ashaWon = final.game!.winners.includes(final.game!.players.find((p) => p.seat === 0)!.index);

    // The server tells Asha what she earned: two people played, so a win pays for beating one other person.
    const reward = await host.reward();
    const expected = gameReward(ashaWon, 1);
    expect(reward).toEqual({ t: 'reward', coins: expected, won: ashaWon });
    const me = (await api('GET', '/v1/me', { token: asha.token })).body.profile as Profile;
    expect(me).toMatchObject({ gamesPlayed: 1, gamesWon: ashaWon ? 1 : 0, coins: COINS.welcome + expected });

    const client = new pg.Client({ connectionString: dbUrl });
    await client.connect();
    try {
      const games = await client.query('SELECT id FROM games WHERE room_code = $1', [welcome.code]);
      expect(games.rows).toHaveLength(1);
      const players = await client.query('SELECT seat, user_id, won FROM game_players WHERE game_id = $1 ORDER BY seat', [
        games.rows[0].id,
      ]);
      expect(players.rows.map((r) => [r.seat, r.user_id])).toEqual([
        [0, asha.profile.id],
        [2, null],
      ]);
      expect(players.rows.filter((r) => r.won)).toHaveLength(1);
    } finally {
      await client.end();
    }
  }, 180_000);

  it('pays the daily bonus once a day', async () => {
    const { token } = await newGuest('Daily');
    const first = await api('POST', '/v1/me/daily', { token });
    expect(first.body).toMatchObject({ claimed: true, coins: COINS.dailyBase });
    expect(first.body.profile).toMatchObject({
      coins: COINS.welcome + COINS.dailyBase,
      daily: { available: false, streak: 1, amount: dailyBonus(2) },
    });
    const again = await api('POST', '/v1/me/daily', { token });
    expect(again.body).toMatchObject({ claimed: false, coins: 0 });
    expect(again.body.profile.coins).toBe(COINS.welcome + COINS.dailyBase);
    expect((await api('POST', '/v1/me/daily')).status).toBe(401);
  });

  it('grows the daily bonus for days in a row, and starts again after a missed day', async () => {
    const { profile } = await newGuest('Streak');
    const claim = (day: string) => withDb(dbUrl, (db) => claimDaily(db, profile.id, day));
    expect((await claim('2030-01-01')).coins).toBe(dailyBonus(1));
    expect((await claim('2030-01-02')).coins).toBe(dailyBonus(2));
    expect((await claim('2030-01-02')).claimed).toBe(false);
    expect((await claim('2030-01-03')).coins).toBe(dailyBonus(3));
    const afterGap = await claim('2030-01-05');
    expect(afterGap.coins).toBe(dailyBonus(1));
    expect(afterGap.profile.daily.streak).toBe(1);
    // The bonus stops growing after a few days.
    expect(dailyBonus(30)).toBe(COINS.dailyBase + COINS.dailyStep * COINS.dailyMaxSteps);
  });

  it('never pays the same reward twice', async () => {
    const { profile } = await newGuest('Ledger');
    const pay = () => withDb(dbUrl, (db) => db.tx((tx) => credit(tx, profile.id, 50, 'test', 'once')));
    expect(await pay()).toBe(true);
    expect(await pay()).toBe(false);
    const coins = await withDb(dbUrl, (db) => db.query<{ coins: string }>('SELECT coins FROM users WHERE id = $1', [profile.id]));
    expect(Number(coins[0]!.coins)).toBe(COINS.welcome + 50);
  });

  it('lets people play with an unknown account token (the game just is not counted)', async () => {
    const { host } = await createRoom('Asha', 2, 'stale-token-from-an-old-install');
    expect((await host.room()).seats[0]).toMatchObject({ name: 'Asha', kind: 'human' });
  });

  it('signs in with Google: keeps the guest progress, then finds the same account on another phone', async () => {
    const sub = `google-${Date.now()}`;
    // Phone 1: a guest who has collected a daily bonus, then signs in.
    const phone1 = await newGuest('Player');
    await api('POST', '/v1/me/daily', { token: phone1.token });
    const upgraded = await api('POST', '/v1/auth/google', { ip: nextIp(),
      token: phone1.token,
      body: { idToken: googleToken({ sub, email: 'asha@example.com', given_name: 'Asha' }) },
    });
    expect(upgraded.status).toBe(200);
    expect(upgraded.body).toMatchObject({ outcome: 'upgraded', token: phone1.token });
    expect(upgraded.body.profile).toMatchObject({
      id: phone1.profile.id,
      guest: false,
      email: 'asha@example.com',
      name: 'Asha', // was still the default name
      coins: COINS.welcome + COINS.dailyBase,
    });

    // Phone 2: a fresh guest signs in with the same Google account and gets the same account back.
    const phone2 = await newGuest('Someone');
    const existing = await api('POST', '/v1/auth/google', { ip: nextIp(), token: phone2.token, body: { idToken: googleToken({ sub }) } });
    expect(existing.body.outcome).toBe('existing');
    expect(existing.body.token).not.toBe(phone2.token);
    expect(existing.body.profile).toMatchObject({ id: phone1.profile.id, coins: COINS.welcome + COINS.dailyBase });
    // Both phones are signed in to it.
    expect((await api('GET', '/v1/me', { token: phone1.token })).body.profile.id).toBe(phone1.profile.id);
    expect((await api('GET', '/v1/me', { token: existing.body.token })).body.profile.id).toBe(phone1.profile.id);
  });

  it('creates a new account for a first-time Google sign-in without a guest', async () => {
    const created = await api('POST', '/v1/auth/google', { ip: nextIp(),
      body: { idToken: googleToken({ sub: `new-${Date.now()}`, given_name: 'Ravi', email: 'ravi@example.com' }) },
    });
    expect(created.body).toMatchObject({ outcome: 'created' });
    expect(created.body.profile).toMatchObject({ name: 'Ravi', guest: false, coins: COINS.welcome });
  });

  it('refuses Google tokens that are forged, expired, for another app, or unverified emails', async () => {
    const sub = `bad-${Date.now()}`;
    const status = async (idToken: string) => (await api('POST', '/v1/auth/google', { ip: nextIp(), body: { idToken } })).status;
    expect(await status(googleToken({ sub, aud: 'someone-elses-app' }))).toBe(401);
    expect(await status(googleToken({ sub, exp: Math.floor(Date.now() / 1000) - 3600 }))).toBe(401);
    expect(await status(googleToken({ sub, iss: 'https://evil.example.com' }))).toBe(401);
    expect(await status(googleToken({ sub }, { kid: 'unknown-key' }))).toBe(401);
    // A real token with the claims changed after signing.
    const [h, , s] = googleToken({ sub }).split('.');
    const forged = Buffer.from(JSON.stringify({ ...claimsFor({ sub: 'someone-else' }) })).toString('base64url');
    expect(await status(`${h}.${forged}.${s}`)).toBe(401);
    expect(await status('not.a.jwt')).toBe(401);
    // An address Google hasn't verified isn't stored.
    const unverified = await api('POST', '/v1/auth/google', { ip: nextIp(),
      body: { idToken: googleToken({ sub, email: 'x@example.com', email_verified: false }) },
    });
    expect(unverified.body.profile.email).toBeNull();
  });

  it('signs out: the session stops working', async () => {
    // (A Google sign-in: this suite has used up the guest allowance for the minute by now.)
    const { token } = (await api('POST', '/v1/auth/google', { ip: nextIp(), body: { idToken: googleToken({ sub: `out-${Date.now()}` }) } }))
      .body as { token: string };
    expect((await api('GET', '/v1/me', { token })).status).toBe(200);
    expect((await api('POST', '/v1/auth/signout', { token })).status).toBe(200);
    expect((await api('GET', '/v1/me', { token })).status).toBe(401);
  });

  it('deletes an account for good: profile, sessions, coins and coin history', async () => {
    const sub = `delete-${Date.now()}`;
    const signedIn = await api('POST', '/v1/auth/google', {
      ip: nextIp(),
      body: { idToken: googleToken({ sub, email: 'gone@example.com', given_name: 'Gone' }) },
    });
    const { token, profile } = signedIn.body as { token: string; profile: Profile };
    await api('POST', '/v1/me/daily', { token });

    expect((await api('DELETE', '/v1/me')).status).toBe(401);
    expect((await api('DELETE', '/v1/me', { token })).status).toBe(200);
    expect((await api('GET', '/v1/me', { token })).status).toBe(401);
    expect((await api('DELETE', '/v1/me', { token })).status).toBe(401);

    const left = await withDb(dbUrl, async (db) => ({
      users: await db.query('SELECT 1 FROM users WHERE id = $1 OR google_sub = $2 OR email = $3', [profile.id, sub, 'gone@example.com']),
      sessions: await db.query('SELECT 1 FROM sessions WHERE user_id = $1', [profile.id]),
      ledger: await db.query('SELECT 1 FROM coin_ledger WHERE user_id = $1', [profile.id]),
    }));
    expect(left).toEqual({ users: [], sessions: [], ledger: [] });

    // Signing in with the same Google account afterwards starts from scratch.
    const again = await api('POST', '/v1/auth/google', { ip: nextIp(), body: { idToken: googleToken({ sub }) } });
    expect(again.body.outcome).toBe('created');
    expect(again.body.profile.id).not.toBe(profile.id);
  });

  it('keeps finished games for the other players, without the deleted player in them', async () => {
    const made = async (name: string) =>
      (await api('POST', '/v1/auth/google', { ip: nextIp(), body: { idToken: googleToken({ sub: `${name}-${Date.now()}`, given_name: name }) } }))
        .body as { token: string; profile: Profile };
    const stays = await made('Stays');
    const goes = await made('Goes');
    const game = (key: string) => ({
      key,
      code: 'TEST',
      mode: 'individual' as const,
      startedAt: Date.now(),
      players: [
        { seat: 0 as const, userId: stays.profile.id, name: 'Stays', bot: null, won: true },
        { seat: 2 as const, userId: goes.profile.id, name: 'Goes', bot: null, won: false },
      ],
    });
    await withDb(dbUrl, (db) => recordGame(db, game(`before-${Date.now()}`)));
    await api('DELETE', '/v1/me', { token: goes.token });

    const rows = await withDb(dbUrl, (db) =>
      db.query<{ name: string; user_id: string | null }>(
        'SELECT gp.name, gp.user_id FROM game_players gp JOIN game_players mine ON mine.game_id = gp.game_id WHERE mine.user_id = $1 ORDER BY gp.seat',
        [stays.profile.id],
      ),
    );
    expect(rows).toEqual([
      { name: 'Stays', user_id: stays.profile.id },
      { name: 'Player', user_id: null },
    ]);

    // A game that ends after someone deleted their account mid-game is still recorded for the others.
    const paid = await withDb(dbUrl, (db) => recordGame(db, game(`after-${Date.now()}`)));
    expect([...paid!.keys()]).toEqual([stays.profile.id]);
  });

  it('publishes a page explaining how to delete an account', async () => {
    const res = await fetch(`http://127.0.0.1:${port}/delete-account`);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/html');
    const html = await res.text();
    expect(html).toContain('Delete your Asta Chemma account');
    expect(html).toContain('ఖాతాను తొలగించండి');
  });

  // Last: it uses up this address's allowance of new guests for the minute.
  it('limits how fast one address can create guest accounts', async () => {
    let limited = false;
    for (let i = 0; i < 15 && !limited; i++) {
      limited = (await api('POST', '/v1/auth/guest', { body: { name: `G${i}` } })).status === 429;
    }
    expect(limited).toBe(true);
  });
});
