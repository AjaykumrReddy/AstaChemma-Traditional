import { Client } from 'pg';
import { MIGRATIONS } from './migrations';

/**
 * Postgres access. In production the connection string comes from Cloudflare
 * Hyperdrive (which pools connections close to the database), so opening a
 * client per request is cheap. Locally and in tests it points at PGlite.
 */

export interface Db {
  query<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<T[]>;
  /** Run `fn` in a transaction: all of it happens, or none of it. */
  tx<T>(fn: (db: Db) => Promise<T>): Promise<T>;
}

/** Any number unlikely to clash with other advisory locks: guards migrations. */
const MIGRATION_LOCK = 727_274;

/** Migrations run at most once per isolate (and are a cheap no-op after the first time ever). */
let migrated: Promise<void> | null = null;

async function migrate(client: Client): Promise<void> {
  await client.query('BEGIN');
  try {
    // Two servers starting at once must not both apply a step.
    await client.query('SELECT pg_advisory_xact_lock($1)', [MIGRATION_LOCK]);
    await client.query(
      'CREATE TABLE IF NOT EXISTS schema_migrations (version integer PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())',
    );
    const { rows } = await client.query<{ version: number }>('SELECT version FROM schema_migrations');
    const done = new Set(rows.map((r) => r.version));
    for (const step of MIGRATIONS) {
      if (done.has(step.version)) continue;
      await client.query(step.sql);
      await client.query('INSERT INTO schema_migrations (version) VALUES ($1)', [step.version]);
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  }
}

function wrap(client: Client): Db {
  return {
    async query<T>(text: string, params?: unknown[]) {
      const result = await client.query(text, params);
      return result.rows as T[];
    },
    async tx(fn) {
      await client.query('BEGIN');
      try {
        const value = await fn(this);
        await client.query('COMMIT');
        return value;
      } catch (error) {
        await client.query('ROLLBACK').catch(() => {});
        throw error;
      }
    },
  };
}

/** Open a connection, make sure the schema is current, run `fn`, and close. */
export async function withDb<T>(connectionString: string, fn: (db: Db) => Promise<T>): Promise<T> {
  const client = new Client({ connectionString });
  await client.connect();
  try {
    if (!migrated) {
      migrated = migrate(client).catch((error) => {
        migrated = null; // try again on the next request
        throw error;
      });
    }
    await migrated;
    return await fn(wrap(client));
  } finally {
    await client.end().catch(() => {});
  }
}
