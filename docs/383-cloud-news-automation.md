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

## Core rules

- Publish only stories from today in Europe/Pristina time. Reject anything from yesterday, 3 days ago, last week, or undated material.
- Use the last30days skill for research depth. Use it as the social/source-discovery engine, not as a generic web search replacement.
- Search across X/Twitter, YouTube, TikTok, Instagram/Reels, Threads, Pinterest, LinkedIn, Polymarket, GitHub, Perplexity/web search, Serbian/regional sources, international outlets, official institutions, and specialist websites.
- Do not use Kosovo competitor outlets as the main source. Avoid Telegrafi, Koha, Gazeta Express, Klan Kosova, RTK, Reporteri, Indeksonline, Nacionale, Sinjali, Periskopi, Kallxo, Dukagjini, KosovoPress, Bota Sot, Zeri, Lajmi.net, Insajderi, Ekonomia Online, and Albanian Post as primary sources. They may be used only as context or corroboration.
- Every article must have a real, public `image_url` that starts with `http://` or `https://`. Do not publish blank images.
- Preserve uncertainty. For rumors, accusations, and drama, write as "pretendon", "tha", "akuzoi", "u raportua", or "nuk eshte verifikuar" unless a reliable source proves it.
- Include conflicting angles when they are real and relevant, but do not manufacture conflict.

## Source priorities

Technology / Teknologji:

- Prefer `therundown.ai` and Instagram `@therundownai` for AI and technology stories.
- Use other technology sources only when they are more relevant, more current, or directly connected to Kosovo/Balkans.

Celebrity / Entertainment / Showbiz:

- Track Instagram and web/social posts from `@theshaderoom`, `@complex`, and `@pagesix`.
- Use these for fast-moving celebrity, culture, music, sneakers, gossip, and entertainment stories.

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
