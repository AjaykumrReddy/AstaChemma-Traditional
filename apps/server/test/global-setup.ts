import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { generateKeyPairSync } from 'node:crypto';
import { createServer as createHttpServer, type Server } from 'node:http';
import { createServer } from 'node:net';
import type { TestProject } from 'vitest/node';

/**
 * Starts the real Worker in Cloudflare's local runtime (`wrangler dev`) with
 * tiny timings, for the end-to-end tests, and stops it afterwards.
 */

declare module 'vitest' {
  export interface ProvidedContext {
    port: number;
    /** The test Postgres, for checking what the Worker stored. */
    dbUrl: string;
    /** Private key (PEM) for signing test "Google" ID tokens; its public half is served as the JWKS. */
    googleKey: string;
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
let pg: { server: PGLiteSocketServer; db: PGlite } | null = null;
let jwksServer: Server | null = null;

export async function setup(project: TestProject) {
  const port = await freePort();
  // A real (in-memory) Postgres for the accounts tables, reached the way the
  // deployed Worker reaches Neon: through the Hyperdrive binding.
  const dbPort = await freePort();
  const db = await PGlite.create();
  const server = new PGLiteSocketServer({ db, port: dbPort, host: '127.0.0.1', maxConnections: 20 });
  await server.start();
  pg = { server, db };
  const dbUrl = `postgres://postgres:postgres@127.0.0.1:${dbPort}/postgres`;
  project.provide('dbUrl', dbUrl);

  // A stand-in for Google's key server: the tests sign ID tokens with this key.
  const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const jwks = JSON.stringify({ keys: [{ ...publicKey.export({ format: 'jwk' }), kid: 'test-key', alg: 'RS256', use: 'sig' }] });
  const jwksPort = await freePort();
  jwksServer = createHttpServer((_, res) => {
    res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'public, max-age=60' });
    res.end(jwks);
  }).listen(jwksPort, '127.0.0.1');
  project.provide('googleKey', privateKey.export({ type: 'pkcs8', format: 'pem' }) as string);
  // Tiny timings, and a high message limit: the test robots play far faster than people.
  // Test clients ping every 0.5 s, so 2 s of silence means a client has gone quiet.
  const vars = [
    'BOT_THROW_MS:1',
    'BOT_MOVE_MS:1',
    'AWAY_MS:300',
    'ABANDONED_MS:60000',
    'RATE_MAX_MESSAGES:100000',
    'SILENT_MS:2000',
    'GOOGLE_CLIENT_IDS:test-web-client',
    `GOOGLE_JWKS_URL:http://127.0.0.1:${jwksPort}/certs`,
  ].flatMap(
    (v) => ['--var', v],
  );
  child = spawn('npx', ['wrangler', 'dev', '--port', String(port), '--ip', '127.0.0.1', ...vars], {
    cwd: new URL('..', import.meta.url),
    shell: true,
    env: {
      ...process.env,
      WRANGLER_SEND_METRICS: 'false',
      CI: 'true',
      CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE: dbUrl,
    },
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
  if (child?.pid) {
    if (process.platform === 'win32') spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F']);
    else child.kill('SIGTERM');
  }
  if (pg) {
    await pg.server.stop().catch(() => {});
    await pg.db.close().catch(() => {});
  }
  jwksServer?.close();
}
