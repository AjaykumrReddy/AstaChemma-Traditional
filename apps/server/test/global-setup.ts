import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { createServer } from 'node:net';
import type { TestProject } from 'vitest/node';

/**
 * Starts the real Worker in Cloudflare's local runtime (`wrangler dev`) with
 * tiny timings, for the end-to-end tests, and stops it afterwards.
 */

declare module 'vitest' {
  export interface ProvidedContext {
    port: number;
  }
}

async function freePort(): Promise<number> {
  return new Promise((resolve) => {
    const s = createServer();
    s.listen(0, '127.0.0.1', () => {
      const { port } = s.address() as { port: number };
      s.close(() => resolve(port));
    });
  });
}

let child: ChildProcess | null = null;

export async function setup(project: TestProject) {
  const port = await freePort();
  // Tiny timings, and a high message limit: the test robots play far faster than people.
  // Test clients ping every 0.5 s, so 2 s of silence means a client has gone quiet.
  const vars = [
    'BOT_THROW_MS:1',
    'BOT_MOVE_MS:1',
    'AWAY_MS:300',
    'ABANDONED_MS:60000',
    'RATE_MAX_MESSAGES:100000',
    'SILENT_MS:2000',
  ].flatMap(
    (v) => ['--var', v],
  );
  child = spawn('npx', ['wrangler', 'dev', '--port', String(port), '--ip', '127.0.0.1', ...vars], {
    cwd: new URL('..', import.meta.url),
    shell: true,
    env: { ...process.env, WRANGLER_SEND_METRICS: 'false', CI: 'true' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let log = '';
  child.stdout?.on('data', (d) => (log += d));
  child.stderr?.on('data', (d) => (log += d));

  // Wait for the Worker to answer its health check.
  const deadline = Date.now() + 90_000;
  for (;;) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/health`);
      if (res.ok) break;
    } catch {
      // not up yet
    }
    if (Date.now() > deadline) throw new Error(`wrangler dev did not start:\n${log.slice(-2000)}`);
    await new Promise((r) => setTimeout(r, 300));
  }
  project.provide('port', port);
}

export async function teardown() {
  if (!child?.pid) return;
  if (process.platform === 'win32') spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F']);
  else child.kill('SIGTERM');
}
