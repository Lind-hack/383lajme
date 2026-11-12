import unittest
from read_news_source import extract


class PublicArticleBodyTests(unittest.TestCase):
    def test_france24_public_expandable_video_intro_survives_accessibility_hiding(self):
        # Structure observed on the public France24 Dublin-summit page, 12 Nov2026.
        # Test prose is a replacement fixture, not a claimed publisher transcript.
        intro=('European leaders gathered in Dublin for a public summit hosted by Ireland. '
               'Delegations from European countries and institutions discussed security and the war in Ukraine. '
               'The meeting concerns European participation in peace negotiations and regional cooperation. '
               'Organisers confirmed the location and published the meeting agenda. '
               'This introduction reports the summit and its stated subjects. No additional remarks or quotations are supplied.')
        html=('<main role="main"><div id="main-content" class="t-content t-content--article t-content--video">'
              '<div class="t-content__main" data-article-content><div class="m-box-expand" data-box-expand>'
              '<div class="m-box-expand__content" aria-hidden="true" data-box-expand-content>'
              f'<p class="t-content__chapo">{intro}</p></div></div>'
              '<p class="o-em-consent__content__text">To display this content from YouTube, you must enable advertisement tracking and audience measurement.</p>'
              '<p class="o-em-adblock__content__text">Please disable your ad blocker to display the video player and continue viewing the embedded video content.</p>'
              '<p class="m-pub-dates">Issued on: 12/11/2026 Modified on: 12/11/2026</p></div></div></main>')
        url='https://www.france24.com/en/video/20261112-european-security-summit'
        result=extract(html,url,max_text_chars=None)
        self.assertEqual(result['text'],intro)
        self.assertEqual(result['status'],'text_extracted')
        self.assertEqual(result['source_text_kind'],'public_video_introduction')
        notice_only=extract(html.replace(intro,''),url)
        self.assertEqual(notice_only['status'],'no_article_text')
        self.assertFalse(notice_only['text'])
        hidden=extract(html.replace('data-box-expand-content','hidden data-box-expand-content'),url)
        self.assertNotIn(intro,hidden.get('text',''))
        restricted=extract('<script type="application/ld+json">{"isAccessibleForFree":false}</script>'+html,url)
        self.assertEqual(restricted['status'],'restricted')


    def test_bloomberg_verification_screen_is_not_readable_article_evidence(self):
        html='<html><title>Bloomberg - Are you a robot?</title><main><p>To continue, please click the box below to let us know you are not a robot.</p></main></html>'
        evidence=extract(html,'https://www.bloomberg.com/news/articles/2026-11-12/world-update')
        self.assertEqual(evidence['status'],'access_challenge')
        self.assertFalse(evidence.get('text'))
        self.assertFalse(evidence.get('image_candidates'))

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
