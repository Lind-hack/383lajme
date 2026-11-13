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
    def test_retired_france24_extraction_cannot_enter_approved_reserves(self):
        import tempfile
        from pathlib import Path
        from datetime import datetime,timezone
        from news_approved_reserve import Reserve
        from news_copyright_review import article_digest,digest,POLICY,CHECKS
        now=datetime.now(timezone.utc).isoformat()
        article=dict(id='f24',slug='f24',category='Botë',url='https://www.france24.com/en/video/20261112-summit',
                     body='Independently composed article.',image_rights=dict(sha256='a'*64))
        evidence=dict(slug='f24',source_url=article['url'],evidence=dict(url=article['url'],status='text_extracted',published=now,
            text='To display this content from YouTube, you must enable advertisement tracking and audience measurement.'))
        proof=dict(article_sha256=article_digest(article),evidence_sha256=digest(evidence),decision=dict(verdict='approve',checks=dict.fromkeys(CHECKS,True),reason='Independent supported factual reporting.'))
        receipt=dict(policy=POLICY,model='gpt-6-luna',provider='openai-codex',reviewed_at=now,articles={'f24':proof})
        context=dict(policy='383-event-context-v2',model='gpt-6-luna',provider='openai-codex',reviewed_at=now,history={},articles={'f24':dict(article_sha256=article_digest(article),decisions=[dict(verdict='distinct')])})
        with tempfile.TemporaryDirectory() as root:
            with self.assertRaisesRegex(ValueError,'source_extraction_policy_stale'):
                Reserve(Path(root),'Botë').store(article,evidence,receipt,context)
            stale=evidence['evidence']
            article['url']='https://www.bbc.com/news/world-update'
            evidence.update(source_url=article['url'],evidence=dict(url=article['url'],status='text_extracted',published=now),
                            corroborating=[dict(url=stale['url'],evidence=stale)])
            proof.update(article_sha256=article_digest(article),evidence_sha256=digest(evidence))
            context['articles']['f24']['article_sha256']=article_digest(article)
            with self.assertRaisesRegex(ValueError,'source_extraction_policy_stale'):
                Reserve(Path(root),'Botë').store(article,evidence,receipt,context)


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

    def test_a_publisher_date_without_a_zone_is_accepted_and_a_refusal_names_its_check(self):
        # 11 Nov 2026: an approved Economy story was thrown away after its three reviews because
        # the publisher wrote "2026-11-11T12:15:46" with no zone, and the refusal gave no reason.
        import tempfile
        from datetime import datetime, timezone
        from pathlib import Path
        from news_approved_reserve import Reserve, source_age
        from news_copyright_review import article_digest, digest, POLICY, CHECKS
        now=datetime(2026,11,11,14,35,tzinfo=timezone.utc)
        self.assertEqual(source_age('2026-11-11T12:15:46',now),8354)
        self.assertEqual(source_age('2026-11-11T15:35:00',now),0)  # local time one hour ahead of UTC
        self.assertEqual(source_age('2026-11-11T12:15:46+01:00',now),8354+3600)
        self.assertEqual(source_age('',now),float('inf'))
        def stored(published):
            a=dict(slug='a',url='https://decrypt.co/a',title='Nvidia bie',body='Independent prose',category='Ekonomi',published_at=now.isoformat(),image_rights=dict(sha256='a'*64))
            e=dict(slug='a',evidence=dict(status='text_extracted',published=published))
            proof=dict(article_sha256=article_digest(a),evidence_sha256=digest(e),decision=dict(verdict='approve',checks=dict.fromkeys(CHECKS,True),reason='Independent composition and all factual claims are supported.'))
            receipt=dict(policy=POLICY,model='gpt-6-luna',provider='openai-codex',reviewed_at=now.isoformat(),articles={'a':proof})
            context=dict(policy='383-event-context-v2',model='gpt-6-luna',provider='openai-codex',reviewed_at=now.isoformat(),history={},articles={'a':dict(article_sha256=article_digest(a),decisions=[dict(verdict='distinct')])})
            with tempfile.TemporaryDirectory() as root:
                reserve=Reserve(Path(root),'Ekonomi')
                reserve.store(a,e,receipt,context,now=now)
                return len(reserve.available(now=now))
        self.assertEqual(stored('2026-11-11T12:15:46'),1)
        with self.assertRaisesRegex(ValueError,'source_older_than_24h_or_undated'):
            stored('2026-11-09T12:15:46')

class ParallelDeskTests(unittest.TestCase):
    def test_showbiz_and_economy_write_their_ready_stories_side_by_side(self):
        # One Luna story takes about ten minutes; one after another gave a desk one story an hour.
        import json, tempfile, threading
        from datetime import datetime, timezone
        from pathlib import Path
        from unittest.mock import patch
        from news_reliable_desks import ProductionPort
        from news_approved_reserve import Reserve
        from news_json_state import atomic
        for category in ('Showbiz','Ekonomi'):
            leads=[dict(url=f'https://example.com/{i}',source='Example') for i in range(3)]
            together=threading.Barrier(3)
            with self.subTest(category=category), tempfile.TemporaryDirectory() as temp:
                root=Path(temp)
                reserve=Reserve(root/'reserve',category)
                port=ProductionPort(category,reserve,root/'run',datetime.now(timezone.utc).timestamp()+3000,qa=True)
                port.data={}
                seen=[]
                def command(script,*args,**kwargs):
                    if script=='prepare_editor_sources.py':
                        atomic(Path(args[0]).with_suffix('.json'),dict(ready_leads=leads))
                    elif script=='news_world_story_worker.py':
                        job=json.loads(Path(args[0]).read_text(encoding='utf-8'))
                        seen.append(job['category'])
                        together.wait(timeout=5)  # fails unless all three run at once
                        atomic(args[1],dict(entries=[dict(article=job['lead'])],metrics=dict(saved_drafts=1,approvals=1,rewrites=1)))
                    else:
                        raise AssertionError('a serial writer was started: '+script)
                with patch.object(port,'python',side_effect=command),patch.object(reserve,'valid',return_value=True):
                    entries=list(port.produce(leads,5))
                self.assertEqual(len(entries),3)
                self.assertEqual(seen,[category]*3)
                self.assertEqual((port.metrics['saved_drafts'],port.metrics['approvals'],port.metrics['rewrites']),(3,3,3))

    def test_the_worker_builds_its_desk_from_the_job(self):
        import tempfile
        from pathlib import Path
        from unittest.mock import patch
        from news_json_state import atomic
        import news_world_story_worker
        made=[]
        class Port:
            metrics={}
            def __init__(self,category,reserve,*rest):made.append((category,reserve.category))
            def write_ready(self,*args,**kwargs):return iter(())
        with tempfile.TemporaryDirectory() as temp:
            with patch.object(news_world_story_worker,'ProductionPort',Port), patch('codex_automation_support.load_env'):
                for category in ('Ekonomi',None):
                    job=dict(lead={},data={},work=temp+'/w',evidence_folder=temp,reserve_root=temp,deadline=0,qa=True)
                    if category:job['category']=category
                    atomic(Path(temp)/'job.json',job)
                    news_world_story_worker.run(str(Path(temp)/'job.json'),Path(temp)/'out.json')
        self.assertEqual(made,[('Ekonomi','Ekonomi'),('Botë','Botë')])

    def test_luna_is_given_the_time_it_was_measured_to_need(self):
        import news_reliable_desks as desks
        self.assertGreaterEqual(desks.WRITER_SECONDS,360)       # drafts took up to 3+ minutes
        self.assertGreaterEqual(desks.EDITOR_SECONDS,540)       # the editor took up to 5.5
        self.assertGreaterEqual(desks.ORIGINALITY_SECONDS,360)
        self.assertLess(desks.WRITER_SECONDS+desks.EDITOR_SECONDS+desks.ORIGINALITY_SECONDS,3000)

    def test_a_story_is_not_started_when_the_hour_cannot_finish_it(self):
        import tempfile, time
        from pathlib import Path
        from unittest.mock import patch
        from news_reliable_desks import ProductionPort
        from news_approved_reserve import Reserve
        with tempfile.TemporaryDirectory() as temp:
            root=Path(temp)
            port=ProductionPort('Showbiz',Reserve(root/'reserve','Showbiz'),root/'run',time.time()+120,qa=True)
            with patch.object(port,'python',side_effect=AssertionError('started')),patch.object(port,'command',side_effect=AssertionError('started')):
                self.assertEqual(list(port.write_ready([dict(url='https://example.com/a')],{},root,1)),[])
            self.assertIn('deadline',port.metrics['failure_reasons'])


class WireTurnTests(unittest.TestCase):
    def test_a_wire_agency_gets_three_turns_per_round_on_world(self):
        from datetime import datetime, timezone
        from news_desk_policy import select_candidates
        now=datetime(2026,11,11,12,tzinfo=timezone.utc)
        def lead(source,domain,n):
            return dict(url=f'https://{domain}/story-{n}',source=source,category='Botë',title=f'{source} story {n}',
                        summary='A government announced a decision.',published=now.isoformat())
        leads=[lead('AP News','apnews.com',n) for n in range(6)]+[lead('DW','dw.com',n) for n in range(6)]+[lead('BBC World','bbc.com',n) for n in range(6)]
        first=[row['source'] for row in select_candidates(leads,{},limit=5,now=now)]
        self.assertEqual(first.count('AP News'),3)
        self.assertEqual({first.count('DW'),first.count('BBC World')},{1})
        everything=select_candidates(leads,{},limit=18,now=now)
        self.assertEqual(len({row['url'] for row in everything}),18)


class ReliableRunTests(unittest.TestCase):
    def test_unfinished_visual_evaluations_are_a_pipeline_failure_not_no_news(self):
        import tempfile
        from pathlib import Path
        from news_reliable_desks import run_category
        class Store:
            def available(self):return []
        class Port:
            metrics={'visual_review':{'articles_awaiting_review':12}}
            def quota_hit(self):return False
            def collect(self,attempted):return []
        with tempfile.TemporaryDirectory() as root:
            result=run_category(Port(),Store(),Path(root)/'outcome.json','Botë')
        self.assertEqual(result['status'],'failed')
        self.assertIn('review_incomplete',result['shortfall_reasons'])

    def test_outcome_identifies_release_and_stand_in_validation_honestly(self):
        import tempfile,os
        from pathlib import Path
        from news_reliable_desks import run_category
        class Store:
            def available(self):return []
        class Port:
            qa=True
            def quota_hit(self):return False
            def collect(self,attempted):return []
        with tempfile.TemporaryDirectory() as root,patch.dict(os.environ,{
                'L383_RELEASE_SHA':'a'*40,'L383_EVAL_MODEL':'gemini-test','L383_MODEL_TEST_PROFILE':'functional-test'}):
            result=run_category(Port(),Store(),Path(root)/'outcome.json','Botë')
        self.assertEqual(result['release_sha'],'a'*40)
        self.assertEqual(result['model_profile']['actual_model'],'gemini-test')
        self.assertFalse(result['model_profile']['luna_throughput_evidence'])
        self.assertFalse(result['publication_enabled'])

    def test_three_confirmed_world_articles_meet_the_minimum_but_not_five_target(self):
        import tempfile
        from pathlib import Path
        from news_reliable_desks import run_category
        titles=['BE miraton procedurat kufitare', 'Japonia hap hekurudhën e rindërtuar', 'Brazili shpall rezervatin detar']
        class Store:
            def __init__(self):
                self.entries=[dict(article=dict(url=f'https://www.bbc.com/news/event-{i}',slug=f'event-{i}',title=title)) for i,title in enumerate(titles)]
            def available(self):return list(self.entries)
            def confirm(self,entry):self.entries.remove(entry)
        class Port:
            def quota_hit(self):return False
            def collect(self,attempted):return []
            def publish(self,entry):return dict(batch=entry['article']['slug']+'.json',articles=[entry['article']])
        with tempfile.TemporaryDirectory() as root:
            result=run_category(Port(),Store(),Path(root)/'outcome.json','Botë')
        self.assertEqual(result['published_count'],3)
        self.assertEqual(result['minimum_count'],3)
        self.assertTrue(result['minimum_met'])
        self.assertEqual(result['target_count'],5)
        self.assertFalse(result['target_met'])

    def test_failed_recovery_is_not_selected_again_in_the_same_run(self):
        import tempfile
        from pathlib import Path
        from news_reliable_desks import run_category
        class Store:
            def available(self):return []
        class Port:
            attempted_recoveries=set()
            def quota_hit(self):return False
            def resume_incomplete(self,remaining):
                self.attempted_recoveries.add('https://example.com/declined')
                return iter(())
            def collect(self,attempted):
                self.seen=attempted
                return []
        port=Port()
        with tempfile.TemporaryDirectory() as root:
            run_category(port,Store(),Path(root)/'outcome.json','Showbiz')
        self.assertIn('https://example.com/declined',port.seen)

    def test_quota_while_resuming_still_finalizes_confirmed_work(self):
        import tempfile
        from pathlib import Path
        from news_reliable_desks import run_category
        class Store:
            def __init__(self):self.entries=[]
            def available(self):return list(self.entries)
            def confirm(self,e):self.entries.remove(e)
        store=Store()
        class Port:
            quota=False
            def quota_hit(self):return self.quota
            def resume_incomplete(self,remaining):
                entry={'article':{'url':'a','slug':'a'}};store.entries.append(entry)
                yield entry
                self.quota=True
                raise RuntimeError('account exhausted')
            def collect(self,attempted):raise AssertionError('quota must stop discovery')
            def publish(self,entry):return {'batch':'a.json','articles':[entry['article']]}
        with tempfile.TemporaryDirectory() as root:
            result=run_category(Port(),store,Path(root)/'outcome.json','Showbiz')
        self.assertEqual(result['published_count'],1)
        self.assertIn('model_quota',result['shortfall_reasons'])

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
    def test_dry_run_does_not_count_two_articles_using_the_same_photo(self):
        import tempfile
        from pathlib import Path
        from news_reliable_desks import run_category
        entries=[dict(article=dict(url='https://example.com/'+slug,slug=slug,title=title,
                                   image_url='https://images.example.com/same.jpg'))
                 for slug,title in [('concert','Dua Lipa announces concert dates'),('film','Rita Ora premieres comedy movie')]]
        class Store:
            def available(self):return entries
            def confirm(self,entry):raise AssertionError('Dry run consumed an approval')
        class Port:
            qa=True
            def quota_hit(self):return True
            def publish(self,entry):return dict(batch='qa.json',articles=[],dry_run=True)
        with tempfile.TemporaryDirectory() as root:
            result=run_category(Port(),Store(),Path(root)/'outcome.json','Showbiz')
        self.assertEqual(result['qa_approved'],1)
        self.assertIn('duplicate_image_this_run',result['shortfall_reasons'])
        self.assertEqual(result['published_count'],0)

    def test_source_outage_is_a_failure_instead_of_no_eligible_news(self):
        import tempfile
        from pathlib import Path
        from news_reliable_desks import run_category
        class Store:
            def available(self):return []
        class Port:
            metrics={}
            def quota_hit(self):return False
            def collect(self,attempted):
                self.metrics=dict(failure_reasons=['source_access'],readable_candidates=0)
                return []
        with tempfile.TemporaryDirectory() as root:
            result=run_category(Port(),Store(),Path(root)/'outcome.json','Botë')
        self.assertEqual(result['status'],'failed')
        self.assertIn('source_access',result['shortfall_reasons'])
        self.assertNotIn('eligible_supply_exhausted',result['shortfall_reasons'])

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
    def test_restart_recovers_completed_receipts_in_each_desk_and_worker_layout(self):
        import tempfile
        from pathlib import Path
        from datetime import datetime, timezone
        from news_approved_reserve import Reserve, recover_approvals
        from news_json_state import atomic
        from news_copyright_review import article_digest, digest, POLICY, CHECKS
        now=datetime.now(timezone.utc)
        urls={'Showbiz':'https://anabelmagazine.com/a', 'Ekonomi':'https://ekonomiaonline.com/a', 'Botë':'https://www.bbc.com/news/a'}
        for category,url in urls.items():
            for layout in ('wave-1/draft-0','wave-1/parallel-0/draft-0','context-refresh/entry-0'):
                with self.subTest(category=category,layout=layout), tempfile.TemporaryDirectory() as root:
                    root=Path(root)
                    a=dict(slug='a',url=url,title='Public update announced',body='Independent prose',category=category,published_at=now.isoformat(),image_rights=dict(sha256='a'*64))
                    e=dict(slug='a',evidence=dict(status='text_extracted',published=now.isoformat()))
                    proof=dict(article_sha256=article_digest(a),evidence_sha256=digest(e),decision=dict(verdict='approve',checks=dict.fromkeys(CHECKS,True),reason='Independent composition and all factual claims are supported.'))
                    receipt=dict(policy=POLICY,model='gpt-6-luna',provider='openai-codex',reviewed_at=now.isoformat(),articles={'a':proof})
                    context=dict(policy='383-event-context-v2',model='gpt-6-luna',provider='openai-codex',reviewed_at=now.isoformat(),history={},articles={'a':dict(article_sha256=article_digest(a),decisions=[dict(verdict='distinct')])})
                    batch=root/'run'/layout/'2026-11-03T22.json'
                    atomic(batch,[a]);atomic(batch.with_suffix('.editor-sources.json'),[e])
                    atomic(batch.with_suffix('.copyright-review.json'),receipt)
                    atomic(batch.with_suffix('.context-review.json'),context)
                    reserve=Reserve(root/'reserve',category)
                    self.assertEqual(recover_approvals(root,reserve),1)
                    self.assertEqual(reserve.available()[0]['article']['body'],'Independent prose')

class DraftResumeTests(unittest.TestCase):
    def test_retired_source_text_is_held_before_any_new_writer_call(self):
        import tempfile,time,subprocess
        from pathlib import Path
        from datetime import datetime,timezone
        from news_reliable_desks import ProductionPort
        from news_approved_reserve import Reserve
        from news_json_state import atomic
        with tempfile.TemporaryDirectory() as temp:
            root=Path(temp);source=root/'source.json';url='https://www.france24.com/en/video/20261112-summit'
            atomic(source,dict(source_url=url,evidence=dict(url=url,status='text_extracted',text='To display this content from YouTube, you must enable advertisement tracking and audience measurement.')))
            lead=dict(url=url,source='France 24',category='Botë',published=datetime.now(timezone.utc).isoformat(),evidence_path=str(source))
            port=ProductionPort('Botë',Reserve(root/'reserve','Botë'),root/'run',time.time()+3000,qa=True)
            with patch('subprocess.run',side_effect=RuntimeError('Unexpected model dispatch')) as external:
                self.assertEqual(list(port.write_ready([lead],{},root/'run/wave-1',1)),[])
            external.assert_not_called()
            self.assertIn('source_extraction_policy_stale',port.metrics['failure_reasons'])


    def test_similar_wording_does_not_make_a_distinct_update_terminal_before_review(self):
        import tempfile,subprocess,time,json
        from pathlib import Path
        from datetime import datetime,timezone
        from news_reliable_desks import ProductionPort
        from news_approved_reserve import Reserve
        from news_copyright_review import article_digest,digest,POLICY,CHECKS
        from news_json_state import atomic
        now=datetime.now(timezone.utc).isoformat()
        common='Banka qendrore njoftoi vendimin e komitetit për normën bazë të interesit pas mbledhjes për politikën monetare. '
        first=dict(id='old',slug='old',category='Ekonomi',source='Monitor',url='https://monitor.al/hold',title='Banka qendrore mban normën në 3%',
            body=common+'Norma mbeti në 3 për qind.',published_at=now,image_rights=dict(sha256='a'*64))
        evidence=dict(slug='old',evidence=dict(status='text_extracted',published=now))
        proof=dict(article_sha256=article_digest(first),evidence_sha256=digest(evidence),decision=dict(verdict='approve',checks=dict.fromkeys(CHECKS,True),reason='Independent reporting supported by complete source facts.'))
        copyright=dict(policy=POLICY,model='gpt-6-luna',provider='openai-codex',reviewed_at=now,articles={'old':proof})
        context=dict(policy='383-event-context-v2',model='gpt-6-luna',provider='openai-codex',reviewed_at=now,history={},articles={'old':dict(article_sha256=article_digest(first),decisions=[dict(verdict='distinct')])})
        with tempfile.TemporaryDirectory() as temp,patch('builtins.print'):
            root=Path(temp);reserve=Reserve(root/'reserve','Ekonomi');reserve.store(first,evidence,copyright,context)
            lead=dict(url='https://scantv.al/cut',source='Scan TV',category='Ekonomi',published=now)
            current=dict(lead,id='new',slug='new',title='Banka qendrore ul normën në 2%',body=common+'Në një mbledhje të re të jashtëzakonshme norma u ul në 2 për qind.')
            calls=[]
            def external(args,**kwargs):
                calls.append(args)
                if 'scripts/news_model_response.py' in args:
                    atomic(Path(args[args.index('--batch')+1]),[current])
                if 'scripts/prepare_editor_sources.py' in args:
                    path=Path(args[args.index('scripts/prepare_editor_sources.py')+1]);atomic(path.with_suffix('.editor-sources.json'),[])
                if 'scripts/run-news-editor-parallel.sh' in args:raise subprocess.TimeoutExpired(args,600)
                return subprocess.CompletedProcess(args,0)
            port=ProductionPort('Ekonomi',reserve,root/'run',time.time()+3000,qa=True)
            with patch('subprocess.run',side_effect=external):
                self.assertEqual(list(port.write_ready([lead],{},root/'run/wave-1',1)),[])
            self.assertTrue(any('scripts/run-news-editor-parallel.sh' in args for args in calls))
            progress=json.loads((root/'run/wave-1/story-0.pending.json').read_text())
            self.assertFalse(progress['terminal'])


    def test_completed_preparation_without_a_started_worker_is_recovered(self):
        self.exercise_prepared_recovery()

    def test_changed_preparation_is_not_rehashed_into_a_valid_checkpoint(self):
        self.exercise_prepared_recovery(changed=True)

    def test_unlabelled_market_update_expires_after_one_hour(self):
        self.exercise_prepared_recovery(market_expired=True)

    def test_declared_breaking_source_keeps_the_one_hour_source_limit(self):
        self.exercise_prepared_recovery(declared_breaking_expired=True)

    def test_old_completed_preparation_does_not_receive_a_new_recovery_clock(self):
        self.exercise_prepared_recovery(preparation_expired=True)

    def test_untimestamped_preparation_is_held_instead_of_redated(self):
        self.exercise_prepared_recovery(preparation_undated=True)

    def exercise_prepared_recovery(self,changed=False,market_expired=False,declared_breaking_expired=False,preparation_expired=False,preparation_undated=False):
        import subprocess,time,tempfile,hashlib
        from pathlib import Path
        from datetime import datetime,timezone,timedelta
        from news_reliable_desks import ProductionPort
        from news_approved_reserve import Reserve
        from news_json_state import atomic
        for category in (('Ekonomi',) if market_expired else ('Showbiz','Ekonomi','Botë')):
            with self.subTest(category=category),tempfile.TemporaryDirectory() as temp,patch('builtins.print'):
                root=Path(temp);calls=[]
                lead=dict(category=category,url='https://example.com/update',source='Publisher',published=datetime.now(timezone.utc).isoformat())
                if market_expired: lead.update(title='Oil prices fall in intraday trading',published=(datetime.now(timezone.utc)-timedelta(hours=2)).isoformat())
                if declared_breaking_expired:
                    lead.update(published=(datetime.now(timezone.utc)-timedelta(hours=2)).isoformat(),
                                editorial_review=dict(breaking='publisher_label'))
                if preparation_expired:
                    lead.update(published=(datetime.now(timezone.utc)-timedelta(hours=2)).isoformat(),
                                editorial_review=dict(breaking='fresh_development'))
                source=root/'source.json';atomic(source,dict(source_url=lead['url'],evidence=dict(url=lead['url'],text='Original complete source evidence.')))
                prepared_at=datetime.now(timezone.utc)-timedelta(hours=2 if preparation_expired else 0)
                lead.update(evidence_path=str(source),preparation_receipt=dict(policy='383-prepared-story-v1',prepared_at=prepared_at.isoformat(),files={str(source):hashlib.sha256(source.read_bytes()).hexdigest()}))
                if preparation_undated:lead['preparation_receipt'].pop('prepared_at')
                atomic(root/'prior/wave-1/discovery.json',dict(ready_leads=[lead]))
                if changed: source.write_text('Changed source facts after preparation.',encoding='utf-8')
                def external(args,**kwargs):
                    calls.append(args)
                    raise RuntimeError('writer unavailable')
                port=ProductionPort(category,Reserve(root/'reserve',category),root/'next',time.time()+3000,qa=True)
                with patch('subprocess.run',side_effect=external):
                    self.assertEqual(list(port.resume_incomplete(5)),[])
                self.assertEqual(any('scripts/news_writer_brief.py' in args for args in calls),not changed and not market_expired and not declared_breaking_expired and not preparation_expired and not preparation_undated)

    def test_all_three_desks_resume_saved_drafts_without_calling_writer_again(self):
        self.exercise_resume()

    def test_new_checkpoints_resume_routine_updates_with_two_hour_old_sources(self):
        self.exercise_resume(routine_source_hours=2)

    def test_expired_routine_checkpoints_do_not_resume_old_work(self):
        self.exercise_resume(routine_source_hours=2,pending_age_hours=2)

    def test_changed_prepared_source_invalidates_incomplete_work(self):
        self.exercise_resume(change_input=True)

    def test_an_explicit_writer_decline_is_not_resumed(self):
        self.exercise_resume(writer_declines=True)

    def test_normalized_draft_survives_source_preparation_failure(self):
        self.exercise_resume(preparation_fails=True)

    def exercise_resume(self,change_input=False,writer_declines=False,preparation_fails=False,routine_source_hours=0,pending_age_hours=0):
        import subprocess,time,tempfile,json
        from pathlib import Path
        from news_reliable_desks import ProductionPort
        from news_approved_reserve import Reserve
        from news_json_state import atomic
        for category in ('Showbiz','Ekonomi','Botë'):
            with self.subTest(category=category),tempfile.TemporaryDirectory() as temp,patch('builtins.print'):
                root=Path(temp);calls=[]
                source=root/'source.json';atomic(source,dict(text='Original complete source evidence.'))
                lead=dict(url='https://example.com/update',source='Publisher',category=category,published=__import__('datetime').datetime.now(__import__('datetime').timezone.utc).isoformat(),evidence_path=str(source))
                if routine_source_hours:
                    from datetime import datetime,timezone,timedelta
                    lead.update(published=(datetime.now(timezone.utc)-timedelta(hours=routine_source_hours)).isoformat(),
                                editorial_review=dict(breaking='fresh_development'))
                def external(args,**kwargs):
                    calls.append(args)
                    if 'scripts/news_model_response.py' in args:
                        if writer_declines: return subprocess.CompletedProcess(args,3)
                        target=Path(args[args.index('--batch')+1]);atomic(target,[dict(lead,slug='test',title='A factual update',body='<p>Supported independent copy.</p>')])
                    if 'normalize' in args:
                        target=Path(args[args.index('--file')+1]);rows=json.loads(target.read_text(encoding='utf-8'));rows[0]['dispatch']='Normalized metadata';atomic(target,rows)
                    if 'scripts/prepare_editor_sources.py' in args:
                        if preparation_fails: raise subprocess.TimeoutExpired(args,90)
                        target=Path(args[args.index('scripts/prepare_editor_sources.py')+1]);atomic(target.with_suffix('.editor-sources.json'),[])
                    if 'scripts/run-news-editor-parallel.sh' in args:
                        raise subprocess.TimeoutExpired(args,600)
                    return subprocess.CompletedProcess(args,0)
                reserve=Reserve(root/'reserve',category)
                with patch('subprocess.run',side_effect=external):
                    port=ProductionPort(category,reserve,root/'run',time.time()+3000,qa=True)
                    self.assertEqual(list(port.write_ready([lead],{},root/'run/wave-1',1)),[])
                    if pending_age_hours:
                        checkpoint=root/'run/wave-1/story-0.pending.json'
                        saved=json.loads(checkpoint.read_text())
                        saved['created_at']=(datetime.now(timezone.utc)-timedelta(hours=pending_age_hours)).isoformat()
                        atomic(checkpoint,saved)
                    if change_input: atomic(source,dict(text='The source has changed its reported figures.'))
                    restarted=ProductionPort(category,reserve,root/'next',time.time()+3000,qa=True)
                    self.assertEqual(list(restarted.resume_incomplete(5)),[])
                self.assertEqual(sum('scripts/news_model_response.py' in args for args in calls),1)
                self.assertEqual(sum('scripts/run-news-editor-parallel.sh' in args for args in calls),0 if writer_declines or preparation_fails else 1 if change_input or pending_age_hours else 2)
                if preparation_fails: self.assertEqual(sum('scripts/prepare_editor_sources.py' in args for args in calls),2)

class PreparationRecoveryTests(unittest.TestCase):
    def test_every_desk_keeps_completed_preparation_after_a_collector_timeout(self):
        import subprocess,time,tempfile
        from pathlib import Path
        from news_reliable_desks import ProductionPort
        from news_approved_reserve import Reserve
        from news_json_state import atomic
        for category in ('Showbiz','Ekonomi','Botë'):
            with self.subTest(category=category),tempfile.TemporaryDirectory() as temp:
                root=Path(temp);calls=[]
                port=ProductionPort(category,Reserve(root/'reserve',category),root/'run',time.time()+3000,qa=True)
                port.data={}
                def external(args,**kwargs):
                    calls.append(args)
                    if any(str(a).endswith('prepare_editor_sources.py') for a in args):
                        selection=Path(args[args.index('scripts/prepare_editor_sources.py')+1])
                        atomic(selection.with_suffix('.json'),dict(ready_leads=[dict(url='https://example.com/update',source='Publisher',category=category)]))
                        raise subprocess.TimeoutExpired(args,480)
                    raise RuntimeError('writer temporarily unavailable')
                with patch('subprocess.run',side_effect=external),patch('builtins.print'):
                    self.assertEqual(list(port.produce([],5)),[])
                self.assertEqual(port.metrics['writer_ready'],1)
                self.assertTrue(any('scripts/news_writer_brief.py' in args for args in calls))
                self.assertIn('partial_preparation_recovered',port.metrics['failure_reasons'])

class StageTimingTests(unittest.TestCase):
    def test_failed_external_stage_keeps_its_wall_time_and_timeout_reason(self):
        import tempfile,subprocess,time
        from pathlib import Path
        from news_reliable_desks import ProductionPort
        from news_approved_reserve import Reserve
        with tempfile.TemporaryDirectory() as root:
            port=ProductionPort('Showbiz',Reserve(Path(root)/'reserve','Showbiz'),Path(root)/'run',time.time()+3000,qa=True)
            with patch('subprocess.run',side_effect=subprocess.TimeoutExpired('model',30)),patch('news_reliable_desks.time.monotonic',side_effect=[10,12]):
                with self.assertRaises(subprocess.TimeoutExpired):
                    port.python('news_model_response.py',seconds=30,model=True)
        self.assertEqual(port.metrics['stage_timing'][0]['stage'],'news_model_response.py')
        self.assertEqual(port.metrics['stage_timing'][0]['wall_seconds'],2)
        self.assertEqual(port.metrics['stage_timing'][0]['result'],'timeout')

class ProductionCollectionTests(unittest.TestCase):
    def test_image_availability_counts_unique_readable_stories_across_waves(self):
        import tempfile,subprocess,time
        from pathlib import Path
        from contextlib import chdir
        from datetime import datetime,timezone
        from news_reliable_desks import ProductionPort
        from news_approved_reserve import Reserve
        from news_json_state import atomic
        with tempfile.TemporaryDirectory() as temp,chdir(temp):
            root=Path(temp);calls=[]
            def external(args,**kwargs):
                number=len(calls);calls.append(number)
                lead=dict(url=f'https://consequence.net/2026/11/concert-{number}/',source='Consequence',category='Showbiz',
                    title='Dua Lipa announces a concert',published=datetime.now(timezone.utc).isoformat())
                source=dict(status='text_extracted',text='Dua Lipa announces a public concert.',image_url='https://images.example/photo.jpg' if number==0 else '')
                atomic(root/'.last30days/cloud-news-discovery-current.json',dict(leads=[lead],raw_leads=[lead],retrieved_evidence={lead['url']:source}))
                atomic(root/'.last30days/showbiz-review/review.json',dict(summary={},articles=[dict(lead,status='reviewed')]))
                return subprocess.CompletedProcess(args,0)
            port=ProductionPort('Showbiz',Reserve(root/'reserve','Showbiz'),root/'run',time.time()+3000,qa=True)
            with patch('subprocess.run',side_effect=external):
                first=port.collect(set());port.collect({first[0]['url']})
        self.assertEqual(port.metrics['readable_candidates'],2)
        self.assertEqual(port.metrics['images_available'],1)

    def test_a_timed_out_visual_review_remains_available_for_retry(self):
        import tempfile,subprocess,json
        from pathlib import Path
        from contextlib import chdir
        from datetime import datetime,timezone
        from news_reliable_desks import ProductionPort
        from news_approved_reserve import Reserve
        from news_json_state import atomic
        for category,source,url,folder in (
                ('Showbiz','Consequence','https://consequence.net/2026/11/artist-update/','showbiz-review'),
                ('Ekonomi','Ekonomia Online','https://ekonomiaonline.com/new-wages/','economy-review')):
            with self.subTest(category=category),tempfile.TemporaryDirectory() as temp,chdir(temp):
                root=Path(temp);calls=[];now=datetime.now(timezone.utc)
                lead=dict(url=url,source=source,category=category,title='Dua Lipa announces a concert' if category=='Showbiz' else 'Kosovo raises public wages',published=now.isoformat())
                def discovery(*args,**kwargs):
                    attempted=json.loads((root/'run/review-attempted.json').read_text(encoding='utf-8'))
                    calls.append(url)
                    allowance=kwargs['env']['L383_SHOWBIZ_REVIEW_SECONDS' if category=='Showbiz' else 'L383_ECONOMY_REVIEW_SECONDS']
                    status='pending_review' if len(calls)==1 else 'pending' if url in attempted or int(allowance)<240 else 'reviewed'
                    atomic(root/'.last30days/cloud-news-discovery-current.json',dict(
                        leads=[lead] if status=='reviewed' else [],raw_leads=[lead],
                        sources=[dict(source=source,category=category,requests_started=1,readable_this_run=1)],
                        retrieved_evidence={url:dict(status='text_extracted',text='A current supported public development.')}))
                    atomic(root/'.last30days'/folder/'review.json',dict(summary={},articles=[dict(
                        lead,status=status,review=dict(decision='consider',score=4) if status=='reviewed' else {})]))
                    return subprocess.CompletedProcess(args,0)
                port=ProductionPort(category,Reserve(root/'reserve',category),root/'run',now.timestamp()+3000,qa=True)
                with patch('subprocess.run',side_effect=discovery):
                    result=port.collect(set())
                self.assertEqual([row['url'] for row in result],[url])
                self.assertGreater(port.metrics['registered_publishers'],0)
                self.assertEqual(port.metrics['attempted_publishers'],1)
                self.assertEqual(port.metrics['source_funnel'][0]['source'],source)
                self.assertEqual(port.metrics['source_funnel'][0]['run_requests_started'],2)

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
    def test_qa_retelling_refusal_is_not_retried_during_finalization(self):
        import tempfile
        from pathlib import Path
        from news_reliable_desks import run_category
        common='Banka qendrore njoftoi vendimin e komitetit për normën bazë të interesit pas mbledhjes për politikën monetare.'
        entries=[dict(article=dict(id=str(i),slug=str(i),url=f'https://monitor.al/decision-{i}',title='Banka mban normën në 3%',body=common)) for i in range(2)]
        class Store:
            def available(self):return list(entries)
        class Port:
            qa=True;comparisons=0
            def quota_hit(self):return False
            def collect(self,attempted):return []
            def publish(self,entry):return dict(batch='qa.json',articles=[],dry_run=True)
            def refresh_context(self,entry,extra_history=()):
                self.comparisons+=1
                self.history=extra_history
                return None
        port=Port()
        with tempfile.TemporaryDirectory() as root:
            result=run_category(port,Store(),Path(root)/'outcome.json','Ekonomi')
        self.assertEqual(result['qa_approved'],1)
        self.assertEqual(result['published_count'],0)
        self.assertEqual(port.comparisons,1)
        self.assertEqual(port.history[0]['body'],common)

    def test_a_distinct_later_bank_decision_reaches_independent_context_refresh(self):
        import tempfile
        from pathlib import Path
        from news_reliable_desks import run_category
        from news_approved_reserve import PublicationHistoryChanged
        common='Banka qendrore njoftoi vendimin e komitetit për normën bazë të interesit pas mbledhjes për politikën monetare. '
        entries=[dict(article=dict(id='old',slug='old',url='https://monitor.al/hold',title='Banka qendrore mban normën në 3%',body=common+'Në vendimin e parë norma mbeti në 3 për qind.')),
                 dict(article=dict(id='new',slug='new',url='https://scantv.al/cut',title='Banka qendrore ul normën në 2%',body=common+'Në një mbledhje të re të jashtëzakonshme norma u ul në 2 për qind.'))]
        class Store:
            def __init__(self):self.entries=list(entries)
            def available(self):return list(self.entries)
            def confirm(self,e):self.entries=[row for row in self.entries if row['article']['url']!=e['article']['url']]
        class Port:
            comparisons=0
            def quota_hit(self):return False
            def collect(self,attempted):return []
            def publish(self,entry):
                if entry['article']['id']=='new' and not entry.get('context_refreshed'):
                    raise PublicationHistoryChanged('Related earlier decision must be compared independently')
                return dict(batch=entry['article']['slug']+'.json',articles=[entry['article']])
            def refresh_context(self,entry,**kwargs):
                self.comparisons+=1
                return dict(entry,context_refreshed=True)
        port=Port()
        with tempfile.TemporaryDirectory() as root:
            result=run_category(port,Store(),Path(root)/'outcome.json','Ekonomi')
        self.assertEqual(result['published_count'],2)
        self.assertEqual(port.comparisons,1)


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
