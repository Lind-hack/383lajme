import unittest
from bota_sources import bing_original_url,publisher_country,balanced_sources,excluded_publisher

class WorldwideTests(unittest.TestCase):
 def test_search_market_does_not_attribute_country_and_url_is_guarded(self):
  self.assertEqual(publisher_country('https://b92.net/news'),'Serbi')
  self.assertEqual(publisher_country('https://unknown.example/news'),'Të tjera')
  self.assertEqual(publisher_country('https://example.co.nz/news'),'Zelandë e Re')
  self.assertEqual(publisher_country('https://sports.rik.cy/news'),'Qipro')
  for url in ['https://www.kosovahaber.com/news','https://periskopi.com/news','https://kosovapress.com/news','https://www.tff.org/news']:
   self.assertTrue(excluded_publisher(url))
  self.assertFalse(excluded_publisher('https://kosovapress.com.evil.test/news'))
  self.assertEqual(bing_original_url('https://www.bing.com/news/apiclick?url=https%3A%2F%2Fb92.net%2Fnews'),'https://b92.net/news')
  for link in ['https://evil.example/?url=https://b92.net','https://bing.com/?url=http://b92.net','https://bing.com/?url=https://user:pass@b92.net']:
   self.assertEqual(bing_original_url(link),'')
 def test_busy_country_and_duplicate_urls_do_not_monopolize(self):
  rows=[{'url':f'https://a.test/{i}','country':'A','outlet':'A'} for i in range(100)]
  rows += [{'url':f'https://{c}.test/news','country':c,'outlet':c} for c in ['B','C','D']]
  selected=balanced_sources(rows+rows,50,country_cap=10,outlet_cap=4)
  self.assertEqual([a['country'] for a in selected[:4]],['A','B','C','D'])
  self.assertEqual(len(selected),7);self.assertEqual(len({a['url'] for a in selected}),7)
 def test_expanded_catalog_and_regional_publisher_ownership(self):
  from bota_catalog import PUBLISHERS,PUBLISHER_DOMAINS,PUBLISHER_FEEDS
  self.assertGreaterEqual(len(PUBLISHERS),90);self.assertGreaterEqual(len(PUBLISHER_DOMAINS),230);self.assertGreaterEqual(len(PUBLISHER_FEEDS),40)
  for url,country in [('https://ba.n1info.com/news','Bosnjë dhe Hercegovinë'),('https://rs.n1info.com/news','Serbi'),('https://www.dawn.com/news','Pakistan'),('https://www.jordantimes.com/news','Jordani'),('https://news.err.ee/article','Estoni'),('https://www.nation.africa/news','Kenia')]:
   self.assertEqual(publisher_country(url),country)
  self.assertEqual(publisher_country('https://dawn.com.evil.test/news'),'Të tjera')

if __name__=='__main__':unittest.main()
