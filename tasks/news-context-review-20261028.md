# Independent event context and publication review

The requested outcome is to stop separate phrasings/angles of the same news
event from appearing as separate articles, verify within-batch photo identity,
and require source originality plus actual public-content readback before a run
is described as complete. Kosovë and Shqipëri retain the same source-expression
and close-translation checks as other desks. This work does not claim the wider
20-article/category-throughput goal is achieved.

## Reproduced gaps

- Early semantic deduplication only sent pairs above a lexical similarity
  threshold to its model judge. A low-overlap Rama/TVSH retelling fixture was
  outside that threshold, including when the older article had another category.
- Direct Supabase publication rechecked identities/headlines and only clear
  within-batch lexical repeats; it required no independent event-context receipt.
- Batch validation compared image URL strings. Commons thumbnail/original URLs
  and identical bytes at different hosts could appear distinct.
- The hourly public check required HTTP 200 and a slug anywhere in the HTML;
  it did not establish that visible article copy matched the reviewed article.

## Implementation

`news_context_review.py` independently compares the complete finished batch
with complete published copy from the preceding 36 hours, across categories,
and each draft with all preceding siblings. History is paged without the old
500-record ceiling, then split into bounded groups; no lexical prefilter selects
which history reaches this reviewer. Every history group must explicitly approve
a draft. Invalid/missing decisions hold that draft. Located passages are required
for both the draft event and any identified retelling. Genuine separate subsequent
developments remain allowed. A shared subject or photo alone is not a duplicate.

The receipt binds approved prose/evidence identity/photo metadata and preceding
siblings. Both Git and Supabase publication verify it against current history.
Unchanged history rows may age out of the moving window; new or edited rows
invalidate the receipt. Approval expires after one hour. A reviewer outage or
incomplete review cannot be reported as a completed no-news run. Context work
uses the existing GPT-6 Luna/max Codex OAuth runtime, inline complete evidence
where it fits and file reads otherwise. Its final shared deadline ends at minute
53; the existing 55-minute process limit still covers all publication work.

Batch image validation checks normalized Commons file identity and prepared
SHA-256 digests as well as existing URL/dimension/rights/native-review gates.
Dynamic image URL query identifiers remain distinct. There is no cross-hour
photo ban. The 730-day portrait limit, source access rules and copyright review
policy have not changed.

Public readback now parses the visible article story, comparing the exact
headline, category, excerpt, entire body paragraph list and hero photo (or the
existing supported official-video iframe). Script/hydration data cannot substitute
for actual story markup. It fails before completion reporting on any mismatch.
Database field/provenance readback remains required. No existing articles are
deleted by this change.

## Verification and release status

- Windows regression suite: 146 tests passed, two native Bash checks skipped.
- Production application build passed.
- An existing 12-article production batch passed real public-content readback;
  this is readback evidence, not proof of the new model reviewer in production.
- Independent review found and prompted fixes for moving-window expiry,
  malformed verdict isolation, official-video rendering, HTML paragraph splitting
  and unreviewed paragraph suffixes. Each has regression coverage.
- Native Linux checks and real OAuth model QA remain pending at this checkpoint.
- No production activation or push has occurred. The explicit current user
  deployment policy requires Vercel GitHub integration; current GitHub deployment
  records identify Railway. This mismatch needs resolution before a release
  that could update production domains.

Local verification evidence is in
`C:/Users/PC1/.codex/visualizations/2026/10/28/01a18336-eb9c-7b90-a6b6-1fb23252d7ad/news-review-verification/`.
