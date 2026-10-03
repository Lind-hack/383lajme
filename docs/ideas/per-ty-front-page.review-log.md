# Plan Review Log: Për ty front page
Phases 0-1 (recon + interrogation) complete — plan locked with Lind (Q1 front page, Q2 image+snapshot, Q3 layout+look, cosmetics accepted). MAX_ROUNDS=5.

Reviewer: gpt-5.5 via `-c model` override (config pins gpt-6.1-sol, rejected for ChatGPT-account auth; Lind chose per-run override). codex-cli 0.146.0.

## Round 1 — Codex
Material issues I’d require fixed before implementation:

- Archive fill is underspecified/wrong: `getArticles(6, label)` is engagement-sorted, not recent, and after de-dupe + 30-day filtering can return nothing even when category archive exists. Fix: add/use a latest-by-category query with `published_at >= cutoff`, `withBody:false`, enough rows to survive de-dupe.

- Archive stories cannot just enter the same ranked feed: `rankFeed` drops anything older than 7 days via `MAX_AGE_MS`, while the plan wants 30-day archive category fill. Fix: pass `archiveByCategory` separately into `buildPaper`, never through `rankFeed`.

- Section construction depends on display strings like `Sepse ndjek Sport` and `Nga Prishtina`, which are localization/copy brittle and collide with future wording changes. Fix: carry stable match keys (`cat:<label>`, `person:<id>`, `city:<id>`) on ranked items.

- Snapshot article fetch order is not guaranteed: `getArticlesBySlugs()` uses `.in(...)`, so the frozen edition/sections can render shuffled. Fix: reorder fetched articles according to the decoded slug arrays before rendering.

- Public snapshot privacy is weaker than stated: the URL itself exposes selected story slugs, section titles, and maybe name to every share target, log, referrer, and recipient. Fix: make name sharing opt-in, show an explicit “public link includes these sections/stories” preview, and avoid sending full snapshot URLs to analytics.

- `name` default-on in the share sheet is a privacy footgun for a public, durable URL. Fix: default “Shfaq emrin tim” off, or at least require a per-share explicit confirmation.

- Snapshot title validation is too loose: “≤40 chars from reader’s own sections” still allows control/bidi/weird Unicode in a public OG surface. Fix: derive titles from canonical server-known category/person/city names, or strip controls/bidi and enforce a conservative printable whitelist.

- Snapshot expiry/date is ambiguous: `YYYY-MM-DD` and `today` are not defined as Kosovo date vs server UTC, which can expire/share differently around midnight. Fix: use `kosovoDateKey()` consistently for encode, decode, expiry, and display.

- OG route is a public compute amplifier: attacker-generated valid codes can force DB slug lookups plus remote image fetch + `sharp` work on unbounded unique URLs. Fix: use light article queries, strict time/byte limits, only fetch one lead image, and add observable warnings/counters for decode/image failures.

- `getArticlesBySlugs()` currently selects full article bodies, wasting bandwidth for snapshot and OG pages. Fix: add `getArticlesBySlugsLight(slugs)` using `ARTICLE_COLUMNS_LIGHT`.

- Lead rendering is ambiguous and risks duplicate display: “lead rendered big, numbering unchanged” can mean the same story appears both as hero and row. Fix: specify that the lead is the first numbered item rendered in hero form, not duplicated, with its original number.

- Custom prefs can hide every section/box and choose a short edition, producing a “front page” with almost nothing and no recovery except settings. Fix: enforce at least one visible section or show a persistent “restore sections” control.

- TreguBox uses `/api/tregu/markets`, an expensive no-store endpoint returning full markets, activity, history, and media for one mini card. Fix: add a lightweight cached endpoint or query mode for one daily mini market.

- The plan says `track("perty_share")` but does not import or consent-check against the existing analytics helper. Fix: use `lib/analytics.track` only, with channel-only params and no URL/code/name fields.

- `archive: true` is planned on `FeedArticle` but the existing type and downstream item types do not include it. Fix: update shared types/tests explicitly and keep archive articles out of read/progress/edition math.

- Verification misses regressions for existing guarantees: ledger/visit/streak/reset, signup sync, and brief caching are easy to break during the split. Fix: add focused tests/manual checks for those behaviors alongside the new paper tests.

VERDICT: REVISE

### Claude's response
Accepted (verified in code): archive query (getArticles is engagement-sorted with no date window -> new light `getCategoryShelf` with cutoff); archive kept out of rankFeed (MAX_AGE_MS 7d confirmed) as a separate `shelf` prop; stable `key` on ranked items; snapshot reorder after `.in()`; canonical server-derived section titles (keys in URL, not text); Kosovo date via kosovoDateKey everywhere; OG limits (lead image only, timeout, byte cap, warn logs); light slug query; lead not duplicated; hide-all recovery; analytics via lib/analytics with channel only; archive out of edition/progress math; regression checks for the split.
Partially accepted: Tregu box stays on /api/tregu/markets because the homepage band already makes this exact call (precedent, no new endpoint); added a visibility-gated lazy fetch and a follow-up note.
Rejected: name default-off. The nameplate ("Gazeta e Lindit") is the product, and Lind approved the preview with the toggle on. Mitigated instead: the preview image shows exactly what the public link carries, plus the explicit line "Kushdo me lidhjen e sheh këtë".

## Round 2 — Codex
Most prior findings are addressed: separate shelf, light slug fetch, order restoration, canonical snapshot section titles, Kosovo dates, lead de-dupe, hide-all recovery, analytics hygiene, OG image limits, and split regression checks are now in the plan.

Remaining material issues:

- `buildPaper(feed, interests, prefs, { homeFrom })` has no `shelf` argument, but section top-up depends on `shelf`. Fix: make the signature explicit, e.g. `buildPaper(feed, interests, prefs, { homeFrom, shelf })`, and test shelf fill there.

- A single stable `key` on ranked items is not enough for sections. `rankFeed` currently picks one primary reason; an article matching `person:kurti` and `cat:Sport` would only be available to one section, so followed categories can still look empty incorrectly. Fix: add `keys: string[]` for all matched follows plus `primaryKey` for reason/ordering; sections match `keys`.

- `learned:<label>` is undefined as a stable key: learned items do not have a canonical label and do not correspond to a section. Fix: use `key: "learned"` or omit learned from section keys entirely.

- Snapshot expiry is specified for `app/gazeta/[code]/page.tsx`, but not for `/api/og/gazeta/[code]`; expired private-ish share images could keep rendering even after the page says expired. Fix: OG route must also call `isExpired(kosovoDateKey())` and return a non-personal expired image or 404/410.

- The plan still has an internal contradiction: `encodeSnapshot` stores `{key, slugs[]}`, but later says the snapshot carries “section titles the reader saw.” Fix: update the privacy/data statement to say it carries section keys, with titles derived server-side.

- `front-page.tsx` says it renders lead “reason,” then says `readOnly` has “no reasons.” Fix: make the prop contract explicit: reasons render only when `!readOnly`.

- TreguBox remains a known load risk: `/api/tregu/markets` is dynamic/no-store and returns full history/activity/media for one mini card; “homepage does it too” is precedent, not proof it scales on another route. Fix: at minimum abort on unmount, cache the client result per session, and add a follow-up threshold/metric for replacing it with a lightweight endpoint.

VERDICT: REVISE

### Claude's response
Accepted all 7: explicit `shelf` in buildPaper; `primaryKey` + `keys[]` (rankFeed does pick one primary reason per story, so a single key would starve sections); learned/top never form sections; OG route shares expiry (410) and drops `immutable`; privacy statement fixed to say keys not titles; readOnly prop contract explicit; Tregu fetch aborted on unmount, session-cached 10 min, with a measurable trigger for a lighter endpoint.

## Round 3 — Codex
Round 2 fixes address my prior material findings: `shelf` is now explicit, ranked items have `primaryKey` plus multi-match `keys[]`, learned/top no longer pretend to be section keys, OG expiry is enforced, snapshot wording is consistent, `readOnly` behavior is explicit, and the Tregu risk now has abort/session-cache plus a measurable follow-up trigger.

No new blocker jumped out. Implementation traps to watch, but not plan-stoppers:

- Ensure top-injected `rankFeed` items actually get `primaryKey: "top"` and `keys: []`, otherwise section logic may see `undefined`.
- Ensure `keys[]` contains followed keys only, not every possible `articleKeys()` match, so section construction cannot surface a non-followed person/city by accident.
- For shelf rows, test category alias behavior in both Supabase and SQLite paths; old raw categories like `Politikë`/`Siguri` need to fill the canonical `Kosovë` shelf.

VERDICT: APPROVED

### Resolution
Converged: APPROVED in 3 rounds. The three implementation traps were added to Risks.
