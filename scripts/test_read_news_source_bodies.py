import unittest
from read_news_source import extract


class PublicArticleBodyTests(unittest.TestCase):
    def test_public_article_body_takes_precedence_over_short_schema_teaser(self):
        text='The public research announcement contains specific supported technical details and the actual release date.'
        result=extract(f'<article><div itemprop="articleBody"><p>A short related preview that must not become the entire source story.</p></div><div class="articleBody"><p>{text}</p><p>{text} A second verified detail.</p></div></article>', 'https://www.bleepingcomputer.com/news/security/example/')
        self.assertIn(text,result['text'])
        self.assertNotIn('related preview',result['text'])

    def test_visible_article_wrapper_beats_empty_related_article_cards(self):
        text='The city administration announced a specific public transport change affecting the published bus timetable.'
        result=extract(f'<main><article><h2>Related card</h2></article><div class="article_content-wrapper"><p>{text}</p><p>{text} It starts on Monday.</p></div></main>', 'https://a2news.com/shqiperia/aktualitet/example')
        self.assertEqual(result['status'],'text_extracted')
        self.assertIn(text,result['text'])
        self.assertNotIn('Related card',result['text'])

    def test_known_body_classes_do_not_expose_restricted_or_hidden_copy(self):
        text='Restricted full text must never be recovered by selecting a newly supported publisher body class.'
        for cls in ('articleBody','article_content-wrapper'):
            hidden=extract(f'<div hidden class="{cls}"><p>{text}</p></div>', 'https://example.com/story')
            self.assertNotIn(text,hidden.get('text',''))
            restricted=extract(f'<script type="application/ld+json">{{"isAccessibleForFree":false}}</script><div class="{cls}"><p>{text}</p></div>', 'https://example.com/story')
            self.assertEqual(restricted['status'],'restricted')
            self.assertNotIn('text',restricted)
