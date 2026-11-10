from unittest.mock import patch
import unittest
from news_desk_policy import select_candidates

class DeskAudienceTests(unittest.TestCase):
    def test_local_interest_uses_full_evidence_and_fills_foreign_gaps(self):
        foreign=[dict(url=f'https://nme.com/news/music/story-{i}',category='Showbiz',source='NME',title='New album',published='2026-11-03T22:00:00Z') for i in range(5)]
        local=[dict(url=f'https://anabelmagazine.com/artist-{i}',category='Showbiz',source='Anabel',title='Artist shares a public update',published='2026-11-03T22:00:00Z') for i in range(3)]
        evidence={a['url']:{'text':'A new public statement by Dua Lipa about her next performance.'} for a in local}
        self.assertEqual([a['url'] for a in select_candidates(foreign+local,evidence,limit=5)][:3],['https://anabelmagazine.com/artist-0','https://anabelmagazine.com/artist-1','https://anabelmagazine.com/artist-2'])
        self.assertEqual(len(select_candidates(foreign,evidence,limit=5)),5)

class CandidateIndexTests(unittest.TestCase):
    def test_puzzles_and_duplicate_urls_do_not_displace_new_artist_news(self):
        from datetime import datetime, timezone
        now=datetime.now(timezone.utc)
        rows=[dict(url='https://anabelmagazine.com/puzzle',source='Anabel',category='Showbiz',title='Fjalekryqi i dites',published=now.isoformat()),
              dict(url='https://privebruto.com/update',source='Prive Bruto',category='Showbiz',title='Dua Lipa shares a new concert update',published=now.isoformat()),
              dict(url='https://privebruto.com/update/',source='Prive Bruto',category='Showbiz',title='Dua Lipa shares a new concert update',published=now.isoformat())]
        result=select_candidates(rows,limit=5,now=now)
        self.assertEqual([a['url'] for a in result],['https://privebruto.com/update'])

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
            reserve.store(a,e,receipt,context,now=now,time_sensitive=True)
            self.assertEqual(reserve.available(now=now+timedelta(hours=2)),[])
            bad_e=dict(e,evidence=dict(status='text_extracted'))
            bad_proof=dict(proof,evidence_sha256=digest(bad_e))
            bad_receipt=dict(receipt,articles={'a':bad_proof})
            with self.assertRaisesRegex(ValueError,'complete'):
                reserve.store(a,bad_e,bad_receipt,context,now=now)
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

    def test_quota_during_collection_is_not_reported_as_no_eligible_supply(self):
        import tempfile
        from pathlib import Path
        from news_reliable_desks import run_category
        class Store:
            def available(self):return []
        class Port:
            quota=False
            def quota_hit(self):return self.quota
            def collect(self,attempted):self.quota=True;return []
        with tempfile.TemporaryDirectory() as root:
            result=run_category(Port(),Store(),Path(root)/'outcome.json','Showbiz')
            self.assertEqual(result['status'],'model_quota')
            self.assertEqual(result['shortfall_reasons'],['model_quota'])

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

class PublicationBoundaryTests(unittest.TestCase):
    def test_replaced_remote_image_is_held_even_when_url_is_unchanged(self):
        import hashlib
        from news_approved_reserve import verify_pixels
        article={'image_url':'https://images.example/hero.jpg','image_rights':{'sha256':hashlib.sha256(b'original pixels').hexdigest()}}
        verify_pixels(article,fetcher=lambda url:b'original pixels')
        with self.assertRaisesRegex(ValueError,'pixels'):
            verify_pixels(article,fetcher=lambda url:b'replaced pixels')

    def test_recovery_ownership_uses_run_slot_across_midnight(self):
        import tempfile
        from pathlib import Path
        from news_json_state import atomic
        from news_publication_recovery import delivery_belongs_to_slot
        with tempfile.TemporaryDirectory() as root:
            batch=Path(root)/'2026-11-03T22.json'
            atomic(batch.with_suffix('.delivery-attempt.json'),{'run_slot':'2026-11-03T22'})
            self.assertTrue(delivery_belongs_to_slot(batch,'2026-11-03T22'))
            self.assertFalse(delivery_belongs_to_slot(batch,'2026-11-03T23'))

    def test_crash_after_batch_insert_releases_only_empty_batch_for_retry(self):
        import tempfile
        from pathlib import Path
        from news_publication_recovery import recover_persisted
        changes=[]
        def request(method,table,query):
            if method=='DELETE':changes.append((table,query));return []
            return [] if table=='news_articles' else [{'batch_key':'2026-11-03T22'}]
        with tempfile.TemporaryDirectory() as root:
            batch=Path(root)/'2026-11-03T22.json'
            self.assertIsNone(recover_persisted(batch,{'id':'a'},request=request))
            self.assertEqual(changes,[('news_batches',{'batch_key':'eq.2026-11-03T22'})])

    def test_recovery_uses_persisted_publication_time_after_insert(self):
        import tempfile
        from pathlib import Path
        from unittest.mock import patch
        from news_publication_recovery import recover_persisted
        from news_copyright_review import article_digest
        from test_codex_automation_support import make_article
        from codex_automation_support import _article_row
        from news_batch_identity import batch_key
        original=make_article(1,'Showbiz')
        original['published_at']='2026-11-03T22:00:00Z'
        persisted=dict(original,published_at='2026-11-03T22:18:00Z',source_published_at=original['published_at'])
        persisted['originality_review']={'article_sha256':article_digest(original)}
        with tempfile.TemporaryDirectory() as root:
            batch=Path(root)/'2026-11-03T22.json'
            def request(method,table,query):return [_article_row(persisted,batch_key(batch))]
            recovered=recover_persisted(batch,original,request=request)
            self.assertEqual(recovered[0]['published_at'],'2026-11-03T22:18:00Z')
            persisted['body']='Unapproved replacement'
            with self.assertRaisesRegex(ValueError,'differs'):
                recover_persisted(batch,original,request=request)

class InterruptedApprovalTests(unittest.TestCase):
    def test_restart_recovers_completed_receipts_without_rewriting_copy(self):
        import tempfile
        from pathlib import Path
        from datetime import datetime, timezone
        from news_approved_reserve import Reserve, recover_approvals
        from news_json_state import atomic
        from news_copyright_review import article_digest, digest, POLICY, CHECKS
        now=datetime.now(timezone.utc)
        a=dict(slug='a',url='https://anabelmagazine.com/a',title='Dua Lipa shares news',body='Independent prose',category='Showbiz',published_at=now.isoformat(),image_rights=dict(sha256='a'*64))
        e=dict(slug='a',evidence=dict(status='text_extracted',published=now.isoformat()))
        proof=dict(article_sha256=article_digest(a),evidence_sha256=digest(e),decision=dict(verdict='approve',checks=dict.fromkeys(CHECKS,True),reason='Independent composition and all factual claims are supported.'))
        receipt=dict(policy=POLICY,model='gpt-6-luna',provider='openai-codex',reviewed_at=now.isoformat(),articles={'a':proof})
        context=dict(policy='383-event-context-v2',model='gpt-6-luna',provider='openai-codex',reviewed_at=now.isoformat(),history={},articles={'a':dict(article_sha256=article_digest(a),decisions=[dict(verdict='distinct')])})
        with tempfile.TemporaryDirectory() as root:
            root=Path(root)
            batch=root/'run'/'wave-1'/'draft-0'/'2026-11-03T22.json'
            atomic(batch,[a]);atomic(batch.with_suffix('.editor-sources.json'),[e])
            atomic(batch.with_suffix('.copyright-review.json'),receipt)
            atomic(batch.with_suffix('.context-review.json'),context)
            reserve=Reserve(root/'reserve','Showbiz')
            self.assertEqual(recover_approvals(root,reserve),1)
            self.assertEqual(reserve.available()[0]['article']['body'],'Independent prose')

class ProductionCollectionTests(unittest.TestCase):
    def test_source_photo_capture_is_not_reported_as_a_full_article_page(self):
        import tempfile,subprocess,json
        from pathlib import Path
        from contextlib import chdir
        from unittest.mock import patch
        from datetime import datetime,timezone
        from news_reliable_desks import ProductionPort
        from news_approved_reserve import Reserve
        from news_json_state import atomic
        now=datetime.now(timezone.utc)
        lead=dict(url='https://consequence.net/2026/11/artist-update/',source='Consequence',category='Showbiz',title='Dua Lipa announces a concert',published=now.isoformat())
        with tempfile.TemporaryDirectory() as temp,chdir(temp):
            root=Path(temp)
            def external_command(*args,**kwargs):
                atomic(root/'.last30days/cloud-news-discovery-current.json',{'leads':[lead],'raw_leads':[lead],'retrieved_evidence':{lead['url']:{'status':'text_extracted','text':'Dua Lipa announces a new performance.','image_url':'https://images.example/photo.jpg'}}})
                atomic(root/'.last30days/showbiz-review/review.json',{'summary':{},'articles':[{'url':lead['url'],'status':'reviewed','capture':{'visual_evidence_kind':'source_article_image','full_screenshot':'source-photo.png','visual_page_complete':False}}]})
                return subprocess.CompletedProcess(args,0)
            port=ProductionPort('Showbiz',Reserve(root/'reserve','Showbiz'),root/'run',now.timestamp()+3000,qa=True)
            with patch('subprocess.run',side_effect=external_command):
                self.assertEqual(len(port.collect(set())),1)
            self.assertEqual(port.metrics['visual_review']['article_pages_captured'],0)
            self.assertEqual(port.metrics['visual_review']['new_evals'],1)

class EditorRejectionTests(unittest.TestCase):
    def test_a_story_the_editor_drops_is_a_review_rejection_on_every_desk(self):
        import tempfile,json
        from pathlib import Path
        from datetime import datetime,timezone
        from unittest.mock import patch
        from news_reliable_desks import ProductionPort
        from news_approved_reserve import Reserve
        from news_json_state import atomic
        for category in ('Showbiz','Ekonomi'):
            with tempfile.TemporaryDirectory() as temp,patch('builtins.print'):
                root=Path(temp)
                port=ProductionPort(category,Reserve(root/'reserve',category),root/'run',datetime.now(timezone.utc).timestamp()+3000,qa=True)
                port.data={};calls=[];batch=[]
                def python(script,*args,**kwargs):
                    calls.append(script)
                    if script=='prepare_editor_sources.py' and '--discovery' in args:
                        atomic(Path(args[0]).with_suffix('.json'),dict(ready_leads=[dict(url='https://www.cnbc.com/2026/11/09/test.html',source='CNBC')]))
                    if script=='editor_completion.py':raise RuntimeError('No receipt for a rejected draft')
                def command(args,**kwargs):
                    if '--batch' in args:
                        target=Path(args[args.index('--batch')+1]);batch.append(target);atomic(target,[dict(url='https://www.cnbc.com/2026/11/09/test.html')])
                    else:atomic(batch[0],[])
                with patch.object(port,'python',side_effect=python),patch.object(port,'command',side_effect=command):
                    self.assertEqual(list(port.produce([],5)),[])
                self.assertNotIn('editor_completion.py',calls,category)
                self.assertEqual(port.metrics['failure_reasons'],['review_rejection'],category)

class RefusedDraftTests(unittest.TestCase):
    URL='https://www.cnbc.com/2026/11/09/test.html'

    def run_story(self,refusals):
        """One ready story whose originality review refuses the first `refusals` drafts."""
        import tempfile,json
        from pathlib import Path
        from datetime import datetime,timezone
        from unittest.mock import patch
        from news_reliable_desks import ProductionPort
        from news_approved_reserve import Reserve
        from news_json_state import atomic
        with tempfile.TemporaryDirectory() as temp,patch('builtins.print'):
            root=Path(temp)
            port=ProductionPort('Ekonomi',Reserve(root/'reserve','Ekonomi'),root/'run',datetime.now(timezone.utc).timestamp()+3000,qa=True)
            port.data={};prompts=[];feedback=[];reviews=[]
            article=dict(url=self.URL,slug='test',title='Titull',body='<p>Tekst.</p>',source='CNBC')
            def python(script,*args,**kwargs):
                if script=='prepare_editor_sources.py' and '--discovery' in args:
                    atomic(Path(args[0]).with_suffix('.json'),dict(ready_leads=[dict(url=self.URL,source='CNBC')]))
                elif script=='prepare_editor_sources.py':
                    atomic(Path(args[0]).with_suffix('.editor-sources.json'),[dict(slug='test',evidence=dict(text='Other words entirely.'))])
                elif script=='news_copyright_review.py':
                    batch=Path(args[1]);reviews.append(batch)
                    if len(reviews)<=refusals:
                        atomic(Path(kwargs['env']['L383_REVIEW_REJECTED']),[dict(article,rejection_reason='The lead translates the source sentence.')])
                        atomic(batch,[])
                    else:
                        atomic(batch.with_suffix('.copyright-review.json'),dict(reviewed_at=datetime.now(timezone.utc).isoformat()))
                        atomic(batch.with_suffix('.context-review.json'),{})
            def command(args,**kwargs):
                if '--batch' in args:
                    prompts.append(args[-1]);atomic(Path(args[args.index('--batch')+1]),[dict(article)])
                else:feedback.append((kwargs.get('env') or {}).get('L383_EDITOR_GATE_FEEDBACK'))
            with patch.object(port,'python',side_effect=python),patch.object(port,'command',side_effect=command), \
                    patch('codex_automation_support._recently_published',return_value=[]), \
                    patch('news_context_review.review'),patch('news_context_review.verify'), \
                    patch('news_copyright_review.validate_for_publication'), \
                    patch.object(port.reserve,'store',side_effect=lambda article,*a,**k:dict(article=article)):
                entries=list(port.produce([],5))
            return entries,prompts,port.metrics,feedback

    def test_a_refused_draft_is_composed_once_more_with_the_named_defect(self):
        entries,prompts,metrics,_=self.run_story(1)
        self.assertEqual(len(entries),1)
        self.assertEqual(len(prompts),2)
        self.assertNotIn('Refusal:',prompts[0])
        self.assertIn('The lead translates the source sentence.',prompts[1])
        self.assertEqual(metrics['rewrites'],1)
        self.assertEqual(metrics['approvals'],1)
        self.assertNotIn('failure_reasons',metrics)

    def test_a_second_refusal_ends_the_story_and_is_named(self):
        entries,prompts,metrics,_=self.run_story(2)
        self.assertEqual(entries,[])
        self.assertEqual(len(prompts),2)
        self.assertEqual(metrics['failure_reasons'],['originality_rejection'])

    def test_a_writer_that_declines_the_story_is_reported_as_that(self):
        import tempfile
        from pathlib import Path
        from datetime import datetime,timezone
        from unittest.mock import patch
        from news_reliable_desks import ProductionPort
        from news_approved_reserve import Reserve
        from news_json_state import atomic
        with tempfile.TemporaryDirectory() as temp,patch('builtins.print'):
            root=Path(temp)
            port=ProductionPort('Botë',Reserve(root/'reserve','Botë'),root/'run',datetime.now(timezone.utc).timestamp()+3000,qa=True)
            port.data={}
            def python(script,*args,**kwargs):
                if script=='prepare_editor_sources.py' and '--discovery' in args:
                    atomic(Path(args[0]).with_suffix('.json'),dict(ready_leads=[dict(url=self.URL,source='CNBC')]))
            def command(args,**kwargs):
                raise RuntimeError('news_model_response.py: exit 3')
            with patch.object(port,'python',side_effect=python),patch.object(port,'command',side_effect=command):
                self.assertEqual(list(port.produce([],5)),[])
            self.assertEqual(port.metrics['failure_reasons'],['writer_declined'])

    def test_an_approved_draft_is_not_rewritten(self):
        entries,prompts,metrics,_=self.run_story(0)
        self.assertEqual(len(entries),1)
        self.assertEqual(len(prompts),1)
        self.assertNotIn('rewrites',metrics)

    def test_the_editor_is_told_what_the_publication_gates_would_refuse(self):
        from unittest.mock import patch
        with patch('originality_gate.originality_errors',return_value=['body contains an exact source overlap of 8 words']):
            _,_,_,feedback=self.run_story(0)
        self.assertIn('exact source overlap of 8 words',feedback[0])

class SiblingStoryTests(unittest.TestCase):
    BODY='Inflacioni vjetor arriti ne 3.4 perqind ne tetor sipas institutit te statistikave, i shtyre nga cmimet e ushqimeve, transportit dhe qirave ne gjithe vendin gjate muajit te kaluar.'
    def story(self,url,body=None,title='Inflacioni arrin 3.4% ne tetor'):
        return dict(url=url,slug=url[-1],title=title,excerpt='',body=body or self.BODY,image_subject='')

    def test_the_same_event_from_two_publishers_is_recognised_and_other_stories_are_not(self):
        from news_reliable_desks import repeats_sibling
        first=self.story('https://monitor.al/a')
        again=self.story('https://scantv.al/b',self.BODY.replace('sipas institutit te statistikave','njoftoi instituti'),'Inflacioni ne Shqiperi ngjitet ne 3.4%')
        other=self.story('https://monitor.al/c','Punonjesit e hekurudhave hyne ne greve dhe nderprene qarkullimin e trenave te udhetareve ne te gjitha linjat, duke kerkuar indeksimin e pagave per cdo kategori te punesuarish.','Greva ndal trenat')
        self.assertTrue(repeats_sibling(again,[first]))
        self.assertFalse(repeats_sibling(other,[first]))
        self.assertFalse(repeats_sibling(first,[first]))

    def test_a_second_story_about_one_event_is_not_delivered_in_the_same_run(self):
        import tempfile
        from pathlib import Path
        from news_reliable_desks import run_category
        entries=[{'article':self.story('https://monitor.al/a')},
                 {'article':self.story('https://scantv.al/b',title='Inflacioni ne Shqiperi ngjitet ne 3.4%')}]
        class Store:
            def __init__(self):self.entries=[];self.confirmed=[]
            def available(self):return list(self.entries)
            def confirm(self,e):self.confirmed.append(e);self.entries.remove(e)
        store=Store();delivered=[]
        class Port:
            done=False
            def quota_hit(self):return False
            def collect(self,attempted):
                if self.done:return []
                self.done=True;return [{'url':e['article']['url']} for e in entries]
            def produce(self,leads,remaining):
                for entry in entries:
                    store.entries.append(entry);yield entry
            def publish(self,entry):
                delivered.append(entry['article']['url']);return {'batch':'x.json','articles':[],'dry_run':True}
        with tempfile.TemporaryDirectory() as root,patch('builtins.print'):
            result=run_category(Port(),store,Path(root)/'outcome.json','Ekonomi')
        self.assertEqual(delivered,['https://monitor.al/a'])
        self.assertEqual(result['qa_approved'],1)
        self.assertIn('duplicate_story_this_run',result['shortfall_reasons'])

if __name__=='__main__':unittest.main()
