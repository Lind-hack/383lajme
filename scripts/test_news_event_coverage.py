import unittest
import os
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from unittest.mock import patch

from cloud_news_discovery import canonical, event_coverage, fetch_feed, select_hourly_leads, freshness_bucket
from prepare_editor_sources import prioritize_grounded_leads


def story(host, path, title='OpenAI launches Orion agent model worldwide', category='Teknologji', **extra):
    return {'url':f'https://{host}/{path}', 'title':title, 'category':category,
            'published':'2026-10-25T08:00:00+01:00', **extra}


class EventCoverageTests(unittest.TestCase):
    def test_recent_reports_precede_day_old_wide_coverage_without_deleting_reserves(self):
        now = datetime(2026, 10, 26, 20, tzinfo=timezone.utc)
        older = [story(host, 'orion', published='2026-10-26T03:00:00Z')
                 for host in ('techcrunch.com', 'therundown.ai', 'engadget.com')]
        recent = story('bleepingcomputer.com', 'patch', 'Microsoft fixes Windows security vulnerability',
                       published='2026-10-26T21:30:00+02:00')
        selected = select_hourly_leads([*older, recent], now=now)
        self.assertEqual(selected[0]['url'], recent['url'])
        self.assertEqual(len(selected), 2)
        self.assertEqual(selected[1]['coverage_family_count'], 3)
        prepared = [{**lead, 'primary_evidence': {'status': 'text_extracted', 'text': 'fact '*200}}
                    for lead in reversed(selected)]
        self.assertEqual(prioritize_grounded_leads(prepared, now=now)[0]['url'], recent['url'])

    def test_freshness_uses_source_time_offsets_and_preserves_unknown_dates_as_reserves(self):
        now = datetime(2026, 10, 26, 20, tzinfo=timezone.utc)
        for timestamp, expected in [('2026-10-26T17:00:00Z', 0), ('2026-10-26T16:59:59Z', 1),
                                    ('2026-10-26T14:00:00Z', 1), ('2026-10-26T13:59:59Z', 2),
                                    ('2026-10-26T21:30:00+02:00', 0), ('2026-10-26T21:00:00Z', 2),
                                    ('invalid', 2)]:
            self.assertEqual(freshness_bucket({'published': timestamp}, now), expected, timestamp)
        self.assertEqual(freshness_bucket({}, now), 2)
        self.assertEqual(freshness_bucket({'updated': now.isoformat(), 'lastmod': now.isoformat()}, now), 2)

    def test_fresh_feed_item_after_the_first_hundred_is_still_discovered(self):
        now=datetime(2026,10,25,11,tzinfo=timezone.utc)
        old={'title':'OpenAI releases an earlier model','link':'https://techcrunch.com/old',
             'published':(now-timedelta(days=3)).isoformat()}
        fresh={**old,'link':'https://techcrunch.com/fresh','published':now.isoformat(),'tags':[{'term':'Reviews'}]}
        response=SimpleNamespace(status_code=200,content=b'feed',raise_for_status=lambda:None)
        with patch.dict(os.environ,{'L383_HOURLY_NEWS':'1'}), \
                patch('cloud_news_discovery.requests.get',return_value=response), \
                patch('cloud_news_discovery.feedparser.parse',return_value=SimpleNamespace(entries=[old]*100+[fresh])):
            leads,audit=fetch_feed({'source':'TechCrunch','category':'Teknologji','url':'https://techcrunch.com/feed/'},now)
        self.assertEqual([r['url'] for r in leads],[fresh['link']])
        self.assertEqual(audit['entries'],101)
        self.assertEqual(leads[0]['tags'],['Reviews'])

    def test_substantive_english_announcement_precedes_a_newer_labelled_review(self):
        review=story('techcrunch.com','review','Testing a new tablet',tags=['Reviews'],
                     published='2026-10-25T11:00:00+01:00')
        announcement=story('techcrunch.com','launch','OpenAI announces a breakthrough agent model')
        selected=select_hourly_leads([review,announcement])
        self.assertEqual(selected[0]['url'],announcement['url'])
        self.assertEqual(len(selected),2)  # Ordering never discards a review.

    def test_independent_coverage_survives_collapse_and_outranks_a_newer_singleton(self):
        event=[story(host,'orion') for host in ('techcrunch.com','therundown.ai','engadget.com')]
        newest=story('bleepingcomputer.com','patch','Microsoft fixes Windows security vulnerability',
                     published='2026-10-25T11:00:00+01:00')
        selected=select_hourly_leads([newest,*event])
        self.assertEqual(len(selected),2)
        self.assertEqual(selected[0]['coverage_family_count'],3)
        self.assertEqual(set(selected[0]['coverage_urls']),{s['url'] for s in event})
        self.assertEqual(selected[1]['url'],newest['url'])
        self.assertNotIn('breaking',selected[0])

    def test_sister_publishers_duplicate_feeds_and_other_desks_do_not_inflate_attention(self):
        rows=[story('variety.com','concert','Singer announces London stadium concert dates','Showbiz'),
              story('billboard.com','concert','Singer announces London stadium concert dates','Showbiz'),
              story('variety.com','concert?utm_source=rss','Singer announces London stadium concert dates','Showbiz'),
              story('nme.com','concert','Singer announces London stadium concert dates','Showbiz'),
              story('cbsnews.com','concert','Singer announces London stadium concert dates','Botë')]
        coverage=event_coverage(rows)
        self.assertEqual(coverage[canonical(rows[0]['url'])]['coverage_family_count'],2)
        self.assertEqual(coverage[canonical(rows[-1]['url'])]['coverage_family_count'],1)

    def test_wide_coverage_of_a_known_published_event_does_not_displace_a_new_story(self):
        event=[story(host,'orion') for host in ('techcrunch.com','therundown.ai','engadget.com')]
        fresh=story('bleepingcomputer.com','patch','Microsoft fixes Windows security vulnerability')
        selected=select_hourly_leads([*event,fresh],{event[0]['url']})
        self.assertEqual(selected[0]['url'],fresh['url'])
        self.assertFalse(selected[0]['coverage_already_published'])
        self.assertTrue(selected[1]['coverage_already_published'])

    def test_numbered_developments_and_broad_same_company_headlines_stay_distinct(self):
        rows=[story('techcrunch.com','model-101','OpenAI launches Orion agent model 101 worldwide'),
              story('engadget.com','model-202','OpenAI launches Orion agent model 202 worldwide'),
              story('therundown.ai','funding','OpenAI raises funding for new office')]
        self.assertTrue(all(r['coverage_family_count']==1 for r in event_coverage(rows).values()))
        self.assertEqual(len(select_hourly_leads(rows)),3)

    def test_unreadable_primary_stays_excluded_but_its_feed_can_signal_event_attention(self):
        rows=[story('theverge.com','orion'),story('techcrunch.com','orion')]
        selected=select_hourly_leads(rows)
        self.assertEqual([r['url'] for r in selected],[rows[1]['url']])
        self.assertEqual(selected[0]['coverage_family_count'],2)

    def test_preparation_preserves_priority_without_promoting_thin_or_risky_reporting(self):
        def evidence(row, words=200):
            return {**row,'primary_evidence':{'status':'text_extracted','text':'fact '*words}}
        single=evidence(story('techcrunch.com','single'))
        widely=evidence({**story('engadget.com','event'),'coverage_family_count':4})
        thin=evidence({**widely,'url':'https://engadget.com/thin'},30)
        risky={**widely,'source_basis_warning':'Interview requires independent public facts.'}
        self.assertEqual(prioritize_grounded_leads([single,thin,risky,widely]),[widely,single,thin,risky])


if __name__=='__main__':unittest.main()
