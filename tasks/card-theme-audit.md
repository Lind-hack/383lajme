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

- 22 theme, language and colour-contrast regression checks pass. They calculate contrast from actual stylesheet palettes and include both stops/metal ranks, glass alpha blending, admin inverse controls, newspaper buttons, trip-room tabs/invites/actions and portrayal scale end labels.
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
- Shared newspaper instances require valid published share codes. `/visit/r/[code]` is a private trip-room invite, not a saved travel report; its join layout was reviewed from source. Do not invent a code and treat a 404 as the actual template.
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


## Admin continuation

Source review found stale/warning and odds-change foregrounds retaining dark ink over dark semantic washes (warning contrast 2.36:1). Fixed those pairs, inherited form/fieldset labels, health/news panel backgrounds, neutral count/status chips and primary/secondary/danger hover states. Regression coverage checks these pairs in both palettes, including inherited panel ink and grouped CSS selectors. All 20 checks pass. Actual protected-page visual verification still awaits the user's sign-in; the last browser signal remains `/hyr` with a login link and no profile link.

The second public release `8f6f9d830c11017287bb8862e1a3093e0c434eb7` completed through Railway GitHub integration (`589c97e6-c262-41cf-927b-3a6dd53a0ca7`, SUCCESS). The live deployment-info endpoint matched main/production/github-main and retained race-live-v4. The obsolete race-grid-v3 gate was not claimed as passed.

## Trip-room continuation

Admin follow-up release `d5a83ed25974743e3ddba4f382fd61b3a5c4c56f` succeeded through Railway GitHub integration (`41f0b235-d98a-4c8a-9c98-edd08b68f3d6`); the live endpoint matched that SHA, main, production and github-main. The concurrent video-row addition was preserved and the combined production build passed.

The shared newspaper uses the same Cover/Story/Panel slides, reel controls and dark paper palette as the personal newspaper. A valid shared edition still needs rendered verification. Trip-room source review found selected tabs using fixed dark ink over a theme-aware surface and gold invites mixing dark paper with a gold stop. Tabs now pair site ink/surface; invite cards retain two bright gold stops with constant dark ink. Orange action labels and the WhatsApp invite label now use contrasting fills/ink. The added regression covers both themes and both invite gradient stops; 21 checks pass. Browser account verification remains unavailable: the existing handoff tab still shows `/hyr` without a profile link.

## Public index continuation

Trip-room release `7136aaf07c1a7ba9ce6e2c7f97c8dcc29b5e305d` succeeded via Railway GitHub integration (`ac2a9560-8349-4a5e-9bcc-8a2265bec44e`) and matched the live endpoint. The public Bota page rendered at 1280px in light and dark themes without horizontal overflow. The dark screenshot exposed fixed red/green end-label ink on the index scale; these now use semantic theme ink. The original dark preference was restored after inspection. `/toni` is a permanent redirect to this page, rather than a separate unaudited template.

An unresolved image-selection defect was also observed: Bota cards show publisher-branded photos, and `tools/bota_gpt.py` extracts `og:image` while `lib/bota-publication.mjs` accepts that URL without rights or distinct-from-source provenance. This does not meet the user's separate contextual-image requirement. Correcting the worker/publication image path remains required; a cosmetic fallback alone would not fulfill it. Account verification still shows the preserved `/hyr` handoff.

## Bota image-path correction

The worker now obtains a specific, source-grounded photo subject in the existing editorial response and calls the common newsroom photo selector within its four existing request workers. Publisher OG/article images are comparison evidence only. The selector checks Commons licence metadata, photo age/subject/dimensions, URL identity and available source-image fingerprints. Photo research failures preserve the translated article without republishing the publisher image.

`bota-image.mjs` validates the selected photo's provider, licence URL, attribution where required, subject/caption, dimensions and source-distinction record. New publication rejects noncompliant image URLs; snapshots, cached fallbacks and readers suppress older photos without that evidence. Saved pending batches retain their translations while removing noncompliant photos before retry. Article pages render the photo credit, licence and rights link; captions now follow the dark-mode muted ink.

65 JavaScript checks and 38 Python checks passed (18 Bota worker/source/photo checks plus 20 shared newsroom photo-policy checks). A live, nonpublishing Commons probe selected an Albin Kurti photo under CC BY 4.0. VPS/container requests and Pillow imports passed. This establishes the new image path, not universal photo availability or full site completion: existing photo-free records still need contextual replacements, a scheduled production run needs observation, and private/shared rendered verification remains outstanding. No copyright/legal guarantee is inferred from these engineering checks.

## Existing-photo repair path

Image-path release `4f76a037cb87c6da69f06bffbd21c9d1f7a5a923` succeeded through Railway GitHub integration (`e9d2535a-a969-42b2-b1d5-316116dcc29d`) and matched production deployment-info. The inactive, clean worker checkout was fast-forwarded to that SHA under its existing run lock; the scheduled-runtime adapter import passed. The timer remains active for 07:23 Europe/Warsaw. Live Bota inspection confirmed no publisher images in the page and no horizontal overflow; original article count/index remained 29/57.

The repair endpoint is guarded by the existing automation secret. It pages older records and accepts only a validated photo plus article identity/hash. Migration 0109 merges only six photo fields atomically; cards derive from the article view, so no secondary write can diverge. The published body, source hash, timestamps, counts and scores are preserved. The one-off worker plans against stored published text, compares current publisher images where available, and uses the same actual-model checks and photo selector. Dry runs never patch; failures cannot report all-success; a stale hash refuses the write. The migration/invalid-input guard was exercised inside a rolled-back transaction. 65 JavaScript and 22 Bota Python checks pass. Actual backfill and rendered photo credits still require execution/verification after release; account handoff remains signed out.

## Backfill result and source-quality follow-up

Repair release `b188b475632ceaeb73ebd42b15900c61c0f7dca5` succeeded via Railway GitHub deployment `68ca28f6-59f0-4378-ae4b-791dae691b1b`. Migration 0109 is installed; anon/authenticated execution is denied and service-role execution is allowed. Backfill session 81300 ended with exit 0: 299 processed, 113 photos updated, 186 without a cleared match, zero failures. Non-photo content and run-record fingerprints matched before/after (299 articles, eight runs). A repaired Albin Kurti article rendered its photo, CC BY 4.0/Commons links and readable credit at 1280px and 390px without horizontal overflow. Temporary viewport reset; sign-in handoff retained.

That inspection also exposed a historical player-profile/fixture reader and a TV/streaming guide. The prospective source filter now rejects player/database/fixture routes on newsroom domains and observed viewing-guide title patterns. The editorial prompt also excludes non-narrative profiles, result tables, calendars and viewing instructions while retaining match reporting. 18 source-policy checks, 22 Bota worker/photo/repair checks and 67 JavaScript checks pass. The concurrent official-video page addition from main was preserved; `app/video/[id]/page.tsx` adds another template to the inventory and still needs rendered audit. Private/shared-instance checks remain outstanding; browser handoff still shows `/hyr`.


## Navbar account spacing and auth synchronization

- Replaced the 220px account reserve and 176px translation workaround with content-sized account controls and a 44px collapsed hamburger slot. The profile target is 44px.
- Navbar, user menu, drawer and Tregu balance share one browser display-state subscription. Initial reads cannot overwrite a newer sign-in/sign-out; loading does not flash anonymous actions. Server authorization is unchanged.
- Password/signup success publishes the SDK-confirmed user before navigation. No-session password responses remain on the form with an error. Removed navbar balance's redundant getUser request outside Tregu.
- Auth callbacks preserve the configured public hostname or its www alias, including trusted same-site forwarded hosts. Unrelated hosts cannot override the configured origin.
- Validation: 13 auth race/origin tests, 4 image policy tests, 18 source tests and 22 Bota tests pass. npm run build passes on current main including the latest video work.
- Browser: 1280px desktop account/hamburger spacing 8px, 390px mobile spacing 4px; no horizontal overflow. Search remains left of Pyet Dardanin; mobile auth actions are at the top of the drawer. Scoped layout detector: no findings.
- A real signed-in account check is still pending: the provided Codex browser remains on the signed-out login page. Do not report an end-to-end login as verified.


## Real signed-in verification

- Verified the user's genuine browser session: signed-in avatar, 8px desktop account gap, no Hyr/Regjistrohu links in navbar or account drawer. Collapsed account controls become hidden after the transition; the drawer provides the profile action.
- Server-rendered /profili stays signed in after a full reload. The profile-to-portfolio link opens /tregu/portofoli with the same session. At 390px the portfolio has no horizontal overflow or anonymous navbar links. Profile dark-mode control is present in profile settings.
- Found remaining hardcoded dark brown copy in the saved-news empty state. Dark-mode-only overrides use existing muted/accent ink tokens for that copy, anonymous status and active profile navigation. Light colors remain unchanged. Actual theme paper #151513: empty-state copy contrast improves from 2.50:1 to 8.78:1; accent ink is 8.52:1.
- Preserved the newer password-recovery work on main. All 18 auth/store/origin/recovery checks pass. No account settings, saved articles, positions or balances were changed during verification.
