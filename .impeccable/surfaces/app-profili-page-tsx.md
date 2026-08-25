---
version: 1
slug: "app-profili-page-tsx"
primary_target: "app/profili/page.tsx"
related_targets: ["app/profili/profile-hub.tsx", "app/profili/profile.module.css", "app/tregu/portofoli/page.tsx", "components/article-sidebar.tsx"]
---

# Profili — Gazeta jote personale

## THESIS

Profili is the signed-in reader's calm control desk: a personal newspaper shelf joined to a truthful 383 Coin account, not a generic settings dashboard. It must make returning to saved reporting, understanding account activity, and controlling public identity feel immediate.

## OWN-WORLD

Operate first, Read second. Preserve 383's warm cream, ink, quiet rules, Manrope, and orange action accent. Danger red appears only where an irreversible account action begins. Editorial asymmetry, whitespace, and a strong saved-story lead distinguish the surface from equal-card SaaS dashboards. Motion is limited to direct state feedback and respects reduced motion.

## STORY

Identity and current public state → persistent saved reading → 383 Coin balance and recent activity → public-name/privacy controls → access details → bottom danger zone. Data failures name the unavailable system and never impersonate an empty list or zero balance.

## FIRST VIEWPORT

On desktop, show member identity, membership context, public anonymity state, and the four task routes in a persistent left rail while saved reading leads the adjacent workspace. Each route previews its current state so the account model is understandable before clicking. On mobile, identity compresses above a horizontally scrollable sticky task route; saved reading follows immediately and every operational target remains at least 44px.

## FORM

Seed: the incumbent `origin/main:app/profili/page.tsx` identity card, `components/navbar.tsx`, and the base cream/ink/orange tokens in `DESIGN.md` and `app/globals.css`. Evolve that real signed-in identity surface into an editorial account hub; do not import a separate dashboard visual system.

## Interaction contract

- Saves persist to the authenticated account and older device bookmarks migrate only when present.
- Anonymous mode hides the display name in public comments, holder lists, and trade activity without hiding the account from its owner.
- Settings, removal, sign-out, and deletion always recover from network failure and state the result.
- Permanent deletion requires the exact typed confirmation `FSHIJE` and remains at the bottom of the page.
- Balance history uses ledger-step semantics because the balance holds between transactions.
- Portfolio hierarchy is total value first, subordinate facts second; avoid equal metric tiles.
- Profile task links preserve spatial continuity with smooth anchor travel for pointer and touch input, an active-section state, and instant navigation for keyboard or reduced-motion users.
