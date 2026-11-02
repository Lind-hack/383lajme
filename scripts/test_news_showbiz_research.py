import json
import tempfile
import time
import unittest
from datetime import datetime,timedelta,timezone
from pathlib import Path

from news_ingestion_store import Inventory
from news_showbiz_focus import ARTISTS
from news_showbiz_research import research_route,run_research,queue_leads,cached_report,POLICY,searches

NOW=datetime(2026,11,1,12,tzinfo=timezone.utc)
ARTIST=next(a for a in ARTISTS if a['id']=='bebe-rexha')


def response(url,text):return {'url':url,'payload':text.encode(),'headers':{}}


def atom(channel=None,published='2026-10-20T12:00:00Z',views=100):
    channel=channel or ARTIST['youtube_channel_id']
    return f'''<feed xmlns="http://www.w3.org/2005/Atom" xmlns:yt="http://www.youtube.com/xml/schemas/2015" xmlns:media="http://search.yahoo.com/mrss/">
    <yt:channelId>{channel.removeprefix('UC')}</yt:channelId><title>Artist</title><entry>
    <yt:channelId>{channel}</yt:channelId><title>Bebe Rexha performs</title>
    <link href="https://www.youtube.com/watch?v=fjYdYdJq8dk"/><published>{published}</published>
    <updated>2026-11-01T11:00:00Z</updated><media:statistics views="{views}"/></entry></feed>'''


def fetcher(url,**kwargs):
    if 'youtube.com/feeds/' in url:return response(url,atom())
    if 'instagram.com' in url:return response(url,'<html><title>Instagram</title><p>Log in to continue</p></html>')
    return response(url,'''<rss version="2.0"><channel><item><title>Bebe Rexha posts a new outfit</title>
        <link>https://www.nme.com/news/music/bebe-rexha-outfit</link><pubDate>Sun, 01 Nov 2026 11:00:00 GMT</pubDate></item>
        <item><title>Bebe Rexha gossip</title><link>https://telegrafi.com/bebe-rexha</link><pubDate>Sun, 01 Nov 2026 11:00:00 GMT</pubDate></item></channel></rss>''')


class DailyResearchTests(unittest.TestCase):
    def test_artist_searches_cover_every_approved_showbiz_publisher(self):
        from news_source_policy import load_manifest
        query=' '.join(searches(ARTIST))
        for publisher in load_manifest()['publishers']:
            if publisher['category']=='Showbiz':
                for domain in publisher['domains']:
                    self.assertIn('site:'+domain,query)

    def test_updated_video_is_retained_as_history_and_never_called_new(self):
        job={'artist':ARTIST,'kind':'youtube','url':'https://www.youtube.com/feeds/videos.xml'}
        row=research_route(job,NOW,time.monotonic()+5,fetcher=fetcher)
        self.assertEqual(row['status'],'checked')
        self.assertEqual(row['official_posts'][0]['status'],'historical_reference_not_new_upload')
        self.assertEqual(row['official_posts'][0]['metrics']['views'],100)
        self.assertTrue(row['official_posts'][0]['published'].startswith('2026-10-20'))

    def test_wrong_official_channel_cannot_supply_artist_posts(self):
        def wrong(url,**kwargs):return response(url,atom(channel='UCwrongartist'))
        row=research_route({'artist':ARTIST,'kind':'youtube','url':'https://www.youtube.com/feeds/videos.xml'},NOW,time.monotonic()+5,fetcher=wrong)
        self.assertEqual(row['status'],'unavailable')
        self.assertEqual(row['official_posts'],[])

    def test_login_profile_is_not_a_new_artist_post(self):
        row=research_route({'artist':ARTIST,'kind':'instagram','url':ARTIST['instagram']},NOW,time.monotonic()+5,fetcher=fetcher)
        self.assertEqual(row['status'],'no_public_posts')
        self.assertEqual(row['official_posts'],[])

    def test_only_registered_showbiz_publishers_enter_collection_without_index_timestamps(self):
        with tempfile.TemporaryDirectory() as folder:
            state=Path(folder)/'inventory.sqlite'
            result=run_research(Path(folder)/'research',state,artists=[ARTIST],now=NOW,fetcher=fetcher,decoder=lambda u:u)
            self.assertEqual(result['summary']['approved_publisher_leads'],1)
            self.assertFalse(result['summary']['coverage_complete'])
            store=Inventory(state)
            rows=store.db.execute("SELECT source,url,hint FROM tasks").fetchall();store.close()
            self.assertEqual(len(rows),1)
            self.assertEqual(rows[0]['source'],'NME')
            self.assertNotIn('published',json.loads(rows[0]['hint']))
            self.assertEqual(result['summary']['official_post_leads'],0)

    def test_pending_routes_resume_without_repeating_completed_routes(self):
        with tempfile.TemporaryDirectory() as folder:
            result=run_research(folder,artists=[ARTIST],now=NOW,budget_seconds=0,fetcher=fetcher)
            self.assertGreater(result['summary']['pending_routes'],0)
            result=run_research(folder,artists=[ARTIST],now=NOW,fetcher=fetcher,decoder=lambda u:u)
            def fail(*args,**kwargs):raise AssertionError('completed routes must be reused')
            again=run_research(folder,artists=[ARTIST],now=NOW,fetcher=fail,decoder=lambda u:u)
            self.assertEqual(again['routes'],result['routes'])

    def test_two_distinct_observations_compute_growth_without_claiming_virality(self):
        with tempfile.TemporaryDirectory() as folder:
            run_research(folder,artists=[ARTIST],now=NOW,fetcher=fetcher,decoder=lambda u:u)
            def newer(url,**kwargs):
                return response(url,atom(views=300)) if 'youtube.com/feeds/' in url else fetcher(url,**kwargs)
            result=run_research(folder,artists=[ARTIST],now=NOW+timedelta(hours=4),force=True,fetcher=newer,decoder=lambda u:u)
            post=result['official_posts'][0]
            self.assertEqual(post['observed_growth']['views_added'],200)
            self.assertEqual(post['observed_growth']['views_per_hour'],50)
            self.assertEqual(post['observed_growth']['viral_status'],'not_established')

    def test_new_local_day_invalidates_cache_even_within_four_hours(self):
        with tempfile.TemporaryDirectory() as folder:
            p=Path(folder)/'cache.json'
            old=datetime(2026,11,1,22,59,tzinfo=timezone.utc)
            p.write_text(json.dumps({'policy':POLICY,'roster_sha256':'key','generated_at':old.isoformat(),
                                    'summary':{'pending_routes':0}}))
            self.assertIsNotNone(cached_report(p,old+timedelta(seconds=30),'key'))
            self.assertIsNone(cached_report(p,old+timedelta(minutes=2),'key'))


if __name__=='__main__':unittest.main()
