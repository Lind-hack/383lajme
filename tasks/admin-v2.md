# Admin v2 — rebuild

Branch `feat/admin-v2`. Started 2026-09-04. Ships to a Vercel preview, not main.

## Why this is a rebuild and not a polish pass

The panel is pointed at the wrong database. Measured, not inferred:

| store | rows | who reads it |
|---|---|---|
| Supabase `news_articles` | 84 | the live site (`lib/db.ts:206`) |
| `data/auto-articles/*.json` | 1074 | the admin panel (`app/admin/page.tsx:52`) |
| slugs in both | **0** | — |

`/api/edit` and `/api/admin/articles` write only to the JSON files via
`lib/github-articles.ts`. Nothing in `app/`, `lib/` or `scripts/` ever updates
`news_articles`; the pipeline is its only writer
(`scripts/codex_automation_support.py:1759`). Those JSON batches are the
*outage fallback* — `lib/db.ts:222` reads them only when Supabase fails.

So every edit and delete in the admin today is a no-op against production, and
the 84 live articles are invisible to the operator.

The lag has the same root: `loadArticlesWithFiles()` reads all 130 JSON files,
1,228 articles, **3.75 MB including full bodies** (41% of the payload), hands
them to a client component as props, and renders every row unvirtualized.
Repointing at Supabase with server-side paging removes the cause rather than
optimizing it.

## Decisions taken (2026-09-04)

1. Panel manages Supabase `news_articles` only. The 1,074 disk articles stay on
   disk as the fallback they were meant to be. No import.
2. Ineligible dossiers are removed through a review-and-purge screen that shows
   *why* each is ineligible. No blind rule-based mass delete.
3. Tailwind v4 + lucide, already installed. No shadcn — it would introduce
   theming variables into a codebase that has none.
4. Branch + Vercel preview. Nothing touches 383ks.com until merged.

## Design

Operate mode (impeccable). Earned familiarity; the tool disappears into the
task. Restrained color — `#FF4422` for primary action and current selection
only, never decoration. One family (Manrope) on a fixed rem scale. Density is
allowed. Skeletons, not spinners. Inline over modal. Drawn lucide icons, never
emoji. `tabular-nums` on every comparable number, matching the Tregu rule.

## Tasks

### Phase 0 — foundation
- [x] Branch, plan
- [ ] `lib/admin/articles.ts` — server-side list/search/paginate against `news_articles`
- [ ] `app/api/admin/articles` — PATCH + DELETE against Supabase, admin-session gated
- [ ] Admin shell: responsive nav across Artikuj / Dosje / Tregu / Sondazhi / Reagimi
- [ ] Admin CSS layer in `app/admin/admin.css`, scoped, no leak into the site

### Phase 1 — articles
- [ ] Server-paginated list, real search (title, excerpt, body, source, category)
- [ ] Category + date filters, sort by date/score
- [ ] Inline edit, optimistic save, error recovery
- [ ] Delete with an in-page confirm, not `window.confirm`

### Phase 2 — dosje
- [ ] Link from the main panel (missing today)
- [ ] Per-topic timeline: each milestone with citations, matched 383 articles,
      image and video thumbnails the operator can actually eyeball
- [ ] Eligibility screen: why each dossier is ineligible, per-row + bulk delete

### Phase 3 — tregu refreshes
- [ ] Refresh feed from `market_snapshots`: when, which market, how far the
      probability moved, and the cited evidence that moved it
- [ ] Handle null `ai_prob` — sport markets are scraper-priced, not Groq-priced

### Phase 4 — verify
- [ ] `npm test` green
- [ ] `npm run build` clean
- [ ] Desktop + mobile pass
- [ ] web-design-guidelines pre-ship review
