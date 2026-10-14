"""Adapt the common newsroom photo policy to Bota's camel-case publication."""
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))

def select_bota_photo(source, result, deadline=None):
    if not isinstance(result.get('photoPlan'), dict):
        return {'imageUrl': None}
    from news_image_policy import select_photo, fold
    evidence = {'text': '\n'.join(source['sourceParagraphs']), 'image_url': source.get('imageUrl') or '', 'image_candidates': source.get('imageCandidates', [])[:4]}
    lead = {'pair_id': source.get('id', ''), 'title': source['title'], 'source': source['outlet'], 'category': 'Botë', 'primary_evidence': evidence}
    plan = result.get('photoPlan')
    original = fold(source['title'] + '\n' + evidence['text'])
    if isinstance(plan, dict):
        subject = plan.get('subject', '')
        quote = plan.get('subjectEvidence', '')
        if (isinstance(subject, str) and 3 <= len(subject.strip()) <= 160
            and isinstance(quote, str) and 1 <= len(quote.split()) <= 20
            and fold(quote) in original and fold(subject) in fold(quote)
            and fold(subject) != fold(source['outlet'])):
            plan = {'subject': subject.strip(), 'subject_evidence': quote.strip(), 'queries': [subject.strip()],
                    'caption': subject.strip(), 'planner': 'bota-gpt-grounded'}
        else:
            plan = None
    else:
        plan = None
    if not plan:
        return {'imageUrl': None}
    lead['photo_plan'] = plan
    lead['_photo_deadline'] = deadline if deadline is not None else time.monotonic() + 60
    photo = select_photo(lead, evidence, {})
    if not photo:
        return {'imageUrl': None}
    return {target: photo[key] for key, target in {
        'image_url': 'imageUrl', 'image_width': 'imageWidth', 'image_height': 'imageHeight',
        'image_subject': 'imageSubject', 'image_caption': 'imageCaption', 'image_rights': 'imageRights',
    }.items()}
