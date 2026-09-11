# Plan: close the six outstanding Tregu items

_Locked via claudex-loop — by Claude + Lind_

## Goal

Six items were left open after the `9a174e9` release. Recon proved one is already done, two
are blocked by the sports calendar rather than by code, and three need work. This plan closes
what can be closed with evidence, converts the calendar-blocked pair into replay proof against
real captured provider payloads, and records an explicit decision on radar rather than leaving
it as a silent gap.

Production context: `www.383ks.com` still publishes Vercel DNS records and returns 402, so all
VPS automation has been dead since 2026-09-10T21:46Z. Supabase and the provider APIs are
independent of Vercel and remain reachable, which is what makes offline verification possible.

## Approach

1. **Item 3 — settlement → payout: VERIFIED, no code change.**
   Evidence already gathered from production Supabase:
   - `football-uefa-champions-401915441`: `settlement_due_at 21:05:00` → `resolved_at 21:06:22`
     (~82s, consistent with the two-minute lane).
   - Matching `transactions` rows, `type=payout`, `meta.settlement=official_espn_final`.
   - `sport_market_settlements` rows all carry a non-null `transaction_id`, one per
     (market, user, side) — the exactly-once guarantee holding in production.
   - Repeats independently on 2026-09-04, 09-05, 09-06, 09-09 and 09-10.
   Record this in the QA doc. Do not re-run broad tests to "re-confirm" it.

2. **Item 3b — two stranded F1 markets.**
   `f1-race-winner-f1-2026-08-23-zandvoort` and `kush-fiton-cmimin-e-madh-te-hungarise-2026`
   are `closed` with `outcome IS NULL`, no `settlement_due_at`, and **0 holders**. No user
   funds are affected. Recover them with the existing `scripts/recover-f1-results.mjs` once
   automation is reachable; do not hand-write a settlement path for them.

3. **Item 4 — news generation, two-stage.**
   Root cause: `run-tregu-daily-drafts.mjs` sends one prompt carrying 10 quality rules plus a
   10-field mandatory contract, and rule 9 explicitly licenses returning zero. That contract was
   authored for Codex/GPT-5; it is now executed by Groq via `marketAiChat`. Groq resolves the
   overload by returning `{"markets":[]}` — every run since 2026-08-28.
   Fix: split one hard task into two easy ones.
   - Stage 1 — shortlist: a short prompt asking only for 6–10 candidate topics from the supplied
     articles (`topic_key`, one-line `decision_point`, `source_slugs`). No contract fields.
   - Stage 2 — contract: per shortlisted topic, fill the full `news-event-v3` contract.
   - Every existing quality gate (`draftViolation`, `evaluateDailyMarketCandidate`,
     `dailyDraftPublicationReason`) stays untouched and still runs. The two-stage change affects
     only how candidates are produced, never what is allowed to publish.
   - Diagnose before and after against real articles pulled from Supabase, calling Groq directly,
     so the fix is measured rather than assumed.

4. **Item 5 — lineups: stop the wasted fetch only.**
   `football-pre-match.mjs:119` discards `team_news` whenever a bookmaker line exists, which is
   defensible: bookmakers already price confirmed absences, and applying a haircut on top would
   double-count. The real defect is that `runUpcomingFootballTemplateAutomation` calls
   `fetchPregameRoster` for every fixture on every refresh and then throws the result away —
   roughly 136 wasted ESPN requests an hour across ~34 open markets, against a provider that has
   already rate-limited us. Fetch only when no bookmaker line is present.

5. **Item 6 — radar: dropped, documented.**
   MET Norway already supplies the only signal the model consumes (`rain_expected` over the
   race-hour window), with missing precipitation preserved rather than invented. EUMETNET OPERA
   would mean ODIM HDF5 / GeoTIFF parsing and circuit-coordinate grid mapping for a market that
   closes before lights out. Record the decision and the upgrade path; write no radar code, and
   never call the forecast a radar.

6. **Items 1 & 2 — replay against real captured payloads.**
   ESPN returns 0 events for Europa, Conference, Champions and NBA across the next 3 days, so
   live observation is impossible today. Instead drive the real code path with real captured
   payloads and assert the full lifecycle: creation → opening odds → stats → settlement → payout.
   Label every result as replay. Never describe it as live production evidence.

## Key decisions & tradeoffs

- **Two-stage generation over prompt relaxation.** Relaxing the rules would raise candidate count
  by lowering the bar; the gates exist deliberately. Splitting the task raises count by making
  each call tractable for a smaller model, leaving quality enforcement intact.
- **Lineups left out of pricing.** Chosen against the original request, because bookmaker lines
  already incorporate confirmed absences. Applying both double-counts. The genuinely correct
  version — apply only roster news that post-dates the bookmaker snapshot — needs timestamp
  plumbing that does not exist and is out of scope here.
- **Radar dropped rather than deferred silently.** A forecast is not a radar; saying so plainly
  is better than a half-built integration.
- **Replay is labelled, never upgraded to "verified live".** Empty provider windows and replays
  do not prove live lifecycle, per the standing instruction in the handoff.

## Assumptions

Confirmed ledger (sources in the session transcript):
1. Item 3 done — Supabase `transactions` / `sport_market_settlements` / `markets`.
2. Items 1–2 calendar-blocked — live ESPN scoreboard returns 0 events.
3. Item 4 cause is prompt/model mismatch, not the gates — `tregu-automation.mjs:98` correctly
   enforces 720–2160h for the event contract. An earlier claim of a 2–7 day bug was wrong.
4. Item 4 untestable end-to-end while `www` is 402; generation testable offline via Supabase + Groq.
5. Two stranded F1 markets, 0 holders.
6. `resolve_market` is PO/JO only; sport settles via `settle_due_sport_markets`; both wired into
   the two-minute lane at `tregu-automation-server.ts:772,783`.

## Risks / open questions

- **DNS is the hard blocker.** Nothing ships to production verified until `www` resolves away
  from the disabled Vercel deployment. Commits will stack unverified until then.
- The apex currently serves `commit_sha: null`, `deployment_source: "unverified"` — not a GitHub
  deployment. `9a174e9` has never been live.
- Two-stage generation doubles Groq calls per run. Free tier, run once per four-hour window, so
  cost is not a concern; latency rises modestly.
- Replay proves the code path, not provider behaviour drift at real kickoff.

## Out of scope

- Any change to the quality gates or the six-per-day publication limit.
- Radar implementation.
- Lineup-driven pricing changes.
- Touching `.env.automation` or repointing `TREGU_AUTOMATION_URL` without explicit instruction.
- `stock_signal.py` / `futures_signal.py` (different repo and hard rules).
