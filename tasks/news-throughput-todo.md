# Balanced news throughput checklist

- [x] Inspect current main and live runtime, source health and per-category losses.
- [x] Research five independent dimensions and inspect an official scraping skill.
- [x] Confirm mandatory photos and permission for relevant cross-batch photo reuse.
- [x] Repair article-date extraction and expose source-content diagnostics.
- [x] Repair grounded photo subjects and rights-safe alternative subjects.
- [x] Implement two-to-three category allocation, honest shortages and productive refill.
- [x] Enforce Luna/max/Codex OAuth without API fallback and bounded work.
- [x] Verify empty editorial results and optional rounds preserve approved work.
- [ ] Review full changes; run source, photo, editorial, publication and scheduling tests plus build.
- [ ] Push intended clean changes to main; verify Railway production SHA/source.
- [ ] Install committed versioned worker without interrupting a production run.
- [ ] Verify full seven-desk QA and actual balanced production publication/category pages.

The final throughput item remains open until actual output proves it. Do not replace this with a weaker smoke-test success criterion.

## Verification 2026-10-21

- Local relevant suite: 188 local tests passed (two Linux-only skips). The initial 186-test committed staging suite passed fully on Linux, including process-group cleanup; final follow-up Linux checks pending.
- npm run build passed; Bash syntax and diff whitespace checks passed.
- Full throughput and production release remain unverified. Current scheduled worker is active; staging must not change its symlink or shared state.
