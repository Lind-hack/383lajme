# F1 — live odds, auto-publish, and the race card

Working tree on `main`, uncommitted. 672 tests pass, `next build` clean.

## Done and verified in the browser

- [x] **Top three drivers on the main card.** New `components/tregu/f1-top-three.tsx`:
      rank, official 2026 portrait ringed in the constructor's colour, name, team,
      and win probability in tabular numerals. The bar under each name is the
      Tregu floor's own order-book depth bar, sized to that driver's share **of
      the leader's** — against a full 0–100% track every bar sat in the first
      third and the ranking was carried by the number alone.
- [x] **One treatment for both F1 card kinds.** The championship rows and the race
      rows are now the same component; championship keeps its points-and-gap line
      through an optional `meta` slot, and rows keep their per-driver deep link.
- [x] **The next race leads the carousel.** `featuredMarketScore` is `movement × 5`,
      so a race that has never been repriced could not reach the front and always
      lost to whichever football fixture ticked last. `app/tregu/page.tsx` now
      pins the soonest-closing open race into slot 1 and ranks the rest on merit.
- [x] **`headshot_url` declared on `MiniMarket.sportOutcomes`.** The pipeline has
      written it since `f1-upcoming-race.mjs:170`; the card type never declared it,
      so the portrait was unreachable from the hub.
- [x] **Car art reworked.** Full opacity, top-right, no radial-gradient mask — the
      blend belongs in the asset's alpha, not a gradient ellipse approximating a
      photographic edge. On the featured card the corner is *reserved* rather than
      shared: the headline price and the chart header claim their width back.
- [x] **The close time keeps its corner.** `.tregu-market-top` is
      `justify-content: space-between`, so "Mbyllet 1d" is the right-hand item —
      the exact corner the car wanted, and an absolute car won it. That is the
      wrong way round: the time is information, the car is decoration. On grid
      cards the car is now the last *flex item* of that row rather than an
      overlay, so the browser reserves its width and no overlap is possible at any
      card width. Hidden under 640px, where every corner is spoken for.
      Verified: both featured F1 cards report the close label visible and zero
      text under the car at 1440px and 1283px.
- [x] **Chart draw-in fixed** (from the interrupted Codex goal): `stroke-dasharray`
      moved out of the element and into the keyframes, ending on `none`. The dash
      was measured in user space while `preserveAspectRatio="none"` stretched the
      path ~1.34× horizontally, so the flattest, most-stretched run — the recent
      one, on the right — was the part that went missing.

## Not started — the odds pipeline

Most of the machinery already exists and is wired into `lib/tregu-automation-server.ts`.
What is missing is narrower than it looks.

- [ ] **Auto-publish the race.** `lib/f1-upcoming-race.mjs:178` ships the template
      as `status: "draft"`, which is the admin gate to remove. `runUpcomingF1TemplateAutomation`
      already discovers the race 3 days out, builds it and inserts it.
- [ ] **2-minute cadence.** `runTreguLiveAutomation` keys runs with
      `fiveMinuteRunKey(now)`, so a 2-minute caller dedupes as `already_processed`.
      Needs a finer key for the F1 path. **The schedule itself is not in this repo:**
      the primary loop is cron-job.org, GitHub is a 30-minute backup, and GH Actions'
      floor is 5 minutes.
- [ ] **Pre-race news → odds.** Nothing scans F1 news today. OpenF1's `race_control`
      is already fetched but only covers in-race stewarding, so a Thursday grid
      penalty moves nothing. Needs a source (formula1.com / autosport) plus the
      existing Groq evidence path.
- [ ] **In-race repricing.** `fetchOpenF1LiveRace` already returns position, gaps,
      intervals, stints, tyre age, weather and race control; `openF1ToWinnerLeaderboard`
      already turns that into probabilities. This is a cadence problem, not a data one.

## Open question — the 5-point cap

`apply_f1_race_winner_oracle` is called with `p_cap: 0.05` and the database enforces
a 5-point absolute cap per move. A grid penalty for the favourite cannot "take a big
toll" under it: it would converge ~5 points per tick.

Two readings, and this is a product call rather than a technical one:

1. **Keep the cap.** A penalty bleeds in over ~8 minutes of 2-minute ticks. Slower,
   but one bad parse can never crater a market.
2. **Carve out structural events.** A grid penalty, a retirement or a DNF is a fact,
   not an opinion, and a retirement especially *must* go to ~0 immediately — capping
   that would leave the market lying. Opinion-shaped news keeps the 5-point cap.

Recommendation is (2), limited to an explicit allowlist of event types, with the cap
untouched everywhere else.
