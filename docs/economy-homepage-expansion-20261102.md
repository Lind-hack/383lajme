# Economy homepage selection and source expansion — 2 November 2026

Changes are committed locally on `codex/economy-source-review`. They have not been deployed or activated in the production hourly worker. This audit did not write, approve for publication, publish or email any articles.

## Implemented behavior

- Economy has 20 configured sources, up from 14: Buletini Ekonomik, Scan TV, ABC Business Australia, Semafor Business, The Guardian Business and the European Central Bank were added. Public article access was tested before inclusion; additional blocked/restricted candidates were not presented as working sources.
- Business front pages are explicit source routes and are collected before feeds/archive tasks. Preserve measured browser geometry or label HTML order as fallback.
- Top-three and top-ten current economic headlines receive priority; every active publisher queues its best eligible current lead before another publisher’s extras. Local publishers receive early turns among comparable candidates. Clearly off-topic pages are excluded before native review and are not counted as model rejections.
- Economy now has the same 600-second review window as Showbiz and reviews up to six complete stories per call, still bounded by the existing context-byte limit. Mixed-desk review windows run concurrently.
- Prominent short factual updates retain priority through source preparation and writer briefs. Consumer prices, wages, benefits, taxes, public budgets and routine company/market news can qualify without an extraordinary event or invented Kosovo impact.
- Original publisher images with source credit, native pixel checks and a 600×350 minimum, 50-word briefs, 80-character headlines and the expanded Economy allocation remain enabled. Factual, sensitive-claim, originality and final image-subject checks remain required.
- Guardian Business owns only its registered business/money and regional business-front-page paths. Other Guardian pages remain World, and both sections share one ownership family.
- Ekonomia Online’s Economy route was corrected to `https://ekonomiaonline.com/category/ekonomi/` using its actual navigation link. A separate live Chromium/reader check returned 94 article-link entries and 28 ranked headline cards, including the budget bill, customs receipts and unspent capital-investment funds. This route correction is not retroactively applied to the saved audit’s homepage observations.

## Fresh collection and native-review evidence

One fresh Economy-only collection was used. The first ten-minute native pass completed 54 decisions and selected 41 distinct unpublished candidates. It exposed a coverage gap: Guardian article images were captured but received no completed verdicts before the deadline. After the publisher-first queue fix, a second ten-minute review resumed the same saved evidence and existing content-bound decisions. Original fetch, capture and model-approval timestamps were retained. The following are combined unique URL-entry outcomes after the second pass, not the yield of one cold hourly invocation.

| Metric | Result |
| --- | ---: |
| Configured/attempted sources | 20 / 20 |
| Sources yielding readable bodies | 16 |
| Stored readable bodies, including older/reference pages | 652 |
| Current on-topic URL entries queued for native review | 192 |
| Source-image captures | 192 |
| Completed native text-and-image reviews | 96 |
| Competitive native decisions | 71 |
| Distinct unpublished candidates selected for preparation | 69 |
| Selected candidates in a fresh top-three position | 16 |
| Selected candidates in a fresh top-ten position | 46 |
| Actually published | 0 |

All 12 sources with current eligible inventory received at least one completed native decision after the resumed pass. Guardian Business received three decisions, including two considered candidates. Ninety-six entries still lack completed model decisions. The latest pass captured five homepages, three complete layouts; article visuals were original source-image pixels with complete source text, not full article-page layouts. Homepage promotion is publisher attention, not verified virality.

| Source | Readable bodies* | Native reviewed | Competitive | Selected |
| --- | ---: | ---: | ---: | ---: |
| Monitor | 42 | 11 | 10 | 10 |
| Ekonomia Online | 56 | 7 | 0 | 0 |
| CNBC | 31 | 10 | 9 | 9 |
| Financial Times | 0 | 0 | 0 | 0 |
| MarketWatch | 0 | 0 | 0 | 0 |
| CoinDesk | 0 | 0 | 0 | 0 |
| The Block | 0 | 0 | 0 | 0 |
| Decrypt | 34 | 7 | 4 | 4 |
| Kosovo Central Bank | 40 | 0 | 0 | 0 |
| Bank of Albania | 36 | 0 | 0 | 0 |
| SEC | 40 | 0 | 0 | 0 |
| Federal Reserve | 47 | 0 | 0 | 0 |
| RTÉ Business | 45 | 13 | 8 | 7 |
| CryptoSlate | 44 | 5 | 4 | 4 |
| Buletini Ekonomik | 51 | 4 | 4 | 4 |
| Scan TV | 41 | 10 | 9 | 9 |
| ABC Business Australia | 37 | 12 | 9 | 9 |
| Semafor Business | 45 | 11 | 9 | 9 |
| European Central Bank | 41 | 3 | 3 | 2 |
| The Guardian Business | 22 | 3 | 2 | 2 |

*Readable-body counts include older/reference pages. Financial Times and The Block remain HTTP 403 limited, MarketWatch HTTP 401 limited and CoinDesk HTTP 429 limited. No access bypass or preview-only article approval was used.

## Validation and review artifacts

- 300 relevant Linux tests passed; local verification passed with one platform skip. The route correction also passed the source-policy, Economy-policy and homepage suites and a live browser/reader check.
- Production Webpack build passed with existing unrelated Tregu warnings/notices.
- Initial source/front-page implementation: `91a0dd09`; publisher-coverage fix and resumed review: `c3aba60a`; verified Economy-route correction: `fd6c53be`.
- Artifact: `economy-expand-20261102/REPORT.html`, `result.json`, and `FIRST-PASS-result.json` in this chat’s visualization directory. Original publisher articles are linked, not reproduced.
- This audit ends at collection and native selection. The 69 candidates still require media finalization, original writing and every publication gate. No production-deployment or publication claim is made.
