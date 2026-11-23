import type { ServerMessage } from '@asta/protocol';
import { describe, expect, it } from 'vitest';
import { Room, RoomError, type MemberData, type RoomData, type RoomTimings } from './room';

const TIMINGS: RoomTimings = {
  botThrowMs: 1000,
  botMoveMs: 800,
  awayMs: 30_000,
  abandonedMs: 600_000,
  turnMs: 20_000,
  joinMs: 15_000,
};

/** A room with a fake clock and an inbox per member. */
function setup(players = 2, mode: 'individual' | 'team' = 'individual') {
  let now = 1_000_000;
  const inbox = new Map<string, ServerMessage[]>();
  const io = { now: () => now, send: (id: string, m: ServerMessage) => inbox.set(id, [...(inbox.get(id) ?? []), m]) };
  const room = new Room(Room.create('KQ7M', mode, players, now), io, TIMINGS);
  const join = (name: string): MemberData => room.join(name, () => {});
  const last = (id: string) => [...(inbox.get(id) ?? [])].reverse().find((m) => m.t === 'room') as Extract<ServerMessage, { t: 'room' }>;
  const advance = (ms: number) => {
    now += ms;
  };
  /** Advance to the room's next wake-up and handle it. */
  const tick = () => {
    const at = room.wakeAt();
    if (at === null) return false;
    now = Math.max(now, at);
    room.wake();
    return true;
  };
  return { room, join, last, advance, tick, inbox, now: () => now, io };
}

describe('lobby', () => {
  it('seats players in order and makes the first one host', () => {
    const { room, join } = setup(3);
    const a = join('Asha');
    const b = join('Ravi');
    expect([a.seat, b.seat]).toEqual([0, 1]);
    expect(room.view().seats.map((s) => [s.seat, s.kind, s.host ?? false])).toEqual([
      [0, 'human', true],
      [1, 'human', false],
      [2, 'open', false],
    ]);
  });

  it('refuses players once full or started', () => {
    const { join, room } = setup(2);
    const a = join('A');
    join('B');
    expect(() => join('C')).toThrow(RoomError);
    room.start(a.id);
    expect(() => join('D')).toThrowError(expect.objectContaining({ code: 'already-started' }));
  });

  it('only the host changes seats or starts, and only with every seat filled', () => {
    const { join, room } = setup(3);
    const a = join('A');
    const b = join('B');
    expect(() => room.start(b.id)).toThrowError(expect.objectContaining({ code: 'not-host' }));
    expect(() => room.start(a.id)).toThrowError(expect.objectContaining({ code: 'not-ready' }));
    expect(() => room.setSeat(a.id, 1, 'bot')).toThrowError(expect.objectContaining({ code: 'illegal' }));
    room.setSeat(a.id, 2, 'bot', 'hard');
    room.start(a.id);
    expect(room.data.status).toBe('playing');
    expect(room.data.game!.players.find((p) => p.seat === 2)?.bot).toBe('hard');
  });

  it('frees a lobby seat after the grace period and passes on the host role', () => {
    const { join, room, tick } = setup(2);
    const a = join('A');
    const b = join('B');
    room.disconnected(a.id);
    expect(room.view().seats[0]).toMatchObject({ connected: false });
    tick(); // grace period over
    expect(room.view().seats[0]?.kind).toBe('open');
    expect(room.data.hostId).toBe(b.id);
  });
});

describe('play', () => {
  it('hides the random-number state and accepts only the current player', () => {
    const { join, room } = setup(2);
    const a = join('A');
    const b = join('B');
    room.start(a.id);
    expect(room.view().game!.rng).toBe(0);
    expect(room.data.game!.rng).not.toBe(0);
    expect(() => room.throw(b.id)).toThrowError(expect.objectContaining({ code: 'not-your-turn' }));
    expect(() => room.move(a.id, 'nope')).toThrowError(expect.objectContaining({ code: 'illegal' }));
    room.throw(a.id);
    expect(room.data.game!.lastThrow).not.toBeNull();
  });

  it('plays computer turns when their wake-up comes', () => {
    const { join, room, tick } = setup(2);
    const a = join('A');
    room.setSeat(a.id, 2, 'bot', 'easy');
    room.start(a.id);
    // Hand the turn to the computer: throw until it's not ours.
    while (room.data.game!.players[room.data.game!.current]!.seat === 0) {
      const g = room.data.game!;
      if (g.phase === 'awaitingThrow') room.throw(a.id);
      else room.move(a.id, g.legalMoves[0]!.id);
    }
    const version = room.data.version;
    expect(room.data.botAt).not.toBeNull();
    tick();
    expect(room.data.version).toBeGreaterThan(version); // the computer acted
  });

  it('lets the computer stand in for an away player, and hands back on rejoin', () => {
    const { join, room, tick, now } = setup(2);
    const a = join('A');
    const b = join('B');
    room.start(a.id);
    room.disconnected(b.id);
    expect(room.wakeAt()).toBe(now() + TIMINGS.awayMs);
    tick();
    expect(room.view().seats[1]).toMatchObject({ away: true, connected: false });
    room.rejoin(b.id, b.token, () => {});
    expect(room.view().seats[1]).toMatchObject({ away: false, connected: true });
    expect(() => room.rejoin(b.id, 'wrong', () => {})).toThrowError(expect.objectContaining({ code: 'bad-token' }));
  });

  it('gives a seat to the computer for good when a player leaves mid-game', () => {
    const { join, room } = setup(2);
    const a = join('A');
    const b = join('B');
    room.start(a.id);
    room.leave(b.id);
    expect(room.view().seats[1]).toMatchObject({ kind: 'bot', name: 'B', level: 'medium' });
  });

  it('pauses the computers while nobody is connected, and carries on when someone is back', () => {
    const { join, room, tick } = setup(2);
    const a = join('A');
    room.setSeat(a.id, 2, 'bot', 'easy');
    room.start(a.id);
    room.disconnected(a.id);
    tick(); // the grace period ends: away, but nobody is watching
    expect(room.view().seats[0]).toMatchObject({ away: true });
    expect(room.data.botAt).toBeNull();
    expect(room.wakeAt()).toBe(room.data.lastActivity + TIMINGS.abandonedMs); // only the clean-up is planned
    // Back again: hand the turn to the computer, and it plays on.
    room.rejoin(a.id, a.token, () => {});
    while (room.data.game!.players[room.data.game!.current]!.seat === 0) {
      const g = room.data.game!;
      if (g.phase === 'awaitingThrow') room.throw(a.id);
      else room.move(a.id, g.legalMoves[0]!.id);
    }
    expect(room.data.botAt).not.toBeNull();
  });
});

/** A quick-match room for two players, with a fake clock. */
function quick() {
  let now = 1_000_000;
  const io = { now: () => now, send: () => {} };
  const room = new Room(
    Room.createQuick('QK7M', [
      { name: 'Asha', userId: 'user-a' },
      { name: 'Ravi', userId: 'user-r' },
    ], now, TIMINGS),
    io,
    TIMINGS,
  );
  const [a, r] = room.data.members as [MemberData, MemberData];
  const tick = () => {
    const at = room.wakeAt();
    if (at === null) return false;
    now = Math.max(now, at);
    room.wake();
    return true;
  };
  const current = () => room.data.members.find((m) => m.seat === room.data.game!.players[room.data.game!.current]!.seat)!;
  return { room, a, r, tick, current, now: () => now };
}

describe('quick match', () => {
  it('starts at once, with both seats reserved for the matched players', () => {
    const { room, a, r } = quick();
    expect(room.data.status).toBe('playing');
    expect(room.view().seats.map((s) => [s.kind, s.name, s.connected])).toEqual([
      ['human', 'Asha', false],
      ['human', 'Ravi', false],
    ]);
    expect(room.view()).toMatchObject({ quick: true, turnEndsIn: TIMINGS.joinMs + TIMINGS.turnMs });
    // Each joins with their ticket, exactly like rejoining.
    room.rejoin(a.id, a.token, () => {});
    room.rejoin(r.id, r.token, () => {});
    expect(room.view().seats.every((s) => s.connected)).toBe(true);
  });

  it('plays a turn for a player whose time runs out, and hands over to the computer after three in a row', () => {
    const { room, a, r, tick, current } = quick();
    room.rejoin(a.id, a.token, () => {});
    room.rejoin(r.id, r.token, () => {});
    const slow = current();
    const version = room.data.version;
    tick(); // the first turn's time runs out
    expect(room.data.version).toBeGreaterThan(version); // the server acted for them
    expect(slow.missed).toBe(1);
    // Keep letting every turn time out: soon both are away and the computer plays on.
    for (let i = 0; i < 40 && !(a.away && r.away); i++) tick();
    expect(a.away && r.away).toBe(true);
    expect(room.view().seats.every((s) => s.away)).toBe(true);
  });

  it('hands back control as soon as an away player acts again', () => {
    const { room, a, r, tick, current } = quick();
    room.rejoin(a.id, a.token, () => {});
    room.rejoin(r.id, r.token, () => {});
    for (let i = 0; i < 60 && !(current().away && room.data.game!.phase === 'awaitingThrow'); i++) tick();
    const p = current();
    expect(p.away).toBe(true);
    room.throw(p.id); // they're back
    expect(p.away).toBe(false);
    expect(p.missed).toBe(0);
  });

  it('plays on with the computer for a matched player who never arrives, and gives them no credit', () => {
    const { room, a, tick } = quick();
    room.rejoin(a.id, a.token, () => {});
    // Asha stops playing too; the game plays out on the timer and the computer.
    for (let i = 0; i < 20_000 && room.data.status === 'playing'; i++) tick();
    expect(room.data.status).toBe('finished');
    const result = room.result()!;
    expect(result.players.map((p) => p.userId)).toEqual(['user-a', null]); // Ravi never came
  });
});

describe('persistence', () => {
  it('survives being saved and reloaded mid-game, exactly', () => {
    const { join, room, io } = setup(2);
    const a = join('A');
    const b = join('B');
    room.start(a.id);
    room.throw(a.id);
    // Save as JSON (as the Durable Object does) and load into a fresh Room.
    const saved = JSON.parse(JSON.stringify(room.data)) as RoomData;
    const reloaded = new Room(saved, io, TIMINGS);
    expect(reloaded.view()).toEqual(room.view());
    // The reloaded room plays on with the same hidden RNG: same next throw.
    const g = reloaded.data.game!;
    const actor = g.players[g.current]!.seat === 0 ? a : b;
    const throwAllowed = g.phase === 'awaitingThrow' || g.canHold;
    if (throwAllowed) {
      room.throw(actor.id);
      reloaded.throw(actor.id);
      expect(reloaded.data.game!.lastThrow).toEqual(room.data.game!.lastThrow);
    }
  });

  it('is removed once abandoned long enough', () => {
    const { join, room, advance } = setup(2);
    const a = join('A');
    room.disconnected(a.id);
    expect(room.isExpired()).toBe(false);
    advance(TIMINGS.abandonedMs + 1);
    expect(room.isExpired()).toBe(true);
  });
});
