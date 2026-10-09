# Bota për Kosovën: a useful daily reading

The user delegated the design choice. Lead with foreign coverage in Albanian, make it easy to explore and share, and support older readers with clear labels, larger text and comfortable controls.

## Implementation
1. Show a dated briefing of three existing articles and their published Albanian summaries. Label older coverage accurately. Do not invent explanations or recency.
2. Put stories before the optional statistics. Add country selection, text search, visible result counts and a reset action. Display publisher and Albanian summary rather than foreign quotations.
3. Add a remembered larger-text setting shared by the listing and article reader, and sharing with a selectable-link fallback.
4. Make map exploration accessible through a country dropdown and a playful random-country button; keep the existing map and country dialog.
5. Improve the reader with its published summary, source, estimated reading time, clear source link and an explanation of the portrayal assessment. Keep the existing publication pipeline and translated content.

## Scope and acceptance
No changes to publishing, classification, index formula, Tregu or home utility cards. Statistics describe media portrayal, not approval by countries. Listening is deferred unless a reliable Albanian voice is available; text and sharing must work independently.
Mobile at 390 and 320 pixels and desktop must have no horizontal overflow. Main controls are at least 48px high, visible keyboard focus, labelled fields and understandable empty states. Larger text persists between listing and reader. Country/search filters combine correctly and reset; random selection opens actual available coverage; sharing cancellation is silent and fallback works. Existing articles retain internal reader links and original source links.

## Verification and release
Run publication/data tests, full webpack production build, mobile/desktop browser checks including keyboard and unavailable storage/share APIs. Perform read-only quality and review-agent review; fix demonstrated defects. Commit intended files from clean worktree and push to origin/main through authorized Railway GitHub integration. Verify exact production SHA and the live listing and reader. Preserve unrelated task checklists and checkout changes.
