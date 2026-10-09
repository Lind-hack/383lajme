# News layout checklist

- [x] Inspect baseline category and homepage layouts at desktop and mobile widths.
- [x] Tighten Economy, Technology and Showbiz article gaps.
- [x] Enlarge and align images/text in shared news rows and top-five cards.
- [x] Verify populated pages at 1440, 768, 390 and 360 pixels, including long headlines and overflow.
- [x] Run relevant tests and npm run build.
- [x] Complete read-only review and resolve actionable findings.
## Screenshot follow-up — latest rows and Tregu

- [x] Match mobile latest-news photo height to the category/headline block; put summary and time across the full row.
- [x] Replace the empty 300px leaderboard loader with visible compact loading content and settle HTTP failures/timeouts.
- [x] Check news geometry at 360, 390, 560, 768 and 1440px; run 38 focused tests.
- [x] Check normal, failed and delayed leaderboard loading (14px gap); production build passed including TypeScript and 63 static pages. Release uses the authorized Railway GitHub integration.

The full empty viewport in the supplied Tregu screenshot was not reproduced on current production. Its loaded progress-to-leaderboard gap measures 14px. The empty loader and unhandled HTTP failure were confirmed in source and corrected.

