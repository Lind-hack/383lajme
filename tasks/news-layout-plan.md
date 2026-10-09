# News layout plan

Scope: remove excessive article gaps on Economy, Technology, and Showbiz category pages; enlarge and align article images and text in all shared news layouts, including latest news and the five-story feature, on mobile and desktop.

Preserve existing working-tree edits. Production releases must follow AGENTS.md; no direct deployment.

## Tasks and acceptance criteria
1. Inspect current category grids, latest lists, supporting stories and top-five cards. Capture baseline rendered geometry at 1440, 768, 390 and 360 pixels.
2. Use compact, consistent spacing in category grids and between hero/grid/list sections. Images and text must share predictable alignment without artificial blank height.
3. Increase thumbnail sizes in latest and supporting rows; align metadata with the text column. Ensure top-five images, text and footers remain aligned for varying headline lengths.
4. Verify all three category pages and homepage news variants at desktop/tablet/mobile widths; inspect screenshots and overflow, run relevant tests and npm run build, then perform a read-only defect review.

Verification must cover populated content, long titles and mobile widths. Existing unrelated failures must be reported accurately.
