import { randomInt } from 'node:crypto';
import { createServer, type Server } from 'node:http';
import {
  CODE_ALPHABET,
  CODE_LENGTH,
  MAX_MESSAGE_BYTES,
  PROTOCOL_VERSION,
  isValidCode,
  parseClientMessage,
  type ServerMessage,
} from '@asta/protocol';
import { WebSocket, WebSocketServer } from 'ws';
import { DEFAULT_TIMINGS, Room, RoomError, type Connection, type RoomTimings } from './room';

export interface ServerOptions {
  port: number;
  host?: string;
  timings?: RoomTimings;
  /** Rooms with no connected players are removed after this long. */
  abandonedRoomMs?: number;
}

export interface GameServer {
  port: number;
  rooms: Map<string, Room>;
  close(): Promise<void>;
}

/** A connected socket and the room seat it is bound to, if any. */
interface Client extends Connection {
  socket: WebSocket;
  room: Room | null;
  memberId: string | null;
}

function newCode(taken: Map<string, Room>): string {
  for (;;) {
    let code = '';
    for (let i = 0; i < CODE_LENGTH; i++) code += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
    if (!taken.has(code)) return code;
  }
}

/**
 * The online game server: an HTTP server (with /health) carrying a WebSocket
 * server. Each socket can create, join or rejoin one room and then play in it.
 */
export async function startServer(options: ServerOptions): Promise<GameServer> {
  const timings = options.timings ?? DEFAULT_TIMINGS;
  const abandonedRoomMs = options.abandonedRoomMs ?? 10 * 60_000;
  const rooms = new Map<string, Room>();

  const http: Server = createServer((req, res) => {
    if (req.url === '/health') {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ ok: true, rooms: rooms.size, protocol: PROTOCOL_VERSION }));
      return;
    }
    res.writeHead(404).end();
  });
  const wss = new WebSocketServer({ server: http, maxPayload: MAX_MESSAGE_BYTES });

  wss.on('connection', (socket) => {
    const client: Client = {
      socket,
      room: null,
      memberId: null,
      send(message: ServerMessage) {
        if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message));
      },
    };
    const fail = (code: RoomError['code'], message: string) => client.send({ t: 'error', code, message });

    socket.on('message', (data) => {
      const message = parseClientMessage(data.toString());
      if (!message) return fail('bad-message', 'That message was not understood.');
      try {
        switch (message.t) {
          case 'ping':
            client.send({ t: 'pong' });
            return;
          case 'create':
          case 'join':
          case 'rejoin': {
            if (message.protocol !== PROTOCOL_VERSION) return fail('version', 'Please update the app to play online.');
            if (client.room) return fail('illegal', 'You are already in a room.');
            let room: Room | undefined;
            let member;
            if (message.t === 'create') {
              room = new Room(newCode(rooms), message.mode, message.players, timings);
              rooms.set(room.code, room);
              member = room.join(message.name, client);
            } else {
              room = isValidCode(message.code) ? rooms.get(message.code) : undefined;
              if (!room) return fail('no-room', 'No room with that code.');
              member = message.t === 'join' ? room.join(message.name, client) : room.rejoin(message.playerId, message.token, client);
            }
            client.room = room;
            client.memberId = member.id;
            return;
          }
        }
        // Everything else needs a seat in a room.
        const { room, memberId } = client;
        if (!room || !memberId) return fail('not-in-room', 'Join a room first.');
        switch (message.t) {
          case 'seat':
            room.setSeat(memberId, message.seat, message.kind, message.level);
            return;
          case 'start':
            room.start(memberId);
            return;
          case 'throw':
            room.throw(memberId);
            return;
          case 'move':
            room.move(memberId, message.moveId);
            return;
          case 'leave':
            room.leave(memberId);
            client.room = null;
            client.memberId = null;
            return;
        }
      } catch (error) {
        if (error instanceof RoomError) return fail(error.code, error.message);
        console.error(error);
        fail('illegal', 'Something went wrong.');
      }
    });

    socket.on('close', () => {
      if (client.room && client.memberId) client.room.disconnected(client.memberId, client);
    });
  });

  // Remove rooms nobody is connected to any more.
  const sweeper = setInterval(() => {
    const now = Date.now();
    for (const [code, room] of rooms) {
      if (room.isAbandoned() && now - room.lastActivity > abandonedRoomMs) {
        room.dispose();
        rooms.delete(code);
      }
    }
  }, Math.min(60_000, abandonedRoomMs));

  await new Promise<void>((resolve) => http.listen(options.port, options.host ?? '0.0.0.0', resolve));
  const address = http.address();
  const port = typeof address === 'object' && address ? address.port : options.port;

  return {
    port,
    rooms,
    close: () =>
      new Promise<void>((resolve) => {
        clearInterval(sweeper);
        for (const room of rooms.values()) room.dispose();
        for (const socket of wss.clients) socket.terminate();
        wss.close(() => http.close(() => resolve()));
      }),
  };
}
