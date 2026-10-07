# Dedicated category news pipeline

The single source of truth is `scripts/news_sources.json`. Every publisher has
one category and one ownership family. Discovery and final publication both
use `news_source_policy.py`: off-category primary or corroborating sources are
rejected, never reassigned. Sister publications cannot independently corroborate
each other. The writer and independent editor must verify the shared claim on
both original pages; headline pairing is only a discovery heuristic.

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
The existing VPS `383-production.timer` runs once every UTC hour, all 24 hours.
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
production defaults to at most ten verified articles. Empty verified inventory
is a successful `no_news` outcome, with no filler. Total discovery outage,
authentication and publication errors fail visibly. A flock and atomic hourly
records prevent concurrent publication and regeneration of a published slot.
The worker has a 55-minute deadline. Retention remains disabled.

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
