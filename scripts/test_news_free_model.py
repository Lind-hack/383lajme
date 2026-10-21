"""The historical import must never retain an alternate-provider API path."""
import unittest
import news_free_model
import news_model

class LegacyModelImportTests(unittest.TestCase):
    def test_legacy_import_only_exposes_the_oauth_helper(self):
        self.assertIs(news_free_model.ask_rows, news_model.ask_rows)
        self.assertFalse(hasattr(news_free_model, "gemini_json"))
        self.assertFalse(hasattr(news_free_model, "gemini_key"))
