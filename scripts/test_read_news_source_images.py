import unittest
from read_news_source import extract


class SourceImagesTests(unittest.TestCase):
    def test_article_declared_large_images_are_kept_but_sidebar_images_are_not(self):
        html = '''<meta property="og:image" content="https://example.com/small.jpg">
        <script type="application/ld+json">{"@type":"NewsArticle","image":{"url":"https://example.com/schema.jpg"}}</script>
        <article><p>This is the original readable article body with enough text to be extracted.</p>
        <img src="/preview.jpg" srcset="/medium.jpg 640w, /original.jpg 1600w">
        <aside><img src="/unrelated.jpg"></aside></article>'''
        result = extract(html, "https://example.com/story")
        self.assertEqual(result["status"], "text_extracted")
        self.assertIn("https://example.com/schema.jpg", result["image_candidates"])
        self.assertIn("https://example.com/original.jpg", result["image_candidates"])
        self.assertNotIn("https://example.com/unrelated.jpg", result["image_candidates"])


if __name__ == "__main__":
    unittest.main()
