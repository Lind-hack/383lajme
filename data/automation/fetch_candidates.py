import re, urllib.request, urllib.error, json
urls = [
"https://balkaninsight.com/2026/07/22/eu-osce-missions-criticise-kosovos-demolition-of-serb-owned-villas/bi/",
"https://europeanwesternbalkans.com/2026/07/22/interpol-rejects-serbias-request-for-international-arrest-warrants-against-activists/",
"https://euobserver.com/229568/i-would-have-ethnically-cleansed-kosovo-in-1998-says-serbian-minister-opening-a-balkan-pandoras-box/",
"https://www.bbc.co.uk/news/articles/c93483k0lp1o?at_medium=RSS&at_campaign=rss",
"https://www.bbc.co.uk/news/articles/c36de9n4pxpo?at_medium=RSS&at_campaign=rss",
"https://www.france24.com/en/europe/20260722-germany-greenlights-controversial-joint-french-russian-nuclear-project",
"https://seenews.com/news/germany-to-grant-kosovo-5-mln-euro-for-power-grid-upgrades-1298483",
"https://seenews.com/news/wizz-air-opens-base-in-kosovos-pristina-1298468",
"https://www.aljazeera.com/sports/2026/7/22/chelsea-sign-morgan-rogers-from-aston-villa-in-record-british-deal",
"https://www.bbc.co.uk/news/articles/cy5d36e752yo?at_medium=RSS&at_campaign=rss",
"https://europeanwesternbalkans.com/2026/07/22/eu-concerned-over-decision-to-confirm-resignations-of-serb-prosecutors/",
"https://kossev.info/en/narandzasti-meteoalarm-kosovo-oluje-grad-upozorenje/",
"https://balkaninsight.com/2026/07/22/nobody-mentions-us-silence-surrounds-wartime-rape-of-kosovos-ethnic-minorities/btj/",
"https://kossev.info/en/rse-kosovo-trgovina-ljudima-latinska-amerika/",
"https://www.france24.com/en/zelensky-sacks-army-chief-oleksandr-syrsky-after-protests",
"https://www.technologyreview.com/2026/07/20/1140675/chinas-ai-models-have-trumps-ai-world-at-war-with-itself/",
"https://time.com/article/2026/07/18/the-world-should-learn-from-australia-s-social-media-law/",
]
headers={"User-Agent":"Mozilla/5.0 (compatible; 383Lajme/1.0; editorial verification)"}
for url in urls:
    result={"url":url}
    try:
        with urllib.request.urlopen(urllib.request.Request(url,headers=headers), timeout=25) as r:
            html=r.read(800000).decode('utf-8','replace'); result['status']=r.status; result['final_url']=r.url
        for key, patt in [('title',r'<meta[^>]+(?:property|name)=["\']og:title["\'][^>]+content=["\']([^"\']+)'),('image',r'<meta[^>]+(?:property|name)=["\']og:image["\'][^>]+content=["\']([^"\']+)')]:
            m=re.search(patt,html,re.I)
            if not m:
                m=re.search(r'<meta[^>]+content=["\']([^"\']+)["\'][^>]+(?:property|name)=["\']og:'+key+r'["\']',html,re.I)
            result[key]=m.group(1).replace('&amp;','&') if m else ''
        result['description']= (re.search(r'<meta[^>]+(?:property|name)=["\'](?:og:description|description)["\'][^>]+content=["\']([^"\']+)',html,re.I) or [None,''])[1]
    except Exception as e: result['error']=f'{type(e).__name__}: {e}'
    print(json.dumps(result,ensure_ascii=False))
