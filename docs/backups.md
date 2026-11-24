# Database backups

The game's database (accounts, coins, coin history, shop items, game results and
the leaderboard) lives in Neon Postgres. Two layers protect it:

| | How far back | Where |
|---|---|---|
| **Neon history** (built in) | the last **6 hours** (free plan) | Neon Console → Branches → Restore |
| **Nightly backup** (`.github/workflows/db-backup.yml`) | the last **30 nights** | GitHub → Actions → "Nightly database backup" → a run → Artifacts |

Games against the computer and on one phone are stored only on players' phones,
and live online rooms in Cloudflare; neither is in the database.

## Set-up (once)

In GitHub: **Settings → Secrets and variables → Actions → New repository secret**:

1. **`DATABASE_URL`**: in the Neon Console → your project → **Connect** → choose
   the **direct** connection (turn *Connection pooling* off) → copy the
   `postgresql://…?sslmode=require` string.
2. **`BACKUP_PASSPHRASE`**: a long password (e.g. five random words). **Save a copy
   in a password manager**: without it the backups can't be opened, and GitHub
   won't show it again.

Then **Actions → Nightly database backup → Run workflow** to make the first
backup now. After that it runs every night at 02:00 India time. A failed run
emails the repository owner.

The repository is public, so backups are encrypted (AES-256) before they're
stored, and nothing unencrypted is ever logged or kept.

## Restoring

Only needed after a real loss, e.g. a bug that wiped coins, noticed too late for
Neon's 6-hour restore.

1. **Download** the backup from the night before the problem: GitHub → Actions →
   Nightly database backup → that night's run → **Artifacts** → download, then unzip
   (you get `asta-chemma-db-YYYY-MM-DD.dump.gpg`).
2. **Decrypt** (Git Bash on Windows has `gpg`):
   ```
   gpg --decrypt --output db.dump asta-chemma-db-YYYY-MM-DD.dump.gpg
   ```
   (it asks for the `BACKUP_PASSPHRASE`).
3. **Restore into a new Neon branch first**, never straight over the live database:
   in Neon create an empty branch (e.g. `restore-test`), copy its direct connection
   string, then:
   ```
   pg_restore --no-owner --no-privileges --dbname "<restore-test connection string>" db.dump
   ```
   (`pg_restore` comes with PostgreSQL; on Windows install "Command Line Tools"
   from the PostgreSQL installer.)
4. **Check** the restored data (e.g. in Neon's SQL editor: counts of `users`,
   `coin_ledger`, `games`).
5. **Switch the game to it**: make that branch the project's default (or point the
   Cloudflare Hyperdrive connection at it) – or copy just the affected rows back.
   Then delete `db.dump` from your computer.
