# Reliable Showbiz and Economy output

Accepted implementation specification, 2026-11-03. Review baseline: `ad6fe988`.

Only Showbiz and Economy change. Target five articles per hourly category run;
three is the minimum success target when eligible supply and services exist.
No padding, fabricated engagement or guaranteed output during outages.

## Editorial behavior

- Supported fresh routine updates qualify for consideration at 4/10. Scores are
  editorial judgments, not measured audience engagement. Sensitive allegations
  still require independently readable corroboration; originality is mandatory.
- Prefer three local-interest slots among five, immediately filling gaps with
  eligible international stories. Use complete extracted source text, entity
  relevance, freshness, observed homepage prominence and publisher rotation.
- Showbiz: Albanian artists, including Dua Lipa, Rita Ora and Bebe Rexha; public
  posts, statements, fashion, photos, performances and confirmed personal news.
  Economy: Kosovo/Albania household costs, income, jobs, banks, taxes and business,
  followed by relevant international market/company developments.
- Routine single-source updates and grounded 50-word briefs remain eligible;
  prefer 120–220 words when supported. Do not demand extraordinary significance,
  verified virality, lengthy prose or an invented Kosovo angle.

## Processing and recovery

- Work in small waves of visual evaluation, preparation, writing and review.
  Save each draft and approval independently. Try alternatives up to the
  existing 55-minute job deadline, preserving fair shared model capacity.
- Reuse original publisher images under existing policy. Cache completed image
  judgments against exact pixels, story context and policy, without renewing
  timestamps. Distinguish unsuitable images from verification unavailable.
- Quota stops new model calls, not publication of completed approvals. No
  model/provider/authentication bypass or API fallback.
- Retain at most ten approved unpublished drafts per category. Do not withhold
  current news to build reserves. A reserve needs unchanged content, evidence,
  image bytes, current policy, source age under 24 hours and approvals under six
  hours. Breaking/time-sensitive market updates expire after one hour.
- Before publication, recheck duplicates and changed history without a model;
  hold ambiguous related history for independent comparison. Use the shared
  publication lock and stable batch identity. Consume only after exact readback.
- QA neither publishes nor consumes production reserves. Process restarts must
  recover approvals and confirmed publication counts without duplicate inserts.

## Outcomes and acceptance

Retain existing outcome fields; add target/minimum, new/reused visual Evals,
readable sources, ready stories, saved drafts, approvals, reserve usage,
confirmed publications and explicit shortfall reasons. Images available,
image Evals and full article-page captures are different measurements.

Agreed TDD boundaries: candidate ranking/eligibility, category-run outputs, and
publication/readback. Cover local/foreign fallback, 4/10 eligibility, sensitive
claims, image invalidation, partial writer/quota failure, expiry, crashes and
duplicate-free retries. Replay captured audit evidence without publication,
then run live-source QA. Run relevant Linux tests and production build.

Run Standards and Spec reviews against the pinned baseline and a defect-first
review before release. The two intervening main commits `02c8f0e8` and
`35d2f71a` are existing unrelated UHZ/homepage work and are preserved.
Release only through committed origin/main and its configured GitHub deployment
integration, verify the deployed SHA and worker files, then observe three
scheduled hourly runs. Report shortfalls honestly; do not equate volume with
reader satisfaction.
