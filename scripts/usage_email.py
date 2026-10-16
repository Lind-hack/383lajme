"""Email-safe tables and inline heat scales for the 383 daily activity brief."""
from datetime import datetime
from html import escape
from zoneinfo import ZoneInfo

NAMES = {'home': 'Homepage', 'tregu': 'Tregu', 'perty': 'Për Ty', 'quiz': 'Quiz',
         'bota': 'Bota për Kosovën', 'dosje': 'Dosje', 'search': 'Search',
         'xhep': 'Kosova në Xhep', 'visit': 'Visit / travel', 'articles': 'Articles',
         'categories': 'News categories', 'video': 'Video', 'other': 'Other pages'}
HEAT = ['#F1F4F6', '#DAE8F3', '#B5D2E8', '#FFCFB7', '#FF8A5C', '#B83216']
INK, MUTED, LINE = '#171B22', '#58616D', '#E2E6EA'


def numeric(value):
    from math import isfinite
    try:
        parsed = float(value)
        return max(0, parsed) if isfinite(parsed) else 0
    except (TypeError, ValueError):
        return 0


def count(value):
    return f'{numeric(value):,.0f}'


def duration(value):
    seconds = round(numeric(value))
    if seconds < 60:
        return f'{seconds}s'
    minutes, seconds = divmod(seconds, 60)
    return f'{minutes}m {seconds:02d}s' if minutes < 60 else f'{minutes // 60}h {minutes % 60:02d}m'


def heat_color(value, maximum):
    ratio = numeric(value) / numeric(maximum) if numeric(maximum) else 0
    return HEAT[min(5, max(1, int(ratio * 5)))] if ratio > 0 else HEAT[0]


def safe_path(value):
    from urllib.parse import urlsplit
    if not isinstance(value, str):
        return None
    try:
        url = urlsplit(value)
        if url.hostname and url.hostname not in ('383ks.com', 'www.383ks.com'):
            return None
        path = url.path or '/'
        if not path.startswith('/') or path.split('/')[1] in ('admin', 'auth', 'api', 'hyr', 'profili'):
            return None
        import re
        for pattern, replacement in [(r'^/visit/r/[^/]+.*', '/visit/r/[invite]'),
                                      (r'^/gazeta/[^/]+.*', '/gazeta/[paper]'),
                                      (r'^/xhep/rooms/[^/]+.*', '/xhep/rooms/[invite]')]:
            if re.match(pattern, path):
                return replacement
        return path[:180]
    except ValueError:
        return None


def paragraph(text, color=MUTED):
    return f'<p style="margin:8px 0 18px;font-size:14px;line-height:1.6;color:{color}">{escape(text)}</p>'


def heading(text):
    return f'<h2 style="margin:0 0 8px;font-size:23px;line-height:1.3;letter-spacing:-.4px;color:{INK}">{escape(text)}</h2>'


def block(content, background='#FFFFFF'):
    return f'<tr><td class="section" bgcolor="{background}" style="padding:28px 32px;border-bottom:1px solid {LINE}">{content}</td></tr>'


def bars(items, key, time=False):
    maximum = max((numeric(row.get(key)) for row in items), default=0)
    markup = '<table role="presentation" width="100%" cellspacing="0" cellpadding="0">'
    for row in items:
        value = numeric(row.get(key))
        label = escape(row['label'])
        formatted = duration(value) if time else count(value)
        width = round(100 * value / maximum) if maximum else 0
        markup += (f'<tr><td style="padding:10px 8px 6px 0;font-size:14px;line-height:1.4;word-break:break-word">{label}</td>'
                   f'<td width="88" align="right" style="font-size:15px;font-weight:700;white-space:nowrap">{formatted}</td></tr>'
                   f'<tr><td colspan="2" style="padding-bottom:8px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>'
                   f'<td height="7" width="{max(1, width)}%" bgcolor="#FF572D" style="height:7px;font-size:0;line-height:0">&nbsp;</td>'
                   + (f'<td height="7" bgcolor="#F0F2F4" style="height:7px;font-size:0;line-height:0">&nbsp;</td>' if width < 100 else '')
                   + '</tr></table></td></tr>')
    return markup + '</table>'


def render_email(overall, by_url, usage):
    from clarity_daily_report import field, rows, display
    usage = usage if isinstance(usage, dict) else {}
    features = [r for r in usage.get('features', []) if r.get('feature') in NAMES]
    pages = [{**r, 'label': safe_path(r.get('path'))} for r in usage.get('pages', []) if safe_path(r.get('path'))]
    buttons = [{**r, 'label': NAMES.get(r.get('feature'), 'Other pages') + ' · ' +
                str(r.get('action', '')).removeprefix('button:').replace('_', ' ').title()}
               for r in usage.get('buttons', []) if str(r.get('action', '')).startswith('button:')]
    destinations = [{**r, 'label': safe_path(r.get('path'))} for r in usage.get('destinations', []) if safe_path(r.get('path'))]
    features.sort(key=lambda r: (-numeric(r.get('clicks')), -numeric(r.get('seconds')), r['feature']))
    clicks = sum(numeric(r.get('clicks')) for r in features)
    active = sum(numeric(r.get('seconds')) for r in features)
    traffic = rows(overall, 'Traffic')
    traffic = traffic[0] if traffic else {}
    top_click = max(features, key=lambda r: numeric(r.get('clicks')), default=None)
    top_time = max(features, key=lambda r: numeric(r.get('seconds')), default=None)
    now = datetime.now(ZoneInfo('Europe/Warsaw'))
    summary = []
    if top_click and clicks:
        summary.append(f"{NAMES[top_click['feature']]} led clicks with {count(top_click['clicks'])}.")
    if top_time and active:
        summary.append(f"{NAMES[top_time['feature']]} held attention for {duration(top_time['seconds'])}.")
    if not summary:
        summary.append('The new feature counters are warming up. Page activity from Clarity is available below.')
    plain = ['383 — Your daily activity brief', now.strftime('%d %B %Y') + ' · Last 24 hours', *summary,
             'Feature counters measure consenting visitors only.']
    content = block(
        '<table role="presentation" width="100%"><tr><td style="font-size:34px;font-weight:800;letter-spacing:-2px;color:#FF572D">383</td>'
        f'<td align="right" style="font-size:12px;color:{MUTED}">{now:%d %b %Y}<br>Last 24 hours</td></tr></table>'
        '<h1 style="font-size:34px;line-height:1.1;letter-spacing:-1px;margin:24px 0 16px;color:#171B22">What people<br>used today.</h1>'
        + paragraph(' '.join(summary), INK)
        + f'<p style="margin:0;font-size:13px;line-height:1.7;color:{MUTED}"><b>{display(field(traffic, "distinctUserCount", "distantUserCount"))}</b> Clarity visitors &nbsp;·&nbsp; '
          f'<b>{display(field(traffic, "totalSessionCount"))}</b> sessions &nbsp;·&nbsp; <b>{count(clicks)}</b> measured clicks</p>', '#F9F6F1')
    chart = heading('Feature activity heatmap') + paragraph('Darker cells mean more activity. Read each column separately: clicks and time have different scales.')
    if features:
        chart += '<table width="100%" cellpadding="0" cellspacing="4" style="table-layout:fixed"><thead><tr>'
        chart += '<th width="34%" align="left" style="font-size:12px;padding:8px 4px">Section</th>'
        chart += ''.join(f'<th style="font-size:12px;padding:8px 2px">{label}</th>' for label in ('Visits', 'Clicks', 'Active time')) + '</tr></thead><tbody>'
        maximum = {key: max(numeric(r.get(key)) for r in features) for key in ('visits', 'clicks', 'seconds')}
        for row in features:
            chart += f'<tr><th align="left" style="font-size:13px;font-weight:600;padding:10px 4px;word-break:break-word">{escape(NAMES[row["feature"]])}</th>'
            for key in ('visits', 'clicks', 'seconds'):
                value = numeric(row.get(key))
                color = heat_color(value, maximum[key])
                text_color = '#FFFFFF' if color == HEAT[-1] else INK
                formatted = duration(value) if key == 'seconds' else count(value)
                chart += f'<td bgcolor="{color}" align="center" style="padding:14px 2px;font-size:13px;font-weight:700;color:{text_color};border-radius:5px">{formatted}</td>'
            chart += '</tr>'
            plain.append(f"{NAMES[row['feature']]}: {count(row.get('visits'))} visits · {count(row.get('clicks'))} clicks · {duration(row.get('seconds'))} active")
        chart += '</tbody></table>'
    else:
        chart += paragraph('No feature-counter measurements yet. This is an empty measurement window, not evidence that nobody used the site.')
    chart += '<table role="presentation" cellpadding="0" cellspacing="3" style="margin-top:14px"><tr><td style="font-size:11px;padding-right:6px">Lower</td>'
    chart += ''.join(f'<td bgcolor="{c}" width="22" height="12" style="font-size:0">&nbsp;</td>' for c in HEAT)
    chart += '<td style="font-size:11px;padding-left:6px">Higher</td></tr></table>'
    chart += paragraph('Visits count page openings. Clicks count links and controls. Active time counts foreground interaction, with a 60-second idle cutoff.')
    if usage.get('firstEvent'):
        chart += paragraph('First retained measurement: ' + str(usage['firstEvent'])[:16].replace('T', ' ') + ' UTC. New counters may cover less than the full 24 hours.')
    content += block(chart)
    for title, intro, data, key, is_time in [
        ('Buttons people pressed', 'Actual button clicks, grouped by section. “Other” groups controls whose labels are not yet named.', buttons, 'clicks', False),
        ('Pages people clicked into', 'Internal link clicks by destination page. These are measured clicks, not page views.', destinations, 'clicks', False),
        ('Where people spent time', 'Total measured active time per page. A busy tab left in the background does not count.', sorted(pages, key=lambda r: -numeric(r.get('seconds'))), 'seconds', True),
        ('Pages with the most interaction', 'All measured link and button clicks made while viewing each page.', sorted(pages, key=lambda r: -numeric(r.get('clicks'))), 'clicks', False),
    ]:
        selected = sorted([r for r in data if numeric(r.get(key)) > 0], key=lambda r: -numeric(r[key]))[:6]
        body = heading(title) + paragraph(intro)
        body += bars(selected, key, is_time) if selected else paragraph('No measurements yet for this window. New activity will populate this section automatically.')
        content += block(body)
        plain += ['', title] + [r['label'] + ': ' + (duration(r[key]) if is_time else count(r[key])) for r in selected]
    popular_totals = {}
    for row in rows(overall, 'PopularPages'):
        path = safe_path(field(row, 'url'))
        if path:
            popular_totals[path] = popular_totals.get(path, 0) + numeric(field(row, 'visitsCount'))
    popular = [{'label': path, 'visits': value} for path, value in popular_totals.items()]
    content += block(heading('Popular pages across the day') + paragraph('Clarity page visits provide context for the full reporting window. This is separate from the new click counters.')
                     + (bars(sorted(popular, key=lambda r: -r['visits'])[:6], 'visits') if popular else paragraph('Clarity has no popular-page measurements for this window.')))
    clarity_time = []
    for row in rows(by_url, 'EngagementTime'):
        path = safe_path(field(row, 'URL'))
        value = field(row, 'activeTime')
        if path and value is not None and numeric(value) > 0:
            clarity_time.append({'label': path, 'seconds': numeric(value)})
    content += block(heading('Pages that held attention') + paragraph('Clarity average active time per session on each page. This is an average, separate from the total active-time ranking above.')
                     + (bars(sorted(clarity_time, key=lambda r: -r['seconds'])[:6], 'seconds', True) if clarity_time else paragraph('Clarity has no page engagement measurements for this window.')))
    friction = heading('Where people got stuck') + '<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>'
    for metric, label in [('DeadClickCount', 'Dead clicks'), ('RageClickCount', 'Rage clicks'), ('QuickbackClick', 'Quick backs')]:
        info = rows(overall, metric)
        value = display(field(info[0], 'subTotal')) if info else 'not available'
        friction += f'<td width="33%" valign="top" style="padding:12px 5px 10px 0;font-size:13px;color:#743B13"><b style="font-size:24px">{value}</b><br>{label}</td>'
        plain.append(f'{label}: {value}')
    friction += '</tr></table>' + paragraph('Dead clicks do nothing; rage clicks repeat rapidly. These can signal confusing controls, rather than useful engagement.', '#743B13')
    content += block(friction, '#FFF4E8')
    footer = heading('What to look at next') + paragraph(' '.join(summary) + ' Compare the click and active-time columns, then open recordings to understand why. Popularity alone does not prove usefulness.')
    footer += '<p style="margin:20px 0"><a href="https://clarity.microsoft.com/projects/view/yxa7ek3m9v/heatmaps" style="display:inline-block;background:#171B22;color:#FFFFFF;padding:13px 20px;border-radius:6px;text-decoration:none;font-size:14px;font-weight:700">Open on-page heatmaps</a></p>'
    footer += paragraph('Sent daily around 09:00 Europe/Warsaw to lindsylqa@gmail.com. Website counters and Microsoft Clarity measure consenting visitors only. This report is an aggregate feature heatmap; on-page click positions are available in Clarity.')
    content += block(footer, '#F9F6F1')
    markup = ('<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">'
              '<title>383 — Daily activity brief</title><style>@media(max-width:600px){.section{padding:24px 16px!important}}'
              'a:focus-visible{outline:3px solid #FF572D;outline-offset:4px}</style></head>'
              f'<body style="margin:0;padding:20px 0;background:#EDF0F3;color:{INK};font-family:Arial,Helvetica,sans-serif">'
              '<!-- THESIS: A readable activity brief led by a numeric feature heatmap, not an unformatted export. '
              'OWN-WORLD: Existing 383 ink/cream/orange; restrained cool-to-warm data cells; email-safe tables and system text. '
              'STORY: Compare measured clicks and active time, inspect ranked controls and pages, then open Clarity. '
              'FIRST VIEWPORT: Compact 383/date masthead, two-line 34px title, factual takeaway, then the heatmap at readable mobile scale. '
              'FORM: Code-led extension of the existing report; 383-usage-email-v2. '
              'FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance -->'
              '<div style="display:none;max-height:0;overflow:hidden">See which sections earned clicks and active time in the last 24 hours.</div>'
              '<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">'
              '<table role="presentation" width="680" cellpadding="0" cellspacing="0" style="width:100%;max-width:680px;background:#FFFFFF">'
              + content + '</table></td></tr></table></body></html>')
    return '\n'.join(plain), markup
