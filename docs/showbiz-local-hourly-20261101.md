# Local Showbiz-only hourly evaluation — 1 November 2026

Changes are local. No articles were published and no deployment was made.

## Final policy

- Showbiz editorial consideration starts at 5/10, with Albanian artists first.
- Routine non-sensitive updates can use one readable registered publisher;
  an inaccessible original social post alone does not disqualify that reporting.
  Direct-post verification, dates, metrics and viral status must remain honest.
- Small updates can use a single paragraph of at least 50 grounded words.
  Extra paragraphs must add facts rather than repeat details or speculate.
  Other desks retain their existing length requirements.
- Showbiz uses the source article's original image, with source URL, credit,
  decoded dimensions, hashes and native pixel review. Minimum size is 600×350.
  Its presence on the source is not represented as a free reuse licence.
  The article UI links the publisher credit to the same article.

## Local result

All 14 configured Showbiz publishers were included in a fresh collection, which
produced 128 readable current articles. The visual inventory contained 120
eligible canonical stories; six received native visual decisions, nine article
pages were captured, and 12 homepages were captured (seven complete layouts).
Four reviewed stories were rejected and two were considered. Visual coverage
remains incomplete: 111 stories were still pending capture, with three access or
render failures. This is not evidence that every publisher article was reviewed.

Both selected stories had source photos and reporter notes. The production
writer prompt and all four complete reference documents were used for the final
writing runs. A continuation supplied the missing Rita Ora story, and a compact
rewrite replaced its repetitive longer draft. Both final drafts passed
journalism, independent factual/originality review, content-bound publication
review verification, and batch validation:

1. Kim Kardashian vishet si North West, Keke Palmer si Janet Jackson — Anabel.
2. Rita Ora ndan tatuazhin Baby në shpinë — KultPlus.

The Rita image is the publisher's illustrative portrait, not direct evidence of
the tattoo or a newly verified Instagram post. No claim of measured virality was
made. Earlier exploratory writing and failed intermediate runs are retained in
the artifact's attempts directory and are excluded from the final results.

## Operational fixes verified during this run

Homepage capture now reserves time for article reviews, and fresh partial
captures can be reused while retaining their partial-layout flags. Partial
navigation can preserve readable text and pixels without claiming a complete
page. Recaptured article evidence retains its actual fetch timestamp, so source
preparation can reuse the exact reviewed body instead of losing it to a redundant
network request. Kida no longer matches the English word “Kids”. Windows model
calls use Hermes' supported query-file transport for complete large prompts.

Validation: 162 focused tests, 160 passed and two platform skips; three native
browser regressions passed. The production Webpack build passed with existing
Tregu import warnings and remote-data fallback notices.

Artifacts are in the current chat's `showbiz-hourly-20261101` visualization folder:
`REPORT.html`, `collection.json`, `visual-review/review.json`, `result.json`, final
article batch, original-image provenance and independent review receipts.
