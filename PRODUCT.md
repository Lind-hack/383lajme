# 383 Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

383 serves people who follow Kosovo news and public life. The `/visit` surface primarily serves members of the Kosovo diaspora, their partners, children, friends, and other international visitors preparing for or currently making a trip to Kosovo. They may be driving across several borders, arriving by plane, have limited Albanian, or need help quickly in an unfamiliar system.

## Product Purpose

383 combines Kosovo-focused news with useful public-interest tools. The diaspora visitor surface shortens the path from a visitor's situation to a practical next action. Success means a visitor can compare border waits, verify and share a nearby report, find urgent help, and carry useful border or city cards without creating an account.

## Positioning

383 brings practical visitor guidance into the same Kosovo-focused product people already use for current information. `/visit` has two clear modes: a border utility for the journey into or out of Kosovo and a photo-led city-card builder for the stay. Authority and provenance remain maintained in the data layer without adding visible source strips that compete with the task.

## Operating Context

Visitors use the product before departure, during a long drive, at a border crossing, or while planning a day in Kosovo. Usage is mobile-first and may happen with weak connectivity, limited time, or elevated stress.

## Capabilities and Constraints

- Provide a dedicated `/visit` page and visible entry points from the homepage and navigation side panel.
- Keep exactly two visitor products: the border utility card and the city travel card. Do not restore documents, banking, investment, property, insurance, or six-route portal sections.
- Show Kullë, Merdarë, Hani i Elezit, and Vërmicë/Morinë in a continuously filled, animated wait meter that remains understandable without color or motion.
- Refresh authoritative border conditions every ten minutes and fail to an explicit unavailable state when live data cannot be trusted.
- Let a visitor report a selected crossing and direction only after granting a fresh location within one kilometre of that crossing. Rate-limit reports, quarantine implausible outliers, aggregate recent accepted reports, and never retain exact coordinates or raw IP addresses.
- Request location only after the visitor explicitly asks to report or find nearby police, ambulance, fire, or fuel. A denied location must never block emergency numbers.
- Keep `112`, `192`, `193`, and `194` callable and visible without implying that 383 dispatches emergency help.
- Offer seven major Kosovo cities, five photo-led places per city, a useful description and visit hint for each place, and a direct Google Maps action.
- Let visitors save multiple city cards in the current session and download one city, all saved cities, or the border utility as standalone offline HTML.
- Require no account. Do not sell location or put safety and emergency functions behind payment.
- Keep sourcing, review dates, and freshness validation in the backend and data model; do not reintroduce visible provenance strips into this surface unless the product owner changes that decision.
- Production domains are updated only through Vercel's GitHub integration after a committed push to `origin/main`. Never deploy a local working tree directly to production.

## Brand Commitments

The product name is `383`. Existing logo, warm cream, ink, and orange brand recognition must remain intact. Albanian is the surface's current primary voice. The experience should feel distinctly Kosovo-specific: calm and operational at the border, warmer and more vacation-oriented in the city guide, without introducing a separate cobalt product world.

## Evidence on Hand

- Existing 383 visual implementation and tokens in `app/globals.css`, `components/navbar.tsx`, and `DESIGN.md`.
- Existing diaspora editorial module in `components/diaspora-series.tsx` and `lib/mock-data.ts`.
- User-provided visitor feature scope and safety rules in the active task.
- Current border parsing and community aggregation in `lib/visit-border-server.ts`, `lib/visit-community-store.ts`, and `app/api/visit/borders`.
- Curated seven-city, five-place data in `lib/visit-v2-data.ts`, with local documentary imagery and Google Maps queries.
- No visitor testimonials, service guarantees, or emergency-response capability is confirmed. Future work must not fabricate them.

## Product Principles

1. Get the visitor to the right action quickly.
2. Keep authority and freshness enforced in the data path while keeping the visible task interface concise.
3. Personalize with the minimum sensitive information.
4. Keep stressful paths calm while making preparation and discovery enjoyable.
5. Preserve useful fallbacks when connectivity or live sources fail.

## Accessibility & Inclusion

The visitor surface must be keyboard accessible, mobile-first, readable in stressful conditions, and usable with reduced motion. Critical actions must not depend on color, animation, or hover. Location requests need a clear purpose, understandable success and failure states, and a usable denial fallback.
