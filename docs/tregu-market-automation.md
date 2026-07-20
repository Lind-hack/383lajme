# 383 Tregu market automation (VPS runbook)

383 Tregu is a virtual, educational 383C prediction market. Its live LMSR probability is moved by authenticated PO/JO 383C bets, a bounded verified-news Groq oracle, and bounded official live-score signals for configured sporting events. System adjustments change only LMSR market state (`q_yes`/`q_no`) and an auditable snapshot; they never change user balances, positions, or transactions.

## Required environment

Set these on the VPS application process and the local caller environment:

- `TREGU_AUTOMATION_URL`: base URL of this app, e.g. `https://example.com`.
- `TREGU_AUTOMATION_SECRET`: a high-entropy secret shared with the protected routes. `CRON_SECRET` is a legacy fallback.
- `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`: required by the server-side automation.
- `GROQ_API_KEY`: primary provider for both authenticated news repricers. Google/Gemini credentials are the server-side fallback; do not put keys in the repository.
- The VPS default Hermes model needs working OpenAI Codex OAuth (`hermes auth list openai-codex`) for daily draft generation.
- `GMAIL_USER`, `GMAIL_APP_PASSWORD`, and exactly one recipient (`TREGU_LIVE_RECIPIENT` or the existing `RECIPIENT_EMAIL`) are required for tregu-live verified-update mail. No credential is included in a message or endpoint response.

## AI news repricers

The existing local two-minute unit and the authenticated Vercel five-minute `tregu-live` heartbeat both run the verified-news AI repricer. They retain separate idempotency buckets and audit actions (`reprice` and `tregu_live`), so the admin panel distinguishes their health. Groq is tried first; Google/Gemini is used only for an eligible Groq/provider failure. Each run rechecks and persists a non-secret `last_checked_at` plus scan result for **every open** market. Only newly published, relevant verified evidence reaches the AI; an open market without it is recorded as `no_fresh_evidence` and its price is unchanged. A score that produces the same LMSR probability is explicitly recorded as `no_change`. Social-only sources (X/Twitter, Facebook, Instagram, TikTok, Telegram, Reddit, or `social_only` evidence) cannot reach the AI or reprice a market. Closed and resolved markets are skipped before any provider or oracle write, and the database function locks and rechecks the market before applying any system adjustment. Each run audit reports `open_markets_scanned`, `markets_checked`, `markets_with_evidence`, `updates_applied`, `no_change`, and `skipped_closed`.

Each successful scan calls `apply_news_oracle`, which atomically changes the LMSR state and creates a `market_snapshots` row with `oracle_kind = news_oracle`, reference probability, applied LMSR probability, reasoning, cited evidence, publishers, previous probability, and cap. The chart shows both trade and oracle markers on the actual LMSR line, with the Groq reference as a dashed overlay. A single publisher can move odds by at most 2 percentage points; a move up to 5 points requires two independent publishers. The database also enforces the 5-point absolute cap.

## Official live sports score path

An open sport market may opt in with `live_event` configured as `{ provider: "espn", event_id, league, yes_team }`. The reprice run fetches only ESPN's public official scoreboard endpoint for that exact event; social posts never enter this path. A changed official score/status produces one `live_score` snapshot with its ESPN URL, score/status, reference probability, previous LMSR probability, and a database-enforced maximum move of 10 percentage points. Repeated unchanged states are idempotent. When ESPN reports `STATUS_FINAL`, `apply_live_score_oracle` atomically records the final score snapshot and sets the market to `closed`; it does not resolve or pay it out automatically.

Launch liquidity defaults to `b = 400`. A 383C PO bet on a fresh 50/50 market moves PO to about 80.8%, while retaining the normal LMSR formula.

## Endpoints and idempotency

Automation routes require `Authorization: Bearer $TREGU...ET`:

- `GET /api/automation/tregu/daily-drafts` — authenticated, read-only verified-news context for the root Hermes Codex caller.
- `POST /api/automation/tregu/daily-drafts` — idempotent by Europe/Pristina date. It accepts only 3–5 unique, source-cited PO/JO drafts with short Polymarket-style titles, concrete title deadlines, and explicit resolution criteria; admin approval still opens a market.
- `POST /api/automation/tregu/reprice` — idempotent per UTC two-minute run bucket; it applies the bounded hybrid oracle only to verified evidence for still-open markets. It never pauses or reopens a market, and never touches user balances, positions, or transactions.
- `GET /api/cron/update-markets` — the `tregu-live` five-minute remote-only VPS heartbeat. It requires `Authorization: Bearer *** (or `TREGU_AUTOMATION_SECRET` fallback), accepts no body, and invokes the verified-news AI repricer (Groq, then eligible Google/Gemini fallback). Missing/wrong bearer returns `401`; a failed refresh returns non-2xx; successful no-evidence/no-change checks return JSON `2xx` without email. It sends one SMTP email to the configured recipient only when a verified AI result changes a market probability. Official sports/settlement work is not reachable from this route.

Codex daily drafts use `closes_in_hours`; breaking and controversy markets must close in 2–48 hours. Official live-event cards instead carry an explicit fallback `closes_at` and close early at ESPN final time.

## Formula 1 Dashboard live winner markets

A live F1 winner draft is an explicit `live_f1` binary market, not a football/ESPN market. Before it may be approved, its `live_event` must be `{ "provider": "formula1_dashboard", "event_id": "<season-race-id>", "driver_code": "<three-letter-code>" }`. Create one mapped binary market per driver for the same event ID. The two-minute `run-tregu-live-sports.mjs` processor renders `https://app.formula1dashboard.com/live-timing/` in Chromium; a static shell, incomplete leaderboard, missing race state, unmapped driver, or non-live race is recorded as unavailable/no-change and cannot move prices.

Only changed rendered position, gap, pit, tyre/stint, or status rows can call `apply_f1_market_oracle`. That RPC validates the source/event mapping, clamps every movement to 5 percentage points, writes an attributable `f1_dashboard` market snapshot, and never touches balances, positions, or trades. It sends a single source-linked email only after the RPC returns a persisted adjustment. `FINISHED` produces a settlement plan only when all open mapped markets belong to exactly one event; it then calls the existing idempotent `resolve_market` authority for one `PO` winner and every other `JO` market. Never settle a provisional leaderboard.

Apply `0024_tregu_f1_dashboard_oracle.sql` after `0023_tregu_market_classification.sql` before enabling F1 writes. The 07:00 Europe/Pristina daily draft review already exposes `General / News`, `Live Football`, and `Live F1` selectors; live modes cannot be approved without their required source configuration.

## Safe four-card live-event preview

`node scripts/preview-tregu-live-event-drafts.mjs` requests exactly three source-cited Codex cards, adds the fixed Spain–France ESPN event `760514` card, and submits only `dryRun: true`. It requires exactly four validated cards and returns zero created markets; it does not create a run audit, insert a draft, email, schedule, deploy, or apply a migration.

## VPS commands (not scheduled by this change)

```sh
node scripts/run-tregu-daily-drafts.mjs
node scripts/run-tregu-reprice.mjs
node scripts/run-tregu-live-sports.mjs
```

The intended external scheduler configuration is deliberately not installed by this change:

- `0 7 * * *` in `Europe/Pristina` for daily drafts.
- `*/2 * * * *` for the existing local news repricer; the same two-minute VPS job may also invoke `run-tregu-live-sports.mjs` after it. The live-sports script calls only the authenticated live-sports processor: it fetches ESPN summaries, records oracle audits, locks official finals, and settles only markets whose verified seven-minute window is due.

Apply migrations `0004`, `0005`, `0006`, `0008`, `0011`, `0017`, and `0018_tregu_live_heartbeat.sql` before calling the applicable automation in an environment that is meant to use it. Migration `0018` adds only the explicit `tregu_live` action allowlist entry and heartbeat index; it is required before enabling the five-minute timer. The existing two-minute Groq/Google unit is independent and must remain enabled.

## tregu-live systemd timer

The timer command must make exactly one GET request; it does not run Hermes or any LLM locally:

```sh
curl --fail --silent --show-error -H "Authorization: Bearer $CRON_SECRET" "$TREGU_AUTOMATION_URL/api/cron/update-markets"
```

The authenticated response is a non-secret JSON summary with `kind: "tregu_live"`, `runKey`, verified-news scan counts, AI provider/fallback audit fields, `updates_applied`, `no_change`, and per-market statuses. Admin health reads persisted `market_automation_runs` records separately as the local two-minute repricer and five-minute `tregu-live` heartbeat; the UI polls this endpoint every 30 seconds.

## Argentina–England three-outcome preflight

`npm run tregu:argentina-england:preflight` fetches fixed official ESPN event `760515`, the ESPN schedule/scoreboard, and the DraftKings soccer source at runtime. It prints a no-write review-only draft preview by default; it does not call the application or database.

The command is fail-closed: it supplies England/Draw/Argentina opening probabilities only when the DraftKings payload identifies this exact match and an explicit full-time/90-minute 1X2 market with all three quoted prices. Generic match-winner feeds, extra-time/penalty markets, malformed data, and any source without a draw price fail rather than derive a draw. The draft stores every source URL and fetch timestamp in `pre_match_analysis`; its opening analysis has no claims about lineups, form, or controversies.

Only an operator may opt into one review-only database draft with `node scripts/argentina-england-three-outcome-draft.mjs --apply`. That path requires `TREGU_AUTOMATION_URL` and `TREGU_AUTOMATION_SECRET` (or `CRON_SECRET`), remains `draft`, and is idempotent by the fixed market slug. It never opens or deploys a market.

## England–Argentina source-backed pre-match refresh

Apply migration `0013_tregu_pre_match_refresh_audit.sql`, then run `npm run tregu:argentina-england:refresh` every two minutes on the VPS. The runner invokes last30days/ScrapeCreators for discovery only and posts no Groq credential; the protected server route uses `GROQ_API_KEY` exclusively server-side. It retains only ESPN/FIFA/reputable non-social, snippet-backed URLs that name both teams, requires Groq to cite two independent retained publishers, and declines movement when evidence is insufficient or not material.

The database locks the specific open ESPN market before recording a scan or applying a three-way reference. A material update is capped at five percentage points per outcome, normalized, writes a `pre_match_groq` snapshot, and cannot alter 383C balances, positions, or transactions. The card shows a static, accessible Groq/market-scan dot with the last successful scan and `Aktiv`/`Healthy`/`Stale` state; it also labels ESPN lineups as confirmed only when both teams have exactly eleven supplied starters, otherwise as unknown rather than predicted.

## England–Argentina Flashscore supplemental live stats

For ESPN event `760515`, the live processor reads Flashscore's public World Cup competition page and only follows a public match URL after the page itself identifies the exact England–Argentina pairing. No login, private endpoint, CAPTCHA workaround, or fabricated match URL is used. Returned Flashscore xG, shots, shots on target, possession, and corners are merged per metric only when at least as fresh as ESPN, labeled `Flashscore`, and retained with a source URL, fetch timestamp, and availability/reason audit in `live_score_state` and the ESPN-backed sport-oracle record.

ESPN remains authoritative for event mapping, score/clock, final lock, and settlement. If Flashscore's public page blocks access, has no matching event, or does not expose a metric, the card explicitly says `Flashscore i padisponueshëm` and continues with ESPN data. xG is rendered only when actually supplied by a source.
