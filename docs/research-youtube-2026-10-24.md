# LIN-943: Research YouTube

**Research date:** 2026-10-24
**Linear issue:** LIN-943 — "Research YouTube" (voice note: "Hey, research YouTube for me.")
**Scope:** Desk research only. No API keys, OAuth apps, Google Cloud projects, or YouTube
channel/account were created or changed. No code was changed.

## Important ambiguity

The issue gives no scope beyond the word "YouTube" — no API, no feature, no decision it is
meant to inform. 383 already touches YouTube in three separate, deliberately narrow ways (below),
and also just shipped a feature (the video edition / "Më shumë për ty" video rows, see recent
commits `fdfe2129`, `819a32d3`, `4a9f6033`) that produces 383's **own** short vertical video
clips but does not publish them anywhere outside 383.ks.com.

Absent a more specific ask, this report does two things:

1. **Audits what 383 already does with YouTube** — so "research YouTube" has a documented
   current-state baseline instead of starting from zero.
2. **Answers the question the current codebase state makes obvious to ask next**: now that 383
   produces its own short-form video content, should it also publish to a 383 YouTube channel?
   This is the one YouTube-shaped decision visibly open in the repo right now.

If LIN-943 meant something narrower (e.g., "check why a specific video embed broke" or "evaluate
the YouTube API for X"), that should be filed as its own issue — this report does not guess at
it beyond the two items above.

## Part 1 — Current state: how 383 already uses YouTube

383 uses YouTube in three places, and in all three only the **free, keyless, read-only** surface
— RSS feeds of specific channel IDs and the public oEmbed endpoint. None of them use the paid/
quota-metered Data API v3, OAuth, or a Google Cloud project. This looks like a deliberate pattern,
not an oversight: a related commit (`562423b0`, "drop youtubesearchpython — the package no longer
exists") shows the project already walked back an unofficial scraping library in favor of this
simpler, ToS-aligned approach.

| Surface | File | What it does |
|---|---|---|
| Article illustration fallback | `scripts/news_video_policy.py` | When no licensed photo exists for a story's subject, polls ~150 official-channel RSS feeds (governments, institutions, leagues, clubs, companies — never news outlets) for uploads in the last 3 days, requires the video's title to name the story's subject and share an event word, confirms embeddability via oEmbed, and embeds the player (`youtube-nocookie`) on the article page. |
| Dosje explainer vetting | `lib/dosje-video.mjs` | Gatekeeps explainer videos attached to a `/dosje` dossier: the channel must be on an editorial allowlist of real newsrooms/institutions (`VETTED_CHANNELS`), and oEmbed must confirm the video still exists and report who made it, before a human reviewer ever sees it as a candidate. |
| Social discovery (research-only) | `last30days` skill (used by `docs/383-cloud-news-automation.md`) | Treated as one listening source among many (TikTok, Instagram, X, Reddit, etc.) for story discovery, not for sourcing embeddable video. |
| Removed: video search/theater UI | `tasks/kuizi-dites-plan.md` (2026-10-12 decision) | Kuizi i Ditës deliberately dropped `/api/yt-search` and its video theater dialog — "Video is gone... Text plus the stories' existing `imageUrl`." |

Nothing here publishes *to* YouTube. All of it reads from a small, named allowlist of channels
and never touches arbitrary search.

## Part 2 — The open question: should 383 publish its own clips to a YouTube channel?

383's video edition (`lib/video-edition.ts`, `components/video-row.tsx`, `app/video/`) renders
up to seven Albanian-voiced short clips a day (HD 1080×1920, matching YouTube Shorts' format
exactly) and now personalizes a subset of them per reader under "Më shumë për ty" (`fdfe2129`,
`819a32d3`). Today these clips live only on 383ks.com. YouTube is a plausible second distribution
surface for exactly this content, so it's the concrete case worth researching.

### What it would take technically

- **Uploading is the only part that needs the paid/metered API.** Reading channel feeds (what
  383 already does) stays on RSS + oEmbed, free and keyless. Uploading requires the **YouTube
  Data API v3** (`videos.insert`) behind an OAuth2-authorized Google Cloud project — a real
  credential 383 does not currently hold for YouTube.
- **Quota changed materially in 2026 and is now more generous for this exact use case.** Before
  June 1, 2026, every project shared one 10,000-unit/day budget and an upload cost 1,600 units —
  about 6 uploads/day on the free tier. Since June 1, 2026, Google split uploads into their own
  bucket: `videos.insert` now costs 1 unit against a separate 100-calls/day allocation, independent
  of the shared 10,000-unit budget used for everything else. Seven uploads a day fits this
  comfortably with no quota-increase request needed. ([getphyllo.com](https://www.getphyllo.com/post/youtube-api-limits-how-to-calculate-api-usage-cost-and-fix-exceeded-api-quota), [blotato.com](https://www.blotato.com/blog/youtube-api-pricing))
- **No per-call cost.** The Data API is free to use within quota; there is no YouTube equivalent
  of a pay-per-request bill.

### Monetization is not a near-term target, and shouldn't drive the decision

- Shorts ad-revenue sharing requires **1,000 subscribers + 10M valid Shorts views in 90 days**
  (or the long-form path: 1,000 subscribers + 4,000 public watch hours/12 months). A lighter
  Tier 1 (fan funding/shopping only) needs 500 subscribers + 3M Shorts views/90 days.
  ([vidiq.com](https://vidiq.com/blog/post/youtube-shorts-monetization/))
- **The bar is rising, not falling.** From 1 Feb 2027, new applicants need 1,000 subscribers +
  8,000 watch hours/365 days, or 20M Shorts views/90 days — roughly double today's requirement.
  Existing partners are grandfathered, but a channel started now would likely face the higher
  bar before it could plausibly qualify anyway. ([androidheadlines.com](https://www.androidheadlines.com/2026/08/youtube-doubles-partner-program-monetization-requirements-2027-update.html))
- Given 383's actual goal is almost certainly distribution/reach for 383ks.com, not YouTube ad
  revenue, monetization thresholds shouldn't be a go/no-go factor — but they do mean nobody
  should promise ad income as a reason to do this.

### The real risk is YouTube's "inauthentic content" (formerly "repetitious content") policy

Effective 15 July 2025, YouTube tightened enforcement of what now disqualifies a channel from
monetization and recommendation: **"mass-produced or repetitive content"** — videos built from a
reused template with little per-video distinctiveness, compilations with no added value, or
lightly-edited reposts. YouTube states it evaluates the *output*, not the tool: AI-assisted
or AI-voiced content is fine as long as each video is original and valuable, not templated at
scale to game discovery. ([tubefilter.com](https://www.tubefilter.com/2025/07/03/youtube-crackdown-repetitive-non-original-content/), [searchenginejournal.com](https://www.searchenginejournal.com/youtube-targets-mass-produced-content-in-monetization-update/550337/))

383's video edition is, structurally, exactly the shape this policy targets: a fixed template
(photo/fact/quote/map/video beats, one TTS voice, same intro rhythm), seven a day, every day.
The commits already in this branch's history (`6beb8c8d` "fill older stories while the summary
model is out of quota", `d21d70fd` "word shots take turns between three looks; more of what
stories speak of finds b-roll") show the team is already aware that visual variety matters and
has been actively working to increase it — which is the right direction to keep leaning in if
this ships to YouTube, independent of whether monetization is ever sought. A channel that is
demonetized or demoted for "inauthentic content" is also a channel YouTube won't recommend,
which would defeat the distribution purpose of doing this at all.

### Disclosure requirement

Since early 2025, YouTube requires creators to flag "realistic altered or synthetic content" via
the uploader's "Altered Content" toggle — content depicting real people/places/events that could
mislead a viewer if they didn't know it was synthetic. AI-generated scripts, auto-captions, and a
synthetic voice reading real, attributed news over real photos/maps (383's actual format) are
explicitly **not** the target of this rule and don't need disclosure on their own; it targets
fabricated depictions (e.g., a real person appearing to say/do something they didn't). Disclosure,
when it does apply, doesn't by itself restrict reach or monetization eligibility.
([support.google.com](https://support.google.com/youtube/answer/14328491?hl=en), [blog.youtube](https://blog.youtube/news-and-events/disclosing-ai-generated-content/))

### Licensing / rights check specific to re-publishing on YouTube

383's existing b-roll and photo-rights pipeline (`news_video_policy.py`, `news_image_policy.py`)
was built for *embedding on 383ks.com under YouTube's own embed terms* and for Commons
CC0/PD/CC BY(-SA) images. Re-publishing that same imagery *inside a new 383-authored video
uploaded to YouTube* is a different legal act — it's no longer "embed the original," it's
"incorporate into a derivative work I'm distributing under my own channel." Commons CC
BY(-SA) material is compatible (attribution would need to move from a webpage caption into
the video itself or its description), but this needs an explicit pass before any upload, not
an assumption that the existing article-embed rights clearance already covers it.

## Recommendation

Do not build or credential anything from this report alone — it is research, not a decision.
If the product owner wants to pursue a 383 YouTube channel for the video edition:

1. **Pilot manually first**, uploading a small number of clips by hand through YouTube Studio
   (no API credential needed) for a few weeks to see real audience/recommendation behavior before
   writing any automation.
2. **If it's worth automating**, request a Google Cloud project + OAuth2 client scoped to
   `youtube.upload` only; the current 1-unit/call, 100-calls/day `videos.insert` bucket (effective
   since 1 June 2026) covers 7 uploads/day with no quota-increase request.
3. **Treat per-clip visual/script variety as a hard requirement, not a nice-to-have** — continue
   and extend the b-roll/word-shot variety work already underway, specifically because YouTube's
   inauthentic-content enforcement is template-shape-aware, not just duplicate-detection-aware.
4. **Clear re-publication rights for any Commons-sourced imagery before the first upload** —
   don't carry over the embed-terms clearance built for the article page.
5. **Do not plan around YouTube ad revenue.** Treat any channel as a distribution/discovery
   channel for 383ks.com; monetization thresholds are rising and are not the goal.

## Sources

- [YouTube API Quota Limits 2026: 10,000 Units, Costs & How to Get More](https://www.getphyllo.com/post/youtube-api-limits-how-to-calculate-api-usage-cost-and-fix-exceeded-api-quota)
- [YouTube API Pricing: Complete Guide for 2026 — Blotato](https://www.blotato.com/blog/youtube-api-pricing)
- [YouTube Shorts Monetization in 2026: Requirements, RPM, and How Much You Get Paid — vidIQ](https://vidiq.com/blog/post/youtube-shorts-monetization/)
- [YouTube Is Doubling Partner Program Monetization Requirements — Android Headlines](https://www.androidheadlines.com/2026/08/youtube-doubles-partner-program-monetization-requirements-2027-update.html)
- [YouTube tightens monetisation rules for repetitive content — Content Grip](https://www.contentgrip.com/youtube-tightens-monetisation/)
- [YouTube doesn't want to monetize "mass-produced or repetitive" content — Tubefilter](https://www.tubefilter.com/2025/07/03/youtube-crackdown-repetitive-non-original-content/)
- [YouTube Targets Mass-Produced Content in Monetization Update — Search Engine Journal](https://www.searchenginejournal.com/youtube-targets-mass-produced-content-in-monetization-update/550337/)
- [Disclosing use of altered or synthetic content — Google/YouTube Help](https://support.google.com/youtube/answer/14328491?hl=en)
- [How we're helping creators disclose altered or synthetic content — YouTube Blog](https://blog.youtube/news-and-events/disclosing-ai-generated-content/)

## Research limitations

This report relies on third-party summaries of YouTube policy (vidIQ, Tubefilter, Search Engine
Journal, Android Headlines, getphyllo, Blotato) alongside two first-party Google/YouTube pages;
it was not cross-checked against the official YouTube Partner Program and Data API documentation
pages directly. Pricing, quota, and policy thresholds should be reread from
`developers.google.com/youtube/v3` and YouTube's official Partner Program page immediately before
any implementation decision, since both have changed materially within 2026 per the sources above.
