# Registered-source retrieval

Retrieval and publication have separate inventories. The 20-article target and
category shortlists do not truncate the durable source URL queue.

`news_ingestion.py` seeds every publisher in `news_sources.json`, including
publishers without a configured feed. It reads configured RSS/Atom feeds and
their advertised continuation, public home/listing pages and pagination,
robots-declared XML/news sitemaps (including indexes and gzip), and advertised
public WordPress post APIs with pagination. Article bodies, declared image
candidates, source dates and private provenance are retained before editorial
selection. Original public source text remains untrusted evidence.

The SQLite inventory is `/opt/data/news-pipeline-state/source-inventory.sqlite`.
Tasks and failures survive restarts. HTTP errors, restricted pages, missing
article text and unfinished requests remain pending with retry backoff. A
checkpoint advances only after the discovered public routes have drained and a
usable index was read. The initial discovery window is the previous 24 hours;
unfinished scopes persist and completed scopes overlap by one hour. Sitemap
lastmod is a discovery hint, never an article's publication time.

`383-source-ingestion.service` runs the committed `run-source-ingestion.sh`
between 07:00 and 23:59 Europe/Warsaw. Each pass drains for four minutes, then
pauses for one minute. Fresh dated stories have priority over archive discovery;
publishers rotate and have at most one request in flight each, eight overall.
Publication remains hourly at 07:00–23:00 Europe/Warsaw. Both paths share a
collector lock: publication reads committed recent evidence if collection is
active, or collects itself if it is idle. SQLite WAL permits concurrent reads.
If collection starts with an empty morning inventory, publication waits within
its normal discovery budget for every category to have candidate depth rather
than immediately treating the empty startup snapshot as a failed news run.
Stopping the service terminates its container request process group.

The latest retrieval report is
`/opt/data/news-pipeline-state/source-ingestion-latest.json`. Per-publication
discovery and quality reports also retain ingestion metrics. Reported page
retrievals, readable bodies, current category-eligible stories, pending tasks
and published articles are distinct quantities.

Source/category restrictions, factual checks, corroboration, deduplication,
copyright review, mandatory qualifying photos and the publication cap remain
enforced. A readable response does not override publisher eligibility. Source
image URLs are candidates; they do not establish permission to reuse a photo.

## Verification on 2026-10-25

An isolated VPS audit attempted all 96 registered publishers in 246.4 seconds:
1,263 article-page responses, 1,071 readable bodies across 75 publishers, and
393 current category-eligible stories. Eligible counts were Kosovë 62,
Shqipëri 87, Sport 45, Teknologji 22, Ekonomi 33, Botë 102 and Showbiz 42.
These are retrieval results, not publication results.

18,366 discovery/article tasks remained pending, including archive discovery
and access failures; only one publisher had fully exhausted its discovered
routes. Therefore this audit does **not** establish exhaustive coverage of every
new article on all registered websites. HTTP 401/403 responses, restricted
articles, invalid TLS, DNS failures and incomplete public indexes remain explicit
limitations. Access controls are not bypassed and missing stories are not
invented. Future reports must preserve this distinction.

Regression coverage includes 225 articles spanning feed, sitemap and listing
pagination with no publication-count truncation; restart persistence; changed
metadata invalidation; cache reuse; restricted pages; deadlines; cross-publisher
rejection; XML entity rejection; gzip; WordPress pagination; Atom continuation;
and concurrent collector/publication access. The collector stop test was also
run inside the production container using an isolated fake request process.

Direct review fixed misleading restricted-page completion, archive starvation,
per-URL transaction overhead, unnecessary evidence refetches and container
process shutdown. Follow-up checks preserve pagination inside navigation,
apply the rolling 24-hour window without relying on a caller's environment,
keep missing declared sitemaps failed, and avoid repeatedly downloading an
already retrieved old article unless its discovery metadata changes.
Remaining coverage/access limitations are recorded above.

The first live scheduled run on this ingestion release produced 686 current
eligible source leads, 374 unpublished selections and 51 photo-qualified ready
stories across all seven desks, but published only three articles. Retrieval
success is not publication success: editorial deadlines, already published
events, topic classification and originality rejection still affected output.
Follow-up changes align URL identity with the publication gate, mark likely
retellings before expensive preparation without removing potential updates,
preserve the Albania youth-sport exception in Albanian, distinguish concert
tours from tournaments, inline verified fallback facts for the tool-free
writer, and supply existing originality diagnostics to the initial editor.
These changes do not waive any final check or establish a guaranteed quota.

## Release operations

Publish code only through a clean commit pushed to `origin/main` and Railway's
GitHub integration. Verify exact production provenance, stage the worker from
that commit's Git archive, and activate while the hourly publisher is idle and
its container lock is held. Install this repository's service unit, run
`systemctl daemon-reload`, then enable/start `383-source-ingestion.service`.
For later releases, stop collection before changing the worker alias; restart
it after activation. The inventory remains outside versioned workspaces.
