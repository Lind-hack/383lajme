"""Render a clearly labelled illustrative email for desktop/mobile verification."""
from pathlib import Path
from clarity_daily_report import build_report

overall = [
    {'metricName': 'Traffic', 'information': [{'totalSessionCount': 430, 'distinctUserCount': 281}]},
    {'metricName': 'PopularPages', 'information': [{'url': '/per-ty', 'visitsCount': 182}, {'url': '/tregu', 'visitsCount': 136}, {'url': '/', 'visitsCount': 121}]},
    {'metricName': 'DeadClickCount', 'information': [{'subTotal': 14}]},
    {'metricName': 'RageClickCount', 'information': [{'subTotal': 3}]},
    {'metricName': 'QuickbackClick', 'information': [{'subTotal': 9}]},
]
usage = {
    'firstEvent': '2026-10-16T09:00:00Z',
    'features': [
        {'feature': 'perty', 'visits': 182, 'clicks': 241, 'seconds': 10740},
        {'feature': 'tregu', 'visits': 136, 'clicks': 326, 'seconds': 7560},
        {'feature': 'home', 'visits': 121, 'clicks': 167, 'seconds': 2100},
        {'feature': 'quiz', 'visits': 54, 'clicks': 149, 'seconds': 1680},
        {'feature': 'bota', 'visits': 31, 'clicks': 28, 'seconds': 960},
        {'feature': 'visit', 'visits': 17, 'clicks': 11, 'seconds': 420},
    ],
    'pages': [{'path': '/per-ty', 'clicks': 241, 'seconds': 10740}, {'path': '/tregu', 'clicks': 326, 'seconds': 7560}, {'path': '/kuiz', 'clicks': 149, 'seconds': 1680}],
    'buttons': [{'feature': 'tregu', 'action': 'button:buy', 'clicks': 98}, {'feature': 'quiz', 'action': 'button:quiz_answer', 'clicks': 84}, {'feature': 'home', 'action': 'button:search_open', 'clicks': 42}],
    'destinations': [{'path': '/per-ty', 'clicks': 114}, {'path': '/tregu', 'clicks': 86}, {'path': '/bota-per-kosoven', 'clicks': 21}],
}
by_url = [{'metricName': 'EngagementTime', 'information': [{'Url': '/per-ty', 'activeTime': 65}, {'Url': '/tregu', 'activeTime': 48}]}]
_, markup = build_report(overall, by_url, usage)
markup = markup.replace('<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">',
                        '<p style="text-align:center;font:13px Arial;color:#9A3412">Illustrative design preview · example data, not live statistics</p>'
                        '<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">', 1)
output = Path('.impeccable/review/usage-email-preview.html')
output.parent.mkdir(parents=True, exist_ok=True)
output.write_text(markup, encoding='utf-8')
print(output.resolve())
