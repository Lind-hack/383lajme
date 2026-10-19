"""Call the protected production sender in resumable batches; never log credentials."""
import json
import sys
import urllib.request


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def run(settings, request=None):
    origin = settings.get('SITE_URL', '').rstrip('/')
    secret = settings.get('CRON_SECRET', '')
    if origin != 'https://383ks.com' or not isinstance(secret, str) or not secret:
        raise ValueError('Invalid newsletter scheduler settings')
    opener = urllib.request.build_opener(NoRedirect)

    def post():
        req = urllib.request.Request(origin + '/api/automation/newsletter/weekly', data=b'',
            headers={'Authorization': 'Bearer ' + secret, 'User-Agent': '383-newsletter-scheduler/1.0'}, method='POST')
        with opener.open(req, timeout=70) as response:
            return json.load(response)

    for _ in range(12):
        result = (request or post)()
        if not isinstance(result, dict) or not ('sent' in result or 'skipped' in result):
            raise ValueError('Invalid newsletter sender response')
        for field in ('sent', 'queued', 'failed', 'pending', 'held'):
            if field in result and (not isinstance(result[field], int) or result[field] < 0):
                raise ValueError('Invalid delivery count')
        print(json.dumps({k: result[k] for k in ('issue', 'skipped', 'sent', 'queued', 'failed', 'pending', 'held') if k in result}), flush=True)
        if result.get('failed', 0) or result.get('held', 0):
            raise RuntimeError('Newsletter delivery requires inspection')
        if not result.get('pending', 0) or not (result.get('sent', 0) + result.get('queued', 0)):
            return result
    return result


if __name__ == '__main__':
    try:
        with open(sys.argv[1], encoding='utf-8') as source:
            run(json.load(source))
    except Exception as error:
        print(json.dumps({'error': type(error).__name__, 'status': getattr(error, 'code', None)}), file=sys.stderr)
        sys.exit(1)
