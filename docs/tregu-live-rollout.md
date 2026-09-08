# Tregu live markets rollout

Local implementation includes mobile discovery and restoration, competition card/receipt themes, taller charts, coin-denominated cash-out, basketball discovery and clock model, football remaining-goals model, and F1 timing enrichment/result recovery.

## Required database release

Apply `0069_tregu_live_score_moves.sql` and `0070_tregu_sell_coins.sql` through the authenticated Supabase migration connection before releasing the UI. Neither migration has been executed here: Vercel exposed environment names but returned empty values. SQL transaction integration verification still requires that connection.

Verify cash-out in a test account for binary, football, basketball and F1: partial requested coins, Sell all, insufficient holding, closed market, simultaneous trades, and repeat request behavior. The existing sell routines own balances and ledger writes; the wrapper resolves coins under the same market lock.

## Monza recovery

Exact target: `f1-race-winner-f1-2026-09-06-monza`, market `42eff465-8429-41d6-948d-20f259b006d1`, OpenF1 session `11361`. Published classification identifies ANT, car 12, 53 laps. The helper verifies the configured session and completed result before writing.

With a securely configured environment, run `node scripts/recover-f1-results.mjs --slug=f1-race-winner-f1-2026-09-06-monza` first. Add `--apply` only after matching readback. Application invokes the existing settlement pass, which processes all already-due verified markets; it does not target arbitrary open markets.

## Scheduler and data limits

Confirm the production scheduler POSTs `/api/automation/tregu/live-sports` every 120 seconds using the existing automation credential. This workspace has not verified or changed that external scheduler. GitHub's checked-in news backup runs every 30 minutes and is not the sports scheduler.

Live OpenF1 telemetry needs an authenticated subscription during active sessions. Dashboard fallback has fewer metrics. The model uses supplied timing, tyre age, recent pace and measured rain; weather radar forecasts and unreported mechanical condition are not available and are not fabricated. Probabilities are heuristic estimates, not a calibrated guarantee.

Pregame football refresh uses provider moneylines and confirmed provider roster absences; this is not unrestricted news sentiment analysis. Basketball discovers published NBA/FIBA fixtures within 72 hours and does not invent games when schedules are empty. Kosovo league discovery still needs a suitable provider.

## GitHub-only production release

Preserve unrelated `app/page.tsx`, `components/category-explorer.tsx` and `docs/ad-strategy-383.pdf` changes. Test and build the intended clean commit, push `origin/main`, then verify the GitHub-triggered Vercel SHA through `/api/deployment-info`. No direct Vercel production deployment.

F1 UI marker is now `race-live-v4`; the user's removal request supersedes the old 22-grid-slot visual check. Verify zero orange grid slots, visible taller chart and driver trading choices instead.

## Local validation

- 260 relevant sports/trading/deployment-guard tests passed.
- `npm run build` passed.
- 390px viewport: no horizontal document overflow; Champions League filter shows 18 current matching cards and scrolls the results heading to 120px below the viewport top.
- Back from a market restores its prior card within 20px.
- Exact Monza recovery dry run returned ANT for session 11361; no write performed.
- Impeccable detector reported only advisory existing typography-ramp discrepancies.
