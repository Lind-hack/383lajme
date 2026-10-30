"""Fresh publisher-homepage attention, never factual or publication approval."""
from datetime import datetime, timezone
from urllib.parse import urlsplit


MAX_AGE_SECONDS = 3600


def homepage_article_identity(url):
    # Use the same identity as publication, without changing fetch/cache URLs.
    from codex_automation_support import _canonical_url
    try:
        return _canonical_url(url)
    except ValueError:
        return ''


def is_homepage(url, publisher):
    parsed = urlsplit(url)
    host = (parsed.hostname or '').removeprefix('www.')
    return (parsed.scheme in {'http', 'https'} and parsed.path in {'', '/'}
            and not parsed.query and host in {d.removeprefix('www.') for d in publisher['domains']})


def homepage_weight(lead, now=None):
    """Earlier observed article links rank higher; no top-N truncation.

    HTML order is an explicit fallback signal, not measured screen geometry.
    Ignore old observations rather than let yesterday's lead stay promoted.
    """
    observed = lead.get('homepage') or {}
    if not isinstance(observed, dict):
        return 0.0
    try:
        position, total = observed['position'], observed['article_count']
        checked = datetime.fromisoformat(observed['observed_at'])
        age = ((now or datetime.now(timezone.utc))-checked).total_seconds()
        if (observed.get('method') != 'public_html_dom_order'
                or type(position) is not int or type(total) is not int
                or not 1 <= position <= total or not 0 <= age <= MAX_AGE_SECONDS):
            return 0.0
        return 1.0/position
    except (KeyError, TypeError, ValueError, OverflowError):
        return 0.0
