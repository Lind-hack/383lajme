"""Explicit production QA: one newly created account, at most one free 383 Coin.
Never uses an existing user's account or a service-role trading request.
"""
import base64, json, pathlib, secrets, urllib.request, urllib.error, urllib.parse

env = {}
for line in pathlib.Path('/opt/data/workspaces/383lajme-prod-f731569/.env.automation').read_text().splitlines():
    if '=' in line and not line.lstrip().startswith('#'):
        key, value = line.split('=', 1)
        env[key.strip()] = value.strip().strip('"').strip("'")
base = env['NEXT_PUBLIC_SUPABASE_URL'].rstrip('/')
service = env['SUPABASE_SERVICE_ROLE_KEY']
site = env.get('TREGU_AUTOMATION_URL', 'https://383lajme.vercel.app').rstrip('/')
headers = {'apikey': service, 'Authorization': 'Bearer ' + service, 'Content-Type': 'application/json'}

def request(url, method='GET', body=None, request_headers=None):
    req = urllib.request.Request(url, data=None if body is None else json.dumps(body).encode(), method=method, headers=request_headers or headers)
    try:
        with urllib.request.urlopen(req, timeout=35) as response:
            data = response.read()
            return json.loads(data) if data else None
    except urllib.error.HTTPError as error:
        raise RuntimeError('QA request failed with HTTP ' + str(error.code)) from None

markets = request(base + '/rest/v1/markets?select=id,slug&status=eq.open&market_type=eq.binary&market_classification=eq.general_news&closes_at=gt.now()&limit=1')
if not markets:
    raise SystemExit('No eligible existing news market for authenticated QA')
market = markets[0]
password = secrets.token_urlsafe(36)
email = 'tregu-qa-' + secrets.token_hex(8) + '@example.invalid'
recovery = pathlib.Path('/tmp/tregu-auth-qa-recovery.json')
if recovery.exists(): raise SystemExit('Resolve the existing QA recovery file before creating another account')
user = request(base + '/auth/v1/admin/users', 'POST', {'email': email, 'password': password, 'email_confirm': True, 'user_metadata': {'display_name': 'Tregu QA'}})
uid = user['id']
recovery.touch(mode=0o600, exist_ok=False)
recovery.write_text(json.dumps({'user_id':uid,'email':email,'password':password,'market_id':market['id']}))
holding = False
try:
    session = request(base + '/auth/v1/token?grant_type=password', 'POST', {'email':email,'password':password})
    claims = json.loads(base64.urlsafe_b64decode(session['access_token'].split('.')[1] + '=='))
    if claims.get('role') != 'authenticated':
        raise RuntimeError('QA must use authenticated JWT')
    ref = urllib.parse.urlparse(base).hostname.split('.')[0]
    value = 'base64-' + base64.urlsafe_b64encode(json.dumps(session,separators=(',',':')).encode()).decode().rstrip('=')
    chunks = [value[i:i+3180] for i in range(0,len(value),3180)]
    cookie = '; '.join('sb-'+ref+'-auth-token'+('' if len(chunks)==1 else '.'+str(i))+'='+chunk for i,chunk in enumerate(chunks))
    web_headers = {'Cookie':cookie,'Content-Type':'application/json','Origin':site}
    holding = True  # An interrupted request may still have committed the buy.
    bought = request(site + '/api/tregu/bet','POST',{'marketId':market['id'],'side':'PO','coins':1},web_headers)
    holding = bool(bought.get('ok'))
    if not holding: raise RuntimeError('Buy did not confirm')
    preview = request(site + '/api/tregu/sell','POST',{'marketId':market['id'],'side':'PO','preview':True},web_headers)
    if not preview.get('ok'): raise RuntimeError('Sell preview did not confirm')
    sold = request(site + '/api/tregu/sell','POST',{'marketId':market['id'],'side':'PO','sellAll':True},web_headers)
    if not sold.get('ok'): raise RuntimeError('Sell did not confirm')
    remaining = request(base + '/rest/v1/positions?select=shares&user_id=eq.'+uid+'&market_id=eq.'+market['id'])
    if any(float(row['shares']) > 0.000001 for row in remaining): raise RuntimeError('QA position remains')
    holding = False
    print(json.dumps({'ok':True,'market':market['slug'],'role':claims['role'],'buy_coins':1,'sell_preview':True,'sold_all':True,'remaining_positions':0}))
finally:
    if not holding:
        request(base + '/auth/v1/admin/users/' + uid,'DELETE')
        recovery.unlink()
    else:
        print(json.dumps({'recovery_required':True,'user_id':uid,'credentials_file':str(recovery)}))
