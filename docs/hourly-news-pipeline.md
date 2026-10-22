# Dedicated category news pipeline

The single source of truth is `scripts/news_sources.json`. Every publisher has
one category and one ownership family. Discovery and final publication both
use `news_source_policy.py`: off-category primary or corroborating sources are
rejected, never reassigned. Sister publications cannot independently corroborate
each other. The writer and independent editor verify claims against fetched original text.
Routine news may use one readable registered publisher as factual evidence; sensitive allegations
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
have a Kosovo/Albania subject and documented facts. Verified local entertainment,
public personalities and company news can remain in their local desk; unrelated
international celebrity stories stay in Showbiz. Publishers owned by the same group count as one family.

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
Never switch the current symlink during an active production or QA run.
Hourly publication state lives outside releases at
`/opt/data/news-pipeline-state/hourly-runs`; preserve the previous slot state and
rejection ledger when installing a new release. Never copy a dirty application checkout into production. Preserve the prior
runtime link for rollback. A rollback of application code also goes through main.

The worker's Supabase URL, anonymous key, service role key and automation secrets
must match the live Railway website configuration. Production uses
`https://supabase.383ks.com`; the older cloud Supabase configuration in the
legacy worker is a different database. Keep credentials out of Git and logs.
The private news configuration preserves the existing report delivery settings.

## Outcomes and evals

`L383_QA_ONLY=1` runs discovery, writer, independent editor and quality gates
without publishing or sending a report. `L383_MAX_ARTICLES=2` limits a smoke run;
production targets 20 articles: Kosovo, Albania, world, technology, economy and
sport 3 each; showbiz 2. Every available category receives two places before
third places; no desk may exceed three. Readable unpublished stories from the rolling last
24 hours are grouped by event. Routine news can use a verified primary; sensitive
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

## Original copy and contextual photo policy

Hourly writers build a fact outline and a fresh lead/structure in plain Albanian;
they must not closely translate sources or imply interviews/eyewitness reporting
by 383. Publisher introductions are removed unless the independent editor
records necessary attribution for a direct quote, exclusive reporting or an
unconfirmed claim. Internal sources, URLs and verification evidence remain.
The journalism gate enforces structure and keeps every publisher name out of public copy;
originality compares body, headline and excerpt with primary and corroborating
texts, does not exempt copied text because it is quoted and catches stitched short
fragments. Substantive direct quotations are excluded from automated output. Exact overlap checks are screening, not a guarantee against
close paraphrase or translation; the independent editor must assess both.

Before drafting, the existing GPT-6 Luna/max OAuth worker plans specific
photographic subjects supported by exact phrases in each story. Commons search
fetches file descriptions and license metadata. The automated pool accepts
CC0, explicit public domain, and CC BY/BY-SA with a named creator, all with
matching rights URLs and no additional restrictions; the article page credits
creator and licence, and no other surface carries the photo. NC/ND are excluded. Unknown, NC/ND, attribution-free claims without evidence and files with
additional restrictions are rejected. Subject tokens must appear in the actual
file description; writer/editor separately verify semantic relevance. Captions
identify these as illustrative archive photos, never today's event. Prepared captions identify illustrative archive photographs; the narrower pool
stay on the article page with their credit; cards and Telegram use no photo.

Publisher photographs are compared by URL identity, SHA-256 and visual
fingerprints, including renamed/rehosted copies. If a declared source photo
cannot be checked, the candidate is skipped. Publisher-photo fallbacks are
disabled for hourly news. A run-local provenance catalog binds every prepared
photo to the primary story URL; normalization and publication reject absent,
changed or stale records. Every run reserves distinct photos across candidates.
No suitable photo means an inventory shortfall, not a category stock image.
The file-rights URL is linked alongside the photo caption on the article page;
source/license/creator evidence remains stored in raw_article.

The source reader prefers the actual publisher article-body container, including Lapsi’s div-based article body, over sidebar paragraph widgets. Hourly contextual photos require native 1200×630 or larger decoded images; they are never upscaled to fabricate dimensions. Legacy daily image requirements remain 1200×675.

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


A separate independent composition/rights review runs after all editing,
normalization and refill steps. Its per-article receipt hashes all reader-facing
prose, source evidence and photo rights. Publication itself requires the current
receipt and reruns non-mutating deterministic gates, even for direct CLI and
legacy finalize calls. Incomplete or failed reviews cannot publish. Review uses
GPT-6 Luna through the existing Codex OAuth configuration at max effort and
adds a bounded 360-second stage within the existing worker deadline. No new API
billing or model fallback is introduced.

Open Graph/Twitter previews use the existing original 383 title-card renderer,
not archive photographs. Telegram automation accepts only articles carrying the
publication-stamped originality review and sends text with previews disabled;
it does not redistribute photos without their captions/rights. Do not call the
Telegram route as a test: unit tests mock the network. These changes affect future
automatic dispatches, not previously sent messages or the old article archive.


## Balanced throughput update, 2026-10-21

Photo subjects are grounded against source evidence before Wikipedia resolution
and bounded alternatives; deity, anatomy, unrelated city and acronym namesakes
are rejected. Contextual rights-cleared photographs can be reused across hourly
batches with accurate archive captions; they remain distinct within a batch.
Every article still requires a qualifying photo. Source diagnostics distinguish
short evidence, missing dates, restrictions and blocked access. Top Channel
article dates use the article-specific date element with daylight-saving-aware
local time.

Every model stage uses Luna/max through Codex OAuth; no API-provider fallback
is available. The full run remains bounded to 55 minutes, with model work ending
by minute 50 to reserve publication time. Empty optional edits preserve already
approved work and exhausted candidate pools do not trigger impossible refills.
Per-category selected, readable, photo-qualified and writer-ready counts are
stored in the quality report. Actual 2-3-per-desk output must be verified after
release; passing allocation tests alone does not establish publication yield.

Place fallbacks may search Commons only by the exact grounded Wikidata depicts
identity; searched images require that same depicts tag in the file metadata.
This recovers alternatives to an old or unusable Wikipedia lead image without
accepting a person with a shared place name. Maps, logos and other non-photo
material remain rejected, alongside all rights, source-image and size checks.

Hermes's internal fallback_model is explicitly disabled in the isolated news
home, in addition to the pipeline's OAuth/model argument restrictions.
The isolated Luna model configuration sets a 600-second non-stream stale limit
and 900-second request timeout. Hermes otherwise applies an implicit 90-second
non-stream watchdog to Luna; the 21:00 run recorded seven such note-call
failures. Codex first-byte and event watchdogs are 300 seconds. These limits
never extend a shorter worker phase/process deadline or the 55-minute run cap.

Wikipedia entity resolution is separate from image qualification. A company or
institution whose lead image is a logo can still supply a grounded entity ID
for licensed-photo research. The logo is never carried into the prepared image
files; the existing Commons rights, context, size and editorial gates decide
whether an actual photograph qualifies. Namesakes and publisher subjects remain
excluded even during identity-only resolution.

The worker pins its working directory to the physical versioned release before
creating evidence, batch or state paths. Historical artifacts therefore remain
addressable after the current-release symlink changes.

Reporter-note work also rotates across desks before processing backups. A
shared model deadline therefore prioritizes two notes per available category
before a busy desk's fourth or later candidate.

Model review reads wrapped .editor-sources.md and per-chunk .copyright-input-N.md evidence views, plus a wrapped article input. These preserve all serialized evidence characters across short lines so Hermes cannot clip source/body strings at its per-line limit. Original JSON is authoritative for gates and content-bound receipts. Models must continue reading with offsets when paginated.

Model stages use per-request ASCII story IDs and map exact responses back to the original source records. Only missing or malformed decisions are retried; explicit rejections remain rejections. Reporter-note reuse is limited to model notes from identical source URL, title, primary text and corroborating text within 24 hours. Independent article, source, originality and image checks still apply on every run.
