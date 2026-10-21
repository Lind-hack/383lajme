# Balanced hourly newsroom throughput

## Owner requirements

- Hourly 07:00–23:00 Europe/Warsaw, target 20, each of seven categories normally 2–3 published stories.
- Preserve factual verification, independent composition review, source/category ownership and deduplication. Never invent or weaken copy to reach a quota.
- Every article requires a relevant rights-cleared qualifying photo. Text-only publication is not allowed.
- The owner explicitly permits reusing a relevant credited photo across different hourly batches, with an accurate archive caption; images remain distinct within a batch.
- Every model stage uses GPT-6 Luna at max reasoning via ChatGPT/Codex OAuth. No model/scraping API billing.
- Preserve existing startup/completion emails, scoring and 0.2/hour ranking decay, unrelated work and tasks/todo.md.

## Evidence and approach

Five independent research dimensions covered source access, photo inventory, scraping skills, runtime budgets/recovery, and category/editorial survival. On 20 October the live worker selected 325 leads but reported 29 unreadable-source losses and 202 photo losses. Wrong Wikipedia entity resolution selected Rama the deity, animal tusks and abstract objects for real news subjects. The allocation test explicitly permitted 14 World articles. Some readable Top Channel articles were lost solely because article dates were not extracted. The live worker also contained high-effort overrides and Gemini API routing, contrary to the clarified model contract.

1. Preserve current live worker improvements when bringing them onto current main; keep the newer SMTP implementation. Main and the installed worker have diverged.
2. Repair grounded photo subjects/alternatives and article date extraction; expose inadequate evidence and retrieval diagnostics before expensive work. Permit the specifically authorized cross-batch photo reuse.
3. Reserve two places per available desk before third places; cap each desk at three, total twenty. Keep intended coverage distinct from exhausted inventory and skip impossible refills.
4. Enforce Luna/max/OAuth-only calls, bounded stage deadlines, valid empty editorial outcomes and preservation of approved replacements.
5. Review the actual complete diff, run relevant deterministic regressions and npm run build. Release only committed intended files via origin/main and Railway GitHub integration. Install the committed worker in an isolated versioned release after checking that production is idle.
6. Run a full real-evidence seven-category QA pass with mandatory photos and all editorial gates. Then inspect actual scheduled publication, exact database identities, visible category pages and intended email behavior.

## Scraping recommendation

The official D4Vinci/Scrapling `scrapling-official` skill best fits targeted Python retrieval fallbacks without a paid scraping account. A skill installation is not worker integration. Evidence does not justify routing every candidate through a browser: fourteen sampled articles across all desks were readable with ordinary HTTP. Fix parser/date defects and the larger visual/allocation losses first; add a bounded retrieval fallback only for a demonstrated remaining gap, preserving restricted-content and public-address protections.

## Completion standard

Allocation tests and a two-article smoke run are insufficient. Verify a complete real run reaching 2–3 original, source-verified, photo-qualified published articles in every category (14–20 total, aiming for20). Record shortages honestly. Keep this task incomplete if external inventory/editorial yield or production verification does not prove that standard.
