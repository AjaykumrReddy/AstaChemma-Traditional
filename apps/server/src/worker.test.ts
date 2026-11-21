import { PROTOCOL_VERSION, type ClientMessage, type RoomView, type ServerMessage } from '@asta/protocol';
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
    error: () => next((m): m is Extract<ServerMessage, { t: 'error' }> => m.t === 'error'),
    close: () => socket.close(),
    /** Go quiet without closing, like a phone that lost signal. */
    goSilent: () => clearInterval(pinger),
  };
}
type TestClient = Awaited<ReturnType<typeof connect>>;

async function createRoom(name: string, players: 2 | 3 | 4 = 2) {
  const host = await connect('new');
  host.send({ t: 'create', protocol: P, name, mode: 'individual', players });
  const welcome = await host.welcome();
  return { host, welcome };
}

async function joinRoom(code: string, name: string) {
  const guest = await connect(code);
  guest.send({ t: 'join', protocol: P, code, name });
  return { guest, welcome: await guest.welcome() };
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
