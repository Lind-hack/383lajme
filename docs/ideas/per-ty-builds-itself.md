# Gazeta jote ndërtohet vetë (Për ty builds itself)

## Problem Statement

How might we make a first-time reader — young and phone-first from TikTok, or a habitual
Telegrafi/Koha reader — open Për ty, have it set up, notice something no other Kosovo
portal does, and come back tomorrow, without asking them to fill in a form first?

Observed (2026-10-09): people shown 383 scrolled the homepage and never touched Për ty or
the other unique features. The "Për ty" tab is visible on mobile (`components/mobile-tab-bar.tsx`)
but promises nothing, and the first thing it shows a guest is setup: hello → 3 questions →
a 3.6 s "building" animation (`app/per-ty/onboarding.tsx`).

## Recommended Direction

**383 already learns, silently.** `components/reading-affinity.tsx` runs on every article
page and records topic, people and city keys (0.5 on open, +1 after 10 s); `rankFeed()`
already serves those as `kind: "learned"` stories once they add up to one real read
(`lib/per-ty-rank.mjs`). The only thing stopping a self-built paper is the gate in
`per-ty-feed.tsx`: no explicit interests → onboarding. The best thing the site does is
invisible to the reader.

So we flip setup around. After a guest's **3rd real read**, Dardani appears once at the end
of that article: *"Lexove 3 lajme — sport, Prizren. Ta bëra gazetën."* with a preview of
their first three stories and one tap into /per-ty. A guest who has reading history skips
the questions and lands on their built paper. A short *"A e kam qëlluar?"* row lets them
adjust it, and the three questions move behind it as an edit, not a gate. A reader with no
history at all still gets today's onboarding.

The paper then opens on **Qyteti yt sot**: the existing town box made first and filled in
automatically. The home town is guessed from what they read (`city:*` affinity), or set with
one tap. It holds what 383 already collects: town weather (Open-Meteo, coordinates for all
22 towns in `lib/cities.mjs`), fuel prices, border waits, and the town's top story. The
existing "Po, ma dërgo" 07:00 push stays at the end, as the reason to come back tomorrow.

## Key Assumptions to Validate

- [ ] **First-time readers read 3 articles in their first visit.** Check reads per session
      in `lib/analytics.ts` data before building. If most stop at 1–2, trigger at 2.
- [ ] **A paper built from 3 reads feels right, not random.** Test in a private window on a
      real phone: read 3 Sport/Prizren stories and judge the paper you get. Learned keys are
      category, named people and city only, so 3 reads may give a thin, single-topic paper.
- [ ] **Town news exists for small towns.** The newsroom mix of 2026-09-24..30 had 1–4
      stories a week for small towns ([[383-per-ty]] memory). If the town's top story is
      usually empty, the box is just weather. Measure per town before promising "your town".
- [ ] **Dardani's card reads as a friend, not a tracker or an ad.** Wording test: "Më duket
      se të pëlqen…" vs anything with "të ndoqëm". Track tap vs dismiss rate.
- [ ] **Readers with a home town come back more.** Compare 7-day return between readers with
      and without `home` set (the visit-day counter in `lib/reader-ledger.mjs`, on device).

## MVP Scope

**In:**
1. A device-only read counter (count of 10 s reads, from the existing dwell timer) that
   `ReadingAffinity` can check.
2. Dardani's "Ta bëra gazetën" card at the end of the article on the 3rd read: shown once,
   preview of 3 stories from `rankFeed` with learned affinity, one CTA to /per-ty, and a
   dismiss that hides it for 7 days.
3. In `per-ty-feed.tsx`: a guest with no interests but enough learned affinity gets the
   paper, not onboarding. An "A e kam qëlluar?" row opens the existing steps prefilled
   from what was learned.
4. Home town guessed from the strongest `city:*` affinity (confirm with one tap), and the
   town box moved to the top of the paper as "Qyteti yt sot": weather + fuel + border wait
   + top town story, all from existing sources.
5. Device-only, no new tables, no new scrapers, no new push types.

**Out:** everything in Not Doing.

## Not Doing (and Why)

- **New homepage door / Gazeta jote strip.** Lind chose to keep the homepage as it is. The
  door is the personal card after 3 reads, not a banner.
- **KEDS power cuts, water cuts, pharmacies, team fixtures.** Only existing data for now.
  They're the real painkiller and the obvious v2, but each is a new scraper with an
  unknown source.
- **Accounts or server-side profiles.** Everything stays on the device (standing rule).
- **Town or person alerts.** Same rule. The 07:00 push is the only return channel.
- **Renaming the "Për ty" tab, Ndiqe story follow, Dardani reading your paper.** Good, but
  they improve a page people don't reach yet. Revisit once the card proves people arrive.
- **Learning finer topics (e.g. "Superliga" vs "Sport").** `articleKeys` stays as is. Fix
  only if assumption 2 fails.

## Open Questions

- Should the card also appear on the homepage on a return visit if it was ignored? MVP says
  no (one spot, one time); decide after seeing tap rates.
- 3 reads or 2? Decide from the analytics check above.
- Does a reader who skipped onboarding still get asked their name ("Si të thërras?") for the
  nameplate, or does the paper start as "Gazeta jote"?
