import gzip
import json
import os
import unittest
from datetime import datetime, timezone
from unittest.mock import patch

from news_ingestion_protocol import feed_items, feed_pages, listing_links, owned, sitemap_items, wordpress_items, wordpress_url

PUBLISHER = {'source':'TechCrunch','category':'Teknologji'}
NOW = datetime(2026,10,25,12,tzinfo=timezone.utc)


class IngestionProtocolTests(unittest.TestCase):
    def test_feed_enumerates_every_entry_before_editorial_topic_selection(self):
        items=''.join(f'<item><title>Markets story {i}</title><link>https://techcrunch.com/news/{i}</link><pubDate>Sun, 25 Oct 2026 11:00:00 GMT</pubDate></item>' for i in range(175))
        with patch.dict(os.environ,{'L383_HOURLY_NEWS':'1'}):
            rows=feed_items(('<rss><channel>'+items+'</channel></rss>').encode(),PUBLISHER,NOW)
        self.assertEqual(len(rows),175)
        self.assertEqual(rows[-1]['url'],'https://techcrunch.com/news/174')

    def test_undated_feed_link_is_retained_for_article_date_verification(self):
        data=b'<rss><channel><item><title>AI</title><link>https://techcrunch.com/ai</link></item></channel></rss>'
        self.assertEqual(feed_items(data,PUBLISHER,NOW)[0]['published'],'')

    def test_listing_has_no_position_or_short_headline_cutoff(self):
        html=''.join(f'<article><h2><a href="/story-{i}">AI {i}</a></h2><time datetime="2026-10-25T11:00:00Z"></time></article>' for i in range(65))
        html+='<a rel="next" href="/news?page=2">Next</a><a href="/category/news">News</a>'
        result=listing_links(html,'https://techcrunch.com/news',PUBLISHER)
        self.assertEqual(len(result['articles']),65)
        self.assertEqual(result['pages'],['https://techcrunch.com/news?page=2'])
        self.assertEqual(result['articles'][0]['published'],'2026-10-25T11:00:00Z')

    def test_image_only_card_and_publisher_api_declarations_are_enumerated(self):
        html='<link rel="https://api.w.org/" href="https://techcrunch.com/wp-json/"><article><a href="/ai-story"><img src="photo.jpg"></a><h2>AI wins</h2></article>'
        result=listing_links(html,'https://techcrunch.com/',PUBLISHER)
        self.assertEqual(result['articles'][0]['url'],'https://techcrunch.com/ai-story')
        self.assertEqual(result['wordpress'],['https://techcrunch.com/wp-json'])

    def test_another_publisher_in_the_same_category_is_not_owned(self):
        self.assertFalse(owned('https://therundown.ai/story',PUBLISHER))
        self.assertFalse(owned('http://127.0.0.1/story',PUBLISHER))
        result=listing_links('<a href="https://therundown.ai/story">Another story</a>','https://techcrunch.com/',PUBLISHER)
        self.assertEqual(result['articles'],[])

    def test_wordpress_query_permalink_is_an_article(self):
        result=listing_links('<article><h2><a href="/?p=123">AI</a></h2></article>',
                             'https://techcrunch.com/',PUBLISHER)
        self.assertEqual(result['articles'][0]['url'],'https://techcrunch.com?p=123')

    def test_atom_continuation_is_followed_without_cross_host_redirect_injection(self):
        xml=b'<feed xmlns="http://www.w3.org/2005/Atom"><link rel="next" href="?page=2"/><link rel="next" href="http://127.0.0.1/internal"/></feed>'
        self.assertEqual(feed_pages(xml,'https://techcrunch.com/feed'),['https://techcrunch.com/feed?page=2'])

    def test_navigation_and_footer_links_are_not_queued_as_articles(self):
        html='<nav><a href="/latest-news">Latest News</a></nav><footer><a href="/our-team">Our Team</a></footer><a href="/politics">Politics</a><article><h2><a href="/ai">AI</a></h2></article>'
        self.assertEqual([row['url'] for row in listing_links(html,'https://techcrunch.com/',PUBLISHER)['articles']],['https://techcrunch.com/ai'])

    def test_pagination_inside_navigation_is_preserved(self):
        html='<nav><a rel="next" href="/page/2">Next page</a><a href="/our-team">Our Team</a></nav>'
        result=listing_links(html,'https://techcrunch.com/',PUBLISHER)
        self.assertEqual(result['pages'],['https://techcrunch.com/page/2'])
        self.assertEqual(result['articles'],[])

    def test_sitemap_index_and_news_dates_do_not_confuse_lastmod_with_publication(self):
        kind,rows=sitemap_items(b'<sitemapindex><sitemap><loc>https://techcrunch.com/news.xml</loc><lastmod>2026-10-25</lastmod></sitemap></sitemapindex>')
        self.assertEqual(kind,'sitemapindex');self.assertNotIn('published',rows[0])
        xml=b'<urlset xmlns:news="http://www.google.com/schemas/sitemap-news/0.9"><url><loc>https://techcrunch.com/ai</loc><lastmod>2026-10-25</lastmod><news:news><news:publication_date>2026-10-24T12:00:00Z</news:publication_date><news:title>AI launch</news:title></news:news></url></urlset>'
        kind,rows=sitemap_items(gzip.compress(xml))
        self.assertEqual(kind,'urlset');self.assertEqual(rows[0]['published'],'2026-10-24T12:00:00Z')
        self.assertEqual(rows[0]['lastmod'],'2026-10-25')

    def test_xml_entity_declarations_are_refused(self):
        with self.assertRaises(ValueError):sitemap_items(b'<!DOCTYPE urlset [<!ENTITY x "bad">]><urlset/>')

    def test_all_public_wordpress_posts_are_retained_and_pagination_is_explicit(self):
        posts=[{'status':'publish','link':f'https://techcrunch.com/post-{i}','title':{'rendered':'AI'},'date_gmt':'2026-10-25T11:00:00','content':{'protected':False}} for i in range(130)]
        posts.append({**posts[0],'link':'https://techcrunch.com/private','content':{'protected':True}})
        self.assertEqual(len(wordpress_items(json.dumps(posts),PUBLISHER)),130)
        self.assertEqual(wordpress_items(json.dumps(posts),PUBLISHER)[0]['published'],'2026-10-25T11:00:00Z')
        url=wordpress_url('https://techcrunch.com/wp-json/','2026-10-24T12:00:00',page=4)
        self.assertIn('/wp-json/wp/v2/posts?',url);self.assertIn('page=4',url)


if __name__=='__main__':unittest.main()
