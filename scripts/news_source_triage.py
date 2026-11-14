"""Early event triage inside the existing visual call; never final approval."""
import re
from bs4 import BeautifulSoup
from news_source_policy import fold

POLICY = '383-source-event-triage-v2'
INSTRUCTION = (
    ' If published_articles is nonempty, compare this source development with their COMPLETE copy in the same review. '
    'Return published_event: {verdict: distinct|retelling|uncertain, reason: string, source_span: exact source passage, '
    'against_id: published ID for a retelling, against_span: exact published passage for a retelling}. '
    'Spans must identify the event, at least 20 characters. Another source, language, background paragraph or angle '
    'is not a new event. A separately evidenced subsequent decision, result or material update can be distinct. '
    'A shared celebrity, institution or topic alone is never a duplicate. Hold retellings and uncertainty before writing. '
    'This triage grants no factual, copyright or final independent publication approval.'
)

def comparisons(lead, source, history):
    def words(text):
        # Prefixes retain attention to names with Albanian case endings. This
        # selects complete comparison copy; it never declares a duplicate.
        return {w[:4] for w in re.findall(r"\w+",fold(BeautifulSoup(str(text),'html.parser').get_text(' '))) if len(w)>3}
    target=words(str(lead.get('title',''))+' '+str(source.get('text','')))
    ranked=[]
    for row in history:
        overlap=len(target & words(' '.join(str(row.get(key) or '') for key in ('title','excerpt','body'))))
        if row.get('url')==lead['url'] or overlap>=2:
            ranked.append((overlap,row))
    return [{k:row.get(k) for k in ('id','category','title','excerpt','body','url','published_at')}
            for _,row in sorted(ranked,key=lambda item:-item[0])[:3]]

def validate(row, source, history):
    decision=row.get('published_event',{})
    if (decision.get('verdict') not in {'distinct','retelling','uncertain'}
            or not isinstance(decision.get('reason'),str) or len(decision['reason'].strip())<20
            or not located(decision.get('source_span'),source.get('text',''))):
        raise ValueError('source triage lacks a valid published-event comparison')
    if decision['verdict']=='retelling':
        against=next((old for old in history if str(old.get('id'))==str(decision.get('against_id'))),None)
        if not against or not located(decision.get('against_span'),str(against.get('body',''))):
            raise ValueError('source retelling decision lacks a matching published passage')
    return decision['verdict']

def located(span,text):
    return isinstance(span,str) and len(span.strip())>=20 and ' '.join(span.split()) in ' '.join(BeautifulSoup(text,'html.parser').get_text(' ').split())
