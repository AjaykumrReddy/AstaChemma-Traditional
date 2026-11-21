import { DurableObject } from 'cloudflare:workers';
import {
  CODE_ALPHABET,
  CODE_LENGTH,
  MAX_MESSAGE_BYTES,
  PROTOCOL_VERSION,
  isValidCode,
  normaliseCode,
  parseClientMessage,
  type ServerMessage,
} from '@asta/protocol';
import { DEFAULT_TIMINGS, Room, RoomError, type RoomData, type RoomTimings } from './room';

/**
 * Cloudflare entry point.
 *
 *   GET /health              → { ok, protocol }
 *   WS  /rooms/new           → a new room with a fresh code (then send "create")
 *   WS  /rooms/:code         → an existing room (then send "join" or "rejoin")
 *
 * Each room is a Durable Object named by its code. It keeps the room in its
 * own SQLite-backed storage, accepts WebSockets with the Hibernation API (idle
 * rooms cost nothing), and uses its single storage alarm for every timed event.
 */

export interface Env {
  GAME_ROOM: DurableObjectNamespace<GameRoom>;
  /** Optional overrides (tests use tiny values). */
  BOT_THROW_MS?: string;
  BOT_MOVE_MS?: string;
  AWAY_MS?: string;
  ABANDONED_MS?: string;
  /** Messages allowed per socket per 10 seconds (default 60; tests raise it). */
  RATE_MAX_MESSAGES?: string;
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

function randomCode(): string {
  const bytes = new Uint8Array(CODE_LENGTH);
  crypto.getRandomValues(bytes);
  return [...bytes].map((b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join('');
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === '/health') return json({ ok: true, protocol: PROTOCOL_VERSION });

    const match = url.pathname.match(/^\/rooms\/([^/]+)$/);
    if (!match) return json({ error: 'not found' }, 404);
    if (request.headers.get('Upgrade') !== 'websocket') return json({ error: 'expected a WebSocket' }, 426);

    let code = normaliseCode(decodeURIComponent(match[1]!));
    if (code === 'NEW') {
      // Find a code that isn't in use. With 32^4 codes and short-lived rooms,
      // a clash is rare; a few tries is plenty.
      for (let attempt = 0; ; attempt++) {
        code = randomCode();
        const inUse = await env.GAME_ROOM.getByName(code).exists();
        if (!inUse) break;
        if (attempt >= 8) return json({ error: 'busy, try again' }, 503);
      }
      url.searchParams.set('create', '1');
    } else if (!isValidCode(code)) {
      return json({ error: 'bad room code' }, 400);
    }
    url.searchParams.set('code', code);
    return env.GAME_ROOM.getByName(code).fetch(new Request(url, request));
  },
} satisfies ExportedHandler<Env>;

/** What each socket remembers across hibernation. */
interface Attachment {
  code: string;
  /** Allowed to create the room (the socket came in through /rooms/new). */
  create: boolean;
  memberId: string | null;
}

/** Per-socket message budget: generous for a person playing (a few taps a second at most), stops floods. */
const RATE_WINDOW_MS = 10_000;
const DEFAULT_RATE_MAX_MESSAGES = 60;

export class GameRoom extends DurableObject<Env> {
  private room: Room | null = null;
  private readonly timings: RoomTimings;
  private readonly rateMax: number;
  /** Message counts per socket (in memory only; fine to lose on hibernation). */
  private readonly rates = new Map<WebSocket, { start: number; count: number }>();

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    const n = (v: string | undefined, fallback: number) => (v !== undefined && v !== '' ? Number(v) : fallback);
    this.timings = {
      botThrowMs: n(env.BOT_THROW_MS, DEFAULT_TIMINGS.botThrowMs),
      botMoveMs: n(env.BOT_MOVE_MS, DEFAULT_TIMINGS.botMoveMs),
      awayMs: n(env.AWAY_MS, DEFAULT_TIMINGS.awayMs),
      abandonedMs: n(env.ABANDONED_MS, DEFAULT_TIMINGS.abandonedMs),
    };
    this.rateMax = n(env.RATE_MAX_MESSAGES, DEFAULT_RATE_MAX_MESSAGES);
    // Keep-alive pings are answered without waking the room.
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('{"t":"ping"}', '{"t":"pong"}'));
  }

  /** Whether a room lives here (used by the Worker when picking a new code). */
  async exists(): Promise<boolean> {
    return this.load() !== null;
  }

  private load(): Room | null {
    if (this.room) return this.room;
    const data = this.ctx.storage.kv.get<RoomData>('room');
    if (data) this.room = this.makeRoom(data);
    return this.room;
  }

  private makeRoom(data: RoomData): Room {
    return new Room(
      data,
      {
        now: () => Date.now(),
        send: (memberId, message) => this.sendToMember(memberId, message),
      },
      this.timings,
    );
  }

  /** Save the room and point the alarm at its next wake-up (or clear everything if it's done). */
  private async persist(): Promise<void> {
    const room = this.room;
    if (!room) return;
    if (room.isExpired()) {
      for (const ws of this.ctx.getWebSockets()) ws.close(1000, 'room closed');
      this.room = null;
      await this.ctx.storage.deleteAll();
      return;
    }
    this.ctx.storage.kv.put('room', room.data);
    const wakeAt = room.wakeAt();
    if (wakeAt === null) await this.ctx.storage.deleteAlarm();
    else await this.ctx.storage.setAlarm(wakeAt);
  }

  private sendToMember(memberId: string, message: ServerMessage): void {
    const text = JSON.stringify(message);
    for (const ws of this.ctx.getWebSockets()) {
      const att = ws.deserializeAttachment() as Attachment | null;
      if (att?.memberId === memberId) safeSend(ws, text);
    }
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const code = url.searchParams.get('code') ?? '';
    const [client, server] = Object.values(new WebSocketPair()) as [WebSocket, WebSocket];
    this.ctx.acceptWebSocket(server);
    const attachment: Attachment = { code, create: url.searchParams.get('create') === '1', memberId: null };
    server.serializeAttachment(attachment);
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws: WebSocket, raw: string | ArrayBuffer): Promise<void> {
    const att = ws.deserializeAttachment() as Attachment;
    const fail = (code: RoomError['code'], message: string) => safeSend(ws, JSON.stringify({ t: 'error', code, message }));

    if (typeof raw !== 'string' || raw.length > MAX_MESSAGE_BYTES) return fail('bad-message', 'That message was not understood.');
    if (!this.withinRate(ws)) {
      fail('bad-message', 'Too many messages.');
      ws.close(1008, 'too many messages');
      return;
    }
    const message = parseClientMessage(raw);
    if (!message) return fail('bad-message', 'That message was not understood.');

    try {
      if (message.t === 'ping') return safeSend(ws, JSON.stringify({ t: 'pong' }));

      if (message.t === 'create' || message.t === 'join' || message.t === 'rejoin') {
        if (message.protocol !== PROTOCOL_VERSION) return fail('version', 'Please update the app to play online.');
        if (att.memberId) return fail('illegal', 'You are already in this room.');
        const attach = (memberId: string, seat: number, token: string) => {
          ws.serializeAttachment({ ...att, memberId } satisfies Attachment);
          safeSend(ws, JSON.stringify({ t: 'welcome', code: att.code, playerId: memberId, token, seat } as ServerMessage));
        };

        let room = this.load();
        if (message.t === 'create') {
          if (!att.create || room) return fail('illegal', 'This room already exists.');
          room = this.room = this.makeRoom(Room.create(att.code, message.mode, message.players, Date.now()));
          room.join(message.name, (m) => attach(m.id, m.seat, m.token));
        } else {
          if (!room) return fail('no-room', 'No room with that code.');
          if (message.t === 'join') room.join(message.name, (m) => attach(m.id, m.seat, m.token));
          else {
            // A newer connection replaces any older one for the same player.
            for (const other of this.ctx.getWebSockets()) {
              const o = other.deserializeAttachment() as Attachment | null;
              if (other !== ws && o?.memberId === message.playerId) {
                other.serializeAttachment({ ...o, memberId: null } satisfies Attachment);
                other.close(1000, 'replaced by a newer connection');
              }
            }
            room.rejoin(message.playerId, message.token, (m) => attach(m.id, m.seat, m.token));
          }
        }
        await this.persist();
        return;
      }

      const room = this.load();
      if (!room || !att.memberId) return fail('not-in-room', 'Join a room first.');
      switch (message.t) {
        case 'seat':
          room.setSeat(att.memberId, message.seat, message.kind, message.level);
          break;
        case 'start':
          room.start(att.memberId);
          break;
        case 'throw':
          room.throw(att.memberId);
          break;
        case 'move':
          room.move(att.memberId, message.moveId);
          break;
        case 'leave':
          room.leave(att.memberId);
          ws.serializeAttachment({ ...att, memberId: null } satisfies Attachment);
          break;
      }
      await this.persist();
    } catch (error) {
      if (error instanceof RoomError) return fail(error.code, error.message);
      console.error('room error', error);
      fail('illegal', 'Something went wrong.');
    }
  }

  async webSocketClose(ws: WebSocket): Promise<void> {
    this.rates.delete(ws);
    const att = ws.deserializeAttachment() as Attachment | null;
    if (!att?.memberId) return;
    const room = this.load();
    if (!room) return;
    // Only "disconnected" if this was the player's last open connection.
    const stillConnected = this.ctx
      .getWebSockets()
      .some((other) => other !== ws && (other.deserializeAttachment() as Attachment | null)?.memberId === att.memberId);
    if (!stillConnected) {
      room.disconnected(att.memberId);
      await this.persist();
    }
  }

  async webSocketError(ws: WebSocket): Promise<void> {
    await this.webSocketClose(ws);
  }

  async alarm(): Promise<void> {
    const room = this.load();
    if (!room) return;
    try {
      room.wake();
    } catch (error) {
      console.error('alarm error', error);
    }
    await this.persist();
  }

  private withinRate(ws: WebSocket): boolean {
    const now = Date.now();
    const r = this.rates.get(ws);
    if (!r || now - r.start > RATE_WINDOW_MS) {
      this.rates.set(ws, { start: now, count: 1 });
      return true;
    }
    r.count++;
    return r.count <= this.rateMax;
  }
}

function safeSend(ws: WebSocket, text: string): void {
  try {
    ws.send(text);
  } catch {
    // The socket is closing; the close handler tidies up.
  }
}
