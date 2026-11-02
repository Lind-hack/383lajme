# Albanian Showbiz discovery: primary-source research

Checked 2026-11-01. This note records public read-only research; it does not configure credentials, publish articles, or establish permission to reuse photographs.

## Editorial and implementation recommendation

Prioritize Albanian global and local artists, with Dua Lipa, Rita Ora and Bebe Rexha first. Search public announcements, attributed statements, fashion, credited shoots, stage appearances and new releases. An artist's public post can establish what they posted; it does not establish an inferred relationship, scandal, pregnancy, motive or public reaction. Keep gossip as an attributed claim only when the actual claim and response are accessible. Do not infer virality from a search result or a single cumulative view count.

Use official profiles to discover and corroborate leads. Keep the repository's approved Showbiz publishers as article-collection sources; the following artist profiles are evidence/monitoring targets, not an automatic addition to the publisher allowlist. Preserve the exact post permalink, author, publication timestamp, retrieval timestamp, evidence text and access status. A profile-page URL alone is insufficient evidence for a new story. An unavailable post remains unavailable; do not replace it with invented text or a generic artist portrait.

## Eleven profiles with first-party link provenance

Links below were extracted from live HTML using ordinary public HTTP requests. “Artist site” means its outbound link was observed; “artist channel” means the artist-branded YouTube channel's public HTML supplied the social link and `channelMetadataRenderer.externalId`. This is ownership evidence, not a claim that an Instagram verification badge was inspected. Rows relying on the artist's self-described channel have lower independent ownership assurance than an artist-site-to-channel chain. No handles below were inferred from artist names.

| Artist | Instagram target | YouTube channel ID | Exact provenance and confidence |
| --- | --- | --- | --- |
| Dua Lipa | [dualipa](https://instagram.com/dualipa) | `UC-J-KZfRV8c13fOCkhXdLiQ` | [Artist site](https://www.dualipa.com/) links Instagram and `youtube.com/@dualipa`; [channel metadata](https://www.youtube.com/@dualipa/about) resolved ID. Strong site/channel chain. |
| Rita Ora | [ritaora](https://www.instagram.com/ritaora/) | `UCfSAqqftdc7FM1SY5vJjKfA` | [Artist site](https://ritaora.com/) links Instagram (with `?hl=en`) and this exact channel ID. Strong site chain. |
| Bebe Rexha | [beberexha](https://www.instagram.com/beberexha/) | `UC5-gWZXAQqSGVfPHkA7NRiQ` | [Artist channel metadata and outbound links](https://www.youtube.com/@beberexha/about), HTTP 200. Artist-branded channel provenance; [artist site](https://www.beberexha.com/) returned HTML but exposed no Instagram link in this inspection. Do not claim the website supplied this handle. |
| Ava Max | [avamax](https://www.instagram.com/avamax) | `UCOwgc8DswjoBMuuUU2ScPvQ` | [Artist site](https://www.avamax.com/) links Instagram and `youtube.com/@avamax`; [channel metadata](https://www.youtube.com/@avamax/about) resolved ID. Strong site/channel chain. |
| Era Istrefi | [eraistrefi](https://www.instagram.com/eraistrefi/) | `UCRdVQqY4jyRzlObeYPxLdHQ` | [Artist channel](https://www.youtube.com/@eraistrefi/about), HTTP 200, explicitly describes itself as the official channel managed by 360 Media and links this Instagram account. Channel self-description plus outbound link; artist website failed to connect. |
| Dhurata Dora | [dhuratadora](https://www.instagram.com/dhuratadora/) | `UCtzhq8TIfFB9vRAHVqLL9PA` | [Booking agency artist page](https://www.0711talents.de/talent/dhurata-dora/) links both exact targets. Strong representative-site chain. Web-reader fetch failed but direct public HTTP returned 200 and links were inspected. |
| Elvana Gjata | [elvanagjataaaa](https://instagram.com/elvanagjataaaa) | `UCy9rb6cS-u5BLOhtgHlOs6Q` | [Artist channel metadata and outbound link](https://www.youtube.com/@elvanagjata/about), HTTP 200. [Artist domain](https://www.elvanagjata.com/) also redirected to this Instagram profile, though domain ownership was not independently established. |
| Ledri Vula | [ledrivula](https://www.instagram.com/ledrivula/) | `UCvLZ4kCkdC5F2Qop2ULz70Q` | [Artist channel](https://www.youtube.com/@LedriVula/about), HTTP 200, explicitly identifies itself as official and managed by 360 Media; supplies the Instagram link. [Official artist upload](https://www.youtube.com/watch?v=phFZYrF_cIs) also gives the Instagram account in its description. |
| Yll Limani | [ylllimani](https://www.instagram.com/ylllimani) | `UCwxa1gR8DEkcOVKXbN5cDkg` | [Artist channel](https://www.youtube.com/@YllLimani/about), HTTP 200, explicitly identifies itself as official and managed by 360 Media; supplies the Instagram link. |
| Dafina Zeqiri | [dafina.zeqiri](https://www.instagram.com/dafina.zeqiri/) | `UCLnVQFFfzOuq6sO76w2QdaQ` | [Artist channel](https://www.youtube.com/@DafinaZeqiri/about), HTTP 200, explicitly identifies itself as official; supplies the Instagram link. |
| Noizy | [noizy](https://www.instagram.com/noizy/) | `UCim40Arej9EBOfg0ViFW2ww` | [Artist-branded channel](https://www.youtube.com/@thisisnoizy/about), HTTP 200, description links Instagram and the Illyrian Bloodline brand. Moderate confidence from branded channel; weaker than independently linked artist site. |

Ava Max's Albanian relevance is explicitly supported by her label's own [artist biography PDF](https://press.atlanticrecords.com/sites/g/files/g2000014001/files/2022-12/Ava%20Max%20Bio%2012.22.pdf), which describes her Albanian-American background. This historical biography is evidence of background, not proof of a current label relationship.

Optional expansion queue: Tayna, Kida, Butrint Imeri and Enisa. Do not add guessed handles. [Tayna's Linktree](https://linktr.ee/taynaofficial) exposes artist releases and social labels, but this inspection did not establish a sufficiently strong artist-site chain or exact social destinations. Attempted short YouTube handles for Kida/Butrint returned 404; that does not prove their real channels do not exist. The eleven rows above are the usable researched set.

## Instagram and public-research capability limits

Meta's own [Instagram API collection](https://www.postman.com/meta/instagram/documentation/6yqw8pt/instagram-api) documents Facebook app/token setup, professional accounts and permissions. Its Facebook Login path can obtain metadata/metrics about other business/creator accounts, but excludes consumer accounts. This is not a credential-free arbitrary-public-profile endpoint. Direct Meta platform/business-discovery documentation returned HTTP 429 during this check; the Content Library developer page displayed a login requirement. An SDK cannot remove these access requirements.

Meta also offers a separate research route: [Meta's Content Library announcement](https://about.fb.com/news/2023/11/new-tools-to-support-independent-research/) describes public Facebook and Instagram professional-account content and an application process for qualified research. The program's actual access administrator, [ICPSR/SOMAR](https://www.icpsr.umich.edu/sites/somar/news/icpsr-to-facilitate-researcher-access-to-metas-api-products), documents independent application review, Python/R and a secure research environment with output review. It is not an immediately usable general newsroom scraper or a newly configured SDK for this pipeline. No approved account or credentials were supplied or configured in this task.

Public Instagram responses can expose profile metadata, a login shell or limited content. A successful HTTP status or verified outbound account link does not mean recent posts, Stories or original photos are accessible. Treat login walls, throttling and missing exact-post evidence as explicit unavailable states. No paid scraping service, login workaround or unofficial API is required by this recommendation.

## Credential-free YouTube feeds fit the existing Python pipeline

[Google's official push-notification guide](https://developers.google.com/youtube/data/guides/push_notifications) documents the per-channel Atom topic `https://www.youtube.com/xml/feeds/videos.xml?channel_id=CHANNEL_ID`, upload/title/description update events and separate `published`/`updated` timestamps. The ordinary feed URL `https://www.youtube.com/feeds/videos.xml?channel_id=CHANNEL_ID` returned public Atom XML without a key for the three channels below in this check. These are observations of current public access, not a guaranteed completeness or retention promise. Poll conservatively and retain failure status. WebSub requires a reachable callback; simple bounded polling fits the current batch job more directly.

Local `scripts/requirements.txt` already contains `requests` and `feedparser`; `scripts/rss_fetcher.py` already uses `feedparser.parse`. `scripts/prepare_social_native_candidates.py` already recognizes Instagram/YouTube source URLs. Therefore a small public Atom reader can reuse installed libraries. Avoid adding a paid client or representing the removed `youtubesearchpython` dependency as an available discovery SDK. This note did not change code/configuration.

## Dated discovery sample (checked 2026-11-01)

These are first-party discoveries, not claims of today's trending news. Feed response was HTTP 200 in each case.

| Artist / source | Exact discovery | Timestamp and editorial limit |
| --- | --- | --- |
| [Bebe Rexha feed](https://www.youtube.com/feeds/videos.xml?channel_id=UC5-gWZXAQqSGVfPHkA7NRiQ) | [New Religion — Live from NRJ Music Awards](https://www.youtube.com/watch?v=fjYdYdJq8dk) | Published `2026-10-27T16:53:21Z`; updated `2026-10-28T17:26:34Z`. Recent performance upload; inspect video/description and approved publisher coverage before creating an article. |
| [Era Istrefi feed](https://www.youtube.com/feeds/videos.xml?channel_id=UCRdVQqY4jyRzlObeYPxLdHQ) | [BAD — Official Music Video](https://www.youtube.com/watch?v=7lqIwrrSTiY) | Published `2026-08-10T16:00:06Z`; updated `2026-10-03T15:34:11Z`. Historical release; cannot be called a new November release. |
| [Era Istrefi feed](https://www.youtube.com/feeds/videos.xml?channel_id=UCRdVQqY4jyRzlObeYPxLdHQ) | [Era Istrefi × Ledri Vula — VEQ TI](https://www.youtube.com/watch?v=_dErqYI73Cs) | Published `2026-07-19T17:51:08Z`, updated `2026-10-29T19:37:09Z`. Recent metadata update is not a fresh upload. |
| [Rita Ora feed](https://www.youtube.com/feeds/videos.xml?channel_id=UCfSAqqftdc7FM1SY5vJjKfA) | [My hair with TypeBea](https://www.youtube.com/watch?v=QOM7ZDB3BIs) | Published `2026-07-28T15:17:44Z`; updated `2026-10-04T01:06:35Z`. Beauty/brand lead, currently too old to present as a new post. |

An additional current-event lead is Dua Lipa's London Literature Festival curation: [the organizer's own announcement](https://www.southbankcentre.co.uk/press/dua-lipa-announced-as-curator-of-2026-london-literature-festival-in-the-southbank-centres-75th-anniversary-year/), dated 2026-03-30, schedules the festival for 21 October–1 November 2026 and opening-weekend curation for 24–25 October. The announcement establishes scheduled involvement, not proof that every scheduled event happened or that an Instagram reaction is viral. A current recap needs direct event/post evidence.

## Implemented locally and verified

The hourly discovery entry point now refreshes the daily research every four
hours and on a new Kosovo calendar day. It watches 19 artists, checks the 11
researched profile/channel targets, and adds publisher-restricted searches that
include all 14 registered Showbiz publishers. The existing publisher collector
remains responsible for retrieving their complete article inventory. Research
adds queue candidates; it does not publish articles itself.

Artist priority carries through source selection, photo preparation, native
page review and the writer brief. The editorial instructions explicitly accept
new public posts, statements, fashion, adult glamorous/swimwear photos and public
personal updates as compelling Showbiz topics. Sensitive factual claims,
freshness, photo rights and publication checks remain in force. A policy-version
change invalidates reviews made under the earlier audience criteria.

The latest live pass attempted 63 routes: 24 were unavailable or exposed no
public post inventory, and it produced zero approved fresh publisher leads and
zero fresh official-post leads. It retained 132 historical uploads separately.
Some Google/YouTube/Instagram connections timed out. This run does not establish
comprehensive social coverage, measured virality or an increase in output.

Validation: 128 focused Python tests (125 passed, three skipped); 23 native
browser tests (22 passed, one platform skip). The new article-body test timed out
once during the combined run and passed in isolation on retry. A live Anabel
capture also confirmed that the rendered readable text matches the extracted
article body; missing resources still make its layout partial. The production
Webpack build passed with existing Tregu import warnings and remote-data fallback
notices. No articles were published and no production deployment was made.
