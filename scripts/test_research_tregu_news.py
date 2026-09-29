import importlib.util
import unittest
from pathlib import Path
from unittest.mock import patch


spec = importlib.util.spec_from_file_location(
    'research_tregu_news', Path(__file__).with_name('research-tregu-news.py'))
research = importlib.util.module_from_spec(spec)
spec.loader.exec_module(research)


class ResearchSelectionTests(unittest.TestCase):
    def test_topic_specific_cross_language_discovery(self):
        markets = [
            {'question': 'Zgjedh Kuvendi i Kosovës president?',
             'pre_match_analysis': {'topic_key': 'kosovo-presidency-resolution',
                                    'proposition': {'entities': ['Kuvendi i Kosovës', 'Presidenti i Kosovës']}}},
            {'question': 'Kongresi i Spanjës miraton ndalimin e dëbimeve?',
             'pre_match_analysis': {'topic_key': 'spain-eviction-ban-legislation',
                                    'proposition': {'entities': ['Kongresi i Deputetëve i Spanjës']}}},
            {'question': 'Nis Argjentina procedurë ligjore për Sea Lion?',
             'pre_match_analysis': {'topic_key': 'argentina-sea-lion-legal-action',
                                    'proposition': {'entities': ['Argjentina', 'Sea Lion']}}},
        ]
        titles = [
            'Kosovo parliament debates presidential vote',
            'Spain proposes eviction ban in housing bill',
            'Argentina threatens legal action over Sea Lion oil project',
        ]
        for market, title in zip(markets, titles):
            self.assertGreater(research.lead_score(market, {'title': title}), 0)
        self.assertEqual(research.lead_score(markets[0], {'title': 'Kosovo football team wins'}), 0)
        self.assertEqual(research.lead_score(markets[1], {'title': 'Spain beats Argentina in football'}), 0)

    def test_pinned_newsroom_urls_and_corroboration_are_discovery_only(self):
        now = research.NOW.isoformat()
        market = {'source_article_slugs': ['budget-vote']}
        recent = {'slug': 'budget-vote', 'url': 'https://primary.example/story',
                  'title': 'Parliament considers budget', 'excerpt': 'Vote is pending',
                  'source': 'Primary', 'published_at': now}
        pinned = {**recent, 'raw_article': {'corroborating_sources': [
            {'url': 'https://second.example/report', 'source': 'Second'},
            {'url': 'https://news.google.com/unsafe', 'source': 'Aggregator'}]}}

        class Reply:
            def __init__(self, rows): self.rows = rows
            def raise_for_status(self): pass
            def json(self): return self.rows

        with patch.object(research.requests, 'get', side_effect=[Reply([recent]), Reply([pinned])]) as get:
            leads = research.persisted_leads('https://db.example', {}, [market])
        self.assertEqual([lead['url'] for lead in leads],
                         ['https://primary.example/story', 'https://second.example/report'])
        self.assertTrue(all(lead['parent_slug'] == 'budget-vote' for lead in leads))
        self.assertEqual(research.lead_score(market, leads[1]), 1000)
        self.assertEqual(get.call_count, 2)


if __name__ == '__main__': unittest.main()
