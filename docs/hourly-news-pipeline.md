# Dedicated category news pipeline

The single source of truth is `scripts/news_sources.json`. Every publisher has
one category and one ownership family. Discovery and final publication both
use `news_source_policy.py`: off-category primary or corroborating sources are
rejected, never reassigned. Sister publications cannot independently corroborate
each other. The writer and independent editor verify claims against fetched original text.
Routine news may use one credited readable publisher; sensitive allegations
require an independent second publisher. Headline pairing is a discovery heuristic.

## Desks

| Category | Source pool |
| --- | --- |
| Kosovë | Koha, KALLXO, Telegrafi, Gazeta Express, Indeksonline, Gazeta Blic, Prishtina Insight, Kosovo 2.0, TV Prizreni |
| Shqipëri | BalkanWeb, News24, Euronews Albania, ABC, Reporter.al, Lapsi, Panorama, Top Channel |
| Teknologji | The Rundown AI, TechCrunch, The Verge, MIT Technology Review, Ars Technica; registered official technology evidence |
| Ekonomi | Monitor, Ekonomia Online, CNBC, Financial Times, MarketWatch, CoinDesk, The Block, Decrypt; central bank and SEC evidence |
| Botë | BBC, Al Jazeera, DW, France24, POLITICO Europe, Euronews international, Guardian, RFE/RL; public Reuters, AP and Bloomberg listings |
| Sport | Sky Sports, ESPN, Motorsport.com, SuperSport, Gazeta Olle; registered official sports evidence |
| Showbiz | Prive, Variety, Billboard, Hollywood Reporter, Deadline, People, TMZ, Anabel, Revista Who |

Each run attempts configured feeds and bounded public listings. Official domains
registered for evidence are not automatically discovered unless configured as
feeds/listings. A registered source is an allowed source, not a guarantee of
access or fresh articles. HTTP blocks, timeouts, undated pages and paywalls are
recorded and skipped. No paywall bypass is used. Market and crypto stories stay
in Ekonomi even when they concern technology companies. Local controversy must
have a Kosovo/Albania subject and documented facts; celebrity stories stay in
Showbiz. Publishers owned by the same group count as one family.

## Worker and release

Railway deploys application code exclusively through a committed push to main.
The existing VPS `383-production.timer` runs daily at 07:00 through 23:00,
inclusive, in Europe/Warsaw, including weekends. The one-week trial beginning
2026-10-07 now uses GPT-6 Luna at max reasoning effort for drafting, independent
editing and repairs, switched on 2026-10-08, with OAuth and no API key.
No model fallback changes the model.
It invokes `scripts/run-hourly-news.sh` inside the existing Hermes container.
The news worker writes validated Supabase rows and never deploys the website.
GitHub news schedules and the application dispatch route are disabled by default
to avoid competing writers. The route requires `NEWS_SCHEDULER=github` to enable
the explicit recovery path.

Install runtime files from a committed Git archive into an immutable
`/opt/data/workspaces/383lajme-news-<SHA>` directory. Link `.env.automation` to
the private `/opt/data/news-pipeline.env`, use the existing Python virtualenv, assign Hermes ownership,
and point `383lajme-news-current` at that release. Install the committed service
and timer under `/etc/systemd/system`, then daemon-reload and enable the timer.
Never copy a dirty application checkout into production. Preserve the prior
runtime link for rollback. A rollback of application code also goes through main.

The worker's Supabase URL, anonymous key, service role key and automation secrets
must match the live Railway website configuration. Production uses
`https://supabase.383ks.com`; the older cloud Supabase configuration in the
legacy worker is a different database. Keep credentials out of Git and logs.
The private news configuration preserves the existing report delivery settings.

## Outcomes and evals

`L383_QA_ONLY=1` runs discovery, writer, independent editor and quality gates
without publishing or sending a report. `L383_MAX_ARTICLES=2` limits a smoke run;
production targets 20 articles: Kosovo 4; Albania, world, technology and economy 3
each; sport and showbiz 2 each. Readable unpublished stories from the rolling last
24 hours are grouped by event. Routine news can use a credited primary; sensitive
claims need independent corroboration. Source text and qualifying images are
prepared outside model turns. Writers draft up to seven per call, covering every
available desk first, then filling the plan. Overrepresented desk drafts are
trimmed before continuing so they cannot displace other categories.
Continuation calls return only new drafts; the wrapper appends them locally
without reproducing earlier articles or changing their fields.
Grounded
briefs need 140+ words and three paragraphs; longer coverage is welcome. Never
fabricate news to meet 20. Category targets, availability, rejection reasons and
publication shortfalls are archived with every run and the completion email
shows published/target counts.
Empty verified inventory
is a successful `no_news` outcome, with no filler. Total discovery outage,
authentication and publication errors fail visibly. A flock and atomic hourly
records prevent concurrent publication and regeneration of a published slot.
The worker has a 55-minute deadline. Retention remains disabled.

After acquiring the lock and passing authentication, website and database checks,
the worker sends a startup confirmation using the existing email styling. The
completion email retains the existing published-article report. Successful empty
runs send a completion status instead. Busy-lock and already-published skips send
no emails. Failures are recorded in systemd journals and hourly state without
sending extra emails. Infrastructure checks also log failures without mail.

The publication gate checks category ownership again, freshness, evidence,
originality, structure, source mix and database deduplication. Supabase readback
and a live article request must succeed before the completion report. After
publication, the worker refreshes the article, category and news landing caches
through the authenticated canonical `https://383ks.com/api/revalidate` endpoint.
The `www` redirect cannot be used for this POST request. A saved
publication outcome survives later verification/report failure to prevent a
retry from rewriting the slot. Quality and availability metrics are written to
`.last30days/hourly-quality-latest.json`; state lives in `hourly-runs/`.

Run `python -m unittest discover -s scripts -p test_news_source_policy.py -v`.
These deterministic evals cover every registered publisher against all seven
categories, spoofed URLs, ownership families, topic boundaries, RSS freshness,
corroboration matching and publication idempotency. CI also runs originality and
source mix regressions. These are policy regression tests, not a claim of measured
human editorial accuracy. Live audits provide per-source eligibility/access data.

Inspect `journalctl -u 383-production.service` and
`systemctl list-timers 383-production.timer`. Diagnose failures before retrying;
never relax verification to meet a volume target.

Hourly model calls return complete JSON responses; the wrapper saves them atomically. Incomplete responses and continuations that alter existing articles leave the prior batch intact. The independent editor receives the source overlap feedback before its first review. Subject and action are checked by the editor against evidence rather than a finite entity/verb whitelist. After rejected drafts are removed, up to two bounded replacement passes fill missing desks from unused prepared evidence. If a desk has exhausted its readable new stories, spare slots go to other available desks; no stories are invented to reach 20.

The source reader prefers the actual publisher article-body container, including Lapsi’s div-based article body, over sidebar paragraph widgets. Hourly images accept native 1200×630 photographs and larger decoded images; they are never upscaled to fabricate dimensions. Legacy daily image requirements remain 1200×675.

Hourly publication IDs are stable hashes of canonical primary URLs, independent of discovery ordinals; accented slugs are normalized to ASCII before editing. Wrong-category source topics are rejected before drafting. Replacement reviews contain only new drafts: previously approved articles retain their exact bodies, metadata and category slots, and the merged batch receives the usual final validation.

Editorial ranking follows `docs/news-ranking-rubric.md`: eight evidence-based
factors per story, rather than copied neutral defaults. The stored base score is
fixed; website ranking subtracts 0.2 points per hour since publication. Top 5
and Njoftimet admit only dated stories published within the last 24 hours and
include the newest pool so older high base scores cannot hide recent news.

Install `scripts/systemd/383-supabase-health-notification.conf` as the health
service notification-policy drop-in, and `scripts/news-failure-log.sh` as the
shared `/opt/data/scripts/send-383-failure-alert.sh`. These preserve infrastructure
checks and failure diagnostics without additional email.

For hourly inserts, published_at is the actual 383 publication time after the
editorial checks. The original source timestamp is preserved as
raw_article.source_published_at. Retrying an existing batch does not reset age.
