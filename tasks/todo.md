# Nations League — fifth competition treatment

Branch: `codex/tregu-production-release` → `origin/main` (Railway auto-deploys).
League key: **`uefa.nations`** (ESPN, verified: 100 upcoming fixtures incl. Kosovo v Ireland 24 Sep).

Decisions taken with Lind, 2026-09-13:
- **All 100 fixtures** — no division filter, mirror the other leagues exactly.
- **Own football section** — `FOOTBALL_LEAGUES`, alongside the four big leagues.
- **Official UEFA mark** for the logo, same provenance as the other three UEFA logos.

## A — Data pipeline (same algorithms, upcoming only)
- [x] `lib/espn-upcoming-football.mjs` — add `uefa.nations` to `LEAGUES`
- [x] `lib/tregu-sport-sections.mjs` — add to `FOOTBALL_LEAGUES` (own section)
- [x] `lib/flashscore-live-stats.mjs` — live-stats URL
- [x] `lib/tregu-sport-branding.ts` — `SPORT_BRANDS` entry (label, shortLabel, logo, accent, tint)

## B — Assets
- [x] `public/logos/uefanationsleague.svg` — official mark
- [x] `public/audio/tregu-success/nations-<t>-v2.wav` — YouTube `Wb94YpYDuck` 4:14→4:17, 0.4s fade out
- [x] `scripts/extract-tregu-success-audio.mjs` — register the `nations` clip so it rebuilds

## C — Competition treatment (card + banner + receipt)
- [x] `components/tregu/competition-art.tsx` — **guard `uefa.nations` out of the Europa fallback**
      (`startsWith("uefa.")` currently drops it into the beams+trophy branch)
- [x] `components/tregu/competition-artwork.tsx` — Nations branch: diamond-flag edge weave + embossed field
- [x] `lib/tregu-sport-branding.ts` — register the pattern art
- [x] `app/globals.css` — `[data-competition="uefa.nations"]` block at the tail, all three surfaces
      Light substrate (unlike the other three) — so `contrastSafeTeamColor()`'s cream assumption holds
- [x] `prefers-reduced-motion` static fallback (DESIGN.md requires a *designed* one, not `animation: none`)

## D — Sound
- [x] `lib/tregu-trade-sound.mjs` — asset, duration, `nations` profile in `resolveTradeSuccessSoundProfile`
- [x] `components/tregu/trade-success-sound.ts` — add `"nations"` to the profile union

## E — Verify
- [x] `app/tregu-preview/uefa/page.tsx` — Nations fixtures + `?receipt=unl`
- [x] `lib/tregu-sport-sections.test.mjs` — update the declared-leagues assertion
- [x] `lib/tregu-market-detail.test.mjs` — sound-profile assertion
- [x] `npm test` (these read component source + globals.css as raw text)
- [x] Browser QA via CUA at 1440 + 400px
- [x] `web-design-guidelines` pre-ship pass

## Done — notes for the next session

- **`competition-art.tsx` trap was real.** `uefa.nations` passes `startsWith("uefa.")`
  and is neither champions nor conference, so it fell into the Europa branch and drew
  beams + a trophy. Explicitly guarded to `return null`.
- **Turbopack served stale CSS twice** during this work. Both times the file on disk was
  correct and the computed style was a version behind; `rm -rf .next` + restart fixed it.
  Read a computed style before judging a screenshot — one visual round here was spent
  assessing a hybrid of new markup and old CSS.
- **The receipt is built for dark competitions.** `.tregu-trade-celebration` sets
  `color:#fff` and spells dividers/secondary text as `rgba(255,255,255,…)` literals, not
  tokens. On a light substrate every one renders white-on-white. Inverted explicitly;
  there is no token to re-scope. **The next light competition must do the same.**
- **Contrast was measured, not eyeballed.** Sampling rendered pixels under each text run
  caught the small type at 1.99:1 where the card looked fine. Fixed by thinning the weave
  in the top/bottom strips (a second, intersected mask layer) and inking the small type.
  Final worst-case: title 5.80:1, brand chip 5.80:1, footer 5.80:1, at 1440 and at 400.
- **The mobile mask override must restate both layers.** Overriding `mask-image` with a
  single layer silently drops the linear thinning and the composite.

## Not done
- Live floor QA — no Nations League market exists yet. First fixtures 24 Sep
  (Kosovë — Irlandë). The treatment is verified on `/tregu-preview/uefa` only.
- The banner (`/tregu/[slug]`) has no preview route; verified by computed style and by
  the shared layer rules, not by eye.
