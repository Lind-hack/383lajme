# Bota briefing refinement checklist

## Globe and unified reader extension
- [x] Place existing globe mascot beside the homepage and Bota introduction.
- [x] Clarify country, publisher and tone in featured articles.
- [x] Render translated articles through the canonical article component with correct attribution and sharing.
- [x] Verify responsive layouts, article navigation, tests, build and read-only review.
- [ ] Commit and verify the authorized GitHub deployment.

- [x] Inspect current production-based worktree and requested skills; settle the scoped design.
- [x] Remove the four top controls and implement the retained scroll shortcut.
- [x] Build the featured briefing with real photo, summary and two supporting stories.
- [x] Complete batched visual/interaction checks and correct the publisher-photo failure found.
- [x] Complete 33 tests, webpack production build, detector and read-only reviews.
- [x] Prepare the clean release from current origin/main.

Final release gate: committed push through Railway GitHub integration, exact live origin/main SHA, and public-page verification. Completion is recorded after deployment in external news-layout-evidence/bota-refinement-release.txt.

Verified at 320, 390, 768 and 1440px with real publication data. The pointer shortcut produced 26 distinct scroll positions and settled at 96px below the viewport top; reduced-motion and keyboard paths immediately reach and focus the same destination. Removed controls are absent from the main page. Long headlines and failed images retain readable content and no horizontal overflow. The featured image is always paired with its own article; failed photos are removed and an available supporting story becomes the lead.

Source review: no remaining actionable findings. Web guidelines review passed for changed components; image dimensions, native link semantics, modifiers, focus and reduced motion are covered. Impeccable detector reported advisory font/radius mismatches against DESIGN.md, which is scoped to Tregu/visit. This Bota refinement intentionally retains Bota's existing sizes, radius and the site's serif font instead of altering those other surface systems. The known unrelated Tregu email-export build warning remains.

Globe extension verification: 41 focused publication/tone/body tests passed, final webpack build passed, and browser checks passed at 320/390/768/1440px. All translated paragraphs match the stored publication, sharing targets the translated route, failed publisher photos are removed, and regular news sharing remains correct. No page errors. Shared navigation has a pre-existing small overflow at 320px; the article content and wrapping share controls fit. Build retains the existing unrelated Tregu email-export warning.
