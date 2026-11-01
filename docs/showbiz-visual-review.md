# Showbiz collection and visual review

The Showbiz desk now receives a dedicated collection pass after general discovery.
It reuses the durable inventory rather than sharing only a few request turns with
every other category. Failed and unfinished tasks remain queued. Neither a
deadline nor a publication quota means collection is complete.

Every current readable Showbiz page enters visual review **before keyword
filtering, event deduplication or publication shortlisting**. The review captures
the publisher homepage, article viewport and article page (up to 16,000 vertical
pixels, with an explicit completeness flag), and retains the complete extracted
article text. The native image request receives labelled homepage/article pixels
and complete source text. Source text and pixels are untrusted evidence, never
instructions. Articles that exceed the complete-context bound remain held with
an error; they are not silently truncated or approved.

The renderer discovers Chromium and Node modules on Windows and Linux. Public
requests retain DNS/redirect validation, bounded resource retrieval, no browsing
credentials, no challenge solving and process-tree cleanup. Applicable CSS
failures remain failures for homepage geometry. Review artifacts may preserve
partial layouts, explicitly labelled `public_browser_partial`; these never become
measured homepage-rank observations. Native review is instructed not to infer
visual prominence from incomplete layouts.

The editor evaluates the new development, audience fit, genre, headline support
and same-event coverage. Only a fresh `consider` decision scoring at least 7/10
enters Showbiz selection. This is editorial triage; existing factual, originality,
photo, copyright and publication gates still run. The exact source version read
by the visual editor is supplied to subsequent preparation. Errors, missing
screenshots, expired verdicts and changed source text hold the article. Other
desks retain their existing selection rules.

## Attention evidence

- Breaking labels and explicitly fresh developments are distinct signals. Neither
  follows merely from a new publication timestamp. Breaking signals expire after
  three hours and are not automatically written into published copy.
- A model must confirm that supplied related articles report the same event.
  Sister publishers count as one family; three families can establish multiple
  independent reports, not social virality.
- Direct social-post links embedded in the article are checked through public
  access. URL-bound public JSON-LD counters are retained with timestamps when
  available. Sharing buttons, profiles, related-post counters and prose saying
  "viral" are not engagement measurements. Blocked/private posts remain
  unavailable. No credentials or access bypass is introduced.
- A point-in-time count is not a growth rate or platform/account benchmark.
  `viral` remains `unknown` without those comparisons. This version does not
  claim comprehensive Instagram, TikTok or X trend monitoring.

## Local audit (no publication)

```powershell
python scripts/news_story_review.py --state C:/audits/showbiz/inventory.sqlite --output C:/audits/showbiz --collect-seconds 900 --review-seconds 900
```

Use a writable output directory and the existing isolated Hermes OAuth/max-effort
configuration. `L383_NEWS_NATIVE_PYTHON` can identify its Python executable on
Windows. The normal production interpreter is discovered automatically. Override
Chromium or Node-module locations only if needed with `L383_NEWS_CHROMIUM` and
`L383_NEWS_NODE_MODULES`.

`--capture-only` saves text/screenshots without claiming a model review. The HTML
report distinguishes captured, partially captured, reviewed, held and unavailable
pages. `discovered-articles.json` retains every discovered article task, including
pending, undated and old URLs. Exit 2 means collection or review is incomplete;
rerun with the same state and output to resume. It is not a successful complete
audit. A rolling public collection cannot prove that every article on the web was
discovered.

Hourly defaults: `L383_SHOWBIZ_COLLECTION_SECONDS=180` for the additional
collection pass and `L383_SHOWBIZ_REVIEW_SECONDS=300` for review. These budgets
bound work; incomplete coverage is reported, not converted into success.
Artifacts live next to discovery under `showbiz-review/`. No new step publishes,
deploys or emails anything by itself.

## Verification on 1 November 2026

The focused Python checks ran 110 tests (107 passed, three platform-specific
skips). Native Windows Chromium checks ran 22 tests (21 passed, one Linux-only
skip). The production build passed using `npm run build -- --webpack`; this
local worktree shares dependencies through a junction, which Turbopack refuses.
Native transport verification and the full single-article review path both
received real NME page pixels plus complete article text. The integration editor
rejected the Deep Purple story at 5/10 for weak audience relevance and retained
unknown virality. This validates the review path, not every publisher/article.
Live collection/capture audits remain explicitly incomplete where public access
or review deadlines prevent coverage. These changes have not been deployed and
the verification did not publish any articles.
