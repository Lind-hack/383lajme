# Showbiz throughput evaluation — 1 November 2026

Status: local component evaluation. No publishing, push or deployment.

The previous local evaluation yielded two passing articles from 128 readable candidates. The expanded evaluation yielded 12 final passing drafts from a pooled inventory of 229 readable URLs (207 canonical identities). These are different, incrementally collected snapshots; this is not a controlled same-snapshot A/B result or a measured uninterrupted production hour.

## Root causes and changes

- The baseline two-story Showbiz allocation and three-per-desk ceiling persisted in planning, writer slots, refill and final validators. Showbiz now expands with the verified inventory. Other desks retain their three-story ceiling; operator-supplied maximums still apply.
- A discovery limit of 60 and a preparation oversampling limit of 32 prevented processing the complete queue. Showbiz no longer has these numeric limits. Bounded deadlines and pending records still apply.
- Slow webpage captures and one-story native calls consumed the review window. Production Showbiz review can use complete public HTML plus the original article image, in batches of up to four independent decisions with two concurrent native requests. Images are labelled as source images, never publisher layouts. Restricted/incomplete public text remains unusable.
- Prioritize Albanian artists, adult celebrity fashion/photo/public updates and current homepage leads, with publisher turns. Homepage prominence is not measured virality. Matching decisions can be reused for 24 hours only when policy, full source text, image identity and screenshot hashes match; captures and image approvals retain their separate freshness requirements.
- Similar Halloween headlines for different named celebrities could collapse into one event. Disjoint named subjects now remain separate unless reviewed coverage explicitly connects them.
- Narrow topic vocabulary rejected valid short music/artist briefs. Final topic checks now also consider the first 200 body words; entertainment performances are distinguished from sports results.
- Normalization could upgrade a prepared source image URL after native approval, invalidating that approval. Hourly prepared image URLs remain unchanged; a current byte-bound native record supplies already-decoded dimensions.
- Add the reachable public Prive Bruto publisher and feed as a separate registry entry, preserving the Prive ownership family. The original Prive connection failures and Revista Who access failures are not claimed fixed.

## Local evidence

Collection used a 420-second pass plus a 180-second incremental refresh. A 600-second article-image review stage reused 24 matching earlier editorial decisions and reached 72 total decisions. Collection/review remained incomplete.

| Stage | Count |
| --- | ---: |
| Registered Showbiz publishers | 15 |
| Pooled readable candidate URLs | 229 |
| Canonical inventoried stories | 207 |
| Visual evidence captures | 158 |
| Actual publisher-page captures | 35 |
| Original article-image captures with full public text | 123 |
| Native editorial decisions | 72 |
| Consider decisions | 39 |
| Selected distinct stories | 32 |
| Prepared writer-ready stories | 19 |
| Drafts returned by seven disjoint writer groups | 14 |
| Final evidence/originality/topic/image/batch passes | 12 |

Two drafts passed independent originality review but failed the deterministic source-wording check. They were held, not published. Five prepared stories did not produce drafts. Final source-mix validation passed with six ownership families. Native vision and independent review used Luna/max through the existing Codex OAuth path.

The passing mix included Rita Ora, Kim Kardashian, Gracie Abrams, Lily Allen, Florence and the Machine, Billie Eilish/Phoebe Bridgers, and several other music stories. Adult-celebrity/homepage ordering was strengthened after this snapshot's review started; tests cover that ordering, but this output does not establish the desired audience mix or real engagement.

86 captured stories still awaited native review, 19 awaited capture, and 30 were unavailable. Only four publisher homepages had visual captures, two complete. Pooled readable counts differ from last-refresh eligible counts, and stored readable bodies include older material. Never describe any of these as every publisher/article being visually evaluated.

## Verification

- 273 relevant tests passed (one skipped) before the final writer-order and orchestration assertions. Follow-up suites passed: 27 writer/capacity tests, 24 review/capacity tests, 35 source/policy tests and 17 orchestration tests. All four grouped-writer scheduler tests also passed.
- The production build passed locally, with existing Tregu export/data fallback warnings.
- Bash syntax checks passed.
- Final local batch passed independent originality receipts, exact-expression checks, factual/source evidence, topic/category checks, original-image provenance, batch validation and source mix.

The local HTML report includes all 12 drafts, original images, source URLs, per-publisher coverage and remaining holds. It is stored under the session visualization directory in `showbiz-throughput-photos-20261101/REPORT.html`.
