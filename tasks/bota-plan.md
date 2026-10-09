# Bota briefing refinement

## Globe, labels and unified reader extension
Reuse the existing dardani-toni globe illustration at a larger size beside the homepage introduction and the destination heading. Preserve the cream/ink/orange identity and existing filters. Show country, publisher and explicit positive/neutral/negative labels on featured stories. These labels describe portrayal of Kosovo.

Reuse ArticleContent for translated articles, with a typed optional editorial slot for country/source metadata, assessment and source sidebar, plus the actual translated sharing path. Do not enable main-news database bookmarks or article-question endpoints for foreign IDs. Preserve all translated paragraphs and original-source attribution.

Verify homepage and destination at 320/390/768/1440px, country/tone labels, internal navigation, translated body, correct sharing URL, missing photos and unchanged standard readers. Run focused Bota/body tests and webpack build, then read-only reviews. Commit the intended files; release only through a clean GitHub push under the deployment policy explicitly authorized by the user.

Follow-up to the released Bota layout. The user explicitly requests removing the four top-level controls (larger text, sharing, news shortcut, country shortcut), retaining the portrayal shortcut with scroll animation, and making the briefing more eye-catching. Confidence is high; the prior instruction delegates routine design choices.

## Decisions and acceptance
- Remove the main-page reading toolbar and two shortcuts; keep only `Si shkruhet për ne?`. Reader tools and the existing story filters/map are outside this narrow request.
- Use a native anchor with progressive enhancement for smooth pointer scrolling, instant reduced-motion/keyboard navigation, URL hash and focus transfer. The destination must clear the sticky navigation.
- Replace the three equal briefing rows with a photographic lead story, readable ink fade, prominent headline and two supporting stories. Reuse 383 cream/ink/orange, Manrope/Georgia, real published imagery, summaries, dates, source labels and article links. No invented claims, fake imagery, autoplay or decorative counters.
- Validate at 320, 390, 768 and 1440px: no overflow, legible long/missing-image states, labelled links, visible focus and image dimensions. Verify smooth intermediate scroll positions and final target alignment, reduced motion and keyboard operation.

## Sequence
1. Refine the briefing component/CSS and add the single scroll shortcut.
2. Run one batched mobile/desktop visual and interaction inspection; fix demonstrated issues and confirm in one pass.
3. Run relevant data tests, webpack build, detector and read-only design/code reviews.
4. Commit/push through the authorized Railway GitHub integration and verify latest origin/main SHA and live UI. Release evidence goes in external news-layout-evidence/bota-refinement-release.txt.

Preserve unrelated task files, original dirty checkout, publishing/classification, reader content, Tregu and Per ty. Update this task's existing Bota files rather than overwrite another plan.
