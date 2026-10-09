# Bota briefing refinement checklist

- [x] Inspect current production-based worktree and requested skills; settle the scoped design.
- [x] Remove the four top controls and implement the retained scroll shortcut.
- [x] Build the featured briefing with real photo, summary and two supporting stories.
- [x] Complete batched visual/interaction checks and correct the publisher-photo failure found.
- [x] Complete 33 tests, webpack production build, detector and read-only reviews.
- [x] Prepare the clean release from current origin/main.

Final release gate: committed push through Railway GitHub integration, exact live origin/main SHA, and public-page verification. Completion is recorded after deployment in external news-layout-evidence/bota-refinement-release.txt.

Verified at 320, 390, 768 and 1440px with real publication data. The pointer shortcut produced 26 distinct scroll positions and settled at 96px below the viewport top; reduced-motion and keyboard paths immediately reach and focus the same destination. Removed controls are absent from the main page. Long headlines and failed images retain readable content and no horizontal overflow. The featured image is always paired with its own article; failed photos are removed and an available supporting story becomes the lead.

Source review: no remaining actionable findings. Web guidelines review passed for changed components; image dimensions, native link semantics, modifiers, focus and reduced motion are covered. Impeccable detector reported advisory font/radius mismatches against DESIGN.md, which is scoped to Tregu/visit. This Bota refinement intentionally retains Bota's existing sizes, radius and the site's serif font instead of altering those other surface systems. The known unrelated Tregu email-export build warning remains.
