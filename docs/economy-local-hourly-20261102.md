# Economy source enablement and local evaluation — 2 November 2026

Implementation is local on `codex/economy-source-review`; it has not been deployed or activated in the production hourly worker. No articles were published or emails sent by this evaluation.

All 14 registered publishers now have explicit discovery routes and are enabled for hourly primary selection when their complete article is actually readable. Financial Times and MarketWatch no longer have the selection exclusion. Native review reads complete source text and inspects real publisher-page or original-image pixels. Economy supports factual briefs of at least 50 words, headlines up to 80 characters, original publisher images with provenance/native review and a minimum decoded size of 600×350, and an expanding verified inventory instead of a three-article ceiling. Other desks retain their existing rules. Sensitive claims, factual accuracy, originality and photo-subject checks remain required.

## Evaluation method

An isolated Linux QA worker collected fresh Economy-only evidence and used the normal hourly stages. The first media-preparation attempt exposed the old licensed-photo bottleneck and was stopped. The completed QA pass replayed the exact same still-fresh collection and native triage after the source-image fix, retaining original evidence/verdict timestamps. The replay-only launcher refuses production mode and checks that the frozen collection is less than one hour old. A lock-skipped launch performed no work and is excluded. This is a frozen-snapshot quality evaluation, not a timed cold-start benchmark. The successful pass completed at 18:17 Europe/Warsaw.

## Measured result

| Stage | Count |
| --- | ---: |
| Registered sources attempted | 14 |
| Sources returning readable bodies | 10 |
| Stored readable bodies, including older/reference pages | 483 |
| Sources with current readable inventory | 6 |
| Distinct current readable publisher articles before final triage | 130 |
| Actual article-image captures | 88 |
| Complete native text/pixel decisions | 12 |
| Competitive native decisions | 7 |
| Source/photo/note-ready stories | 5 |
| Written drafts | 5 |
| Passed all local publication checks | 5 |
| Actually published | 0 |

The native decisions were seven consider, three reject and two hold. Another 118 articles did not receive complete native decisions this run. There were three homepage captures, only one complete layout, and no full article-page screenshots: the article visual evidence was the original source image plus complete extracted text. Broad publisher inventories can include off-topic pages; an inventory entry is not editorial approval. Pending work is retained for later passes.

## Publisher outcomes

| Publisher | Readable bodies | Current distinct inventory | Native decisions | Competitive | Final passing |
| --- | ---: | ---: | ---: | ---: | ---: |
| Monitor | 46 | 15 | 3 | 1 | 1 |
| Ekonomia Online | 56 | 23 | 1 | 0 | 0 |
| CNBC | 37 | 34 | 2 | 2 | 2 |
| Financial Times | 0 | 0 | 0 | 0 | 0 |
| MarketWatch | 0 | 0 | 0 | 0 | 0 |
| CoinDesk | 0 | 0 | 0 | 0 | 0 |
| The Block | 0 | 0 | 0 | 0 | 0 |
| Decrypt | 42 | 14 | 2 | 1 | 1 |
| Kosovo Central Bank | 43 | 0 | 0 | 0 | 0 |
| Bank of Albania | 40 | 0 | 0 | 0 | 0 |
| SEC | 48 | 0 | 0 | 0 | 0 |
| Federal Reserve | 63 | 0 | 0 | 0 | 0 |
| RTÉ Business | 55 | 29 | 2 | 1 | 1 |
| CryptoSlate | 53 | 15 | 2 | 2 | 0 |

Financial Times and The Block returned HTTP 403, MarketWatch HTTP 401 and CoinDesk HTTP 429. They are enabled but remain access-limited; no bypass or preview-only approval was used. The four official institutions returned readable bodies but no current eligible inventory in this snapshot.

## Final articles

- Tom Lee sheh rezistencë në kriptotreg; Bitmine mban 4,9% të ofertës së ETH — Decrypt.
- Të ardhurat e Anthropic arrijnë në 33,24 miliardë dollarë për nëntë muaj — CNBC.
- S&P 500 u rrit 1%, Brent dhe WTI ranë mbi 6% — CNBC.
- Sindikatat irlandeze shpallin grevë 24-orëshe më 12 nëntor — RTÉ Business.
- Bankat qendrore blejnë ar, çmimi bie 30% nga kulmi i janarit — Monitor.

All five passed independent copy editing, deterministic originality/journalism/topic/duplicate checks, independent originality approval, content-bound approval verification, publication-context review and final batch validation. The gold draft was rejected once, rewritten and independently approved; the earlier rejected prose is excluded from the passing result.

## Validation and artifacts

- 259 relevant Linux tests passed.
- Production Webpack build passed with existing unrelated Tregu import/deployment-marker notices.
- Code implementation commit: `f509d871dae836ed3e3d3f0fb71306d262559b01`.
- Reviewable artifact: `economy-local-20261102/REPORT.html` and `result.json` in this chat’s visualization directory. The report links to original publisher pages and includes final 383 drafts and source-image evidence. It does not reproduce complete publisher articles.
- The live worker symlink and production publishing timer were not changed.
