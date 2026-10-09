# Bota daily reading checklist

- [x] Inspect existing page, reader, data and live mobile baseline.
- [x] Resolve product choice using the user's explicit delegation; write separate plan files.
- [x] Implement daily briefing, country/search controls and accessible exploration.
- [x] Implement shared text preference, sharing and reader improvements.
- [x] Verify 33 data/publication tests and mobile/desktop interactions.
- [x] Complete read-only quality and review-agent review; correct country ordering/hydration and reading-link contrast.
- [x] Prepare the release from origin/main, preserving the original checkout and unrelated task work.

Final release gate: successful final production build, clean committed push through the Railway GitHub integration, exact live SHA and listing/reader verification. Completion evidence is recorded after deployment in the external `news-layout-evidence/bota-release-verification.txt` file.

Browser checks cover 320px, 390px and desktop widths; country/search combinations and reset; larger text preserved between listing and reader; denied storage; clipboard success and denied clipboard fallback; native-share cancellation; country exploration focus and Escape; main controls at least 48px high. Current summaries, source labels and translated article links were exercised using the production dataset without modifying it.

Review: no remaining actionable findings across correctness, readability, architecture, security and performance. Publication data, classification, home utility cards and Tregu remain outside this change. Existing unrelated Tregu email-export build warnings are recorded in release evidence.
