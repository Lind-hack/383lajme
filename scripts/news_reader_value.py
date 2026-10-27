"""Transparent discovery priority, not a factual verdict or popularity claim."""
import re
import unicodedata


def reader_value(lead: dict) -> dict:
    text = unicodedata.normalize('NFKD', str(lead.get('title') or '')).casefold()
    text = ''.join(c for c in text if not unicodedata.combining(c))
    reasons = []
    signals = {
        'daily_costs_and_income': r'\b(?:cmim\w*|paga\w*|pension\w*|tatim\w*|taks\w*|qira\w*|inflacion\w*|prices?|wages?|salar\w*|pensions?|tax\w*|rent|inflation)\b',
        'services_and_safety': r'\b(?:nderprer\w*|uji|ujit|rryma|rrymes|energj\w*|trafik\w*|rrug\w*|transport\w*|fluturim\w*|siguri\w*|rrezik\w*|outage\w*|electricity|water|traffic|flight\w*|recall\w*|security|vulnerabil\w*|breach\w*)\b',
        'rights_and_public_decisions': r'\b(?:ligj\w*|viza\w*|afati\w*|zgjedhj\w*|vot\w*|gjykat\w*|hetim\w*|law\w*|visa\w*|deadline\w*|election\w*|ballot\w*|court\w*|investigat\w*)\b',
    }
    for reason, pattern in signals.items():
        if re.search(pattern, text):
            reasons.append(reason)
    category = lead.get('category')
    desk = {
        'Ekonomi': r'\b(?:stocks?|wall street|markets?|aksion\w*|tregj\w*|tregu|bitcoin|ethereum|interest rates?|norm\w*.*interes\w*)\b',
        'Teknologji': r'\b(?:launch\w*|releas\w*|patch\w*|update\w*|fix(?:es|ed)?|publik\w*|perdites\w*|lanson|prezanton)\b',
        'Sport': r'\b(?:final\w*|fiton|fitoi|humb\w*|kualifik\w*|transfer\w*|kampion\w*|champion\w*|wins?|defeat\w*|qualif\w*)\b',
        'Showbiz': r'\b(?:koncert\w*|concert\w*|premier\w*|album\w*|festival\w*|cmim\w*|award\w*|bilet\w*|tickets?)\b',
        'Botë': r'\b(?:armepushim\w*|ceasefire\w*|luft\w*|war|sanction\w*|sanksion\w*|migr\w*|refugjat\w*|refugee\w*)\b',
    }.get(category)
    if desk and re.search(desk, text):
        reasons.append('concrete_desk_development')
    # Advertisements, previews and evergreen explainers remain retrievable,
    # but do not consume the first preparation slots for newly reported news.
    labels = {str(tag).casefold() for tag in (lead.get('tags') or [])}
    reserve = bool(labels & {'opinion', 'review', 'reviews', 'sponsored', 'buying guide', 'betting'}
                   or re.search(r'\b(?:horoskop\w*|sponsoriz\w*|advertorial|coupon\w*|promo code|buying guide|what is|cfare eshte|rumours?|rumors?|gossip|thashethem\w*)\b', text)
                   or (not any(reason in signals for reason in reasons)
                       and re.search(r'\b\d+\s+(?:menyra|ndryshime|keshilla|ways|things|tips|differences)\b', text))
                   or category == 'Ekonomi' and re.search(
                       r'\b(?:time to|should|recommend\w*|urges?|advis\w*|koha|duhet|rekomand\w*)\b.{0,48}'
                       r'\b(?:buy|sell|accumulat\w*|invest\w*|blere|shitur|blerj\w*|shitj\w*)\b', text))
    return {'score': len(reasons) - (4 if reserve else 0), 'signals': reasons,
            'reserve_genre': reserve, 'basis': 'headline_and_genre_signals_not_measured_engagement'}
