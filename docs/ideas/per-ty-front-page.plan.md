# Plan: Për ty becomes the reader's own front page
_Locked via claudex-loop — by Claude + Lind, 2026-10-03_

## Goal
Për ty today reads as a short, uniform list: on live data a reader following Sport,
Teknologji, Kosovë, Kurti, Krasniqi and Prishtina got 2× Kurti, 2× general top
stories, 2× Prishtina, 1× Kosovë — no Sport (7 Sport stories existed, folded away
under "Më shumë") and the 7-day pool has 0 Teknologji. Turn it into **the reader's
own newspaper front page**: still finite (it ends with "Kaq për sot"), but laid out
like a paper — a lead story with a big photo, the numbered edition, then one open
section per thing they follow, plus small boxes. The reader can **shape and style**
their paper, and **share it** (image + a public read-only snapshot link) to
WhatsApp, Instagram, Facebook, Telegram, X, or download it. It should feel alive
and joyful, and stay device-only.

## Approach

### 1. Data — public, same for every reader (`app/per-ty/page.tsx`)
- Keep the 7-day pool (top 100 + newest ≤300).
- **Add a category shelf, kept apart from the pool:** new light query
  `getCategoryShelf(label, { sinceDays: 30, limit: 12 })` in `lib/db.ts`
  (`ARTICLE_COLUMNS_LIGHT`, `published_at >= cutoff`, engagement then recency,
  Supabase + SQLite branches like `getArticles`). Page passes
  `shelf: Record<categoryLabel, FeedArticle[]>` (pool slugs removed) as a **separate
  prop**: it never goes through `rankFeed` (which drops >7 days) and never touches
  edition/progress/read math. Only used to top up a category section with <2 week
  stories; those rows show their date ("12 shtator"). People/cities stay on 7 days.
- Still no personalised server render; `revalidate = 900` stays.

### 2. Pure logic (new, `node --test`-covered, `.mjs` + `.d.mts` like the rest)
- **`lib/paper-prefs.mjs`** — key `383:paper`, `v: 1`. Shape:
  `{ v, style: "klasike"|"moderne"|"nate", accent: "portokalli"|"blu"|"gjelber"|"vjollce"|"kuqe", length: 5|7|10, order: string[], hidden: string[], boxes: { brief, city, tregu, numbers: boolean } }`.
  `normalizePrefs(raw)` accepts junk (optional-chains everything, drops unknown
  keys/values, defaults: klasike, portokalli, 7, all boxes on). `readPrefs/writePrefs`
  wrap localStorage in try/catch. Device-only; not synced (sync carries `cities`
  only — documented, out of scope).
- **`lib/per-ty-paper.mjs`** — `buildPaper(feed, interests, prefs, { homeFrom, shelf })`:
  0. `rankFeed` items gain two additive fields next to `reason`/`kind`:
     `primaryKey` (the follow behind the shown reason: `cat:<label>`, `person:<id>`,
     `city:<id>`, or `learned`/`top`, which never form sections) and `keys: string[]`
     (**every** followed category/person/city the story matches). Sections match on
     `keys`, so a Kurti story that is also Sport can fill the Sport section when the
     Kurti section did not take it. Never match display strings. Rank tests extended.
  1. edition = `buildEdition(feed, { size: prefs.length, perReason: 2, homeFrom })`
     (existing promises kept: ≤ size, ≤2 per reason, rank order, read stays in place).
     `lead` = edition[0], **not duplicated**: it is rendered as item 1 in hero
     form (big image when it has one), items 2..n as numbered rows below.
  2. sections = one per followed thing — key `cat:<label>`, `person:<id>`,
     `city:<id>` — in `prefs.order` (unknown keys ignored, new follows appended in
     default order: home city, people, other cities, categories). Each section: up to
     4 stories whose `keys` include the section key, excluding anything in the edition and anything
     already placed in an earlier section; category sections top up from `shelf`
     when <2. Tests cover shelf fill, multi-key stories and no duplicates. `empty: true` when nothing is left → UI shows Dardani's one honest line
     + link to the tag/category page. Hidden keys skipped. If every section is
     hidden, the paper shows one line "I ke fshehur të gjitha faqet" with a
     "Shfaqi përsëri" button (resets `hidden`).
  3. `minutes` = readingMinutes(edition).
  Replaces `more` (the folded "Më shumë") — its stories now live in sections. The
  day's general "top" leftovers stay with Kryesoret.
- **`lib/paper-snapshot.mjs`** — `encodeSnapshot({ date, name, style, accent, edition: slug[], sections: {key, slugs[]}[] })`
  → base64url of compact JSON; `decodeSnapshot(code)` validates everything
  (slug regex `^[a-z0-9-]{1,120}$`, ≤10 edition slugs, ≤6 sections × ≤4 slugs,
  section `key` must resolve to a known category label / `people.mjs` id /
  `cities.mjs` id — **titles are derived on the server from those canonical lists**,
  never taken from the URL; name through `reader-name`'s normaliser plus a
  letters/space/hyphen/apostrophe whitelist with control and bidi characters
  stripped; date `YYYY-MM-DD`; style/accent enums; total code ≤ 2400 chars) and
  returns `null` on anything off. All dates are `kosovoDateKey()`
  (lib/home-tregu.mjs) for encode, display and expiry; `isExpired(date, today)` → >30 days.
  The snapshot carries **only** slugs, section keys (titles are derived server-side),
  the name (if the toggle is on), style and date — never affinity, read history,
  ledger or reasons.

### 3. UI — split `per-ty-feed.tsx` (764 lines, the graph's hub) as we touch it
`app/per-ty/per-ty-feed.tsx` keeps state + orchestration; new files under `app/per-ty/paper/`:
- `masthead.tsx` — nameplate/issue/name form/greeting/dateline (moved as-is) + share button + "Rregullo" button.
- `front-page.tsx` — lead (big image, headline, excerpt; reason only when
  `!readOnly`) then the numbered edition (existing `EditionRow`), progress
  "3 / 7 lexuar". Shared with the snapshot page via `readOnly`: reasons, read marks,
  "E re" and progress render only when `!readOnly`.
- `section.tsx` — titled section (newspaper rule), 2–4 stories in a compact grid
  (first with image if it has one), empty state line.
- `boxes.tsx` — `DardaniBrief` (moved as-is), `CityBox` (existing HomeCity data,
  promoted to a box with weather/border), `TreguBox` (client-fetches
  `/api/tregu/markets` — the same call the homepage's Tregu band already makes —
  only when the box is on and scrolled within one screen (IntersectionObserver),
  aborted on unmount (AbortController), result kept in `sessionStorage` for 10 min so
  re-renders and return visits in a session do not refetch,
  `pickDailyMarkets(rows,{count:1})`,
  renders `MarketMiniCard`; renders nothing on failure), `NumbersBox` ("Sot në 383":
  stories in today's pool, the reader's `daysWithUs`, streak — honest device numbers
  only, never ranks or percentiles).
- `customize-sheet.tsx` — bottom sheet "Rregullo gazetën": name, style (3), accent
  (5), length (Shkurt/Normal/Gjatë), sections list with up/down buttons + eye toggle
  (buttons, not drag-only — keyboard and screen-reader usable), boxes toggles,
  "+ Shto tema / njerëz" → existing onboarding `editing` flow. Changes apply live.
- `share-sheet.tsx` — preview (the feed-size OG image), "Shfaq emrin tim" toggle
  (default on when a name exists — the nameplate is the point of the card; the
  preview image above the buttons shows exactly the name, stories and section
  titles the public link will carry, with the line "Kushdo me lidhjen e sheh këtë"), buttons: WhatsApp (`https://wa.me/?text=`),
  Instagram (story PNG via `navigator.share({files})`; if files unsupported →
  download + one-line hint), Facebook (`facebook.com/sharer/sharer.php?u=`), Telegram
  (`t.me/share/url`), X (`x.com/intent/post`), Kopjo lidhjen, Shkarko (PNG, both
  sizes), and "Më shumë…" (`navigator.share({url,title})`) where available.
  `track("perty_share", { channel })` via `lib/analytics` (consent handled there) —
  channel only, never the URL, code or name.
- The end card ("Kaq për sot") gains "Ndaje gazetën"; when everything is read it
  becomes "E ke mbaruar gazetën 🎉" with Dardani's happy loop and the share button.
- Theming: `data-style` + `data-accent` on `.perty-paper`, CSS variables in the
  existing Për ty block of `app/globals.css`; "Natë" is a dark paper inside the
  light site. Klasike = current serif masthead.

### 4. Public snapshot
- `app/gazeta/[code]/page.tsx` — server: `decodeSnapshot`; invalid → 404; expired →
  friendly "Kjo gazetë ka skaduar" + CTA. Else new `getArticlesBySlugsLight` (light
  columns; existing `getArticlesBySlugs` untouched), **re-ordered to the decoded slug
  order** (`.in()` returns any order), drop missing,
  render masthead ("Gazeta e Lindit · e shtunë, 3 tetor" or "Gazeta e një lexuesi"
  when the name is off) + `front-page` readOnly + sections + a sticky CTA
  "Bëj gazetën tënde" → `/per-ty`. `robots: noindex`. `generateMetadata` sets
  OG image = `/api/og/gazeta/[code]?f=feed`.
- `app/api/og/gazeta/[code]/route.tsx` — satori, 1080×1350 (`f=feed`) and
  1080×1920 (`f=story`), style/accent honoured, Manrope from disk, lead photo
  re-encoded with sharp — **only the lead's image**, 4 s fetch timeout, 5 MB byte cap,
  falls back to a no-photo layout; light slug query; `console.warn("[gazeta-og] …")`
  on decode/image failure so Railway logs show abuse or breakage. Shared helpers (fonts, remote image → data URL, Dardani PNG)
  extracted from the muaji route into `lib/og-assets.ts`, muaji switched to them
  with no behaviour change. Never fetch our own origin (Railway trap).
  It applies the same `decodeSnapshot` + `isExpired(date, kosovoDateKey())` as the
  page: invalid → 404, expired → 410 with no image. `Cache-Control: public,
  max-age=86400` (no `immutable`, so an expired code stops being served within a day).

### 5. Motion (framer-motion, already used in 23 files)
- "The paper prints": first open per Kosovo day (`383:paper-printed` = date) —
  masthead → lead → edition rows → sections fade+rise 8px, 40 ms stagger, ~300 ms
  ease-out, transform/opacity only. Later visits that day render static.
- Read tick: number → check with a small spring; progress bar width transitions.
- Sheets slide up, drag-down to dismiss, backdrop fade; focus trapped, Esc closes.
- `useReducedMotion()` → no movement anywhere.

### 6. Verification
- `npm test` (new tests for prefs/paper/snapshot incl. junk input, hide-all,
  snapshot order, expiry around Kosovo midnight, bidi/control names, oversize codes),
  `npx tsc --noEmit`, `npm run lint`, `npm run build`.
- Regression checks for the split (manual + existing tests): ledger visit noted once
  per day, issue number, absence/follow-up line, streak, "Harro historikun" clears
  ledger/visits/affinity, signup card after onboarding + sync push on save, brief
  cache hit on reload, 07:00 push offer, wrapped link in the first week.
- Local dev against live Supabase (localhost, public anon key); Playwright/DevTools at
  390×844 and 1440 wide: onboarding → paper → customise (each control) → share sheet
  (each channel's URL) → open the `/gazeta/…` link in a clean context → OG images
  render both sizes. Reduced-motion pass.
- Post-build: design/a11y review against web-design-guidelines + impeccable, motion
  review via improve-animations, code-review-and-quality pass, then Codex
  cross-inspection.

## Key decisions & tradeoffs
- **Finite front page, not an endless feed** (Lind, Q1). Fill comes from layout +
  sections + boxes, not more numbered stories.
- **Share = image + public snapshot link** (Lind, Q2). Snapshot lives entirely in the
  URL: no table, no stored personal data, no abuse surface for guest writes; cost is a
  long URL (~1–2 kB). Rejected: DB short codes (needs a write endpoint for guests,
  rate limiting, and stores what the reader reads).
- **Shared copy shows section titles** (e.g. "Albin Kurti") — that reveals follows;
  mitigated by the preview showing exactly what goes out, the name toggle, and hidden
  sections never being included. Reasons ("Sepse ndjek…") are never shared.
- **Customisation = layout + look** (Lind, Q3); push time stays 07:00 for everyone.
- **Archive shelf only for categories**, to fix empty topic sections without faking
  people/city news; empty sections say so honestly (newsroom supply gap is real).
- **Prefs not synced** across devices (sync API carries cities only).
- Extracting `lib/og-assets.ts` touches the shipped muaji route — accepted to avoid a
  second copy of the font/image/Railway-trap code.

## Toolchain
- Claude build: `framer-motion` (existing), `next/og` + `sharp` (existing). Review
  passes: `web-design-guidelines`, `impeccable`, `improve-animations`,
  `code-review-and-quality` (Claude side). Codex side has `emil-design-eng`,
  `impeccable` installed — usable in the post-build inspection.

## Assumptions
1. Personalisation stays on the device; no personalised server render. — `app/per-ty/page.tsx`, gazeta-jote decisions
2. A shared paper must be a frozen snapshot. — architecture
3. Instagram has no web intent; only `navigator.share` with files (mobile). — `app/muaji/wrapped-stories.tsx`
4. Server-drawn cards via satori with fonts/images read from disk. — `app/api/og/muaji/[month]/[card]/route.tsx`
5. Teknologji/Showbiz/Ekonomi emptiness is newsroom supply; not fixed here. — memory 383-per-ty
6. Motion respects reduced motion. — confirmed in ledger

## Risks / open questions
- URL length on some share targets (X, Facebook sharer) — verify a max-size code works.
- Archive stories could look stale; label them with their date ("12 shtator").
- Tregu box adds a client fetch of the full markets list (same as the homepage
  band) — lazy, aborted on unmount, session-cached, skipped when off. Follow-up
  trigger: if `/api/tregu/markets` p95 in Railway logs passes 1.5 s or its request
  count doubles after release, replace with a cached one-market endpoint.
- Implementation traps (Codex round 3): top-injected items get `primaryKey: "top"`,
  `keys: []`; `keys[]` holds **followed** keys only, never every `articleKeys()` match;
  shelf queries must honour category aliases (Politikë/Siguri → Kosovë) in both the
  Supabase and SQLite paths — tested.
- Safari wipes storage after 7 idle days: prefs reset with everything else (known).
- `per-ty-feed.tsx` split must not change ledger/visit/push behaviour.

## Out of scope
- Newsroom topic quotas (pipeline), push time per reader, syncing prefs, yearly
  wrapped, merging the duplicate visit/streak stores, video export.
