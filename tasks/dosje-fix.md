# Dosje — the file/database split, and what the crons were actually doing

Working tree on `master`, not committed. 671 tests pass, `next build` clean.

## What was wrong

Four failures, three of them silent.

**1. The two halves had drifted.** `lib/topics.mjs` holds 6 topics; `dosje_topics`
holds 18 (0064 added 12). Every public surface resolved a slug through
`topicBySlug()` against the file, so approving one of the twelve in `/admin/dosje`
produced a **404** — live, sourced, unreachable. The same file-only lookup ran the
archive half (`timelineFor` → `articlesForTopic` → `matchTopic(article, TOPICS)`),
the homepage strip and the article rail, so a database-only subject could never
attract an article either.

**2. `/dosje` did not exist.** Only `/dosje/[slug]`. A reader reached a dossier
through an article chip or the homepage strip, both of which surface one only when
a recent article happens to match — so a subject covered for a year was
unreachable in a week nothing matched it. No dossier was in the sitemap either.

**3. Reverify was chasing placeholders.** 0052 recorded two provenance notes as
citations; `url` is `not null check (url ~ '^https://')` so the note got
`https://example.invalid/unverified`. 0054's link-rot job cannot tell a note from
a link: it fetched a reserved hostname nightly, counted the failures and mailed
the newsroom that a source had newly died — 5 consecutive failures for a host
RFC 2606 guarantees can never exist.

**4. The topics did not describe the coverage.** Measured on the 1,228 articles on
disk (2026-03-30 → 2026-08-29): the 6 file topics match 120 (9.8%), healthy. The
12 subjects 0064 added match **19 between them, and 6 match nothing at all** —
Superliga, Olympians, KEK, Dua Lipa, Rita Ora, Bebe Rexha. The miss is the same
each time: the subject is Kosovar and the coverage is not. 383's sport is
Barcelona, the Premier League, the World Cup and Messi; its showbiz is Taylor
Swift; its technology — 117 articles, third-largest category — had no dossier.

Separately: `news_articles` is a rolling **61 rows across 3 days**. The subjects
cron reads only that, which is why the last two runs logged `matched=0` and
`dosje_article_topics` is empty. `Dosje research` has returned `no_candidate` ever
since; it needs 3 matched articles across 2 days and never gets one.

## Done

- [x] `dosjeUniverse()` in `lib/dosje-entries.ts` — the union of both halves, file
      vocabulary winning where both know a subject, mirroring what
      `app/api/automation/dosje/subjects` already did. One answer to "which
      dossier owns this story", not two.
- [x] `timelineFor` / `articlesForTopic` / `articleMatchesTopic` / `topicForArticle`
      / `dosjeFeedEntries` take an optional universe; default unchanged, so the
      59 existing matcher tests still hold.
- [x] `/dosje/[slug]` resolves, prebuilds and lists chips from the union.
      `dynamicParams` stays on, so a subject approved after a build renders on
      first request instead of waiting for a deploy.
- [x] `dosjeFor` uses the database path for an approved topic **with no
      milestones yet**. It used to require one, which sent a reviewed dossier back
      to hand-written history — the exact mixing that module exists to prevent.
- [x] `listDosjeTopics` now selects `anchors, signals, excludes`; without the
      vocabulary a database topic could be listed and linked but never matched.
- [x] New `/dosje` index: sourced badge and recent-coverage count per dossier.
      Dossiers and the index added to the sitemap.
- [x] `isFetchableCitationUrl` (`lib/dosje-sources.mjs`, 4 tests) — reserved hosts
      per RFC 2606/6761 and non-http schemes. Reverify skips them, advances their
      rotation slot and reports `placeholdersSkipped` apart from real failures.
- [x] `0066_dosje_placeholder_citations.sql` — clears the counters the loop
      accumulated. The rows stay: they are the only provenance for two draft
      moments, and `dosje_reverify` already refused to count them.
- [x] `0067_dosje_topics_measured.sql` — six subjects written against the measured
      vocabulary and scored before proposing. Coverage goes 139 → 279 articles,
      11.3% → 22.7%: `inteligjenca-artificiale` 54, `kupa-boterore-2026` 22,
      `lionel-messi` 19, `merkato-e-transfereve` 19, `taylor-swift` 19,
      `zgjedhjet-ne-kosove` 9. All ship as `draft`. The six dead subjects are
      **retired, not deleted** — the anchors were not wrong, the articles were
      absent — and only where they have no milestones.

## Not verified, and why

- **Neither migration has been applied.** There is no `SUPABASE_SERVICE_ROLE_KEY`
  in `.env.local`, so 0066 and 0067 are written and reviewed but unrun.
- **No approved database-only topic exists to render.** The 404 fix is verified
  structurally — the union resolves, `/dosje/nuk-ekziston` still 404s — but the
  path can only be exercised end to end once 0067 lands and a subject is approved.
- **The index shows "Pa mbulim të fundit" on every row**, which is currently true:
  the live window is 3 days and nothing in it matches. It is not a rendering bug.

## Still open

- **The archive window is the real ceiling.** A dossier is history and
  `news_articles` holds three days of it. `dosje_article_topics` is meant to
  accumulate across runs, and will once matches start, but a subject cannot reach
  the standing bar from a window this short if the bar is measured per scan.
  Worth deciding whether the store should retain more, or whether the disk
  batches should backfill it.
- `scripts/dosje_seed.mjs:105` still writes `https://example.invalid/unverified`
  for any new hand-written milestone. Left alone: it is the seeding script, not a
  live path, but it will reintroduce the rows if re-run.
