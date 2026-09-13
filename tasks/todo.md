# Trade page: navigation, related odds, receipt colour

Plan: `C:\Users\PC1\.claude\plans\now-lets-fix-the-zany-pinwheel.md`
Branch: `codex/tregu-production-release` → `origin/main` (Railway auto-deploys).

## 1 — Navigation
- [ ] `.tregu-sticky-back` actually sticky (globals.css:13461 + mobile 13584)
- [ ] `.tregu-tabs` stop vertical drift on horizontal swipe (globals.css:4212)
- [ ] Deep-link social tabs via `?tab=` + close ARIA gaps (market-social.tsx)

## 2 — Related events odds
- [ ] `[slug]/route.ts` select `market_type, outcome_quantities`
- [ ] Branch to `lmsrSportOutcomePrices`, emit leader + outcome probabilities
- [ ] Render "Favourite NN%" at page.tsx:2027

## 3 — Receipt colour
- [ ] `lib/tregu-receipt-theme.mjs` + `.d.mts` + `.test.mjs`
- [ ] ESPN `alternateColor` → payload (espn-upcoming-football, football-market-format, route)
- [ ] Narrow the `[data-competition]` wash leak (globals.css:15158) — own commit
- [ ] Wash → gradient with old mix as var() fallback
- [ ] Ink-relative base rules (13561-13573 + 14203-14290) — dark-ink receipts are new
- [ ] Drop char-hash finish; `page.tsx` resolver
- [ ] `mobile-trade-sheet.tsx` variables + content scrim

## Traps
- `tregu-recorded-market-ui.test.mjs:125` asserts the literal `tradeThemeColor(...)` source string
- `tregu-recorded-market-ui.test.mjs:131` asserts the reduced-motion block mentions the wash
- Regression guard: UEFA cups / nations / basketball receipts must be unchanged
- `rm -rf .next` before every visual check (Turbopack stale CSS, 3x last session)
