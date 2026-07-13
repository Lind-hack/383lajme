# 383 Lajme Cloud News Automation

This is the canonical prompt/instruction file for the scheduled Codex Cloud news run.
The automation should read this file before every production batch.

## Required preflight

Run these checks before researching or writing articles:

```bash
python3 ~/.codex/skills/last30days/scripts/last30days.py --preflight
python3 scripts/codex_automation_support.py github-auth
python3 scripts/codex_automation_support.py env-status
```

`SCRAPECREATORS_API_KEY`, `XAI_API_KEY`, and `INCLUDE_SOURCES` must be present for the full social research path. Do not claim TikTok, Instagram, Threads, Pinterest, LinkedIn, or X/Twitter were searched if the required key for that source is missing.

The installed `last30days` skill is mandatory for discovery. Read its `SKILL.md` and run its research engine with planned queries, not only `--preflight`. Use it as the multi-source listening layer for TikTok, Instagram/Reels, YouTube, Threads, LinkedIn, Polymarket, GitHub, Reddit/Hacker News, X/Twitter, and web discovery. X/Twitter is only one lane, not the default source for the batch.

## Cloud schedule

The GitHub Actions `schedule:` block is the active no-cost backup clock. GitHub can start scheduled jobs late, but it keeps the hosted pipeline running without a laptop.

The Vercel route `/api/cron/dispatch-news` is still available as a precise dispatcher for Vercel Pro Cron or an external scheduler. Vercel Hobby accounts cannot run the required every-two-hours cron schedule; production deploys fail if those frequent cron entries are present in `vercel.json`.

For exact 07:00, 09:00, 11:00, 13:00, 15:00, 17:00, 19:00, 21:00, and 23:00 Kosovo-time dispatches without GitHub scheduler delay, use either Vercel Pro Cron or an external scheduler that calls:

```text
https://383lajme.vercel.app/api/cron/dispatch-news
```

with header:

```text
Authorization: Bearer <CRON_SECRET>
```

If the scheduler cannot send headers, it can call:

```text
https://383lajme.vercel.app/api/cron/dispatch-news?secret=<CRON_SECRET>
```

Required Vercel production env vars for the scheduler route:

- `CRON_SECRET`: Vercel Cron authorization secret.
- `CODEX_PUSH_TOKEN` or `GITHUB_PAT` or `GITHUB_TOKEN`: GitHub token that can dispatch workflows for `Lind-hack/383lajme`.

## Core rules

- Publish 13 to 20 independently verified articles per cron run. Social-driven stories are preferred when independently corroborated, but their temporary unavailability must never block a verified non-social batch. Keep X/Twitter to two stories maximum and social-driven stories to 40% maximum. Do not pad with repeated or invented stories.
- Publish only stories from today in Europe/Pristina time. Reject anything from yesterday, 3 days ago, last week, or undated material.
- Use the last30days skill for research depth. Use it as the social/source-discovery engine, not as a generic web search replacement.
- Pair last30days social discovery with the pipeline's current-day web/RSS lead file. The social layer may be degraded when an optional provider rejects requests; that is never a reason to publish an empty batch or to treat X as the only available source.
- Search across X/Twitter, YouTube, TikTok, Instagram/Reels, Threads, Pinterest, LinkedIn, Polymarket, GitHub, Perplexity/web search, Serbian/regional sources, international outlets, official institutions, and specialist websites.
- Enforce source variety. Do not publish a batch where X/Twitter is the basis for more than two articles. No more than 40% of a batch may be social-driven. At least 60% must have a non-social primary source such as an official institution, company, court, club, specialist site, Serbian/regional outlet, or international outlet. Use at least six source families.
- Do not use Kosovo competitor outlets as the main source. Avoid Telegrafi, Koha, Gazeta Express, Klan Kosova, RTK, Reporteri, Indeksonline, Nacionale, Sinjali, Periskopi, Kallxo, Dukagjini, KosovoPress, Bota Sot, Zeri, Lajmi.net, Insajderi, Ekonomia Online, and Albanian Post as primary sources. They may be used only as context or corroboration.
- Every article must have a real, public, unique `image_url` that starts with `http://` or `https://`. Fetch and decode it before publication. Require at least `1200x675` pixels, record actual `image_width` and `image_height`, and reject missing, broken, low-resolution, unrelated, logo-only, placeholder, or reused images.
- Write original 383 Lajme Albanian newsroom copy. Do not make articles read like translations or source summaries such as "Reddit says" or "Instagram wrote" unless direct attribution is essential to a claim.
- Reader-facing titles and excerpts must never name the source outlet, platform, or account. Write clear Albanian newsroom headlines with a factual hook that makes the story worth opening. Keep social account, platform, and post URL only in the JSON `social_*` metadata used by the internal email report.
- Non-social articles must contain at least 500 Albanian words across at least five paragraphs. Social-driven articles may be short dispatches when their complete social metadata and accurate attribution are present. Set `reading_time` to `ceil(body word count / 200)`; the value must always reflect the actual body length.
- Preserve uncertainty. For rumors, accusations, and drama, write as "pretendon", "tha", "akuzoi", "u raportua", or "nuk eshte verifikuar" unless a reliable source proves it.
- Include conflicting angles when they are real and relevant, but do not manufacture conflict.

## Kosovo audience fit

The site is for readers in Kosovo. Pick stories that a Kosovo/Albanian reader is likely to click, argue about, share, or recognize. Generic international news should appear only when it has a strong Kosovo/Balkans angle, a famous person Kosovars know, a major platform trend, or clear social drama.

Prioritize:

- Kosovo politics, Serbia/Kosovo tension, diaspora, money, security, prices, jobs, sports, visas, migration, EU/NATO/KFOR, education, health, and scandals that affect everyday people.
- Regional Balkan stories with Kosovo relevance or high local word-of-mouth potential.
- Celebrities, athletes, streamers, musicians, influencers, and public figures known to Kosovo/Albanian audiences or currently viral among Albanian-speaking users.
- Dramatic, ridiculous, over-the-top statements, beefs, accusations, public reactions, contradictions, and "people are arguing about this" stories when they are sourced and safely framed.

Do not invent drama. Use social posts as discovery signals, then verify, attribute, or clearly frame the claim as disputed/unverified. Headlines and excerpts should be clickable and lively, but the body must stay accurate and legally safe.

## Source priorities

Technology / Teknologji:

- Prefer `therundown.ai` website articles/newsletter pages for AI and technology stories.
- Do not use The Rundown's X/Twitter account as the source for Teknologji. If using The Rundown, the article URL must be from `therundown.ai`.
- Use Instagram `@therundownai` only as a discovery signal; verify the final Teknologji article from the `therundown.ai` website or another primary/specialist source.
- Use other technology sources only when they are more relevant, more current, or directly connected to Kosovo/Balkans.

Celebrity / Entertainment / Showbiz:

- Track Instagram and web/social posts from `@theshaderoom`, `@complex`, and `@pagesix`.
- Use these for fast-moving celebrity, culture, music, sneakers, gossip, and entertainment stories.
- Prefer figures with Kosovo/Albanian recognition or strong local word-of-mouth potential: Albanian artists/influencers, diaspora celebrities, footballers followed in Kosovo, Balkan public figures, and global names that routinely trend among Kosovo youth.
- Avoid obscure US-only celebrity filler unless the drama is unusually viral or connected to music, sport, fashion, TikTok, or Instagram accounts followed by Albanian-speaking audiences.

Sports:

- Use accounts and sources such as `@433`, Fabrizio Romano, official club/league/player accounts, and high-signal X/Instagram/YouTube posts.
- For transfer stories, prefer Fabrizio Romano or official confirmations over recycled aggregator posts.

Politics / Politike:

- Search all current Kosovo-related political discussion across X/Twitter, Instagram, TikTok, Threads, YouTube, Serbian outlets, regional outlets, international media, official government/opposition channels, embassies, EU/NATO/KFOR/OSCE sources, and Polymarket when relevant.
- Serbian sources talking about Kosovo are valuable and should be marked with the Serbian-source flag already supported by the site.

Economy / Ekonomi:

- Search all current Kosovo economic news and signals across institutions, banks, companies, business leaders, international financial institutions, X/Twitter, Instagram, TikTok, Threads, LinkedIn, Serbian/regional outlets, and specialist finance/business sources.
- Prioritize practical impact: prices, jobs, energy, trade, taxes, remittances, investments, exports/imports, regulation, and company moves.

## Social-source metadata

When an article is based on a social post/status/video/reel/thread, include these optional fields in the article JSON:

```json
{
  "social_platform": "Instagram",
  "social_post_account": "@therundownai",
  "social_post_url": "https://www.instagram.com/...",
  "social_post_basis": "Brief note explaining what the post claimed or showed and how it supports the story."
}
```

Accepted aliases are `source_platform`, `source_account`, `source_post_url`, `source_post_basis`, and `source_post_quote`, but prefer the `social_*` names above.

The email report displays this metadata as "Social basis". If the article is social-driven and these fields are missing, validation should fail.

## Batch workflow

1. Research today's stories with last30days and live source checks.
2. Write the JSON batch into `data/auto-articles/YYYY-MM-DDTHH.json`.
3. Validate:

```bash
python3 scripts/codex_automation_support.py validate --file data/auto-articles/YYYY-MM-DDTHH.json
python3 scripts/validate_source_mix.py --file data/auto-articles/YYYY-MM-DDTHH.json
```

4. Build:

```bash
npm run build
```

5. Publish, deploy, verify, and email:

```bash
python3 scripts/codex_automation_support.py finalize --file data/auto-articles/YYYY-MM-DDTHH.json
```

Do not run the old Gemma/Google local generator as the source of truth for this scheduled cloud pipeline.
