/**
 * The database schema, as numbered steps applied in order. The server applies
 * any missing steps itself the first time it connects (see db.ts), so there is
 * nothing to run by hand. Never edit a step once deployed: add a new one.
 */
export const MIGRATIONS: { version: number; sql: string }[] = [
  {
    version: 1,
    sql: `
      CREATE TABLE users (
        id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        name          text NOT NULL,
        -- Sign-in identities (null while a guest).
        google_sub    text UNIQUE,
        apple_sub     text UNIQUE,
        email         text,
        -- Play money. Only ever changed together with a coin_ledger row.
        coins         bigint NOT NULL DEFAULT 0 CHECK (coins >= 0),
        games_played  integer NOT NULL DEFAULT 0,
        games_won     integer NOT NULL DEFAULT 0,
        created_at    timestamptz NOT NULL DEFAULT now(),
        last_seen_at  timestamptz NOT NULL DEFAULT now()
      );

      -- Sign-in sessions. Only a hash of the token is kept.
      CREATE TABLE sessions (
        token_hash    text PRIMARY KEY,
        user_id       uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at    timestamptz NOT NULL DEFAULT now(),
        last_used_at  timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX sessions_user_idx ON sessions(user_id);

      -- Every coin change, with why. (reason, ref) is unique per user, so a
      -- reward can never be paid twice (e.g. 'win' + the game's key).
      CREATE TABLE coin_ledger (
        id          bigserial PRIMARY KEY,
        user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        delta       integer NOT NULL,
        reason      text NOT NULL,
        ref         text NOT NULL,
        created_at  timestamptz NOT NULL DEFAULT now(),
        UNIQUE (user_id, reason, ref)
      );

      -- Finished online games.
      CREATE TABLE games (
        id           bigserial PRIMARY KEY,
        game_key     text NOT NULL UNIQUE,
        room_code    text NOT NULL,
        mode         text NOT NULL,
        started_at   timestamptz NOT NULL,
        finished_at  timestamptz NOT NULL DEFAULT now()
      );
      CREATE TABLE game_players (
        game_id  bigint NOT NULL REFERENCES games(id) ON DELETE CASCADE,
        seat     smallint NOT NULL,
        user_id  uuid REFERENCES users(id) ON DELETE SET NULL,
        name     text NOT NULL,
        bot      text,
        won      boolean NOT NULL,
        PRIMARY KEY (game_id, seat)
      );
      CREATE INDEX game_players_user_idx ON game_players(user_id);
    `,
  },
  {
    version: 2,
    sql: `
      -- Daily bonus: the last day it was claimed (India time) and the run of days in a row.
      ALTER TABLE users ADD COLUMN last_daily date;
      ALTER TABLE users ADD COLUMN daily_streak integer NOT NULL DEFAULT 0;
      -- Coins won per game, so the app can show them in the results.
      ALTER TABLE game_players ADD COLUMN coins integer NOT NULL DEFAULT 0;
    `,
  },
  {
    version: 3,
    sql: `
      -- The coin shop: what each player bought, and the look they use (null = the free default).
      CREATE TABLE owned_items (
        user_id   uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        item_id   text NOT NULL,
        bought_at timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY (user_id, item_id)
      );
      ALTER TABLE users ADD COLUMN use_board text;
      ALTER TABLE users ADD COLUMN use_marbles text;
      ALTER TABLE users ADD COLUMN use_shells text;
    `,
  },
];
