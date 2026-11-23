import { describe, expect, it } from 'vitest';
import {
  BOARDS,
  boardOf,
  YARD_INDEX,
  applyMove,
  applyThrow,
  cellKey,
  chooseBotAction,
  greedyBotAction,
  searchBotAction,
  createGame,
  expectedTurnsToFinish,
  isSafeCell,
  makeThrow,
  stepsFor,
  entryProgress,
  scoreForOpen,
  throwShells,
  type GameConfig,
  type GameState,
  type Seat,
} from './index';

const B5 = BOARDS['5x5'];
const HOME_INDEX = B5.home;
const routeFor = (seat: Seat) => B5.routes[seat];

const open = (n: number) => makeThrow([0, 1, 2, 3, 4].map((i) => i < n));

const twoPlayers: GameConfig = {
  mode: 'individual',
  players: [
    { name: 'A', seat: 0 },
    { name: 'B', seat: 2 },
  ],
};

const fourPlayers = (mode: 'individual' | 'team'): GameConfig => ({
  mode,
  players: ([0, 1, 2, 3] as Seat[]).map((seat) => ({ name: `P${seat}`, seat })),
});

/** Put pieces at given route positions: { '0-C1': 5, ... } */
function place(state: GameState, positions: Record<string, number>): GameState {
  return {
    ...state,
    pieces: state.pieces.map((p) => (p.id in positions ? { ...p, progress: positions[p.id]! } : p)),
  };
}

describe('board route', () => {
  it('visits all 25 squares exactly once and ends at the centre', () => {
    for (const seat of [0, 1, 2, 3] as Seat[]) {
      const route = routeFor(seat);
      expect(route).toHaveLength(25);
      expect(new Set(route.map(cellKey)).size).toBe(25);
      expect(route[HOME_INDEX]).toEqual({ row: 2, col: 2 });
    }
  });

  it('moves one orthogonal square at a time', () => {
    for (const seat of [0, 1, 2, 3] as Seat[]) {
      const route = routeFor(seat);
      for (let i = 1; i < route.length; i++) {
        const a = route[i - 1]!;
        const b = route[i]!;
        expect(Math.abs(a.row - b.row) + Math.abs(a.col - b.col)).toBe(1);
      }
    }
  });

  it('starts each seat on its own side X square', () => {
    expect(routeFor(0)[0]).toEqual({ row: 4, col: 2 });
    expect(routeFor(1)[0]).toEqual({ row: 2, col: 4 });
    expect(routeFor(2)[0]).toEqual({ row: 0, col: 2 });
    expect(routeFor(3)[0]).toEqual({ row: 2, col: 0 });
    for (const seat of [0, 1, 2, 3] as Seat[]) expect(isSafeCell(B5, routeFor(seat)[0]!)).toBe(true);
    expect(B5.safe).toHaveLength(5);
  });

  it('is exactly the 5×5 route the family drew', () => {
    const drawn = [
      [4, 2], [4, 3], [4, 4], [3, 4], [2, 4], [1, 4], [0, 4], [0, 3], [0, 2], [0, 1], [0, 0], [1, 0], [2, 0], [3, 0], [4, 0], [4, 1],
      [3, 1], [2, 1], [1, 1], [1, 2], [1, 3], [2, 3], [3, 3], [3, 2],
      [2, 2],
    ];
    expect(routeFor(0).map((c) => [c.row, c.col])).toEqual(drawn);
  });

  it('follows the drawn route for the bottom player', () => {
    const r = routeFor(0);
    expect(r[1]).toEqual({ row: 4, col: 3 }); // outer ring goes right first
    expect(r[15]).toEqual({ row: 4, col: 1 }); // last outer square
    expect(r[16]).toEqual({ row: 3, col: 1 }); // inner ring goes up first
    expect(r[23]).toEqual({ row: 3, col: 2 });
  });
});

describe('shell scoring and movement', () => {
  it('maps open shells to scores 1/2/3/4/8', () => {
    expect([1, 2, 3, 4, 5].map(scoreForOpen)).toEqual([1, 2, 3, 4, 8]);
  });

  it('moves a Child 1/2/3/4/8 and a Mother -/1/-/2/4', () => {
    expect([1, 2, 3, 4, 5].map((n) => stepsFor('child', n))).toEqual([1, 2, 3, 4, 8]);
    expect([1, 2, 3, 4, 5].map((n) => stepsFor('mother', n))).toEqual([null, 1, null, 2, 4]);
  });

  it('enters a Child on 4 (no steps) or 5 (+4 steps) and a Mother only on 5 (no steps)', () => {
    expect([1, 2, 3, 4, 5].map((n) => entryProgress('child', n))).toEqual([null, null, null, 0, 4]);
    expect([1, 2, 3, 4, 5].map((n) => entryProgress('mother', n))).toEqual([null, null, null, null, 0]);
  });

  it('counts no open shells as 8, exactly like 5 open', () => {
    expect(scoreForOpen(0)).toBe(8);
    expect(stepsFor('child', 0)).toBe(8);
    expect(stepsFor('mother', 0)).toBe(4);
    expect(entryProgress('child', 0)).toBe(4);
    expect(entryProgress('mother', 0)).toBe(0);
    const g = applyMove(applyThrow(createGame(twoPlayers, 1), open(0)), '0-M');
    expect(g.pieces.find((p) => p.id === '0-M')!.progress).toBe(0);
    expect(g.current).toBe(0); // 8 earns another throw
  });
});

describe('holding a 4 and joining 4 + 4', () => {
  it('lets the player keep a 4 and throw again', () => {
    const g = applyThrow(createGame(twoPlayers, 1), open(4));
    expect(g.canHold).toBe(true);
    const held = applyThrow(g, open(2));
    expect(held.pending.map((t) => t.open)).toEqual([4, 2]);
    expect(held.events.map((e) => e.type)).toEqual(['hold', 'throw']);
  });

  it('joins two 4s into an 8 to release the Mother', () => {
    let g = applyThrow(applyThrow(createGame(twoPlayers, 1), open(4)), open(4));
    const join = g.legalMoves.find((m) => m.join)!;
    expect(join).toMatchObject({ pieceId: '0-M', uses: [0, 1], enters: true, to: 0 });
    g = applyMove(g, join.id);
    expect(g.pieces.find((p) => p.id === '0-M')!.progress).toBe(0);
    expect(g.pending).toEqual([]);
    expect(g.phase).toBe('awaitingThrow');
    expect(g.current).toBe(0);
  });

  it('can still use two 4s separately', () => {
    let g = applyThrow(applyThrow(createGame(twoPlayers, 1), open(4)), open(4));
    g = applyMove(g, '0-C1:0');
    expect(g.pending.map((t) => t.open)).toEqual([4]);
    expect(g.legalMoves.some((m) => m.join)).toBe(false);
    g = applyMove(g, g.legalMoves.find((m) => m.pieceId === '0-C2')!.id);
    expect(g.pieces.filter((p) => p.kind === 'child' && p.progress === 0)).toHaveLength(2);
  });

  it('only joins 4s for the Mother, and only two 4s', () => {
    const out = place(createGame(twoPlayers, 1), { '0-M': 3 });
    const g = applyThrow(applyThrow(out, open(4)), open(4));
    expect(g.legalMoves.some((m) => m.join)).toBe(false);
  });

  it('uses a held 4 and a different next throw separately', () => {
    let g = place(createGame(twoPlayers, 1), { '0-C1': 0 });
    g = applyThrow(applyThrow(g, open(4)), open(2));
    expect(g.legalMoves.some((m) => m.join)).toBe(false);
    expect(g.canHold).toBe(false);
    g = applyMove(g, '0-C1:1'); // the 2
    g = applyMove(g, g.legalMoves.find((m) => m.pieceId === '0-C1')!.id); // then the 4
    expect(g.pieces.find((p) => p.id === '0-C1')!.progress).toBe(6);
    expect(g.current).toBe(1); // the 2 ended the chain
  });

  it('lets the player keep an 8, throw again, and use both in any order', () => {
    // Mother on her entry square, a Child 4 steps ahead (where the Mother's 4 would land).
    let g = place(createGame(twoPlayers, 1), { '0-M': 0, '0-C1': 4 });
    g = applyThrow(g, open(5));
    expect(g.canHold).toBe(true);
    g = applyThrow(g, open(3)); // keep the 8, throw a 3
    expect(g.pending.map((t) => t.open)).toEqual([5, 3]);
    g = applyMove(g, '0-C1:1'); // Child moves 3 first, clearing the square
    expect(g.pieces.find((p) => p.id === '0-C1')!.progress).toBe(7);
    g = applyMove(g, '0-M:0'); // then the kept 8 moves the Mother 4
    expect(g.pieces.find((p) => p.id === '0-M')!.progress).toBe(4);
    expect(g.current).toBe(1); // the 3 ended the chain
  });

  it('only joins two 4s, never a 4 and an 8', () => {
    const g = applyThrow(applyThrow(createGame(twoPlayers, 1), open(4)), open(5));
    expect(g.legalMoves.some((m) => m.join)).toBe(false);
  });

  it('keeps a 4 automatically when it cannot be used but the Mother could join it', () => {
    const g = place(createGame(twoPlayers, 1), { '0-C1': HOME_INDEX, '0-C2': HOME_INDEX });
    const after = applyThrow(g, open(4));
    expect(after.phase).toBe('awaitingThrow');
    expect(after.current).toBe(0);
    expect(after.pending.map((t) => t.open)).toEqual([4]);
    const joined = applyThrow(after, open(4));
    expect(joined.legalMoves).toEqual([expect.objectContaining({ join: true, pieceId: '0-M' })]);
  });

  it('drops an unused held 4 when the chain ends', () => {
    const g = place(createGame(twoPlayers, 1), { '0-C1': HOME_INDEX, '0-C2': HOME_INDEX });
    const after = applyThrow(applyThrow(g, open(4)), open(1));
    expect(after.current).toBe(1);
    expect(after.pending).toEqual([]);
  });
});

describe('turn flow', () => {
  it('loses the turn when nothing can move on 1, 2 or 3', () => {
    const g = createGame(twoPlayers, 1);
    const after = applyThrow(g, open(2));
    expect(after.current).toBe(1);
    expect(after.phase).toBe('awaitingThrow');
    expect(after.events.map((e) => e.type)).toEqual(['throw', 'noMove']);
  });

  it('gives only children as options on 4 open from the start', () => {
    const g = applyThrow(createGame(twoPlayers, 1), open(4));
    expect(g.phase).toBe('awaitingMove');
    expect(g.legalMoves.map((m) => m.pieceId).sort()).toEqual(['0-C1', '0-C2']);
  });

  it('gives an extra throw after 4 or 5', () => {
    let g = applyThrow(createGame(twoPlayers, 1), open(4));
    g = applyMove(g, '0-C1');
    expect(g.current).toBe(0);
    expect(g.phase).toBe('awaitingThrow');
    g = applyThrow(g, open(5));
    g = applyMove(g, '0-M');
    expect(g.current).toBe(0);
    expect(g.pieces.find((p) => p.id === '0-M')!.progress).toBe(0);
  });

  it('passes the turn after 1, 2 or 3', () => {
    let g = place(createGame(twoPlayers, 1), { '0-C1': 0 });
    g = applyMove(applyThrow(g, open(3)), '0-C1');
    expect(g.current).toBe(1);
  });

  it('keeps an unusable 8 and the extra throw, then drops it if still unusable', () => {
    const g = place(createGame(twoPlayers, 1), { '0-M': 23, '0-C1': HOME_INDEX, '0-C2': HOME_INDEX });
    const after = applyThrow(g, open(5)); // Mother would overshoot
    expect(after.current).toBe(0);
    expect(after.phase).toBe('awaitingThrow');
    expect(after.events.map((e) => e.type)).toEqual(['throw', 'hold']);
    const next = applyThrow(after, open(3)); // still nothing fits
    expect(next.current).toBe(1);
    expect(next.pending).toEqual([]);
  });

  it('places a Child entering on 5 four steps along the route', () => {
    const g = applyMove(applyThrow(createGame(twoPlayers, 1), open(5)), '0-C2');
    expect(g.pieces.find((p) => p.id === '0-C2')!.progress).toBe(4);
  });

  it('does not let a Mother on the board move on 1 or 3', () => {
    const g = place(createGame(twoPlayers, 1), { '0-M': 3 });
    expect(applyThrow(g, open(1)).current).toBe(1);
    expect(applyThrow(g, open(3)).current).toBe(1);
    expect(applyThrow(g, open(2)).legalMoves).toEqual([
      expect.objectContaining({ pieceId: '0-M', from: 3, to: 4 }),
    ]);
  });

  it('rejects moves for pieces without a legal move', () => {
    const g = applyThrow(createGame(twoPlayers, 1), open(4));
    expect(() => applyMove(g, '0-M')).toThrow();
    expect(() => applyMove(g, '1-C1')).toThrow();
  });
});

describe('finishing', () => {
  it('requires an exact count to reach the centre', () => {
    const g = place(createGame(twoPlayers, 1), { '0-C1': 21 });
    expect(applyThrow(g, open(4)).legalMoves.find((m) => m.pieceId === '0-C1')).toBeUndefined();
    const exact = applyThrow(g, open(3));
    expect(exact.legalMoves).toEqual([expect.objectContaining({ pieceId: '0-C1', to: HOME_INDEX, finishes: true })]);
  });

  it('gives another throw when a piece reaches home', () => {
    let g = place(createGame(twoPlayers, 1), { '0-C1': 23 });
    g = applyMove(applyThrow(g, open(1)), '0-C1');
    expect(g.current).toBe(0);
    expect(g.phase).toBe('awaitingThrow');
    expect(g.events.map((e) => e.type)).toEqual(['throw', 'move', 'home', 'extraTurn']);
  });

  it('never moves a piece that is already home', () => {
    const g = place(createGame(twoPlayers, 1), { '0-C1': HOME_INDEX, '0-C2': 0 });
    expect(applyThrow(g, open(1)).legalMoves.map((m) => m.pieceId)).toEqual(['0-C2']);
  });

  it('declares the first player with all three pieces home the winner', () => {
    let g = place(createGame(twoPlayers, 1), { '0-M': HOME_INDEX, '0-C1': HOME_INDEX, '0-C2': 23 });
    g = applyMove(applyThrow(g, open(1)), '0-C2');
    expect(g.phase).toBe('finished');
    expect(g.winners).toEqual([0]);
  });
});

describe('captures and safe squares', () => {
  // Bottom route index 1 is (4,3). Top player (seat 2) reaches (4,3) at route index 9.
  it('captures an opponent by landing on a plain square', () => {
    let g = place(createGame(twoPlayers, 1), { '0-C1': 0, '1-C1': 9 });
    g = applyThrow(g, open(1));
    expect(g.legalMoves[0]!.captures).toEqual(['1-C1']);
    g = applyMove(g, '0-C1');
    expect(g.pieces.find((p) => p.id === '1-C1')!.progress).toBe(YARD_INDEX);
    expect(g.events.some((e) => e.type === 'capture')).toBe(true);
  });

  it('gives another throw after a capture', () => {
    // A 1 normally ends the turn; a capture with it earns another throw.
    let g = place(createGame(twoPlayers, 1), { '0-C1': 0, '1-C1': 9 });
    g = applyMove(applyThrow(g, open(1)), '0-C1');
    expect(g.current).toBe(0);
    expect(g.phase).toBe('awaitingThrow');
    expect(g.events.map((e) => e.type)).toEqual(['throw', 'move', 'capture', 'extraTurn']);
  });

  it('gives just one extra throw for a capture with throws still to use, after they are used', () => {
    // Kept 4 plus a 1: capture with the 1, then use the 4, then the bonus throw.
    let g = place(createGame(twoPlayers, 1), { '0-C1': 0, '0-C2': 5, '1-C1': 9 });
    g = applyThrow(g, open(4));
    g = applyThrow(g, open(1)); // keep the 4, throw a 1
    g = applyMove(g, '0-C1:1'); // the 1 captures
    expect(g.phase).toBe('awaitingMove'); // the kept 4 is still to use
    const four = g.legalMoves.find((m) => m.pieceId === '0-C2')!;
    g = applyMove(g, four.id);
    expect(g.current).toBe(0);
    expect(g.phase).toBe('awaitingThrow');
  });

  it('captures every opponent piece on that square', () => {
    let g = place(createGame(twoPlayers, 1), { '0-C1': 0, '1-C1': 9, '1-C2': 9 });
    g = applyMove(applyThrow(g, open(1)), '0-C1');
    expect(g.pieces.filter((p) => p.owner === 1 && p.progress === YARD_INDEX)).toHaveLength(3);
  });

  it('lets a Mother capture a Mother', () => {
    let h = place(createGame(twoPlayers, 1), { '0-M': 0, '1-M': 9 });
    h = applyMove(applyThrow(h, open(2)), '0-M');
    expect(h.pieces.find((p) => p.id === '1-M')!.progress).toBe(YARD_INDEX);
  });

  it('blocks landing on an opponent of the other kind (no sharing a plain square)', () => {
    // Child onto an opponent Mother: not allowed.
    const g = place(createGame(twoPlayers, 1), { '0-C1': 0, '1-M': 9 });
    expect(applyThrow(g, open(1)).legalMoves.find((m) => m.pieceId === '0-C1')).toBeUndefined();
    // Mother onto an opponent Child: not allowed.
    const k = place(createGame(twoPlayers, 1), { '0-M': 0, '1-C1': 9 });
    expect(applyThrow(k, open(2)).legalMoves.find((m) => m.pieceId === '0-M')).toBeUndefined();
  });

  it('still lets opponents of either kind share an X square', () => {
    // Bottom index 8 is the top X (0,2), where the top player's Mother waits.
    const g = place(createGame(twoPlayers, 1), { '0-C1': 4, '1-M': 0 });
    const move = applyThrow(g, open(4)).legalMoves.find((m) => m.pieceId === '0-C1')!;
    expect(move).toMatchObject({ to: 8, captures: [] });
  });

  it('cannot capture on a safe square, so pieces share it', () => {
    // Bottom index 8 is the top X (0,2), which is the top player's entry square.
    let g = place(createGame(twoPlayers, 1), { '0-C1': 4, '1-C1': 0 });
    g = applyThrow(g, open(4));
    const move = g.legalMoves.find((m) => m.pieceId === '0-C1')!;
    expect(move.to).toBe(8);
    expect(move.captures).toEqual([]);
    g = applyMove(g, '0-C1');
    expect(g.pieces.find((p) => p.id === '1-C1')!.progress).toBe(0);
  });

  it('does not let your own pieces share a plain square', () => {
    const g = place(createGame(twoPlayers, 1), { '0-C1': 0, '0-C2': 1 });
    // C1 cannot step onto C2; C2 can still move on.
    expect(applyThrow(g, open(1)).legalMoves.map((m) => m.pieceId)).toEqual(['0-C2']);
  });

  it('lets your own pieces share an X square', () => {
    // Index 4 is the right-hand X (2,4).
    let g = place(createGame(twoPlayers, 1), { '0-C1': 0, '0-C2': 4 });
    g = applyMove(applyThrow(g, open(4)), '0-C1:0');
    expect(g.pieces.filter((p) => p.owner === 0 && p.progress === 4)).toHaveLength(2);
  });

  it('does not let partners share a plain square', () => {
    // Bottom index 1 (4,3) is index 9 on the top route; seats 0 and 2 are partners.
    const g = place(createGame(fourPlayers('team'), 1), { '0-C1': 0, '2-C1': 9 });
    expect(applyThrow(g, open(1)).legalMoves.find((m) => m.pieceId === '0-C1')).toBeUndefined();
  });

  it('lets a captured Mother re-enter only on an 8', () => {
    let g = place(createGame(twoPlayers, 1), { '0-C1': HOME_INDEX, '0-C2': HOME_INDEX });
    expect(applyThrow(g, open(4)).legalMoves).toEqual([]);
    expect(applyThrow(g, open(0)).legalMoves).toEqual([expect.objectContaining({ pieceId: '0-M', to: 0 })]);
    g = applyThrow(g, open(5));
    expect(g.legalMoves).toEqual([expect.objectContaining({ pieceId: '0-M', enters: true, to: 0 })]);
  });

});

describe('team mode', () => {
  it('pairs opposite seats', () => {
    const g = createGame(fourPlayers('team'), 1);
    expect(g.players.map((p) => p.team)).toEqual([0, 1, 0, 1]);
  });

  it('needs both teammates home to win', () => {
    let g = place(createGame(fourPlayers('team'), 1), { '0-M': HOME_INDEX, '0-C1': HOME_INDEX, '0-C2': 23 });
    g = applyMove(applyThrow(g, open(1)), '0-C2');
    expect(g.phase).toBe('awaitingThrow');
    expect(g.winners).toEqual([]);
  });

  it("lets a finished player move their teammate's pieces", () => {
    const done = { '0-M': HOME_INDEX, '0-C1': HOME_INDEX, '0-C2': HOME_INDEX, '2-C1': 5 };
    let g = place(createGame(fourPlayers('team'), 1), done);
    g = applyThrow(g, open(1));
    expect(g.legalMoves.map((m) => m.pieceId)).toEqual(['2-C1']);
  });

  it('declares the team winner when the last teammate piece arrives', () => {
    const done = {
      '0-M': HOME_INDEX, '0-C1': HOME_INDEX, '0-C2': HOME_INDEX,
      '2-M': HOME_INDEX, '2-C1': HOME_INDEX, '2-C2': 22,
    };
    let g = place(createGame(fourPlayers('team'), 1), done);
    g = applyMove(applyThrow(g, open(2)), '2-C2');
    expect(g.phase).toBe('finished');
    expect(g.winners).toEqual([0, 2]);
  });

  it('rejects team mode without four players', () => {
    expect(() => createGame({ ...twoPlayers, mode: 'team' }, 1)).toThrow();
  });
});

describe('determinism and full games', () => {
  it('throws fair shells: 5 open about 1 time in 32', () => {
    const counts = [0, 0, 0, 0, 0, 0];
    let g = createGame(twoPlayers, 12345);
    const n = 64000;
    for (let i = 0; i < n; i++) {
      g = throwShells({ ...g, phase: 'awaitingThrow', pending: [] });
      counts[g.lastThrow!.open]!++;
    }
    const expected = [1, 5, 10, 10, 5, 1].map((c) => c / 32);
    counts.forEach((c, open) => expect(Math.abs(c / n - expected[open]!)).toBeLessThan(0.006));
  });

  it('replays identically from the same seed', () => {
    const a = throwShells(createGame(twoPlayers, 42));
    const b = throwShells(createGame(twoPlayers, 42));
    expect(a.lastThrow).toEqual(b.lastThrow);
  });

  function playOut(config: GameConfig, seed: number, levels: ('easy' | 'medium' | 'hard')[]) {
    let g = createGame(config, seed);
    let rand = seed;
    const random = () => {
      rand = (rand * 1103515245 + 12345) & 0x7fffffff;
      return rand / 0x7fffffff;
    };
    for (let i = 0; i < 20000 && g.phase !== 'finished'; i++) {
      const action = chooseBotAction(g, levels[g.current % levels.length]!, random);
      g = action.type === 'throw' ? throwShells(g) : applyMove(g, action.move.id);
    }
    return g;
  }

  it('bots finish individual games for 2, 3 and 4 players', () => {
    const configs: GameConfig[] = [
      twoPlayers,
      { mode: 'individual', players: [{ name: 'A', seat: 0 }, { name: 'B', seat: 1 }, { name: 'C', seat: 2 }] },
      fourPlayers('individual'),
    ];
    for (const config of configs) {
      for (let seed = 1; seed <= 10; seed++) {
        const g = playOut(config, seed, ['easy', 'medium', 'hard']);
        expect(g.phase).toBe('finished');
        expect(g.winners).toHaveLength(1);
      }
    }
  });

  it('bots finish team games', () => {
    for (let seed = 1; seed <= 10; seed++) {
      const g = playOut(fourPlayers('team'), seed, ['medium', 'hard']);
      expect(g.phase).toBe('finished');
      expect(g.winners).toHaveLength(2);
    }
  });

  /** The bot-strength tests play hundreds of games with the look-ahead bot: seconds of work, more on a busy machine. */
  const SLOW_MS = 30_000;

  it('hard bots beat easy bots more often than not', () => {
    let hardWins = 0;
    const games = 300;
    for (let seed = 1; seed <= games; seed++) {
      // Alternate who goes first to remove the first-move advantage.
      const levels: ('easy' | 'hard')[] = seed % 2 ? ['hard', 'easy'] : ['easy', 'hard'];
      const g = playOut(twoPlayers, seed, levels);
      if (levels[g.winners[0]!] === 'hard') hardWins++;
    }
    expect(hardWins / games).toBeGreaterThan(0.6);
  }, SLOW_MS);

  it('hard (look-ahead) beats the greedy player with hard settings', () => {
    // Measured at 59% ± 3.4 over 800 games; this fixed sample guards against regressions.
    let wins = 0;
    const games = 300;
    for (let seed = 1; seed <= games; seed++) {
      const searchFirst = seed % 2 === 1;
      let g = createGame(twoPlayers, seed * 7919 + 424242);
      for (let i = 0; i < 20000 && g.phase !== 'finished'; i++) {
        const searchTurn = (g.current === 0) === searchFirst;
        const action = searchTurn ? searchBotAction(g) : greedyBotAction(g, 'hard');
        g = action.type === 'throw' ? throwShells(g) : applyMove(g, action.move.id);
      }
      if ((g.winners[0] === 0) === searchFirst) wins++;
    }
    expect(wins / games).toBeGreaterThan(0.53);
  }, SLOW_MS);

  it('hard clears the way before using a kept throw', () => {
    // Mother on a plain square; her own Child sits where the Mother's 4 would land.
    let g = place(createGame(twoPlayers, 1), { '0-M': 1, '0-C1': 5 });
    g = applyThrow(g, open(5)); // an 8: Mother 4 or Child 8
    g = applyThrow(g, open(3)); // keep it and throw a 3: Child 3 only
    // Let Hard spend both throws.
    for (let i = 0; i < 5 && g.current === 0 && g.phase === 'awaitingMove'; i++) {
      const action = searchBotAction(g);
      if (action.type !== 'move') break;
      g = applyMove(g, action.move.id);
    }
    // Best play: Child 3 first (off the square), then the Mother uses the 8.
    expect(g.pieces.find((p) => p.id === '0-C1')!.progress).toBe(8);
    expect(g.pieces.find((p) => p.id === '0-M')!.progress).toBe(5);
  });

  it('solves the solo race: Mother is the bottleneck', () => {
    const start = expectedTurnsToFinish(-1, -1, -1);
    expect(start).toBeGreaterThan(30);
    expect(expectedTurnsToFinish(HOME_INDEX, HOME_INDEX, HOME_INDEX)).toBe(0);
    // A Mother on the board is worth far more than a Child on the board.
    expect(start - expectedTurnsToFinish(0, -1, -1)).toBeGreaterThan(start - expectedTurnsToFinish(-1, 0, -1));
  });
});

describe('7×7 board', () => {
  const B7 = BOARDS['7x7'];
  const seven: GameConfig = { ...twoPlayers, board: '7x7' };

  it('visits all 49 squares once, a step at a time, and ends at the centre', () => {
    for (const seat of [0, 1, 2, 3] as Seat[]) {
      const route = B7.routes[seat];
      expect(route).toHaveLength(49);
      expect(new Set(route.map(cellKey)).size).toBe(49);
      expect(route[B7.home]).toEqual({ row: 3, col: 3 });
      // One square at a time; only the last step into the centre is diagonal.
      for (let i = 1; i < B7.home; i++) {
        const a = route[i - 1]!;
        const b = route[i]!;
        expect(Math.abs(a.row - b.row) + Math.abs(a.col - b.col)).toBe(1);
      }
    }
    expect(B7.home).toBe(48);
  });

  it('runs the outer ring counter-clockwise, the middle clockwise, the inner counter-clockwise', () => {
    const r = B7.routes[0];
    expect(r[0]).toEqual({ row: 6, col: 3 }); // entry, middle of the bottom side
    expect(r[1]).toEqual({ row: 6, col: 4 }); // outer ring goes right first
    expect(r[23]).toEqual({ row: 6, col: 2 }); // last outer square
    expect(r[24]).toEqual({ row: 5, col: 2 }); // middle ring: just inside
    expect(r[25]).toEqual({ row: 5, col: 1 }); // … and goes left (clockwise)
    expect(r[39]).toEqual({ row: 5, col: 3 }); // last middle square
    expect(r[40]).toEqual({ row: 4, col: 3 }); // inner ring: just inside
    expect(r[41]).toEqual({ row: 4, col: 4 }); // … and goes right (counter-clockwise)
    expect(r[47]).toEqual({ row: 4, col: 2 });
  });

  it('has X squares on each side, the middle ring corners and the centre; everyone enters on one', () => {
    expect(B7.safe).toHaveLength(9);
    for (const seat of [0, 1, 2, 3] as Seat[]) expect(isSafeCell(B7, B7.routes[seat][0]!)).toBe(true);
    expect(isSafeCell(B7, { row: 1, col: 1 })).toBe(true);
    expect(isSafeCell(B7, { row: 2, col: 2 })).toBe(false);
  });

  it('plays by the same rules: entry, moves and like-for-like captures', () => {
    let g = createGame(seven, 1);
    g = applyThrow(g, open(4)); // a 4 brings a Child out
    const enter = g.legalMoves.find((m) => m.pieceId === '0-C1')!;
    expect(enter).toMatchObject({ to: 0, enters: true });
    // A Child of seat 2 standing 3 squares along seat 0's route (a plain square) can be captured.
    const target = B7.routes[0][3]!;
    const theirs = B7.routes[2].findIndex((c) => c.row === target.row && c.col === target.col);
    g = place(createGame(seven, 1), { '0-C1': 0, '1-C1': theirs });
    g = applyThrow(g, open(3));
    expect(g.legalMoves.find((m) => m.pieceId === '0-C1')).toMatchObject({ to: 3, captures: ['1-C1'] });
  });

  it('only finishes on an exact throw into the centre (48 steps)', () => {
    let g = place(createGame(seven, 1), { '0-C1': 45 });
    g = applyThrow(g, open(3));
    expect(g.legalMoves.find((m) => m.pieceId === '0-C1')).toMatchObject({ to: 48, finishes: true });
    let h = place(createGame(seven, 1), { '0-C1': 45 });
    h = applyThrow(h, open(4));
    expect(h.legalMoves.find((m) => m.pieceId === '0-C1')).toBeUndefined();
  });

  it('computers finish whole games on it', () => {
    for (const level of ['easy', 'medium', 'hard'] as const) {
      let g = createGame({ mode: 'individual', board: '7x7', players: [0, 1, 2, 3].map((seat) => ({ name: `P${seat}`, seat: seat as Seat, bot: level })) }, 7);
      for (let i = 0; i < 20_000 && g.phase !== 'finished'; i++) {
        const a = chooseBotAction(g, level);
        g = a.type === 'throw' ? throwShells(g) : applyMove(g, a.move.id);
      }
      expect(g.phase).toBe('finished');
    }
  }, 60_000);

  it('a longer route takes longer to finish', () => {
    expect(expectedTurnsToFinish(-1, -1, -1, 48)).toBeGreaterThan(expectedTurnsToFinish(-1, -1, -1, 24) * 1.5);
    expect(expectedTurnsToFinish(48, 48, 48, 48)).toBe(0);
  });

  it('treats games saved before boards existed as 5×5', () => {
    const g = createGame(twoPlayers, 1);
    expect(g.config.board).toBeUndefined();
    expect(boardOf(g).id).toBe('5x5');
  });
});
