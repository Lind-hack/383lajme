import json
import tempfile
import unittest
from collections import Counter
from datetime import datetime,timedelta,timezone
from pathlib import Path
from unittest.mock import patch
from news_coverage import plan_counts,balance,replacement_plan
from news_source_policy import CATEGORIES
from news_showbiz_focus import review_queue
from news_story_review import review_inventory,selection_ready,story_current
from news_writer_brief import build
from test_news_story_review import fake_capture,verdict,EVIDENCE,NOW


class ShowbizCapacityTests(unittest.TestCase):
    def test_verified_showbiz_expands_without_overfilling_other_desks(self):
        counts={c:5 for c in CATEGORIES};counts['Showbiz']=18
        plan=plan_counts(counts)
        self.assertEqual(plan['Showbiz'],18)
        self.assertTrue(all(2<=plan[c]<=3 for c in CATEGORIES if c!='Showbiz'))
        rows=[{'category':c,'url':f'{c}/{i}'} for c,n in counts.items() for i in range(n)]
        self.assertEqual(Counter(a['category'] for a in balance(rows,plan))['Showbiz'],18)
        old=[{'category':'Showbiz','url':str(i)} for i in range(8)]
        new=[{'category':'Showbiz','url':str(i)} for i in range(8,14)]
        self.assertEqual(replacement_plan(old,new,[a['url'] for a in old])['Showbiz'],14)

    def test_more_than_sixty_distinct_showbiz_events_are_not_cut_before_preparation(self):
        from cloud_news_discovery import select_hourly_leads
        rows=[{'category':'Showbiz','source':'NME','url':f'https://www.nme.com/news/music/event-{n}',
               'title':f'Artist announces concert event {n+100}','published':datetime.now(timezone.utc).isoformat()}
              for n in range(70)]
        self.assertEqual(len(select_hourly_leads(rows)),70)

    def test_different_celebrity_outfits_do_not_collapse_into_one_halloween_event(self):
        from cloud_news_discovery import select_hourly_leads
        common={'category':'Showbiz','source':'NME','published':datetime.now(timezone.utc).isoformat()}
        rows=[{**common,'url':f'https://www.nme.com/news/{name}',
               'title':name+' shares new Halloween costume photos and reveals her outfit on Instagram 2026'}
              for name in ('Kim Kardashian','Heidi Klum')]
        self.assertEqual(len(select_hourly_leads(rows)),2)

    def test_each_publisher_hero_gets_a_turn_before_one_outlets_lower_stories(self):
        def lead(source,n):
            return {'category':'Showbiz','source':source,'url':f'https://example.com/{source}/{n}','title':'Fresh celebrity news',
                    'homepage':{'position':n,'article_count':20,'observed_at':NOW.isoformat(),'method':'public_html_dom_order'}}
        rows=[lead('Anabel',i) for i in range(1,16)]+[lead('TMZ',1),lead('KultPlus',1)]
        queue=review_queue(rows,NOW)
        self.assertEqual({a['source'] for a in queue[:3]},{'Anabel','TMZ','KultPlus'})
        self.assertTrue(all(a['homepage']['position']==1 for a in queue[:3]))

    def test_older_homepage_story_keeps_its_date_and_requires_a_fresh_observation(self):
        lead={'published':(NOW-timedelta(days=2)).isoformat(),'homepage':{'position':1,'article_count':5,
             'observed_at':NOW.isoformat(),'method':'public_html_dom_order'}}
        self.assertTrue(story_current(lead,NOW))
        self.assertFalse(story_current({**lead,'homepage':{}},NOW))
        self.assertFalse(story_current(lead,NOW+timedelta(hours=2)))
        self.assertEqual(lead['published'],(NOW-timedelta(days=2)).isoformat())

    def test_public_adult_celebrity_look_is_prioritized_over_unrelated_hero(self):
        home={'position':1,'article_count':20,'observed_at':NOW.isoformat(),'method':'public_html_dom_order'}
        generic={'category':'Showbiz','source':'TMZ','title':'A senator has a political disagreement','url':'https://tmz.com/politics','homepage':home}
        style={'category':'Showbiz','source':'People','title':'Heidi Klum reveals her Halloween costume','url':'https://people.com/heidi','homepage':{**home,'position':9}}
        self.assertEqual(review_queue([generic,style],NOW)[0]['url'],style['url'])

    def test_twelve_stories_get_four_disjoint_three_story_writer_groups(self):
        with tempfile.TemporaryDirectory() as folder:
            root=Path(folder);ready=[]
            for n in range(12):
                url=f'https://www.nme.com/news/music/story-{n}'
                evidence=root/f'evidence-{n}.json'
                evidence.write_text(json.dumps({'source_url':url,'evidence':{'status':'text_extracted','url':url,'text':'Verified public event details. '*70},'corroborating':[]}))
                ready.append({'pair_id':f'Showbiz-{n}','url':url,'category':'Showbiz','source':'NME','title':f'Public performance {n}','published':NOW.isoformat(),'evidence_path':str(evidence)})
            discovery=root/'discovery.json';discovery.write_text(json.dumps({'ready_leads':ready,'publication_plan':{'Showbiz':12}}))
            seen=[]
            for group in range(1,5):
                manifest=root/f'ids-{group}.json'
                count=build(discovery,root/f'brief-{group}.md','Showbiz',cap=3,spares=0,desk_slot=group,identity_output=manifest)
                self.assertEqual(count,3);seen.extend(a['url'] for a in json.loads(manifest.read_text()))
            self.assertEqual(len(set(seen)),12)

    def batch_exercise(self,missing=False):
        rows=[];evidence={};calls=[]
        for n in range(8):
            url=f'https://consequence.net/2026/11/story-{n}/'
            rows.append({'url':url,'category':'Showbiz','source':'Consequence','title':f'Public artist event {n}','published':NOW.isoformat()})
            evidence[url]={**EVIDENCE,'url':url}
        def capture(url,publisher,folder,**kwargs):
            result=fake_capture(url,publisher,folder,**kwargs)
            if kwargs.get('article'):result['evidence']=dict(evidence[url])
            return result
        def reviewer(brief,image,deadline):
            data=json.loads(brief.read_text(encoding='utf-8'));calls.append(len(data))
            self.assertTrue(image.is_file())
            self.assertTrue(all('FINAL VERIFIED FACT.' in a['complete_article_text'] for a in data))
            return [{'review_id':a['review_id'],**verdict()[0]} for a in (data[1:] if missing and len(calls)==1 else data)]
        with tempfile.TemporaryDirectory() as folder,patch('builtins.print'):
            records,result=review_inventory(rows,evidence,[],folder,capturer=capture,batch_reviewer=reviewer,now=NOW)
            self.assertEqual(calls,[4,4])
            self.assertEqual(result['summary']['reviewed_articles'],7 if missing else 8)
            self.assertEqual(sum(selection_ready(a,records[a['url']],evidence[a['url']],NOW) for a in rows),7 if missing else 8)

    def test_eight_complete_articles_get_two_native_calls_with_individual_bound_verdicts(self):self.batch_exercise()
    def test_missing_batch_decision_holds_only_that_story(self):self.batch_exercise(missing=True)


if __name__=='__main__':unittest.main()
