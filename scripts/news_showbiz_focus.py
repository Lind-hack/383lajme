"""Owner-selected Albanian artist relevance; never a claim of measured popularity."""
import json
import re
import unicodedata
from pathlib import Path

ROSTER_PATH=Path(__file__).with_name('showbiz_artists.json')
ROSTER=json.loads(ROSTER_PATH.read_text(encoding='utf-8'))
ARTISTS=ROSTER['artists']

EDITORIAL_GUIDANCE=(
    'Showbiz is entertainment for Albanian-speaking readers in Kosovo. Prioritize new developments involving '
    'Dua Lipa, Rita Ora and Bebe Rexha, then other Albanian artists and personalities at home and abroad. '
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
    'do not present an archive portrait as the new Instagram photo or reuse an unlicensed social photo. '
    'Use the complete factual notes without filler; hold a brief that cannot support the required article length.'
)


def fold(value):
    return ''.join(c for c in unicodedata.normalize('NFKD',str(value or '')).casefold() if not unicodedata.combining(c))


def mentions(text,artist):
    text=fold(text)
    for alias in artist['aliases']:
        alias=fold(alias)
        # Albanian case endings: Lipa/Lipës/Lipën, Ora/Orës/Orën, Rexha/Rexhës.
        pattern=re.escape(alias[:-1])+r'(?:a|es|en|e|s)' if alias.endswith('a') else re.escape(alias)
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


def review_order(lead):
    return (-priority(lead),str(lead.get('source','')),str(lead.get('url','')))
