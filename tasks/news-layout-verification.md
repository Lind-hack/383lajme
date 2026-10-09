# News layout verification

Implemented on codex/news-layout-alignment in the separate 383-news-layout checkout, based on origin/main (4b992d76). The original checkout's unrelated changes are preserved.

- Economy and Technology mobile overlay rows now use their content height instead of retaining 240px/190px grid rows.
- Category-page grids use 16px gaps, with 32px between major article sections and less initial padding.
- Latest-news, compact story and mobile category thumbnails are larger and share their top edge with the text column.
- Top 5 photos are 300px on desktop, 240px on tablet and 112px on phones (previously 280/220/92). Rank columns were narrowed to retain headline space.
- Category grid photos use a taller 3:2 frame. Njoftime photos increased from 146px to 164px, with corresponding card height to preserve text space.

## Verification

- 27 focused tests passed: node --test lib/home-sections.test.mjs lib/front-page.test.mjs lib/image-size.test.mjs.
- Populated shared-component fixture checked at 1440, 768, 390 and 360px: every Top 5, latest-news and compact story image aligned with its text; thumbnails did not shrink; no horizontal overflow; mobile category cards had no artificial row gaps. Fixture includes long/short titles and missing images.
- Economy, Technology and Showbiz actual category routes checked at all four widths, in both development and the optimized build: populated cards, 16px grid gaps, no horizontal overflow. Screenshots inspected after triggering the cards' reveal animations.
- Njoftime fixture: seven cards have 164px photos and 348px card height without overflowing text.
- npm run build -- --webpack passed compilation, TypeScript, all 63 static pages and build finalization. Webpack was used because the isolated checkout shares the original node_modules through a junction, which Turbopack rejects outside its root.
- git diff --check passed.
- Temporary fixture route is removed from application source and is absent from the build route manifest.

## Read-only defect review

No findings. Reviewed the complete five-file source diff and its shared call sites for correctness, readability, architecture, security and performance. The breakpoint-specific image sizes match their CSS widths. Data selection, pagination, news links and publication behavior are unchanged.

The build emits pre-existing Tregu import warnings concerning sendPendingNewsMarketEmails. Those files are unchanged by this work. The production deployment guard skips checks for this local build as designed.

No production release was performed. Release must follow the user-provided AGENTS.md policy; the current remote repository names Railway while the supplied policy names Vercel, so these policies must be reconciled before a production release.

## Homepage gap and overlay readability review

No findings. Read-only review covered the complete source diff and the news-tile call sites (bento, mosaic, overlay), their container breakpoints, and the homepage progress wrapper. The fix reuses the existing homepage scope override. Mobile compact rows explicitly reset the overlay background and color; their existing dark type remains on light paper. No data, auth, route, dependency, or market behavior changed.

Verified with a browser on the actual local homepage: wrapper height equals the progress card at six width/height combinations; Teknologji follows by 48px (360/390/768) or 72px (1366/1440), with no horizontal overflow. A seven-tile fixture uses a white photo surface and long headlines: no body/title geometry spills beyond the tile at 360/390/560/640/768/1366/1440. Conservative white-image contrast is 12.32:1 headline, 11.09:1 excerpt, 10.31:1 time. Before/after and stress-fixture screenshots inspected.

33 focused tests passed: home-tregu, home-sections, front-page, image-size. Production build verification is recorded in release evidence after completion. Release uses the user's existing Railway approval and GitHub integration.
Production build passed compilation, TypeScript and all 63 static pages. Pre-existing Tregu email import warnings remain unrelated to these two source changes.
