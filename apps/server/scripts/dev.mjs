// Local development: a real Postgres (PGlite, saved in .data/) plus the Worker
// (wrangler dev on port 8787, reachable on your Wi-Fi), wired together the way
// Hyperdrive and Neon are in production. No Docker, no cloud database needed.
import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const DB_PORT = 5440;
mkdirSync(new URL('../.data', import.meta.url), { recursive: true });
const db = await PGlite.create(fileURLToPath(new URL('../.data/pglite', import.meta.url)));
const server = new PGLiteSocketServer({ db, port: DB_PORT, host: '127.0.0.1', maxConnections: 20 });
await server.start();
console.log(`Local Postgres (PGlite) on 127.0.0.1:${DB_PORT}`);

const wrangler = spawn('npx', ['wrangler', 'dev', '--port', '8787', '--ip', '0.0.0.0'], {
  stdio: 'inherit',
  shell: true,
  env: {
    ...process.env,
    CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE: `postgres://postgres:postgres@127.0.0.1:${DB_PORT}/postgres`,
  },
});
const stop = async () => {
  wrangler.kill();
  await server.stop();
  await db.close();
  process.exit(0);
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
wrangler.on('exit', stop);
