import { DEFAULT_BOARD, type BoardId } from '@asta/engine';
import { DurableObject } from 'cloudflare:workers';
import {
  BOARDS_PROTOCOL_VERSION,
  MAX_MESSAGE_BYTES,
  isAcceptableName,
  supportedProtocol,
  parseMatchMessage,
  type MatchServerMessage,
} from '@asta/protocol';
import { userIdForToken } from './api';
import { freshCode } from './codes';
import { reportError } from './sentry';
import type { Env } from './worker';

/**
 * Quick match: the waiting lines for two-player games, one per board.
 *
 * Players connect to /match and say they're ready; the line is kept in their
 * sockets' attachments, so it survives hibernation. A Durable Object handles
 * one thing at a time, so nobody can be matched twice. Two players waiting →
 * a fresh room is created with their seats reserved, and each gets a ticket
 * (player id + token) to join it exactly as if rejoining. Players are only
 * matched with others who chose the same board.
 */

interface Ticket {
  state: 'connected' | 'waiting' | 'matching' | 'done';
  name?: string;
  userId?: string | null;
  /** When they joined the line (first come, first matched). */
  since?: number;
  /** Which line: the board they want (missing: 5×5). */
  board?: BoardId;
}

/** A waiting socket silent this long (two missed pings) is treated as gone. */
const SILENT_MS = 60_000;
const PLAYERS_PER_GAME = 2;

export class Matchmaker extends DurableObject<Env> {
  /** One matching pass at a time; a request during one asks for another pass. */
  private matching = false;
  private again = false;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('{"t":"ping"}', '{"t":"pong"}'));
  }

  async fetch(): Promise<Response> {
    const [client, server] = Object.values(new WebSocketPair()) as [WebSocket, WebSocket];
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment({ state: 'connected' } satisfies Ticket);
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws: WebSocket, raw: string | ArrayBuffer): Promise<void> {
    const ticket = ws.deserializeAttachment() as Ticket;
    const send = (message: MatchServerMessage) => safeSend(ws, message);
    const message = typeof raw === 'string' && raw.length <= MAX_MESSAGE_BYTES ? parseMatchMessage(raw) : null;
    if (!message) return send({ t: 'error', code: 'bad-message', message: 'That message was not understood.' });

    if (message.t === 'ping') return send({ t: 'pong' });
    if (message.t === 'cancel') {
      if (ticket.state === 'waiting') ws.serializeAttachment({ ...ticket, state: 'done' } satisfies Ticket);
      ws.close(1000, 'cancelled');
      this.announce();
      return;
    }

    // Joining the line.
    if (!supportedProtocol(message.protocol)) return send({ t: 'error', code: 'version', message: 'Please update the app to play online.' });
    if (!isAcceptableName(message.name)) return send({ t: 'error', code: 'bad-name', message: 'Please choose a different name.' });
    if (ticket.state !== 'connected') return;
    const board = message.board ?? DEFAULT_BOARD;
    if (board !== DEFAULT_BOARD && message.protocol < BOARDS_PROTOCOL_VERSION) {
      return send({ t: 'error', code: 'version', message: 'Please update the app to play on this board.' });
    }
    const userId = await userIdForToken(this.env, message.account);
    ws.serializeAttachment({ state: 'waiting', name: message.name, userId, since: Date.now(), board } satisfies Ticket);
    await this.match();
    this.announce();
  }

  async webSocketClose(): Promise<void> {
    this.announce();
  }

  async webSocketError(): Promise<void> {
    this.announce();
  }

  /** Everyone still waiting, first come first. Sockets gone quiet are dropped. */
  private line(): { ws: WebSocket; ticket: Ticket }[] {
    const now = Date.now();
    const line: { ws: WebSocket; ticket: Ticket }[] = [];
    for (const ws of this.ctx.getWebSockets()) {
      const ticket = ws.deserializeAttachment() as Ticket | null;
      if (ticket?.state !== 'waiting') continue;
      const heard = Math.max(ticket.since ?? 0, this.ctx.getWebSocketAutoResponseTimestamp(ws)?.getTime() ?? 0);
      if (now - heard > SILENT_MS) {
        ws.serializeAttachment({ ...ticket, state: 'done' } satisfies Ticket);
        try {
          ws.close(1001, 'no heartbeat');
        } catch {
          // already closing
        }
        continue;
      }
      line.push({ ws, ticket });
    }
    return line.sort((a, b) => (a.ticket.since ?? 0) - (b.ticket.since ?? 0));
  }

  /** Tell everyone waiting how many are in their line (the same board). */
  private announce(): void {
    const line = this.line();
    const counts = new Map<BoardId, number>();
    for (const { ticket } of line) counts.set(boardOf(ticket), (counts.get(boardOf(ticket)) ?? 0) + 1);
    for (const { ws, ticket } of line) safeSend(ws, { t: 'queued', waiting: counts.get(boardOf(ticket)) ?? 1 });
  }

  /** Pair up everyone who can be paired. */
  private async match(): Promise<void> {
    if (this.matching) {
      this.again = true;
      return;
    }
    this.matching = true;
    try {
      do {
        this.again = false;
        for (;;) {
          const group = this.nextGroup();
          if (!group) break;
          // Reserve them first: awaiting the room lets other messages in.
          for (const p of group) p.ws.serializeAttachment({ ...p.ticket, state: 'matching' } satisfies Ticket);
          const seats = await this.startRoom(group, boardOf(group[0]!.ticket));
          if (!seats) {
            for (const p of group) p.ws.serializeAttachment({ ...p.ticket, state: 'waiting' } satisfies Ticket);
            break; // try again on the next arrival
          }
          group.forEach((p, i) => {
            const seat = seats.members[i]!;
            safeSend(p.ws, { t: 'matched', code: seats.code, playerId: seat.playerId, token: seat.token, seat: seat.seat });
            p.ws.serializeAttachment({ ...p.ticket, state: 'done' } satisfies Ticket);
            p.ws.close(1000, 'matched');
          });
        }
      } while (this.again);
    } finally {
      this.matching = false;
    }
  }

  /**
   * The longest-waiting players who can play each other: on the same board,
   * and never someone with themselves.
   */
  private nextGroup(): { ws: WebSocket; ticket: Ticket }[] | null {
    const groups = new Map<BoardId, { ws: WebSocket; ticket: Ticket }[]>();
    for (const p of this.line()) {
      const group = groups.get(boardOf(p.ticket)) ?? [];
      groups.set(boardOf(p.ticket), group);
      if (p.ticket.userId && group.some((g) => g.ticket.userId === p.ticket.userId)) continue;
      group.push(p);
      if (group.length === PLAYERS_PER_GAME) {
        // Who sits where (and so who throws first) is down to chance, not who queued first.
        return group.sort(() => Math.random() - 0.5);
      }
    }
    return null;
  }

  private async startRoom(group: { ticket: Ticket }[], board: BoardId) {
    try {
      const code = await freshCode(this.env.GAME_ROOM);
      if (!code) return null;
      const members = await this.env.GAME_ROOM.getByName(code).createQuickMatch(
        code,
        group.map((p) => ({ name: p.ticket.name ?? 'Player', userId: p.ticket.userId ?? null })),
        board,
      );
      return members ? { code, members } : null;
    } catch (error) {
      console.error('could not start a quick match', error);
      reportError(error);
      return null;
    }
  }
}

const boardOf = (ticket: Ticket): BoardId => ticket.board ?? DEFAULT_BOARD;

function safeSend(ws: WebSocket, message: MatchServerMessage): void {
  try {
    ws.send(JSON.stringify(message));
  } catch {
    // closing
  }
}
