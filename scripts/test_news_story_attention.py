import json
import time
import unittest
import socket
from unittest.mock import patch
from read_news_source import check_public
from news_story_attention import linked_posts,public_metrics,collect_posts


class AttentionTests(unittest.TestCase):
    def test_dual_stack_public_fetch_prefers_routable_ipv4_without_skipping_validation(self):
        rows=[(socket.AF_INET6,socket.SOCK_STREAM,6,'',('2606:4700::1111',443,0,0)),
              (socket.AF_INET,socket.SOCK_STREAM,6,'',('93.184.216.34',443))]
        with patch('read_news_source.socket.getaddrinfo',return_value=rows):
            self.assertEqual(check_public('https://example.com/'),'93.184.216.34')
        rows[0]=(socket.AF_INET6,socket.SOCK_STREAM,6,'',('::1',443,0,0))
        with patch('read_news_source.socket.getaddrinfo',return_value=rows):
            with self.assertRaisesRegex(ValueError,'non-public'):
                check_public('https://example.com/')

    def test_share_buttons_and_profiles_are_not_evidence_of_social_discussion(self):
        raw='<article><a href="https://x.com/intent/tweet?text=viral">Share</a><a href="https://instagram.com/artist/">Follow</a><a href="https://x.com/artist/status/12345">Actual post</a></article>'
        self.assertEqual(linked_posts(raw,'https://nme.com/news/story'),['https://x.com/artist/status/12345'])

    def test_only_this_post_schema_supplies_counters_not_related_post_or_prose(self):
        url='https://x.com/artist/status/12345'
        def schema(target,count):
            return dict(**{'@type':'SocialMediaPosting','url':target},interactionStatistic={
                'interactionType':{'@type':'LikeAction'},'userInteractionCount':count})
        raw='One million people reacted!<script type="application/ld+json">'+json.dumps([
            schema(url,150),schema('https://x.com/artist/status/99999',999999)])+'</script>'
        self.assertEqual(public_metrics(raw,url),[{'metric':'LikeAction','count':150}])

    def test_inaccessible_social_evidence_stays_unknown(self):
        def fail(*args,**kwargs): raise ValueError('public post unavailable')
        rows=collect_posts(['https://x.com/artist/status/12345'],time.monotonic()+5,fetcher=fail)
        self.assertEqual(rows[0]['status'],'unavailable')
        self.assertEqual(rows[0]['metrics'],[])

    def test_redirect_to_another_post_cannot_supply_this_events_counts(self):
        def fetcher(*args,**kwargs):
            return {'url':'https://x.com/artist/status/99999','payload':b'','headers':{}}
        rows=collect_posts(['https://x.com/artist/status/12345'],time.monotonic()+5,fetcher=fetcher)
        self.assertEqual(rows[0]['status'],'unavailable')
        self.assertIn('requested post',rows[0]['error'])


if __name__=='__main__': unittest.main()
