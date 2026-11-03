import unittest
from news_desk_policy import select_candidates

class DeskAudienceTests(unittest.TestCase):
    def test_local_interest_uses_full_evidence_and_fills_foreign_gaps(self):
        foreign=[dict(url=f'f{i}',category='Showbiz',source='NME',title='New album',published='2026-11-03T22:00:00Z') for i in range(5)]
        local=[dict(url=f'l{i}',category='Showbiz',source='Anabel',title='Artist shares a public update',published='2026-11-03T22:00:00Z') for i in range(3)]
        evidence={a['url']:{'text':'A new public statement by Dua Lipa about her next performance.'} for a in local}
        self.assertEqual([a['url'] for a in select_candidates(foreign+local,evidence,limit=5)][:3],['l0','l1','l2'])
        self.assertEqual(len(select_candidates(foreign,evidence,limit=5)),5)

class EligibilityTests(unittest.TestCase):
    def test_supported_four_point_story_is_considered(self):
        from datetime import datetime, timezone
        from news_story_review import validate_verdict
        now=datetime.now(timezone.utc)
        lead=dict(url='https://consequence.net/2026/11/new-album/',category='Showbiz',published=now.isoformat())
        row=dict(decision='consider',score=4,reason='A new public artist update.',new_development='New album announced.',audience_fit='Entertainment readers.',breaking='fresh_development',same_event_urls=[])
        result=validate_verdict([row],lead,[],dict(evidence={},screenshot_sha256='a'*64),now)
        self.assertEqual(result['decision'],'consider')

class ReserveTests(unittest.TestCase):
    def test_expiry_and_copy_changes_block_reserve_without_consuming_it(self):
        import tempfile
        from datetime import datetime, timedelta, timezone
        from pathlib import Path
        from news_approved_reserve import Reserve
        from news_copyright_review import article_digest, digest, POLICY, CHECKS
        now=datetime.now(timezone.utc)
        a=dict(slug='a',url='https://anabelmagazine.com/a',title='Dua Lipa shares news',body='Independent prose',category='Showbiz',published_at=now.isoformat(),image_rights=dict(sha256='a'*64))
        e=dict(slug='a',evidence=dict(status='text_extracted',published=now.isoformat()))
        proof=dict(article_sha256=article_digest(a),evidence_sha256=digest(e),decision=dict(verdict='approve',checks=dict.fromkeys(CHECKS,True),reason='Independent composition and all factual claims are supported.'))
        receipt=dict(policy=POLICY,model='gpt-6-luna',provider='openai-codex',reviewed_at=now.isoformat(),articles={'a':proof})
        with tempfile.TemporaryDirectory() as root:
            reserve=Reserve(Path(root),'Showbiz')
            context=dict(policy='383-event-context-v2',model='gpt-6-luna',provider='openai-codex',reviewed_at=now.isoformat(),history={},articles={'a':dict(article_sha256=article_digest(a),decisions=[dict(verdict='distinct')])})
            reserve.store(a,e,receipt,context,now=now)
            self.assertEqual(len(reserve.available(now=now)),1)
            self.assertEqual(reserve.available(now=now+timedelta(hours=7)),[])
            self.assertEqual(len(reserve.available(now=now)),1)
            entry=reserve.available(now=now)[0];entry['article']['body']='Changed copy'
            self.assertFalse(reserve.valid(entry,now=now))

class ReliableRunTests(unittest.TestCase):
    def test_quota_after_approval_still_publishes_completed_work(self):
        import tempfile
        from pathlib import Path
        from news_reliable_desks import run_category
        class Store:
            def __init__(self):self.entries=[];self.confirmed=[]
            def available(self):return list(self.entries)
            def confirm(self,e):self.confirmed.append(e);self.entries.remove(e)
        store=Store()
        class Port:
            quota=False
            def quota_hit(self):return self.quota
            def collect(self,attempted):return [{'url':'a'},{'url':'b'}]
            def produce(self,leads,remaining):
                entry={'article':{'url':'a','slug':'a'}};store.entries.append(entry)
                yield entry
                self.quota=True
                raise RuntimeError('account exhausted')
            def publish(self,entry):return {'batch':'a.json','articles':[entry['article']]}
        with tempfile.TemporaryDirectory() as root:
            result=run_category(Port(),store,Path(root)/'outcome.json','Showbiz')
            self.assertEqual(result['published_count'],1)
            self.assertEqual(result['reserve_used'],0)
            self.assertIn('model_quota',result['shortfall_reasons'])
            self.assertEqual(len(store.confirmed),1)

class PhotoCacheTests(unittest.TestCase):
    def test_changed_pixels_or_story_context_need_new_review(self):
        import tempfile
        from pathlib import Path
        from news_photo_fit_cache import PhotoFitCache
        with tempfile.TemporaryDirectory() as root:
            cache=PhotoFitCache(Path(root)/'photos.json')
            context={'title':'Dua Lipa performs','text':'A new concert','pixels':['a'*64]}
            cache.save(context,[0],{'0':{'image_sha256':'a'*64}})
            self.assertEqual(cache.get(context)['picks'],[0])
            self.assertIsNone(cache.get(dict(context,pixels=['b'*64])))
            self.assertIsNone(cache.get(dict(context,text='A different event')))

class RunRecoveryTests(unittest.TestCase):
    def test_failed_readback_retains_approval_and_successful_retry_does_not_duplicate(self):
        import tempfile
        from pathlib import Path
        from news_reliable_desks import run_category
        entry={'article':{'url':'a','slug':'a'}}
        class Store:
            def __init__(self):self.entries=[entry]
            def available(self):return list(self.entries)
            def confirm(self,e):self.entries.remove(e)
        class Port:
            fail=True
            def quota_hit(self):return True
            def publish(self,e):
                if self.fail:raise RuntimeError('readback unavailable')
                return {'batch':'a.json','articles':[e['article']]}
        store=Store();port=Port()
        with tempfile.TemporaryDirectory() as root:
            path=Path(root)/'outcome.json'
            first=run_category(port,store,path,'Showbiz')
            self.assertEqual(first['published_count'],0)
            self.assertEqual(len(store.entries),1)
            port.fail=False
            second=run_category(port,store,path,'Showbiz')
            self.assertEqual(second['published_count'],1)
            third=run_category(port,store,path,'Showbiz')
            self.assertEqual(third['published_count'],1)
            self.assertEqual(store.entries,[])

    def test_qa_never_consumes_an_approval(self):
        import tempfile
        from pathlib import Path
        from news_reliable_desks import run_category
        entry={'article':{'url':'a','slug':'a'}}
        class Store:
            def available(self):return [entry]
            def confirm(self,e):raise AssertionError('QA consumed a reserve')
        class Port:
            qa=True
            def quota_hit(self):return True
            def publish(self,e):return {'batch':'a.json','articles':[],'dry_run':True}
        with tempfile.TemporaryDirectory() as root:
            result=run_category(Port(),Store(),Path(root)/'outcome.json','Showbiz')
            self.assertEqual(result['published_count'],0)
            self.assertEqual(result['status'],'qa_complete')

    def test_each_approved_story_has_an_independent_idempotent_batch_key(self):
        import os
        from pathlib import Path
        from unittest.mock import patch
        from news_batch_identity import batch_key
        with patch.dict(os.environ,{'L383_RUN_DESK':'showbiz'}):
            a=batch_key(Path('approved')/('a'*24)/'2026-11-03T22.json')
            b=batch_key(Path('approved')/('b'*24)/'2026-11-03T22.json')
            self.assertNotEqual(a,b)
            self.assertEqual(a,batch_key(Path('approved')/('a'*24)/'2026-11-03T22.json'))

if __name__=='__main__':unittest.main()
