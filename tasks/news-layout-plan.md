# News layout plan

Scope: remove excessive article gaps on Economy, Technology, and Showbiz category pages; enlarge and align article images and text in all shared news layouts, including latest news and the five-story feature, on mobile and desktop.

Preserve existing working-tree edits. Production releases must follow AGENTS.md; no direct deployment.

## Tasks and acceptance criteria
1. Inspect current category grids, latest lists, supporting stories and top-five cards. Capture baseline rendered geometry at 1440, 768, 390 and 360 pixels.
2. Use compact, consistent spacing in category grids and between hero/grid/list sections. Images and text must share predictable alignment without artificial blank height.
3. Increase thumbnail sizes in latest and supporting rows; align metadata with the text column. Ensure top-five images, text and footers remain aligned for varying headline lengths.
4. Verify all three category pages and homepage news variants at desktop/tablet/mobile widths; inspect screenshots and overflow, run relevant tests and npm run build, then perform a read-only defect review.

Verification must cover populated content, long titles and mobile widths. Existing unrelated failures must be reported accurately.

## Homepage gap and image headline follow-up

The supplied screenshot is the homepage withdrawal bar, not the Tregu floor. Current production measures its wrapper at 1000px in a 1000px viewport, with a 126.75px progress card and Teknologji starting 945.25px after the card. The wrapper inherits `.tregu-scope { min-height: 100vh }`.

1. Reuse `home-tregu-scope` on the progress wrapper. Acceptance: wrapper min-height 0, height follows its card, and Teknologji begins within the normal section spacing at mobile/tablet/desktop widths and different viewport heights.
2. Improve photo-overlay NewsTile headlines using a dark backing behind the complete text block, larger bold type, and brighter excerpt/time. Keep compact mobile rows on their existing light background. Acceptance: white-photo stress test maintains at least 4.5:1 contrast for normal text, text stays inside tiles, no overflow or clipped headline line, and non-overlay rows remain readable.
3. Verify populated homepage and long-title/bright-image fixtures at 360, 390, 768, 1366, and 1440px; run focused tests and production build; complete a read-only review. Commit and push through the previously authorized Railway GitHub release; verify live SHA and the actual homepage geometry/contrast.

Dependencies: task 3 follows 1 and 2. No new dependencies, APIs, data changes, or F1 component edits. Existing unrelated work is preserved in the original checkout. Use the previously authorized separate news planning files.
