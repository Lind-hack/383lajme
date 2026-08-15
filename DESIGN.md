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

# Visit — Folded Atlas

The rules below apply only to `app/visit`, its homepage preview, and its visitor navigation entry. They extend 383 without changing the Tregu system above; Tregu glass and market semantics must not leak into Visit.

## Overview

**Creative North Star: “The Folded Atlas.”** Visit is a calm, mobile-first field guide for people arriving in Kosovo or Albania. Warm paper, faint map texture, fold lines, perforation, stamps, and slightly rotated artifacts make information feel collected and travel-ready. Expression always serves preparedness: the primary hierarchy is emergency help, personal route setup, and current official sources.

**The Safety Before Scenery Rule.** No decorative device may delay, obscure, or compete with emergency access, route setup, source status, or the limits of 383 guidance.

## Colors

Visit uses a surface-scoped palette defined on its page shell: atlas ink (`#171614`), muted ink (`#69645D`), warm paper (`#F4EFE7`), paper white (`#FFFDF9`), rule line (`#D9D1C6`), soft rule (`#E9E2D9`), 383 orange (`#FF4422`), deep orange (`#CC2F15`), emergency red (`#A5221B`), and verified green (`#23624B`). The homepage preview uses the same ink and orange on a slightly deeper paper (`#EEE6DA`).

**The Three-Signal Rule.** Orange identifies navigation and primary preparation actions; green means reviewed or privacy-safe; red is reserved for emergency calling and high-consequence warnings. Never use emergency red as a decorative accent or ordinary CTA color.

## Typography

Manrope leads, with Figtree and Arial as fallbacks. Display headings are dense and editorial: extra-bold, tightly tracked, balanced, and fluid (`48–88px` on the hero; `40–52px` on small screens). Body copy stays relaxed (`1.45–1.65` line-height), while provenance, section numbers, stamps, and artifact labels use compact uppercase text with wide tracking.

**The Readable Provenance Rule.** Source names, review dates, status, language limitations, and safety notices are operational content—not microcopy. Keep them at readable contrast and at least `10–11px`; never fade them to decorate the card.

## Layout

The desktop shell uses a centered `1280px` maximum-width field with a split hero, a form-plus-sticky travel card, and a 12-column guide grid. At `980px`, the experience becomes a single flow and the travel card stops sticking. At `700px`, every critical task becomes one column, guide cards span full width, emergency contacts stack, and the persistent help control remains reachable above the viewport edge.

Spacing is generous between decisions and compact within artifacts. Preserve the numbered sequence: introduction and six routes → travel-card setup → source-checked guide → safety boundary. Print mode isolates the personal travel card and removes site chrome, the guide, and urgent overlay controls.

## Elevation & Depth

Depth is physical and restrained: paper tint, atlas texture, thin rules, dashed perforation, fold lines, rotated stamps, and one soft shadow per raised artifact. Primary panels use low warm shadows; the sticky travel card and emergency sheet may use deeper shadows because they sit above the document plane. Hover lift is limited to fine pointers, typically `1–2px`.

Do not introduce Tregu-style liquid glass. Translucency is allowed only as warm paper laid over the atlas texture, and the interface must remain legible if texture or blur fails to load.

## Shapes

Cards and sheets use gently rounded paper corners (`14–16px`); fields and source links use practical radii (`9–12px`); status chips, primary buttons, and utility actions use pills. Circular geometry is reserved for stamps, punches, icon controls, and the emergency number medallion. Dashed inner borders indicate a detachable or saveable travel artifact—not a generic card treatment.

## Components

**Personal travel card.** Treat it as a portable artifact: destination, arrival, plate country, interface language, checked dates, 112, and official shortcuts must survive scanning, printing, and offline save. The card is device-local; never imply that 383 stores or transmits the selections.

**Source resource.** Every reviewed claim exposes three inseparable elements: explicit status (`Current`, `Needs recheck`, or unavailable in 383), “Last checked” date, and the named authority as a direct outbound link. Do not replace these with a generic “official source” badge or a search-results link. Mixed Kosovo–Albania routes retain both countries' source sets.

**Emergency control and sheet.** The red “Need help now?” control persists on the page. The modal receives and traps focus, closes with Escape, restores focus, and makes background UI inert. Each callable number carries its own current status, checked date, authority name, and source link. Location sharing is opt-in, on-device, and must explain failure or denial without blocking the phone numbers.

**Travel setup.** Destination, arrival method, plate country, and interface language are explicit inputs. The entire visible arrival option receives keyboard focus, selected state, and a minimum touch-friendly hit area. Insurance messages remain conservative: a plate country never proves coverage; direct the visitor to the relevant authority for an individual check.

**Language behavior.** Eight interface languages may translate controls, headings, and route labels. Reviewed summaries and safety/source material remain honestly marked as English, and official sites open in the authority's language. Never change the document language to a selected interface language while English operational content remains on screen.

**Motion.** Use short entrance staging and small purposeful lifts (`140–450ms`, ease-out). The only attention pulse belongs to emergency access and runs a finite number of times. `prefers-reduced-motion` collapses animation and transition durations without removing state feedback.

## Do's and Don'ts

- **Do** keep 112 accessible before personalization and repeat it on the personal card.
- **Do** show provenance per resource and per emergency number, including country-specific sources on combined routes.
- **Do** keep all essential controls usable by keyboard, preserve visible focus, and maintain a linear mobile reading order.
- **Do** make stale or unavailable information obvious and keep useful alternatives visible when a source cannot be trusted.
- **Don't** diagnose medical or legal conditions, promise rescue, infer insurance eligibility, or present 383 as an authority.
- **Don't** hide source dates, authority names, safety limits, or language limits behind hover, tooltips, or low-contrast microtype.
- **Don't** add accounts, remote location storage, or crowdsourced “live” claims to this surface without a new privacy and verification design.
- **Don't** reuse emergency red, dashed perforation, stamps, folds, or atlas texture as generic site-wide decoration.
