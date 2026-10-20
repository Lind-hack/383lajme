# Plan Review Log: Article page overhaul + dosje rebuild
Phases 0-1 (recon + interrogation) complete — plan locked with Lind 2026-10-21. MAX_ROUNDS=5.
Reviewer: codex-cli 0.146.0, model gpt-5.5 via -c (config pins gpt-6.1-sol, rejected on ChatGPT auth).

## Round 1 — fresh Claude reviewer (Haiku, read-only)
16 findings (8 high, 4 medium, 4 low), VERDICT: REVISE. Full text kept in the session; summary:
H1 approved-insert vs BEFORE INSERT trigger · H2 publish route trusts worker text/http_status, weak auth · H3 emptied TOPICS drops matchGroups so a lone anchor matches · H4 Tregu daily drafts (07:20, Luna) ignored, no hard stop · H5 requestDailyCodex retries on 429 · H6 no server-side market+spark path; PO/JO only valid for binary markets · H7 /tregu/[slug] ignores searchParams · H8 "now showing on" false until revalidatePath · M9 incomplete TOPICS importer list incl. tests · M10 wipe before backfill proven; no restore test · M11 reuse claim RPCs, shared lock · M12 prefer:"gemini" still falls to Groq · L13 separate 150-row query · L14 accuracy notes · L15 slider a11y · L16 ship frontend first.

### Claude's response
Verified H1 (0051:252-254 BEFORE INSERT OR UPDATE; 0057 counts live citations), H3 (lib/dosje-entries.ts:208, dosje-match.mjs scoreTopic fallback), H5 (lib/tregu-daily-codex.mjs:5-16), H4 (tregu-daily-drafts.timer 07:20, TimeoutStartSec=2500). Accepted all 16:
- New step 12: migration 0115 adds match_groups/context/research_groups/primer to dosje_topics, model to milestones, and dosje_publish_bundle RPC (draft → citations → approve per savepoint).
- Publish route re-fetches citations, header-only constant-time auth, revalidatePath per affected article.
- Luna wrapper with LunaLimitError, Gemini-only path, 05:00–06:50 hard window, shared flock, claim RPC reuse.
- Pulse card: client fetch of a new article-market endpoint into a fixed skeleton (live prices beat ISR), binary markets only, ?side= preselect, slider a11y.
- Wipe resequenced: backup + restore test → DB delete → backfill → verify → only then remove the file layer (full importer list).
- Delivery split into 3 ships, frontend first.
Rejected: none.

## Round 2 — same reviewer, resumed
Confirmed fixed: H1 (trigger sequence verified against 0051:252-255 + 0057), H3-H8, M9-M12, L13, L15, L16; savepoint semantics and the 05:00–06:50 window verified clear of all Luna timers. New: (1) HIGH publisher still worker-supplied · (2) topic status unset → moments invisible · (3) backfill 23:00 collides with news run · (4) .mjs worker can't import lib/llm.ts · (5) deadline must be checked inside the retry wrapper · (6) restore test ill-defined · (7) RPC grants/search_path unspecified · (8) searchParams makes /tregu/[slug] dynamic · (9) migration before code; backups dir · (10) .article-dosje is inline, not globals · (11) Luna budget list incomplete. VERDICT: REVISE.

### Claude's response
Accepted 1-9, 11: route derives publisher via publisherOf(url); RPC flips topic to approved iff ≥1 moment approved, maps only P0001/23505 as refusals, grants service_role only with search_path; backfill 23:30–06:50; worker calls Gemini REST directly; deadline checked per attempt inside wrapper; restore test via LIKE…INCLUDING ALL scratch schema in BEGIN…ROLLBACK; ?side read client-side with useSearchParams so the page stays static; migration applied before Ship 2 code; full Luna caller list.
Rejected 10: the plan says the dosje is grid-placed via `.article-dosje`, which is accurate; it never claims the class is in globals.css.

## Round 3 — same reviewer
All round-2 items confirmed fixed (10's rejection accepted). New: (A) HIGH topic upsert could demote a live topic to draft · (B) MED restore test still hits live tables (pg_dump schema-qualifies names) · (C) MED 23:30 backfill not guarded against a long 23:00 news run · (D) LOW-MED useSearchParams needs Suspense. VERDICT: REVISE.

### Claude's response
Accepted all four: ON CONFLICT never touches status, approval only in the iff-approved branch; restore test loads a sed-rewritten copy into the scratch schema; backfill window 00:00–06:50 plus a systemctl is-active check on 383-production before the first call; trade panel wrapped in <Suspense>.

## Round 4 — same reviewer
A–D confirmed fixed. No new material problems. Minor: refreshed match_groups can move articles between dossiers → accepted, the email's section 2 now reports moved articles. **VERDICT: APPROVED** (converged in 4 of 5 rounds).

## Act 3 — Build (Ship 1, Claude) + post-build inspection
Built A + C on feat/article-page-overhaul. Deviations from PLAN, all logged here: Tregu card is light (DESIGN.md records a dark card on cream was reverted on sight); market matching runs client-side on the existing /api/tregu/markets response (it already carries q_yes/q_no/b, market_type, spark, history) instead of a new endpoint + spark extraction; /tregu/[slug] untouched because it already preselects via ?ana=po|jo (round-1 H7 was wrong: the page is a client component reading window.location); dosje references stay "Referenca N" without publisher names (site policy); getArticlesBefore({limit:150}) reused instead of a new getRecentArticlesLight. Verified: tsc clean, 1293/1293 lib tests, related scorer 10/10, desktop 1440 + phone 390/312 in dev against production public data.

### Post-build inspection — fresh Claude reviewer (Haiku, read-only), round 1
11 findings: (1) HIGH market widget mounted twice (rail hidden but mounted) · (2) MED whole sticky column taller than viewport hides the market · (3) MED unrelated fallback market for unmapped sections · (4) MED generic words + category clear the floor · (5) MED dateline strip drops quote speakers · (6) MED-LOW declined names miss · (7) LOW all-caps headlines make every word a name · (8) LOW duplicate story in Eksploro · (9) LOW empty dosje row gap on phones · (10) LOW invalid `font: … inherit` shorthand · (11) LOW AGENTS.md/next-env.d.ts rewritten by dev.

### Claude's dispositions
All accepted. (1) useSyncExternalStore media hook: rail or phone stand-in mounts, never both. (2) column no longer sticky; only the market card sticks. (3) fallback kept for sections Tregu covers; elsewhere the market needs relationScore ≥ MIN. (4) a match needs a shared name or ≥3 shared headline stems; generic institution words are not names. (5) no prefix stripping; place datelines are stop words; "Kurti:" splits as an opener. (6) name stems drop case endings. (7) lines >60% capitalised contribute no names. (8) isSameStory filter on explore cards. (9) spacing moved from grid gap to block margins. (10) longhand font props. (11) reverted. Plus web-design-guidelines pass: hover states, touch-action, "…". Re-verified: tsc clean, scorer 10/10, one widget per viewport (2 fetches in dev = Strict Mode), card in view near story end, no horizontal overflow at 390. Inspection rounds used: 1 of 2 (fixes verified directly; no second review needed).
