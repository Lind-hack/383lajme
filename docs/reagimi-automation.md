# Daily educational video

Reagimi i Ditës retains its existing card and reader reactions. It now takes a daily educational video rather than finding a clip for a news headline. The server verifies YouTube's publisher URL against approved original educational channels. Kosovo news outlets, their reuploads, unknown channels and unavailable videos cannot supply the card. Initially approved: TED-Ed and NASA Video, verified through YouTube oEmbed on 2026-09-30. Add other publishers only after verifying their official channel and reviewing the policy.

The local calendar day is Kosovo time. Publishing is authenticated with the existing automation secret, preserves an already valid daily choice, rejects videos repeated within 30 days, and uses compare-and-set when replacing a legacy row. No database migration is needed. Publication updates the existing reagimi_daily table and requires no deployment. The client refreshes the selection every minute and crosses midnight without showing yesterday's video as today's. Translated educational titles are not presented as quotations.

## Scheduler configuration

Requested model: gpt-6-luna. Reasoning effort: xhigh. Run daily at 07:00 Kosovo time (the configured desktop Europe/Warsaw timezone has the same daily offset). The intended job selects and publishes a video; it does not edit the homepage, deployment or news pipeline. Scheduler activation must be verified through Codex's automation tool; this document alone does not create an automation.

Use the following job prompt:

> Run the 383 Reagimi i Ditës daily educational-video selection and publication. Use GPT-6 Luna with xhigh reasoning. Work from current origin/main for Lind-hack/383lajme, preserving unrelated local edits. Read docs/reagimi-automation.md. Do not change page layout, code, data migrations, deployments, markets or the news pipeline during a daily run. Read today's date, approved publishers and the last 30 days from the authenticated GET /api/automation/reagimi/daily via scripts/reagimi-daily.mjs --context. If today already has a verified educational selection, verify it through the public GET /api/reagimi-daily and finish without replacing it. Otherwise research an actual available educational video from an approved original publisher. Watch it or inspect its authoritative transcript/lesson page; establish what it teaches. Choose varied science, history, technology, economics, civic-literacy or critical-thinking subjects suitable for the general 383 audience. Favor understandable short explainers; an evergreen lesson is eligible and must not be described as a new upload. Never select videos from Kosovo rival news outlets, their channels, copied broadcasts or reuploads, including RTK, Koha, Klan Kosova, T7, Dukagjini, ATV, Tëvë1, Gazeta Express, Nacionale, Insajderi, Indeksonline, Telegrafi, KosovaPress, Reporteri, Infokus, Periskopi, Gazeta Blic, Zëri or Bota Sot. The publisher must be one of the server-approved educational channels; no result with an unknown owner is eligible. Do not reuse a video selected in the last 30 days. Write an accurate Albanian educational title of at most 400 characters and an Albanian learning/context sentence of at most 160 characters, without invented quotations or claims. Save only an ignored temporary selection JSON with date, title, context and videoUrl. Publish using node scripts/reagimi-daily.mjs --file <temporary-selection.json>; use --railway only in the already linked production project to read the existing secret into memory. Never print credentials or invoke a deployment. Verify the public /api/reagimi-daily returns today's date, the selected approved publisher and correct playable embed. If discovery, publishing or verification fails, report the specific failure; never substitute a news-outlet clip or claim the video was published. No emails or messages to others are authorized.

## Operator commands

Supply CRON_SECRET or TREGU_AUTOMATION_SECRET in the process environment. Alternatively --railway reads those variables from the already linked Railway production service into memory without logging credentials.

```
node scripts/reagimi-daily.mjs --context --railway
node scripts/reagimi-daily.mjs --file tmp/reagimi-selection.json --railway
```

The script does not infer, translate or generate content: the scheduled GPT-6 Luna run does that research and editorial work. Never write a selection file into tracked news data. A failed verification leaves the card waiting rather than searching YouTube for an unapproved substitute.
