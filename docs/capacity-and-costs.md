# Capacity and costs (checked 23 November 2026)

How far the free plans carry Asta Chemma, what runs out first, and what it costs after that.
Prices and limits are from the providers' pricing pages on the date above; check them again
before relying on them.

**Games against the computer and pass-and-play never touch the server**, so they're free at
any scale. Everything below is about online play and accounts.

## What one online game uses

Measured from the code and from simulating 300 games per size with the game engine:

| | 2 players | 4 players |
|---|---|---|
| Actions (throws + moves), median / 90th percentile | 190 / 240 | 430 / 570 |
| Room storage rows written (save + alarm per action) | ~400 | ~900 |
| Durable Object requests (player messages count 1/20, plus computer turns, timers, connects) | ~20–200 | ~40–450 |
| Durable Object active time (the room stays awake while moves keep coming) | ~10 min ≈ 75 GB-s | ~20 min ≈ 150 GB-s |
| Database queries (record the result, pay coins) | ~15 | ~25 |

Each player also makes a handful of account calls a day (open the app, daily bonus,
leaderboard, shop): roughly 5–20 Worker requests and 20–40 database queries per daily player.
Keep-alive pings are answered without waking the room, so they cost almost nothing.

## Cloudflare (game server, rooms, quick match)

| | Workers **Free** | Workers **Paid** ($5/month per account) |
|---|---|---|
| Worker requests | 100,000 / day | 10 million / month, then $0.30 per million |
| Durable Object requests | 100,000 / day | 1 million / month, then $0.15 per million |
| Durable Object active time | **13,000 GB-s / day** | 400,000 GB-s / month, then $12.50 per million GB-s |
| Durable Object rows written | **100,000 / day** | 50 million / month, then $1.00 per million |
| Hyperdrive (database) queries | 100,000 / day | unlimited |

**On Free, the first limits to run out are room active time (about 170 two-player games a day) and
rows written (about 250 a day).** Roughly **170 people each playing two online games a day**
(two players share each game) reaches them. When a daily free limit runs out, rooms **fail with errors until 00:00 UTC (5:30 am
IST)**, so online play would break for the rest of the evening. Everything else (Worker requests,
Hyperdrive queries, Durable Object requests) lasts much longer: several thousand daily players.

**On Paid ($5/month)**, the included amounts cover about **5,000 two-player games a month**
(~170 a day). After that, each extra game costs about **$0.001** (about 8 paise), mostly for
active time. 15,000 games a month (~500 daily players) ≈ $5 + ~$9 = **~$14/month**; 60,000
(~2,000 daily players) ≈ **~$55/month**. Nothing hard-stops;
set a Durable Objects **spending limit** in the dashboard as a safety net.

## Neon (accounts, coins, leaderboard)

| | **Free** | **Launch** (pay as you go, no minimum) |
|---|---|---|
| Compute | **100 CU-hours / month** | $0.106 per CU-hour |
| Sleeps when idle | after 5 min (always) | after 5 min (can be turned off) |
| Storage | 1 GB per project | $0.35 per GB-month |
| Restore to an earlier point | **last 6 hours only** | up to 7 days |

The database only runs while it's being used, and sleeps after 5 idle minutes. At the smallest
size (0.25 CU), every hour it's awake costs 0.25 CU-hours, so the free 100 CU-hours ≈ **400
awake hours a month ≈ 13 hours a day**. Once players are around for most of the day, the database
stays awake and the free allowance runs out late in the month. When it does, **the database is
switched off until the next month**: sign-in, coins, the leaderboard and the shop stop working.
Online games themselves keep working, because playing never waits for the database.

On Launch, a database awake around the clock at 0.25 CU costs about **$19/month** at most;
with sleep, typically **$3–10/month** at small scale. Storage stays tiny: a finished game is about
1 KB, so 1 GB holds about a million games.

**Backups: the free plan can only go back 6 hours.** A bad bug or a mistake noticed the next
morning couldn't be undone. That's the biggest gap today.

## Sentry (crash reports)

Free: 5,000 errors and 5 million performance spans a month, 30-day history, 1 uptime monitor.
Plenty for the closed test. One widespread bug could use up the month's errors in a day; after
that, new reports are dropped until the month resets. Team plan: $29/month for 50,000 errors.

## Recommendations

1. **Closed test (now):** the free plans are fine for 15–20 testers.
2. **Before the public launch:** move Cloudflare to **Workers Paid ($5/month)** and set a Durable
   Objects spending limit. That removes the daily cut-off, the real risk of a popular evening.
3. **Database backups (soon):** a nightly encrypted backup (`pg_dump`) kept for 30 days, e.g. by a
   scheduled GitHub Action. Or move Neon to **Launch** for 7-day restore.
4. **Watch Neon compute hours** (Neon console → Usage) once testers start. Cap the compute at
   0.25–0.5 CU so a busy moment can't burn hours at 2 CU. Move to Launch when a month heads
   past ~70 CU-hours.
5. **Cheap code savings (optional):** skip rewriting the room alarm when its time hasn't changed.
   That roughly halves rows written per game.

## Rough monthly bill by size

| Daily online players | Cloudflare | Neon | Sentry | Total |
|---|---|---|---|---|
| Up to ~100 (closed test, early days) | $0 (Free) | $0 (Free) | $0 | **$0** |
| ~100–500 | $5–15 | $0–10 | $0 | **~$5–25** |
| ~2,000 | ~$55 | ~$20–40 | $0–29 | **~$75–125** |

Assumes each daily player plays about two online two-player games; local games cost nothing.
Costs grow roughly in step with online games played, about **$1 per 1,000 games** on Cloudflare.
