from concurrent.futures import ThreadPoolExecutor, as_completed
import re
from html import unescape
import requests

urls = [
"https://radiokontaktplus.org/vesti/iz-hrvatske-na-kosovo-izrucen-muskarac-po-interpol-ovoj-poternici/135635/",
"https://kossev.info/en/drzavljanin-albanije-poginuo-kod-kosova-polja-cetvrta-zrtva-u-saobracaju/",
"https://www.danas.rs/vesti/politika/kosovski-analiticar-pitanje-srba-i-severa-narusilo-odnose-pristine-i-sad/",
"https://www.kosovo-online.com/vesti/ekonomija/dizel-na-kosovu-skuplji-za-tri-benzin-za-jedan-cent-25-7-2026",
"https://www.france24.com/en/it-smells-of-burning-thousands-evacuated-as-wildfires-rage-around-madrid",
"https://www.huffingtonpost.co.uk/entry/strictly-come-dancing-2026-cast_uk_6a5f3ca5e4b03e4448784dfc?origin=home-entertainment-unit",
"https://mashable.com/tech/google-gemini-3-5-pro-delay",
"https://app.therundown.ai/guides/automate-tasks-with-claudes-record-a-skill-feature",
"https://www.nytimes.com/athletic/7469462/2026/07/25/salma-paralluelo-lyonnes-barcelona-transfer/",
"https://www.footballtransfers.com/en/transfer-news/es-la-liga/2026/07/done-deals-every-official-completed-transfer-around-europe-today",
"https://www.skysports.com/football/news/11095/13546618/transfer-news-summer-transfer-window-2026-premier-league-deals-ins-and-outs",
"https://www.espn.co.uk/football/story/_/id/48955344/premier-league-2026-summer-transfers-all-confirmed-ins-outs-every-club",
"https://www.bbc.co.uk/news/articles/czjlenp0xk8o?at_medium=RSS&at_campaign=rss",
]
headers={"User-Agent":"Mozilla/5.0 (compatible; 383Lajme/1.0)"}
def verify(url):
    try:
        r=requests.get(url,headers=headers,timeout=25)
        text=r.text
        title=re.search(r'<meta[^>]+property=["\']og:title["\'][^>]+content=["\']([^"\']+)', text, re.I) or re.search(r'<title[^>]*>(.*?)</title>',text,re.I|re.S)
        image=re.search(r'<meta[^>]+property=["\']og:image["\'][^>]+content=["\']([^"\']+)', text, re.I)
        return url, r.status_code, unescape(re.sub('<.*?>',' ',title.group(1)).strip())[:180] if title else '', unescape(image.group(1)) if image else ''
    except Exception as e:
        return url, 'ERR', type(e).__name__, ''
def main():
    with ThreadPoolExecutor(max_workers=8) as ex:
        futures = [ex.submit(verify, url) for url in urls]
        for future in as_completed(futures):
            print("\t".join(map(str, future.result())))


if __name__ == "__main__":
    main()
