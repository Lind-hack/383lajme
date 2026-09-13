"""Offline checks for original-source isolation and durable email retries."""
import importlib.util,sys,types,tempfile,os
from pathlib import Path
from unittest.mock import patch,MagicMock

def module(name,file):
    spec=importlib.util.spec_from_file_location(name,Path(__file__).parent/file)
    value=importlib.util.module_from_spec(spec);spec.loader.exec_module(value);return value
mail=module('mail','send-tregu-news-movement.py')
research=module('research','research-tregu-news.py')
move={'slug':'test','question':'<Test>','before_probability':.6,'after_probability':.55,'verified_sources':[{'url':'javascript:bad','title':'bad'},{'url':'https://example.com/news','title':'News'}]}
plain,rich=mail.render({'details':{'email_updates':[move]}})
assert '-5.0000 pp' in plain and '&lt;Test&gt;' in rich and 'javascript:' not in rich
with patch.object(research,'read',return_value={'status':'text_extracted','url':'https://original.example/news','title':'Original','text':'Verified original text. '*100}):
    item=research.original({'url':'https://redirect.example/news','summary':'UNVERIFIED RSS CLAIM','publishedAt':'2026-09-13T10:00:00Z'})
    assert item['source']=='original.example' and 'UNVERIFIED' not in item['excerpt']
assert not research.has_term('Tirana is a city','Iran')
assert research.has_term('EU announcement','EU')
sys.modules['codex_automation_support']=types.SimpleNamespace(load_env=lambda:None)
with tempfile.TemporaryDirectory() as directory, patch.object(mail,'Path',lambda _:Path(directory)), patch.dict(os.environ,{'NEXT_PUBLIC_SUPABASE_URL':'https://example.supabase.co','SUPABASE_SERVICE_ROLE_KEY':'test','GMAIL_USER':'sender@example.com','GMAIL_APP_PASSWORD':'test'}):
    run={'id':'test-run','details':{'email_updates':[move]}}
    response=MagicMock();response.json.return_value=[run]
    with patch.object(mail.requests,'get',return_value=response),patch.object(mail.requests,'patch',return_value=MagicMock()) as saved,patch.object(mail.smtplib,'SMTP_SSL') as smtp:
        smtp.return_value.__enter__.return_value.send_message.side_effect=OSError('SMTP unavailable')
        try:mail.main()
        except OSError:pass
        else:raise AssertionError('Transport failure swallowed')
        saved.assert_not_called()
        smtp.return_value.__enter__.return_value.send_message.side_effect=None
        mail.main()
        assert saved.call_args.kwargs['json']['details']['news_email_delivery']=='sent'
        assert smtp.return_value.__enter__.return_value.send_message.call_args.args[0]['To']=='lindsylqa@gmail.com'
        response.json.return_value=[{'id':'empty','details':{}}]
        smtp.reset_mock();mail.main();smtp.assert_not_called()
print('Research provenance, signed email changes, failure retry and no-change suppression passed')
