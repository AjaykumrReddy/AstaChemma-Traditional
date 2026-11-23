import type { BotLevel, GameMode, Seat } from '@asta/engine';
import {
  PROTOCOL_VERSION,
  isAcceptableName,
  normaliseCode,
  type ClientMessage,
  type ErrorCode,
  type MatchServerMessage,
  type RoomView,
  type ServerMessage,
} from '@asta/protocol';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState, Platform } from 'react-native';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { useAccountStore } from '../account/store';
import { useGameStore } from '../store/game';
import { serverUrl } from './config';

/**
 * Online play: one WebSocket to the room's server, with automatic reconnects.
 *
 * The session (room code, player id and secret token) is saved, so if the app
 * is closed or the connection drops, the player can rejoin their seat.
 */

export interface Session {
  code: string;
  playerId: string;
  token: string;
  seat: Seat;
}

export type ConnectionStatus = 'idle' | 'connecting' | 'open' | 'reconnecting';
export type OnlineErrorCode = ErrorCode | 'network';

interface OnlineStore {
  /** The name last used online (saved). */
  name: string;
  /** The seat we hold in a room (saved, for rejoining). */
  session: Session | null;
  /** The room as the server last described it. */
  room: RoomView | null;
  status: ConnectionStatus;
  error: OnlineErrorCode | null;
  /** Coins the last finished game paid (shown in the results). */
  reward: { coins: number; won: boolean } | null;
  /** Quick match: when the current turn's time runs out (this device's clock), or null. */
  turnDeadline: number | null;
  /** Quick match: looking for another player (null when not searching). */
  search: { since: number; waiting: number } | null;

  setName(name: string): void;
  /** Join the quick-match line; once matched, the session is set and we join the room. */
  findMatch(): void;
  /** Leave the quick-match line. */
  cancelMatch(): void;
  create(mode: GameMode, players: 2 | 3 | 4): void;
  join(code: string): void;
  /** Reconnect to the saved session. */
  rejoin(): void;
  /**
   * Show the online game in the game screen: switch it to online mode (the
   * local game is kept aside) and show the latest room.
   */
  openGame(): void;
  setSeat(seat: Seat, kind: 'open' | 'bot', level?: BotLevel): void;
  start(): void;
  /** Leave the room for good (the computer takes the seat mid-game). */
  leave(): void;
  /** Forget a session the server no longer knows (or the player abandoned). */
  forget(): void;
  clearError(): void;
}

// ---------------------------------------------------------------------------
// The connection
// ---------------------------------------------------------------------------

let socket: WebSocket | null = null;
/** Bumped whenever we deliberately replace or drop the socket, to ignore stale events. */
let socketId = 0;
let retries = 0;
let retryTimer: ReturnType<typeof setTimeout> | null = null;
let pingTimer: ReturnType<typeof setInterval> | null = null;
/** Keep reconnecting after unexpected drops (true while we hold a seat). */
let stayConnected = false;

const PING_MS = 25_000;
const MAX_BACKOFF_MS = 15_000;
const CONNECT_TIMEOUT_MS = 10_000;

function send(message: ClientMessage): void {
  if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message));
}

function stopTimers(): void {
  if (retryTimer) clearTimeout(retryTimer);
  if (pingTimer) clearInterval(pingTimer);
  retryTimer = null;
  pingTimer = null;
}

function closeSocket(): void {
  socketId++;
  stopTimers();
  const s = socket;
  socket = null;
  try {
    s?.close();
  } catch {
    // already closed
  }
}

/** Open a socket to /rooms/<path> and send `first` once it's open. */
function connect(path: string, first: ClientMessage, reconnecting = false): void {
  closeSocket();
  const id = ++socketId;
  useOnlineStore.setState({ status: reconnecting ? 'reconnecting' : 'connecting', error: null });
  let ws: WebSocket;
  try {
    ws = new WebSocket(`${serverUrl()}/rooms/${encodeURIComponent(path)}`);
  } catch {
    useOnlineStore.setState({ status: 'idle', error: 'network' });
    return;
  }
  socket = ws;
  // Don't sit on "Connecting…" forever: give up on this attempt after a while
  // (onclose then reports the error, or tries again when rejoining a seat).
  const giveUp = setTimeout(() => {
    if (id === socketId && ws.readyState === WebSocket.CONNECTING) ws.close();
  }, CONNECT_TIMEOUT_MS);

  ws.onopen = () => {
    clearTimeout(giveUp);
    if (id !== socketId) return;
    retries = 0;
    useOnlineStore.setState({ status: 'open' });
    ws.send(JSON.stringify(first));
    pingTimer = setInterval(() => send({ t: 'ping' }), PING_MS);
  };
  ws.onmessage = (event) => {
    if (id !== socketId) return;
    let message: ServerMessage;
    try {
      message = JSON.parse(String(event.data)) as ServerMessage;
    } catch {
      return;
    }
    handle(message);
  };
  ws.onclose = () => {
    clearTimeout(giveUp);
    if (id !== socketId) return;
    stopTimers();
    socket = null;
    const { session } = useOnlineStore.getState();
    if (stayConnected && session) scheduleReconnect(session);
    else useOnlineStore.setState({ status: 'idle', error: useOnlineStore.getState().error ?? (session ? null : 'network') });
  };
  ws.onerror = () => {
    // onclose follows and decides what to do.
  };
}

function scheduleReconnect(session: Session): void {
  useOnlineStore.setState({ status: 'reconnecting' });
  // 0.5 s, 1 s, 2 s, 4 s … up to 15 s between tries.
  const delay = Math.min(MAX_BACKOFF_MS, 500 * 2 ** retries++);
  retryTimer = setTimeout(() => rejoinSession(session), delay);
}

function rejoinSession(session: Session): void {
  stayConnected = true;
  connect(session.code, { t: 'rejoin', protocol: PROTOCOL_VERSION, ...session }, true);
}

/**
 * The account to play under (so the result counts towards it), keeping the
 * profile name in step with the name typed for this game.
 */
function accountFor(name: string): { account?: string } {
  const account = useAccountStore.getState();
  if (!account.token) return {};
  if (account.profile && name && account.profile.name !== name && isAcceptableName(name)) void account.rename(name);
  return { account: account.token };
}

/** Start online mode in the game screen, sending this player's actions to the server. */
function enterGame(seat: Seat): void {
  useGameStore.getState().enterOnline(
    {
      throw: () => send({ t: 'throw' }),
      move: (moveId) => send({ t: 'move', moveId }),
    },
    seat,
  );
}

function handle(message: ServerMessage): void {
  const store = useOnlineStore;
  switch (message.t) {
    case 'welcome': {
      stayConnected = true;
      store.setState({ session: { code: message.code, playerId: message.playerId, token: message.token, seat: message.seat } });
      return;
    }
    case 'room': {
      const { room } = message;
      // The server says how long is left, so clocks needn't agree.
      const turnDeadline = room.turnEndsIn != null ? Date.now() + room.turnEndsIn : null;
      store.setState({ room, turnDeadline });
      // Only while the game screen is showing the online game (see openGame).
      if (room.status !== 'lobby' && useGameStore.getState().mode === 'online') {
        useGameStore.getState().receiveRoom(room);
      }
      return;
    }
    case 'error': {
      store.setState({ error: message.code });
      useGameStore.getState().actionRejected();
      // These mean our saved seat is gone for good.
      if (message.code === 'bad-token' || message.code === 'no-room' || message.code === 'not-in-room') {
        if (store.getState().session) store.getState().forget();
      }
      return;
    }
    case 'reward': {
      store.setState({ reward: { coins: message.coins, won: message.won } });
      // The new balance and stats.
      void useAccountStore.getState().ensure();
      return;
    }
    case 'left':
    case 'pong':
      return;
  }
}

// ---------------------------------------------------------------------------
// Quick match: a separate socket to the waiting line (/match)
// ---------------------------------------------------------------------------

let matchSocket: WebSocket | null = null;
let matchPing: ReturnType<typeof setInterval> | null = null;
let matchRetry: ReturnType<typeof setTimeout> | null = null;
let matchRetries = 0;
const MATCH_MAX_RETRIES = 4;

function closeMatchSocket(): void {
  if (matchPing) clearInterval(matchPing);
  if (matchRetry) clearTimeout(matchRetry);
  matchPing = null;
  matchRetry = null;
  const s = matchSocket;
  matchSocket = null;
  try {
    s?.close();
  } catch {
    // already closed
  }
}

function queueForMatch(name: string): void {
  closeMatchSocket();
  let ws: WebSocket;
  try {
    ws = new WebSocket(`${serverUrl()}/match`);
  } catch {
    useOnlineStore.setState({ search: null, error: 'network' });
    return;
  }
  matchSocket = ws;
  ws.onopen = () => {
    if (ws !== matchSocket) return;
    matchRetries = 0;
    ws.send(JSON.stringify({ t: 'queue', protocol: PROTOCOL_VERSION, mode: '2p', name, ...accountFor(name) }));
    matchPing = setInterval(() => ws.readyState === WebSocket.OPEN && ws.send(JSON.stringify({ t: 'ping' })), PING_MS);
  };
  ws.onmessage = (event) => {
    if (ws !== matchSocket) return;
    let message: MatchServerMessage;
    try {
      message = JSON.parse(String(event.data)) as MatchServerMessage;
    } catch {
      return;
    }
    switch (message.t) {
      case 'queued': {
        const { search } = useOnlineStore.getState();
        if (search) useOnlineStore.setState({ search: { ...search, waiting: message.waiting } });
        return;
      }
      case 'matched': {
        closeMatchSocket();
        const session: Session = { code: message.code, playerId: message.playerId, token: message.token, seat: message.seat };
        useOnlineStore.setState({ search: null, session, room: null, reward: null });
        retries = 0;
        rejoinSession(session);
        return;
      }
      case 'error':
        closeMatchSocket();
        useOnlineStore.setState({ search: null, error: message.code });
        return;
      case 'pong':
        return;
    }
  };
  ws.onclose = () => {
    if (ws !== matchSocket) return;
    if (matchPing) clearInterval(matchPing);
    matchPing = null;
    matchSocket = null;
    // Dropped while still looking: get back in line (a new place, but the wait goes on).
    if (useOnlineStore.getState().search && matchRetries < MATCH_MAX_RETRIES) {
      matchRetry = setTimeout(() => queueForMatch(name), Math.min(MAX_BACKOFF_MS, 1000 * 2 ** matchRetries++));
    } else if (useOnlineStore.getState().search) {
      useOnlineStore.setState({ search: null, error: 'network' });
    }
  };
}

// Coming back to the app: reconnect at once if we hold a seat and the socket died.
AppState.addEventListener('change', (state) => {
  if (state !== 'active') return;
  const { session } = useOnlineStore.getState();
  if (session && stayConnected && (!socket || socket.readyState === WebSocket.CLOSED)) {
    stopTimers();
    retries = 0;
    rejoinSession(session);
  }
});

// Web: say goodbye properly when the page goes away (reload, tab closed, navigated
// off), so friends see "offline" at once rather than after the server's silence
// check. If the browser later restores the page from its cache, reconnect.
if (Platform.OS === 'web' && typeof window !== 'undefined') {
  window.addEventListener('pagehide', () => {
    if (socket) closeSocket();
  });
  window.addEventListener('pageshow', (event) => {
    const { session } = useOnlineStore.getState();
    if (event.persisted && session && stayConnected) {
      retries = 0;
      rejoinSession(session);
    }
  });
}

// ---------------------------------------------------------------------------
// The store
// ---------------------------------------------------------------------------

export const useOnlineStore = create<OnlineStore>()(
  persist(
    (set, get) => ({
      name: '',
      session: null,
      room: null,
      status: 'idle',
      error: null,
      reward: null,
      turnDeadline: null,
      search: null,

      setName(name) {
        set({ name });
      },

      findMatch() {
        const name = get().name.trim();
        get().forget();
        matchRetries = 0;
        set({ search: { since: Date.now(), waiting: 0 }, error: null });
        queueForMatch(name);
      },

      cancelMatch() {
        if (matchSocket?.readyState === WebSocket.OPEN) matchSocket.send(JSON.stringify({ t: 'cancel' }));
        set({ search: null });
        closeMatchSocket();
      },

      create(mode, players) {
        const name = get().name.trim();
        get().forget();
        stayConnected = false;
        connect('new', { t: 'create', protocol: PROTOCOL_VERSION, name, mode, players, ...accountFor(name) });
      },

      join(code) {
        const name = get().name.trim();
        const clean = normaliseCode(code);
        get().forget();
        stayConnected = false;
        connect(clean, { t: 'join', protocol: PROTOCOL_VERSION, code: clean, name, ...accountFor(name) });
      },

      rejoin() {
        const { session } = get();
        if (!session) return;
        retries = 0;
        rejoinSession(session);
      },

      openGame() {
        const { session, room } = get();
        if (!session || !room || room.status === 'lobby') return;
        if (useGameStore.getState().mode !== 'online') enterGame(session.seat);
        useGameStore.getState().receiveRoom(room);
      },

      setSeat(seat, kind, level) {
        send({ t: 'seat', seat, kind, level });
      },

      start() {
        send({ t: 'start' });
      },

      leave() {
        send({ t: 'leave' });
        get().forget();
      },

      forget() {
        stayConnected = false;
        closeSocket();
        set({ session: null, room: null, status: 'idle', reward: null, turnDeadline: null });
        useGameStore.getState().exitOnline();
      },

      clearError() {
        set({ error: null });
      },
    }),
    {
      name: 'asta-chemma/online',
      version: 1,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({ name: s.name, session: s.session }),
    },
  ),
);
