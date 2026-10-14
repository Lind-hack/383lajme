# Site card/theme audit — 2026-10-14

Scope: inventory all 43 page templates and inspect shared UI/card families. This is an implementation and coverage record; it does not claim every account-dependent state has been rendered.

## Confirmed causes and repairs

- Tregu custom glass aliases retained white surfaces with light dark-mode text; dark panels/stats now share matching foreground and surface roles.
- Native competition outcomes retained white glass; inactive category filters also retained white opacity fills. Both follow the site surface.
- League paper stopped at cream, secondary ink remained brown, and metal podium labels inherited light theme ink. Dark league palettes now include join/result/points sheets; metal podiums retain dark ink in both themes.
- Border card blue ink, Bota status/read links/accordion, dossier inline ink, comment input aliases and private page palette aliases were disconnected from the site theme. Their roles now match.
- Visitor city canvas/mobile travel banner stayed cream while text switched to light. Their dark surfaces preserve the warm material and original image assets.
- Footer copy was too faint in both themes. Action labels and social sharing buttons had insufficient contrast; their fills/ink now carry readable labels while decorative brand accents keep their colour.
- Default 404 was light with light text in dark mode. A themed Albanian recovery page preserves the 404 route behavior.

## Verification

- 18 theme, language and colour-contrast regression checks pass. They calculate contrast from actual stylesheet palettes and include both stops/metal ranks, glass alpha blending, admin inverse controls and newspaper buttons.
- Final production build passed (three workers, exit 0). Production release identity is recorded below after GitHub deployment.
- Browser candidates over gradients/images are estimates, not measured WCAG ratios. Every changed issue was traced to its owning style; physical photographs, flags, map artwork and intentional bright metal surfaces are preserved.
- No horizontal page overflow was reported in the initial rendered 1280px/390px cases. Static monthly stories render as authored artwork; measured DOM text does not include text inside that artwork.
- The Windows dev preview encountered a Turbopack junction error. Empty/unfinished dev navigation samples are invalid verification; production preview loaded real market cards and was used instead.
- Impeccable detector ran once: 1,027 advisories and 49 warnings, mostly existing font-step/motion/gradient design choices. Those do not authorize replacing the pinned brand or existing motion design.

## Observed route examples (before/fix inspection)

- https://383ks.com/
- https://383ks.com/article/aro-muric-merr-barazim-me-sassuolon
- https://383ks.com/bota-per-kosoven
- https://383ks.com/bota-per-kosoven/artikull/2cbc37ced6667ce983b1eeeb380f1c03ed42f2684145577384b9bf361fa69b49
- https://383ks.com/dosje
- https://383ks.com/dosje/anetaresimi-ne-be
- https://383ks.com/hyr
- https://383ks.com/kategori/kosove
- https://383ks.com/kerko
- https://383ks.com/kerko?q=Kosov%C3%AB
- https://383ks.com/kontakt
- https://383ks.com/kuiz
- https://383ks.com/kushtet
- https://383ks.com/muaji/2026-09
- https://383ks.com/per-ty
- https://383ks.com/privatesia
- https://383ks.com/rreth-nesh
- https://383ks.com/tregu
- https://383ks.com/tregu#ligat
- https://383ks.com/tregu/portofoli
- https://383ks.com/visit
- https://383ks.com/visit/t

## Outstanding coverage

- Authenticated profile/portfolio and authorized admin pages require the user's browser sign-in. On the latest check the sign-in tab remained `/hyr`; no credentials or tokens were inspected or injected.
- Public shared newspaper/travel-report instances require valid published share codes; do not invent a code and treat a 404 as the actual template.
- Preview routes are intentionally unavailable on production. The code and local design-preview templates are separate from live market data.
- Goal remains active until the remaining route/state checks and any resulting fixes are finished.

## Template inventory

- `app/admin/automation/page.tsx`
- `app/admin/dosje/[slug]/page.tsx`
- `app/admin/dosje/page.tsx`
- `app/admin/dosje/pastro/page.tsx`
- `app/admin/komente/page.tsx`
- `app/admin/kuiz/page.tsx`
- `app/admin/page.tsx`
- `app/admin/poll/page.tsx`
- `app/admin/tregu/page.tsx`
- `app/admin/tregu/refreshet/page.tsx`
- `app/admin/xhep/page.tsx`
- `app/article/[slug]/page.tsx`
- `app/bota-per-kosoven/artikull/[id]/page.tsx`
- `app/bota-per-kosoven/page.tsx`
- `app/dosje/[slug]/page.tsx`
- `app/dosje/page.tsx`
- `app/gazeta/[code]/page.tsx`
- `app/hyr/page.tsx`
- `app/kategori/[category]/page.tsx`
- `app/kerko/page.tsx`
- `app/kontakt/page.tsx`
- `app/kuiz/page.tsx`
- `app/kushtet/page.tsx`
- `app/muaji/[month]/page.tsx`
- `app/muaji/page.tsx`
- `app/page.tsx`
- `app/per-ty/page.tsx`
- `app/privatesia/page.tsx`
- `app/profili/page.tsx`
- `app/rreth-nesh/page.tsx`
- `app/toni/page.tsx`
- `app/tregu-preview/basketball/page.tsx`
- `app/tregu-preview/bonus/page.tsx`
- `app/tregu-preview/page.tsx`
- `app/tregu-preview/uefa/page.tsx`
- `app/tregu/[slug]/page.tsx`
- `app/tregu/ligat/[id]/page.tsx`
- `app/tregu/ligat/page.tsx`
- `app/tregu/page.tsx`
- `app/tregu/portofoli/page.tsx`
- `app/visit/page.tsx`
- `app/visit/r/[code]/page.tsx`
- `app/visit/t/page.tsx`

## Review and release status

Final diff reviewed across correctness, readability, architecture, security and performance. Changes are local theme/contrast roles and a themed not-found view; navigation behavior, content/data and authentication guards are unchanged. Private-page visual verification remains outstanding. Production-preview confirmation stalled in the browser tool; earlier production-preview checks loaded 1,028 real Tregu text nodes and identified the final correction batch. Do not treat the stalled confirmation as a passing visual test.


## Confirmation and follow-up

Desktop screenshots confirm dark rail panels and readable metal podiums. The 390px mobile screenshot confirms that panels stack within the screen, with the compact header and bottom navigation visible. Viewport restored after inspection. A final rendered follow-up fixes the gold hero button's ink, featured probability labels, and failed rail thumbnail fallback. The added contrast cases pass; follow-up full production build passed, exit 0.

Initial release `7bc320a259a61ecb098a3efdff1ce85bb655d6ff` completed through Railway GitHub integration (`87ed55ab-526b-423c-b494-56c5c804a4f7`, SUCCESS). This remains a partial site audit: authenticated/profile/admin rendered states and valid shared-instance routes still require verification. Do not mark the full goal complete from these public screenshots.
