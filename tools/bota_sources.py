"""Worldwide discovery metadata. A search market never determines publisher country."""
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime
from urllib.parse import urlparse, parse_qs
import re

COUNTRIES = {
 'rs':'Serbi','ba':'Bosnjë dhe Hercegovinë','me':'Mali i Zi','mk':'Maqedoni e Veriut',
 'al':'Shqipëri','ro':'Rumani','bg':'Bullgari','hu':'Hungari','cz':'Çeki','sk':'Sllovaki',
 'si':'Slloveni','fi':'Finlandë','no':'Norvegji','dk':'Danimarkë','is':'Islandë',
 'pt':'Portugali','ie':'Irlandë','ca':'Kanada','au':'Australi','nz':'Zelandë e Re',
 'br':'Brazil','ar':'Argjentinë','mx':'Meksikë','cl':'Kili','in':'Indi','pk':'Pakistan',
 'jp':'Japoni','cn':'Kinë','kr':'Kore e Jugut','id':'Indonezi','my':'Malajzi','sg':'Singapor',
 'za':'Afrikë e Jugut','ng':'Nigeri','eg':'Egjipt','ae':'Emiratet e Bashkuara Arabe',
 'qa':'Katar','sa':'Arabi Saudite','il':'Izrael','ru':'Rusi','ua':'Ukrainë',
 'cy':'Qipro','lu':'Luksemburg','vn':'Vietnam','pa':'Panama',
}
# Country-specific publisher domains, plus known international mastheads.
OWNERS = {'b92.net':'Serbi','n1info.com':'Serbi','aljazeera.com':'Katar',
 'ndtv.com':'Indi','timesofindia.indiatimes.com':'Indi','thehindu.com':'Indi',
 'channelnewsasia.com':'Singapor','straitstimes.com':'Singapor',
 'dailysabah.com':'Turqi','aa.com.tr':'Turqi','reuters.com':'Britani',
 'apnews.com':'SHBA','euronews.com':'Francë','france24.com':'Francë',
 'rferl.org':'SHBA','voanews.com':'SHBA','balkaninsight.com':'Britani',
 'abcnews.com':'SHBA','ledgertranscript.com':'SHBA'}
DOMESTIC_DOMAINS={'kosovahaber.com','periskopi.com','kosovapress.com'}
INSTITUTION_DOMAINS={'tff.org'}

def excluded_publisher(url):
    host=(urlparse(url).hostname or '').lower()
    return any(host==d or host.endswith('.'+d) for d in DOMESTIC_DOMAINS|INSTITUTION_DOMAINS)
MARKETS = ['en-US','en-GB','de-DE','fr-FR','it-IT','de-AT','de-CH','nl-NL',
 'nl-BE','es-ES','el-GR','sv-SE','pl-PL','tr-TR','hr-HR','sr-RS','bs-BA',
 'sr-ME','mk-MK','sq-AL','ro-RO','bg-BG','hu-HU','cs-CZ','sk-SK','sl-SI',
 'fi-FI','nb-NO','da-DK','is-IS','pt-PT','en-IE','en-CA','en-AU','en-NZ',
 'pt-BR','es-AR','es-MX','es-CL','en-IN','en-PK','ja-JP','zh-CN','ko-KR',
 'id-ID','ms-MY','en-SG','en-ZA','en-NG','ar-EG','ar-AE','ar-QA','ar-SA',
 'he-IL','ru-RU','uk-UA']
TERMS = ['Kosovo','Kosova','Косово','Κόσοβο','コソボ','科索沃','كوسوفو']

def publisher_country(url, outlet=''):
    from tone_sources import country_for
    known=country_for(url,outlet)
    if known:return known
    host=(urlparse(url).hostname or '').lower()
    # MSN and other aggregators are not attributed to the search market.
    for domain,country in sorted(OWNERS.items(),key=lambda item:-len(item[0])):
        if host==domain or host.endswith('.'+domain):return country
    return COUNTRIES.get(host.rsplit('.',1)[-1],'Të tjera')

def bing_original_url(link):
    parsed=urlparse(link)
    if parsed.hostname not in ('www.bing.com','bing.com'):return ''
    original=parse_qs(parsed.query).get('url',[''])[0]
    parsed_original=urlparse(original)
    if parsed_original.scheme!='https' or parsed_original.username or parsed_original.password or parsed_original.port:return ''
    return original

def worldwide_candidates():
    import requests, feedparser
    from tone_scraper import is_fresh
    # Seven-day reporting window is validated again before publication. Search
    # results sometimes ignore freshness; RSS timestamps are mandatory.
    queries=[(market,term) for market in MARKETS for term in ('Kosovo','Kosova')]
    queries += [('en-US',term) for term in TERMS[2:]]
    def search(query):
        market,term=query
        try:
            response=requests.get('https://www.bing.com/news/search',params={
                'q':term,'format':'rss','setmkt':market,'freshness':'Week'},timeout=15)
            response.raise_for_status()
            if len(response.content)>3_000_000:return []
            rows=[]
            for entry in feedparser.parse(response.content).entries:
                published=entry.get('published_parsed');url=bing_original_url(entry.get('link',''))
                if not published or not url:continue
                day=datetime(*published[:6]).date().isoformat()
                if not is_fresh(day):continue
                outlet=entry.get('news_source') or urlparse(url).hostname
                rows.append({'title':entry.get('title',''),'summary':entry.get('summary',''),
                             'url':url,'date':day,'outlet':outlet,'country':publisher_country(url,outlet)})
            return rows
        except Exception:return []
    with ThreadPoolExecutor(max_workers=8) as pool:
        return [row for rows in pool.map(search,queries) for row in rows]

def balanced_sources(rows, limit, country_cap=25, outlet_cap=8):
    """Round-robin actual publisher countries; bound one country's/outlet's share."""
    from collections import Counter
    queues={};seen=set()
    for row in rows:
        key=row.get('id') or row['url']
        if key in seen:continue
        seen.add(key);queues.setdefault(row['country'],[]).append(row)
    selected=[];countries=Counter();outlets=Counter()
    while queues and len(selected)<limit:
        for country in list(queues):
            queue=queues[country]
            while queue:
                row=queue.pop(0)
                outlet=(country,row['outlet'])
                if countries[country]<country_cap and outlets[outlet]<outlet_cap:
                    selected.append(row);countries[country]+=1;outlets[outlet]+=1;break
            if not queue or countries[country]>=country_cap:del queues[country]
            if len(selected)>=limit:break
    return selected
