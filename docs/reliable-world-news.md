# Reliable World news: accepted implementation spec

Review baseline: `52850284`. Scope is Botë only; preserve other desks.

- Aim five confirmed publications hourly; five is also the minimum success target when supply and services permit.
- Expand twelve registered publishers toward twenty-four with the twelve approved additions.
  Verify actual routes/readability; never equate registration, RSS or preview with a read article.
  Discover feeds, sections and homepage leads; cap unique World discovery at 180, rotate publishers
  and preserve incremental backlog. Public access only; report blocked/stale/unreadable sources.
- Rank complete text plus headline, freshness, homepage prominence and regional relevance.
  Prefer Europe/Balkans/Albanian relevance without reserved slots; immediate worldwide fallback.
- Consider concrete current supported stories from 4/10. Routine single-source news is eligible;
  sensitive/disputed claims need independent corroboration. Keep originality and duplicate gates.
  Allow fifty-word Albanian briefs; prefer 120–220 supported words.
- Inspect original publisher photo pixels and full extracted text for every publication candidate.
  Attempt rendered page capture; labelled photo/text fallback is allowed. Accurate compelling hooks,
  stakes, curiosity and image relevance are editorial estimates, never measured virality.
- Reuse reliable runner: waves twelve, preparation three, individual saved drafts and independent
  approvals, model cutoff minute fifty, outer deadline fifty-five, shared model capacity unchanged.
- Stop model calls on quota; finalize approved work. Separate World reserve max ten, unchanged
  hashes/policy, source age under24h, approval under6h, breaking/time-sensitive under1h,
  fresh image-byte verification. Publication lock, crash recovery and exact persisted readback;
  reserve removal only after confirmation.
- Preserve outcomes; add honest source/readable/image/page/Eval/competitive/draft/approval/reserve/
  confirmed-publication counts and specific shortfalls. Never count captures as completed Evals.
- Agreed test seams: discovery/readability; ranking/eligibility; category outcomes; publication/readback.
  One failing behavior test then minimal fix. Cover source previews/homepages, regional fallback,
  4/10 briefs, sensitive claims, misleading hooks, page fallback, image cache, partial writers,
  quota, reserve expiry, crash recovery and duplicate-free retries.
- Replay captured snapshot without publishing, then live-source dry run and source/visual report.
  Separate Standards and Spec reviews, plus defect-first review against the fixed baseline;
  resolve actionable findings. Linux tests and production build before clean origin/main release
  through GitHub integration; verify website and worker SHA. Observe three scheduled hourly runs.
  Volume is not proof of quality; services/supply outages can legitimately yield zero.

## Preparation recovery after the first production audit

The first publication-enabled audit produced zero drafts because optional reporter-note
calls repeatedly exhausted the preparation budget. World now immediately builds source-bound
fragment notes (or reuses valid cached notes), without optional paraphrasing calls. Writers
still compose original Albanian copy and pass the same independent factual, originality,
context and image checks. Each photo-qualified story is checkpointed individually; a failed
sibling or preparation timeout cannot discard completed checkpoints. Recovery continues
through normal writing and approval, never directly to publication. Checkpoints preserve
the ranked writer order regardless of photo completion order. A complete editorial rejection
is reported as review rejection, without requiring a completion receipt for an empty batch.
Canonical World URL
identity prevents tracking/slash aliases from re-entering the review queue. English match
reports about known sports figures are excluded from World. Cancellation waits for the child
process without competing with its output reader. Showbiz/Economy allocations are unchanged.

World's prepared batch of up to three stories uses separate worker processes for writing
and independent reviews. Mutable model environments and receipts remain isolated. The
existing shared model-slot fairness, quota marker and model/outer deadlines still apply.
Workers save approvals to the existing reserve and never publish. The parent verifies
approval hashes and publishes completed stories through the existing lock and readback.
Restart recovery includes completed receipts in the parallel workers' directories.
World editor and originality stages receive up to 420 seconds so a 360-second model
review is not killed by a shorter outer stage limit. The minute-50 model cutoff and
55-minute outer deadline still cap every stage and worker. A worker verifies its context
receipt against the history snapshot actually reviewed; the parent rechecks current history,
holding changed related stories and permitting only conservatively disjoint additions.
World writing and copy editing use `world_newsroom.md` to avoid supplying unrelated
desk allocations and superseded legacy rules. Writers still receive the complete
article schema. Editors return validated decisions rather than replacement article
schemas. Complete source evidence and original candidate copy remain intact, and
all factual, originality, photo, context and publication checks remain mandatory.
