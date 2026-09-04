# Admin v2 — rebuild

Branch `feat/admin-v2`, pushed 2026-09-04. Vercel preview only; `main` untouched.

## Why this was a rebuild and not a polish pass

The panel was pointed at the wrong database. Measured, not inferred:

| store | rows | who reads it |
|---|---|---|
| Supabase `news_articles` | 84 | the live site (`lib/db.ts:206`) |
| `data/auto-articles/*.json` | 1074 | the old admin panel (`app/admin/page.tsx:52`) |
| slugs in both | **0** | — |

`/api/edit` and `/api/admin/articles` wrote only to the JSON files. Nothing in
`app/`, `lib/` or `scripts/` ever updates `news_articles`; the pipeline is its
only writer (`scripts/codex_automation_support.py:1759`). Those batches are the
outage fallback `lib/db.ts:222` reads when Supabase fails.

Three symptoms, one cause:
1. Every edit and delete was a no-op against production.
2. The `/admin?id=` links the pipeline emails (`scripts/kosovo_pipeline.py:1326`)
   carry `news_articles` ids — 0 of 3 sampled existed in the disk store, so the
   links opened the panel and silently did nothing.
3. The lag: 130 files, 1,228 articles, **3.75 MB** including 1.5 MB of body
   text, serialized into the RSC payload and rendered unvirtualized.

## Done

- [x] Articles read one page of `news_articles`, filtered in Postgres, no body
      in the list payload. Token-AND search over title/excerpt/body/source/slug
      (`lib/admin/search-terms.ts`, 9 tests).
- [x] Writes (`PATCH`/`DELETE`) go to `news_articles` via the service role.
- [x] Nav reaches Dosje, Sondazhi and Reagimi — only Tregu had a link.
- [x] Tregu refresh view over `market_snapshots`: price, step, window move, AI
      gap, and **the cited evidence**, which nothing had ever rendered.
- [x] Dosje cleanup screen: per-topic blockers, selective purge, capped at 50,
      explicit slug list — no rule-driven deletion.
- [x] Dosje timeline: milestone text, citations (publisher, HTTP status, quote,
      0063 Wayback snapshot), and rendered images/video posters.
- [x] Hydration mismatch fixed — dates are formatted server-side in Kosovo time.
- [x] GA consent card and the signup prompt no longer fire inside /admin.
- [x] Entity decoding for scraped citation text (6 tests).
- [x] Pre-ship pass: colour-scheme, touch-action, scroll-margin, autocomplete,
      translate="no", unsaved-changes guard.
- [x] 664 tests pass, `npm run build` clean, console clean.

## Not verified, and why

- **The dosje cleanup screen has never been seen against real drafts.** There is
  no `SUPABASE_SERVICE_ROLE_KEY` in `.env.local`, and RLS hides draft topics
  from the anon key, so locally it lists 1 topic instead of the 13 that exist
  (0064 added 12 as drafts). The screen says so rather than showing a confident
  zero. Verify on the preview, where Vercel supplies the key.
- **Deletion has never been executed.** Same reason. The API is written and
  typechecks; no dossier has actually been deleted by it.
- **The broken-image fallback is unverified in-browser.** The one dead image in
  the data (kallxo.com) started loading again mid-session, so the failure path
  never rendered.

## Left alone deliberately

- `app/admin/AdminClient.tsx` — now orphaned, nothing imports it. Kept rather
  than deleted without asking. It is the old disk-store editor, so leaving it
  is a trap for a future reader; delete it once the branch is accepted.
- `/api/edit` — still writes to `data/auto-articles`. No longer called by the
  panel. Same call: remove it or repoint it.
- `futures_signal.py` and the rest of the automation repo — out of scope.

## Still open from the September audit

- `feat/topic-rail-mobile` / `2bcce11` remains unmerged.
- No CI workflow runs `npm test`.
- The npm cache had grown to 10.7 GB and the disk hit 0 bytes mid-session;
  cleared, 4 stale worktrees pruned, 41 remain.
