You are the sole editorial writer for the 383 Lajme production run. Work only in this workspace. Create exactly one new JSON array file at `data/auto-articles/2026-07-22T21.json`.

Do not use Git, GitHub, Vercel, deployment commands, `scripts/pipeline.py`, legacy publish/finalize/deploy actions, or any external text-generation API. Do not publish anything. Do not modify existing article batches. Your job is editorial writing only.

Write exactly 13 original Albanian-language news articles, one per verified direct publisher lead below. Do not invent facts beyond each lead's verified title/description. If a fact is framed as an allegation, opinion, or report, retain that qualification. Social research was unavailable or partial and is not publication evidence. Use only the direct publisher evidence below.

Each article must include all required fields:
`id`, `slug`, `url`, `dispatch`, `title`, `excerpt`, `body`, `source`, `source_flag`, `source_bias`, `tone`, `category`, `published_at`, `reading_time`, `featured`, `engagement_score`, `score_reason`, `score_breakdown`, `score_formula`, `image_url`, `image_width`, `image_height`, `created_at`.

Rules:
- Use IDs `383-20260722T21-01` through `383-20260722T21-13`; slugs must be ASCII lowercase hyphenated and unique.
- The `url` must be exactly the verified direct publisher URL given below.
- `dispatch` must say `cloud_news_discovery + direct publisher verification`.
- Reader-facing `title` and `excerpt` must not name the publisher/platform/account. Source attribution may appear once naturally in the body.
- Body must be original Albanian HTML with at least 5 `<p>` paragraphs and at least 500 actual Albanian words. Be specific and useful; do not pad with generic claims or repetitive boilerplate. Do not claim independent confirmation beyond the verified source.
- Use categories only from: Politikë, Ekonomi, Botë, Siguri, Sport, Teknologji, Kulturë, Shoqëri, Showbiz.
- Set `published_at` and `created_at` to `2026-07-22T21:00:00+02:00`.
- Use `tone` `informues`, source flags appropriate to the geography/topic, and source_bias `qendror` or `analitik`.
- `featured` true for at most 3 strongest Kosovo/region stories, otherwise false.
- Use a numeric engagement_score backed by this exact score_breakdown object for every article: `{"relevance":8,"urgency":8,"public_impact":8,"local_depth":7,"controversy_interest":6,"credibility":9,"corroboration":7,"editorial_safety":9}`. Use exact score formula: `0.22*relevance + 0.14*urgency + 0.16*public_impact + 0.10*local_depth + 0.10*controversy_interest + 0.16*credibility + 0.08*corroboration + 0.04*editorial_safety`.
- Images must be public HTTPS real editorial/illustrative images, unique within the batch, and at least 1200x675. Prefer the verified direct publisher `image` below when it clearly meets the threshold. For a verified direct image that is below the threshold or uncertain, use a unique relevant Unsplash Source image URL in 1600x900 format and explicitly say in `score_reason` that it is a verified illustrative image replacing an undersized/uncertain publisher image. Never reuse an image URL.
- Do not mention last30days, Reddit, X, TikTok, Instagram, YouTube, Hacker News, Polymarket, AI, automation, or research tooling in the reader-facing text.

Verified direct publisher leads. Every URL returned HTTP 200 and supplied this title, description, and OG image. Treat these as the only publication evidence.

1. Source: Balkan Insight | category Politikë | flag 🇪🇺 | bias qendror
URL: https://balkaninsight.com/2026/07/22/eu-osce-missions-criticise-kosovos-demolition-of-serb-owned-villas/bi/
Title: EU, OSCE Missions Criticise Kosovo's Demolition of Serb-Owned Villas
Description: EU and OSCE regret bulldozing of allegedly illegally-built Serb villas near important lake, urging authorities to respect due process and the property rights of all the communities in the country.
Image: https://balkaninsight.com/wp-content/uploads/2026/07/Villa-demolition-Kosovo-north-3.png

2. Source: European Western Balkans | category Botë | flag 🇪🇺 | bias qendror
URL: https://europeanwesternbalkans.com/2026/07/22/interpol-rejects-serbias-request-for-international-arrest-warrants-against-activists/
Title: Interpol rejects Serbia's request for international arrest warrants against activists
Description: The Serbian activist group STAV said Interpol's decision to reject Serbia's request for an international arrest warrant against six activists from Novi Sad confirms its claim the case is politically motivated rather than criminal in nature.
Image: https://europeanwesternbalkans.com/wp-content/uploads/2025/05/Blokada_studenti_aktivisti_Novi_Sad_45_021.jpg

3. Source: EUobserver | category Politikë | flag 🇪🇺 | bias analitik
URL: https://euobserver.com/229568/i-would-have-ethnically-cleansed-kosovo-in-1998-says-serbian-minister-opening-a-balkan-pandoras-box/
Title: Serbian minister's 1998 Kosovo statement prompts regional reaction
Description: The report says outrage over a minister's words reopened debate about narratives around Kosovo and the Milošević era.
Image: https://static.euobserver.com/2026/07/1709Paunovic1.jpg

4. Source: BBC News | category Botë | flag 🇺🇦 | bias qendror
URL: https://www.bbc.co.uk/news/articles/c93483k0lp1o?at_medium=RSS&at_campaign=rss
Title: Who is Mykhailo Drapatyi, Ukraine's new commander-in-chief?
Description: Drapatyi becomes Ukraine's third commander-in-chief since Russia's full-scale invasion in February 2022.
Image: https://ichef.bbci.co.uk/ace/branded_news/1200/cpsprodpb/116e/live/d8585fa0-85d3-11f1-b976-0b9c15b0ccfc.jpg

5. Source: BBC News | category Siguri | flag 🇺🇦 | bias qendror
URL: https://www.bbc.co.uk/news/articles/c36de9n4pxpo?at_medium=RSS&at_campaign=rss
Title: Ukrainian drones hit more sites of Russian online giant retailer Wildberries
Description: Logistics hubs belonging to Wildberries in the Krasnodar and Stavropol regions were struck overnight.
Image: https://ichef.bbci.co.uk/ace/branded_news/1200/cpsprodpb/aa2d/live/0a96cb40-85b7-11f1-bee8-53ce494e1abc.jpg

6. Source: SeeNews | category Ekonomi | flag 🇩🇪 | bias qendror
URL: https://seenews.com/news/germany-to-grant-kosovo-5-mln-euro-for-power-grid-upgrades-1298483
Title: Germany to grant Kosovo 5 mln euro for power grid upgrades
Description: Kosovo's finance ministry said it signed an agreement with German development bank KfW supporting an ongoing power-grid upgrade with a 5 million euro grant.
Image: https://cdn.seenews.com/images/t780x490/germany-to-grant-kosovo-5-mln-euro-for-power-grid-upgrades-1298483-1784727125.webp

7. Source: SeeNews | category Ekonomi | flag ✈️ | bias qendror
URL: https://seenews.com/news/wizz-air-opens-base-in-kosovos-pristina-1298468
Title: Wizz Air opens base in Kosovo's Pristina
Description: The low-cost carrier inaugurated a newly established base in Pristina, according to a statement attributed to Prime Minister Albin Kurti.
Image: https://cdn.seenews.com/images/t780x490/wizz-air-opens-base-in-kosovos-pristina-1298468-1784723045.webp

8. Source: Al Jazeera | category Sport | flag ⚽ | bias qendror
URL: https://www.aljazeera.com/sports/2026/7/22/chelsea-sign-morgan-rogers-from-aston-villa-in-record-british-deal
Title: Morgan Rogers joins Chelsea in record British deal
Description: The 23-year-old Rogers has signed a contract until 2033.
Image: https://www.aljazeera.com/wp-content/uploads/2026/07/afp_6a6079c1f0e2-1784707522.jpg?resize=1920%2C1440

9. Source: BBC News | category Kulturë | flag 🇦🇹 | bias qendror
URL: https://www.bbc.co.uk/news/articles/cy5d36e752yo?at_medium=RSS&at_campaign=rss
Title: Austrian police station opens at Hitler's birthplace in bid to rid site of Nazi link
Description: The opening follows years of controversy about the 17th-century former inn where the Nazi dictator was born.
Image: https://ichef.bbci.co.uk/ace/branded_news/1200/cpsprodpb/5803/live/7ce1c600-85b2-11f1-bee8-53ce494e1abc.jpg

10. Source: European Western Balkans | category Politikë | flag 🇪🇺 | bias qendror
URL: https://europeanwesternbalkans.com/2026/07/22/eu-concerned-over-decision-to-confirm-resignations-of-serb-prosecutors/
Title: EU concerned over decision to confirm resignations of Serb prosecutors
Description: Acting President Albulena Haxhiu confirmed resignations of seven prosecutors from the Serb community, submitted in 2022; a day earlier the Kosovo Prosecutorial Council refused to withdraw resignations of those who had changed their minds.
Image: https://europeanwesternbalkans.com/wp-content/uploads/2026/07/IMG_9819-1.jpeg

11. Source: Balkan Insight | category Shoqëri | flag 🇽🇰 | bias analitik
URL: https://balkaninsight.com/2026/07/22/nobody-mentions-us-silence-surrounds-wartime-rape-of-kosovos-ethnic-minorities/btj/
Title: Silence Surrounds Wartime Rape of Kosovo's Ethnic Minorities
Description: Stigma still cloaks wartime sexual violence in Kosovo, especially for survivors from Roma, Ashkali and Egyptian minorities.
Image: https://balkaninsight.com/wp-content/uploads/2026/07/cover-v7-1280x768.png

12. Source: MIT Technology Review | category Teknologji | flag 🤖 | bias analitik
URL: https://www.technologyreview.com/2026/07/20/1140675/chinas-ai-models-have-trumps-ai-world-at-war-with-itself/
Title: China's AI models have Trump's AI world at war with itself
Description: Kimi and other free models from China have again been seen as a wake-up call, raising questions about the policy response.
Image: https://wp.technologyreview.com/wp-content/uploads/2026/07/GettyImages-2194586709.jpg?resize=1200,600

13. Source: Time | category Teknologji | flag 🇦🇺 | bias analitik
URL: https://time.com/article/2026/07/18/the-world-should-learn-from-australia-s-social-media-law/
Title: What the World Should Learn from Australia's Social Media Law
Description: Six months after Australia restricted social media companies from providing accounts to children under 16, early signs of effects are emerging; the policy debate includes child safety, privacy and age verification.
Image: https://static.time.com/v3/assets/bltea6093859af6183b/bltb646cfa2984c71f1/6a5a422025e8785a3dda4ed9/weekend-essay-social-media.jpg?branch=production&width=3840&quality=75&auto=webp&crop=16:9

After writing the JSON, run no validation or publication commands. Respond only with a compact statement of the created file and article count.