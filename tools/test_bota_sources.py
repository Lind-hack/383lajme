import unittest
from bota_sources import bing_original_url,publisher_country,balanced_sources

class WorldwideTests(unittest.TestCase):
 def test_search_market_does_not_attribute_country_and_url_is_guarded(self):
  self.assertEqual(publisher_country('https://b92.net/news'),'Serbi')
  self.assertEqual(publisher_country('https://unknown.example/news'),'Të tjera')
  self.assertEqual(publisher_country('https://example.co.nz/news'),'Zelandë e Re')
  self.assertEqual(bing_original_url('https://www.bing.com/news/apiclick?url=https%3A%2F%2Fb92.net%2Fnews'),'https://b92.net/news')
  for link in ['https://evil.example/?url=https://b92.net','https://bing.com/?url=http://b92.net','https://bing.com/?url=https://user:pass@b92.net']:
   self.assertEqual(bing_original_url(link),'')
 def test_busy_country_and_duplicate_urls_do_not_monopolize(self):
  rows=[{'url':f'https://a.test/{i}','country':'A','outlet':'A'} for i in range(100)]
  rows += [{'url':f'https://{c}.test/news','country':c,'outlet':c} for c in ['B','C','D']]
  selected=balanced_sources(rows+rows,50,country_cap=10,outlet_cap=4)
  self.assertEqual([a['country'] for a in selected[:4]],['A','B','C','D'])
  self.assertEqual(len(selected),7);self.assertEqual(len({a['url'] for a in selected}),7)

if __name__=='__main__':unittest.main()
