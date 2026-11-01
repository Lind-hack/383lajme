"""Owner-selected Albanian artist relevance; never a claim of measured popularity."""
import json
import re
import unicodedata
from pathlib import Path

ROSTER_PATH=Path(__file__).with_name('showbiz_artists.json')
ROSTER=json.loads(ROSTER_PATH.read_text(encoding='utf-8'))
ARTISTS=ROSTER['artists']
ADULT_CELEBRITIES=('Kim Kardashian','Kylie Jenner','Kendall Jenner','Hailey Bieber','Sabrina Carpenter',
    'Tate McRae','Sydney Sweeney','Megan Fox','Jennifer Lopez','Rihanna','Beyonce','Taylor Swift',
    'Ariana Grande','Billie Eilish','Demi Lovato','Miley Cyrus','Nicki Minaj','Cardi B','Shakira',
    'Madison Beer','Bella Hadid','Gigi Hadid','Emily Ratajkowski','Paris Hilton','Heidi Klum',
    'Gracie Abrams','Selena Gomez','Camila Cabello','Olivia Rodrigo','Addison Rae')

EDITORIAL_GUIDANCE=(
    'Showbiz is entertainment for Albanian-speaking readers in Kosovo. Prioritize new developments involving '
    'Dua Lipa, Rita Ora and Bebe Rexha, then other Albanian artists and personalities at home and abroad. '
    'Think as an entertainment reader: give engaging new adult female celebrity fashion, red-carpet looks, '
    'glamorous or sexy public photos, swimwear posts and public relationship updates strong audience interest. '
    'A clear photo/post hook can be enough; do not demand a public-policy consequence. '
    'A concrete new public statement, Instagram post/reel, fashion or beauty appearance, glamorous photoshoot, '
    'beach/swimwear or bold/sexy posing by an adult public artist, performance, relationship announcement or '
    'documented public exchange can be a valid standalone Showbiz story. Do not require political or economic '
    'consequences, a new album or a concert for entertainment relevance. Describe public photos and styling '
    'accurately and respectfully; no invented intimate details, body judgments, motives or relationships. '
    'Identify the actual new post/event and date; distinguish the artist\'s words from somebody else\'s claims. '
    'A profile, old photo, recycled gallery, new metadata timestamp or a passing celebrity mention is not a new story. '
    'Gossip is a topic, not evidence: private-life rumours and allegations still require independent corroboration. '
    'Do not invent fans reacting, internet discussion, viral status or reaction totals. Prefer an evidenced specific '
    'hook to generic hype such as sets the internet on fire. Archive photos must be labelled as archive; '
    'do not present an archive portrait as the new Instagram photo or substitute an unprepared social image. '
    'Use the complete factual notes without filler. Showbiz briefs may be 50 grounded words in one HTML paragraph; '
    'never repeat a detail or fill space with absent information, caveats or speculative meanings. '
    'For costume or photo roundups, choose a focused angle around a few specific looks rather than reproduce the source list and sequence. '
    'For a tiny update prefer a single concise 50-80 word paragraph; write longer only when each added sentence gives a new supported fact. Use the prepared original article image and preserve its provenance.'
)


def fold(value):
    return ''.join(c for c in unicodedata.normalize('NFKD',str(value or '')).casefold() if not unicodedata.combining(c))


def mentions(text,artist):
    text=fold(text)
    for alias in artist['aliases']:
        alias=fold(alias)
        # Albanian case endings: Lipa/Lipës/Lipën, Ora/Orës/Orën, Rexha/Rexhës.
        endings=r'(?:a|es|en|e|s)' if ' ' in alias else r'(?:a|es|en|e)'
        pattern=re.escape(alias[:-1])+endings if alias.endswith('a') else re.escape(alias)
        if re.search(r'(?<!\w)'+pattern+r'(?!\w)',text): return True
    return False


def focus(lead):
    if lead.get('category')!='Showbiz':
        return {'priority':0,'artists':[],'basis':'not_showbiz'}
    title=lead.get('title','')
    # A long article's incidental name-drop cannot promote an unrelated story.
    opening=str(lead.get('summary') or lead.get('excerpt') or '')[:350]
    hits=[{'id':a['id'],'name':a['name'],'priority':a['priority'],
           'match':'headline' if mentions(title,a) else 'opening'}
          for a in ARTISTS if mentions(title,a) or mentions(opening,a)]
    return {'priority':max((a['priority'] for a in hits),default=0),'artists':hits,
            'basis':'configured_audience_interest_not_measured_engagement'}


def priority(lead):
    return focus(lead)['priority']


def photo_interest(lead):
    if lead.get('category')!='Showbiz': return 0
    text=fold(lead.get('title','')+' '+str(lead.get('summary',''))[:350])
    named=priority(lead)>0 or any(re.search(r'(?<!\w)'+re.escape(fold(name))+r'(?!\w)',text) for name in ADULT_CELEBRITIES)
    hook=re.search(r'\b(?:foto\w*|photo\w*|bikini\w*|swimwear|fustan\w*|outfit\w*|fashion|pozon|posing|poses|look|veshje\w*|instagram|tattoo|tatuazh\w*|red carpet|relationship|costume\w*|kostum\w*|halloween|lingerie|sexy|glamour|plazh\w*)\b',text)
    return int(bool(named and hook))


def review_order(lead):
    from news_homepage_priority import homepage_weight
    return (-priority(lead),-homepage_weight(lead),-photo_interest(lead),str(lead.get('source','')),str(lead.get('url','')))


def headline_subjects(lead):
    title=lead.get('title','');text=fold(title)
    names={a['id'] for a in ARTISTS if mentions(title,a)}
    names.update(fold(name) for name in ADULT_CELEBRITIES if re.search(r'(?<!\w)'+re.escape(fold(name))+r'(?!\w)',text))
    return names


def review_queue(leads,now=None):
    """Artist interest and homepage leads first, with turns for every publisher."""
    from news_homepage_priority import homepage_weight
    from collections import defaultdict,deque
    groups=defaultdict(lambda:defaultdict(list))
    for lead in leads:
        weight=homepage_weight(lead,now)
        artist=priority(lead)
        photo=photo_interest(lead)
        lane=0 if artist==3 else 1 if artist else 2 if photo and weight else 3 if weight>=1/3 else 4 if photo else 5 if weight else 6
        groups[lane][lead.get('source','')].append(lead)
    result=[]
    for lane in sorted(groups):
        pools={name:deque(sorted(rows,key=lambda a:(-homepage_weight(a,now),-photo_interest(a),str(a.get('url','')))))
               for name,rows in groups[lane].items()}
        while any(pools.values()):
            for name in sorted(pools):
                if pools[name]:result.append(pools[name].popleft())
    return result
