---
schemaVersion: 2
generatedBy: impeccable/document
scope: "app/tregu + app/visit (surface-scoped systems)"
register: product
colors:
  base:
    cream: "#F9F6F1"
    white: "#FFFFFF"
    ink: "#111111"
    charcoal: "#1A1A1A"
    muted: "#6B6B6B"
    border: "#E8E3DB"
    orange: "#FF4422"
  category:
    blue: "#0047FF"
    emerald: "#00A651"
    amber: "#F59E0B"
    crimson: "#E41E20"
    violet: "#7C3AED"
    rose: "#F43F5E"
    showbiz: "#E91E8C"
  tregu:
    bg: "var(--color-cream)"
    panel: "rgba(255,255,255,0.66)"
    panelHi: "rgba(255,255,255,0.82)"
    border: "rgba(17,17,17,0.08)"
    borderHi: "rgba(17,17,17,0.16)"
    text: "#111111"
    muted: "#6B6B6B"
    yes: "#00A651"
    yesDim: "rgba(0,166,81,0.12)"
    yesText: "#007A3C"
    no: "#E41E20"
    noDim: "rgba(228,30,32,0.12)"
    noText: "#B4181A"
    orangeAccent: "#FF4422"
    ribbonBg: "#17130E"
    ribbonBorder: "rgba(255,68,34,0.55)"
    ribbonText: "#F1ECE3"
    ribbonMuted: "rgba(241,236,227,0.48)"
    live: "#3ED484"
    deltaUp: "#00854A"
    deltaDown: "#B91C1C"
typography:
  families:
    sans: "'Manrope', sans-serif"
    serif: "Georgia, 'Times New Roman', serif"
  scale:
    display: "clamp(32px, 4.5vw, 58px)"
    h1: "clamp(28px, 3.5vw, 44px)"
    h2: "clamp(20px, 2.2vw, 28px)"
    h3: "17px"
    body: "16px"
    caption: "13px"
    overline: "11px"
  treguSpecific:
    marketQuestion: "15px / 700 / 1.35"
    statValue: "14px / 800, tabular-nums"
    statLabel: "10px / 700, uppercase, 0.16em tracking"
    pill: "11px / 700, uppercase, 0.04em tracking"
rounded:
  sm: "12px"
  md: "16px"
  lg: "24px"
  pill: "100px"
  marketCard: "14px"
  sideButton: "10px"
  input: "10px"
spacing:
  base: "4px"
  scale: [4, 8, 12, 16, 20, 24, 32, 40, 48, 64]
  section: "clamp(48px, 6vw, 72px)"
elevation:
  shadow1: "0 1px 3px rgba(17,17,17,0.05)"
  shadow2: "0 2px 12px rgba(17,17,17,0.06)"
  shadow3: "0 16px 40px rgba(17,17,17,0.10)"
  glassRest: "0 2px 12px rgba(17,17,17,0.06), inset 0 1px 0 rgba(255,255,255,0.7)"
  glassHover: "0 16px 40px rgba(17,17,17,0.10), inset 0 1px 0 rgba(255,255,255,0.85)"
motion:
  duration:
    fast: "150ms"
    base: "200ms"
    slow: "300ms"
  easeOut: "cubic-bezier(0.22, 1, 0.36, 1)"
  easeIn: "cubic-bezier(0.4, 0, 0.7, 1)"
breakpoints:
  sm: "640px"
  md: "768px"
  lg: "860px"
  xl: "940px"
components:
  - name: ".tregu-glass"
    role: "Base panel: frosted card used by every surface in Tregu (market cards, head chip, empty state, loading skeleton)."
  - name: ".tregu-ribbon"
    role: "Dark ink status bar bridging the video hero into the cream floor. Live market count, volume, last-updated."
  - name: ".tregu-market (MarketMiniCard)"
    role: "Dense market card: category pill, question, sparkline + 7d delta, order-book depth bar, PO/JO side buttons with payout multiples, volume footer."
  - name: ".tregu-btn-yes / .tregu-btn-no / .tregu-btn-primary"
    role: "Side-betting buttons (green/red, dim fill) and the primary ink CTA (bonus claim, hover shifts to orange)."
  - name: ".tregu-sort / .tregu-controls"
    role: "Segmented sort control + market count, ink pill on selection."
  - name: ".tregu-ticker"
    role: "Horizontally scrolling live trade tape."
---

# Tregu — DESIGN.md

## Overview

Tregu is 383's prediction market: a trading floor built into a Kosovo news site, not a casino bolted onto one. **The Trading Floor Rule.** Every shared surface answers to the floor first — dark ink status ribbon, tabular payout multiples, order-book depth bars, live trade tape — and the reward layer (coin flips, bonus claims, confetti-style coin flight) is a moment that happens *on top of* that floor, never a replacement for it. If a component has to choose between reading as "serious market data" or "fun game chrome," it reads as market data.

The system is deliberately native to 383, not a dark SaaS app dropped into a news site: it reuses 383's own cream/ink/orange tokens rather than inventing a parallel dark palette. "Liquid glass" here is a restrained, load-bearing choice — `backdrop-filter` blur + layered borders + an inset highlight — used because a trading floor needs panels that feel like glass over the day's news, not because glass is decorative. Anti-references: not Polymarket's stark dark-mode terminal, not a mobile sportsbook's saturated odds-board. The floor should feel like it grew out of 383's homepage, one scroll down from the hero.

## Colors

Base site tokens (`--color-*`) carry through: **cream** `#F9F6F1` body, **ink** `#111111` text and primary actions, **orange** `#FF4422` as the single brand accent (hover states, the hero's radial glow, active-CTA color). Tregu layers a scoped palette on top via `--tg-*` custom properties, all defined once on `.tregu-scope` so nothing leaks into the rest of 383.

**The Two-Color Market Rule.** Only two colors carry meaning inside a market: **yes-green** `#00A651` (dim fill `rgba(0,166,81,0.12)`, text `#007A3C`) and **no-red** `#E41E20` (dim fill `rgba(228,30,32,0.12)`, text `#B4181A`). They appear in exactly three places per market — the depth bar, the side buttons, the 7-day delta chip — and nowhere else. Category color (politics/economy/sport/world) stays confined to the muted `.tregu-pill`; it never competes with yes/no for attention.

The status ribbon is the one deliberately dark surface in the system: `#17130E` ink-black, a hairline `rgba(255,68,34,0.55)` orange top border marking it as the seam between the video hero and the cream floor, live-dot in `#3ED484` (a cooler, more "terminal" green than the yes-green, so "market open" reads as system status, not a bet outcome).

Glass panels use translucent whites, never solid fills at rest: `rgba(255,255,255,0.66)` panel, `rgba(255,255,255,0.82)` for the "hi" emphasis variant (the balance chip, the empty state), borders at `rgba(17,17,17,0.08)` resting / `0.16` on hover.

## Typography

One family, Manrope, carries the entire floor — headings, labels, data, buttons — per the product register: a trading interface doesn't need a display pairing, it needs one typeface tuned across a tight scale (product default 1.125–1.2 step ratio, not brand's fluid display jumps). The one exception is the page H1 ("Tregu"), which still clamps (`clamp(24px, 3.2vw, 34px)`) because it sits directly under the fluid-type hero above it.

**The Tabular Numbers Rule.** Every number a trader might compare against another number — balance, stat values, payout multiples, side percentages, volume, ticker coin amounts — sets `font-variant-numeric: tabular-nums`. This is non-negotiable inside `.tregu-scope`: proportional digits on a probability that's about to move is the fastest way to make the floor feel untrustworthy.

Labels lean on letter-spacing to separate "chrome" text from "data" text: stat labels and pills go uppercase at 0.16em / 0.04em tracking respectively; the numbers next to them stay normal-case and un-tracked. That contrast is the label/value pattern for the whole floor, not just the ribbon.

## Elevation

Two elevation systems coexist by design, and DESIGN.md treats that as intentional rather than inconsistent: the base 383 site uses flat `--shadow-1/2/3` cards (`rgba(17,17,17,0.05–0.10)`, no blur-filter), while `.tregu-scope` upgrades every panel to glass — blur(20px) saturate(150%), a soft rest shadow plus an `inset 0 1px 0 rgba(255,255,255,0.7)` top highlight that reads as a glass edge catching light.

**The Lift-on-Interact Rule.** Glass panels are flat at rest and lift only on deliberate hover (`translateY(-2px)`, shadow deepens to `shadow3` + a brighter inset highlight), gated behind `@media (hover: hover) and (pointer: fine)` so touch devices never get a fake hover state stuck mid-lift. Nothing on the floor animates elevation on load beyond the one-time staggered `tregu-rise` entrance (40ms cascade per card, capped at 240ms) — elevation communicates "you're about to interact with this," not ambient decoration.

`prefers-reduced-transparency` drops every glass panel to a flat `#FFFFFF` fill with the blur stripped — the floor keeps its layout and hierarchy with zero glass, never a broken translucent panel over unreadable content.

## Components

**Market card (`.tregu-market`, `MarketMiniCard`)** is the unit the whole hub is built from: category pill → two-line clamped question → optional sparkline with 7-day delta chip → order-book depth bar (green/red split, one hairline gap between them) → PO/JO side buttons stacked with payout multiple below the percentage → a footer with volume and a hover-revealed "Hap tregun →". The depth bar and side buttons always agree — same percentage, same color — so a trader never has to reconcile two representations of the same probability.

**Buttons** split by intent, not by size: `.tregu-btn-yes` / `.tregu-btn-no` are dim-fill, low-commitment ("you're browsing this side") and live inside cards; `.tregu-btn-primary` is solid ink with an orange hover, reserved for the one true commitment action per screen (claim bonus, place a trade). Category filter chips and sort segments use a third pattern — ink-fill-when-active pill — that never overlaps visually with yes/no green/red.

**Status ribbon** is the only component allowed to break the cream/glass system: full-bleed dark ink, always visible directly under the hero, carrying exactly three live stats (open markets, volume, last updated) plus a pulsing live-dot. It is chrome, not a card — no border-radius, no shadow, no hover state.

**Live ticker** is a single auto-scrolling row of the most recent real trades (`name`, bought/sold, PO/JO, coin amount, market question, time-ago), each item a link straight into that market. It exists to make the floor feel populated and current, not as a marketing marquee — every row is a real, tappable trade.

## Do's and Don'ts

- **Do** keep yes/no green/red confined to the depth bar, side buttons, and delta chip — three places, always in sync with each other.
- **Do** set `tabular-nums` on every comparable number (balance, %, multiples, volume, ticker amounts) — this is the floor's credibility signal.
- **Do** let the coin/bonus system celebrate *at* the balance chip or mobile account bar, never inside a market card — a card's job is showing the trade, not the reward.
- **Do** keep the status ribbon dark, flat, and border-radius-free — it's a header, not a card, and mixing it into the glass system would blur "chrome" and "content."
- **Don't** add a third accent color to a market card. Category pills stay muted-gray; introducing a category color there competes with yes/no for the trader's eye.
- **Don't** apply the coin-earn spin, shine-sweep, or confetti-style flight to anything inside `.tregu-market` or `.tregu-detail-grid` — those animations belong to the wallet/balance layer (navbar chip, mobile account bar, portfolio), never to trading surfaces.
- **Don't** give glass panels a hover-lift on touch devices; the `(hover: hover) and (pointer: fine)` gate exists because a fake hover state that never resolves reads as a stuck/broken button on mobile.
- **Don't** introduce solid, opaque glass at rest. If a panel needs guaranteed-opaque content (a modal, a confirmation), that's a signal it should not be `.tregu-glass` at all — reach for the site's flat `.card` instead.

# Visit — Kosovo in Your Pocket

The rules below apply only to `app/visit`, its homepage preview, and its visitor navigation entry. They extend 383 without changing the Tregu system above; Tregu glass and market semantics must not leak into Visit. The approved visual reference is `C:\Users\PC1\.codex\attachments\02f19901-29a6-4944-bd3c-f65c32765d79\image-1.png`.

## Overview

**Creative North Star: “Kosovo in Your Pocket.”** Visit is a calm Kosovo route desk with two offline products: a border utility and a photo-led city guide. The entire page stays in one warm cream, ink, and 383-orange world. The first viewport pairs direct travel copy with a full rectangular folded road-map sheet; the lower city field continues the same paper material instead of switching into a separate color world.

The page is Operate-first and Read-second. A visitor can call 112 before granting permission, compare four current crossing waits, request nearby help, submit a fresh-location report, and download the utility as standalone HTML. Each of seven cities contains five photo-led places with category, visit-time hint, short practical detail, and direct Google Maps directions; selected cities form a session package that can be downloaded individually or together.

**The Safety Before Scenery Rule.** No map, photograph, fold, or download treatment may delay, obscure, or compete with emergency access, current wait state, location consent, or the limits of 383 guidance.

## Colors

Visit uses the exact surface-scoped palette recorded in the normative tokens above: soft canvas, warm paper, near-white cards, warm ink, muted copy, quiet rules, and 383 orange. The city field deepens only slightly to `cityField`; it does not introduce cobalt, yellow, or pastel postcard framing. Documentary photography supplies natural color inside otherwise neutral cards.

**The Four-Signal Rule.** Orange identifies selected modes, reporting, directions, and primary downloads; green means a short wait or permissioned nearby-help action; amber means a moderate wait; wait red means a long wait. The darker emergency red is reserved for callable help.

Wait meters are numeric and color-redundant: green below 15 minutes, amber from 15 through 29, and red from 30 minutes. Each is one continuous rounded fill over a neutral track and animates from zero to its scale. Unknown values render an empty track and explicit “Pa të dhëna,” never a reassuring green zero.

## Typography

Manrope leads with Arial as the local fallback. Display headings are extra-bold, tightly tracked, balanced, and fluid: the hero, section, and city-name values are recorded exactly in the v2 tokens above. On phones the hero clamps to `45–64px`; readable leads settle at `16px`. Body and explanation copy stays relaxed at `1.45–1.62` line-height.

Operational labels, card brands, place categories, visit-time hints, and compact metadata use dense `9–12px` type, usually `750–900` weight. Place categories use uppercase with `0.07em` tracking; border-card branding uses `0.12em`. Wait values use tabular numerals so ranges scan vertically.

**The Visible-Task Rule.** The visible surface prioritizes the travel task and deliberately omits authority badges, source strips, provenance labels, and review dates. Internal source identity and review metadata remain an authoritative data/backend concern; do not leak them back into the interface as decorative trust chrome.

## Layout

The hero is deliberately oversized: a `min-height: 790px` two-column field with a narrower copy desk and a larger rectangular map stage. The wait preview overlaps the bottom of the map. Main sections use a centered `1280px` content field. The border tool is a `300px` sticky control rail beside the flexible utility card; the city builder is a `260px` sticky picker beside the guide. The five-place gallery uses a 12-column composition: the first two places span seven and five columns, then three equal four-column cards. Saved-city covers form a three-column stack.

At `1080px`, columns tighten, service/emergency grids become two columns, place cards become two-up, and saved covers become two-up. At `820px`, the hero, border tool, city builder, and saved covers become single-column; sticky controls become static; the map keeps a dedicated `610px` stage; places remain two-up. At `560px`, the map stage drops to `490px`, border-pin text hides, nearby services and place cards stack, emergency numbers remain two-up, utility corners tighten, and long download qualifiers disappear. The floating 112 control stays reachable at every width. Print mode removes site chrome, hero, controls, city section, and floating help, leaving the border utility card without elevation.

Spacing is generous between decisions (`76–124px` section padding) and compact inside artifacts. Preserve the story order: rectangular folded-map hero and two modes → current border desk → photo-led city guide → session downloads. There is no yellow trust close.

## Elevation & Depth

Depth is physical and restrained. The hero repeats `public/visit/atlas-texture.webp` at low opacity, while the map itself is a full warm rectangular CSS sheet with clipped folded corners, fold highlights, road/river linework, an authored Kosovo outline, live labels, and a warm shadow (`0 28px 35px rgba(62,43,23,.2)`). It is not a cutout Kosovo raster focal.

The overlapping wait preview uses `0 22px 46px rgba(39,29,19,.15)`. The utility uses `0 20px 54px rgba(50,37,24,.1)`, the city guide uses `0 24px 60px rgba(55,40,24,.1)`, and saved covers use `0 15px 36px rgba(56,42,26,.08)`. City photography is clipped inside white cards; it never becomes a full-bleed page background.

Do not introduce Tregu-style liquid glass, black utility framing, cold SaaS panels, or colored postcard worlds. Translucency is limited to near-white paper over the atlas texture, and the interface remains legible if texture fails to load.

## Shapes

Controls use practical `8–13px` radii; the wait preview and saved-city covers use `16px`; the utility and city guide use `20px`; place cards use `15px`. Primary downloads, saved-card actions, mode emphasis, and the floating emergency control use rounded or pill geometry. Map marks remain circular.

The utility is a quiet cream document with a near-white header, orange vehicle icon, hairline divisions, a softly raised selected row, nearby-service band, and red emergency buttons. It has no black header, perforated/scalloped edge, or passport stamp. City cards are photo-led editorial containers, not colorful postcards.

## Components

**Folded Kosovo field.** Build the dominant map as the implemented full rectangular warm paper sheet with fold seams and an authored Kosovo drawing inside it. Layer semantic city labels and four border anchors above the drawing and retain “Hartë e stilizuar - jo për navigim.” The compact city-header variant uses the authored vector silhouette at low opacity.

**Border desk.** Crossing and direction controls drive both the highlighted row and offline export. Current official ranges refresh every `600` seconds; the visible UI shows the range and update time but intentionally omits source/provenance strips. If parsing or fetching fails, show unavailable data; do not preserve a stale “live” value as fact.

**Wait meter.** Render the entry or exit range with an explicit textual value plus one continuous green/amber/red fill. The fill animates over `720ms` with the visit ease-out curve. Beneath it, show the update time and either the accepted community median plus report count or “Pa raport të verifikuar.” Community data never replaces the primary range.

**Validated community report.** Request a fresh location only after the visitor chooses to report (`maximumAge: 0`). Require reported accuracy within `1km` and physical proximity within `1km` of the selected crossing. Rate-limit the hashed device/network identifier to one report per ten minutes, compare against the current official midpoint, quarantine large outliers, and aggregate accepted reports from the latest 30 minutes. Store distance and accuracy buckets, not exact coordinates. After an accepted submission, refresh the border payload so the new community median can appear immediately.

**Permissioned nearby services.** The “Gjej ndihmën më të afërt” action requests browser location; there is no automatic prompt. Query police, hospital, fire station, and fuel within `10km`, show distance, and tell visitors to verify opening hours. When the map index degrades, expose clearly labeled map-search fallbacks. State that 383 does not retain the visitor's location, and never block 112 or the emergency numbers on permission denial.

**Offline utility card.** Keep current waits, community context, nearby-service state, and 112/192/193/194 within one scannable cream artifact. Download produces standalone HTML with continuous meters, emergency contacts, current direction, optional nearby services, and a dynamic-data warning. It opens offline and requires no account.

**Photo-led city guide.** Keep the city field warm and neutral. For each of seven implemented Kosovo cities, render exactly five places with a local WebP image, meaningful alt text, category, visit-time hint, short description, and direct Google Maps directions. The first two cards are larger on desktop; the remaining three complete the editorial grid. Do not show source names, authority badges, provenance strips, or review dates in the visible guide.

**City package and offline download.** Adding a city creates a session-only saved cover using its lead photograph. Support removal, individual HTML export, and batch export. Embed place images as data URLs when possible so the downloaded guide retains photography offline; preserve details and Maps direction links.

**Emergency access.** Repeat 112 in the hero, as a persistent deep-red floating control, inside the utility card, and in the offline export. Police, fire, and ambulance numbers remain directly callable. No emergency number may require an account, location permission, or payment.

**Motion.** Controls use `160–200ms` state transitions and fine-pointer lifts of `2–3px`. Continuous wait fills use a single `720ms` entrance. Mode selection may smoothly scroll to the relevant tool. `prefers-reduced-motion` collapses animation and transition duration to `.01ms`, restores instant scrolling, and preserves all selected, loading, and error feedback.

## Do's and Don'ts

- **Do** keep 112 accessible before permission or selection and repeat it in the utility card and offline file.
- **Do** refresh official border ranges every ten minutes, show the update time, and fail to an explicit unavailable state when data cannot be trusted.
- **Do** keep accepted community medians and report counts visually secondary to the primary range, then refresh them after an accepted submission.
- **Do** request location only for the visitor-initiated nearby-service or reporting action; require a fresh `1km`-accurate fix within `1km` for reports; explain denial/degradation; avoid exact-coordinate storage.
- **Do** preserve visible focus, minimum `42–52px` operational hit areas, a linear mobile reading order, and reduced-motion behavior.
- **Do** give every city exactly five photographic place cards with useful details, time hints, alt text, and Maps directions; keep saved cities session-only unless a new persistence design is approved.
- **Don't** restore the removed documents, money, investment, health, property, or six-route portal architecture. V2 has two modes only: border utility and city guide.
- **Don't** represent community reports, map listings, opening hours, or downloaded snapshots as guaranteed live truth.
- **Don't** restore visible source/provenance strips, badges, review dates, or authority chrome; sourcing stays internal to data and backend review.
- **Don't** sell location, put safety or emergency numbers behind payment, or let commercial placement affect wait estimates, report validation, or safety access.
- **Don't** restore the cobalt/yellow city section, black utility header, segmented meters, stamp, scalloped edge, yellow trust close, or cutout-raster map focal.
