import json
import tempfile
import unittest
from pathlib import Path
from news_model_response import save_response


class ResponseTests(unittest.TestCase):
    def test_incomplete_and_changed_continuations_preserve_existing_batch(self):
        with tempfile.TemporaryDirectory() as folder:
            batch = Path(folder) / "batch.json"
            article = dict(url="https://techcrunch.com/a", title="OpenAI sjell model", body="<p>text</p>", category="Teknologji", slug="openai-model")
            batch.write_text(json.dumps([article]), encoding="utf-8")
            original = batch.read_bytes()
            for response in ["383_JSON_BEGIN [", "383_JSON_BEGIN [] 383_JSON_END",
                             "383_JSON_BEGIN " + json.dumps([{**article, "title": "Changed"}]) + " 383_JSON_END"]:
                with self.assertRaises(ValueError):
                    save_response(response, batch, "append")
                self.assertEqual(batch.read_bytes(), original)
            new = {**article, "url": "https://techcrunch.com/b", "slug": "second-model"}
            self.assertEqual(save_response("383_JSON_BEGIN " + json.dumps([article, new]) + " 383_JSON_END", batch, "append"), 2)

    def test_editor_cannot_add_a_new_source(self):
        with tempfile.TemporaryDirectory() as folder:
            batch = Path(folder) / "batch.json"
            batch.write_text('[{"url":"https://techcrunch.com/a"}]', encoding="utf-8")
            row = dict(url="https://techcrunch.com/b", title="Title", body="Body", category="Teknologji", slug="slug")
            with self.assertRaises(ValueError):
                save_response("383_JSON_BEGIN " + json.dumps([row]) + " 383_JSON_END", batch, "editor")

    def test_new_only_continuation_preserves_every_existing_field(self):
        with tempfile.TemporaryDirectory() as folder:
            batch = Path(folder) / "batch.json"
            old = dict(url="https://bbc.com/a", title="Title", body="Approved body", category="Botë", slug="approved", custom={"verified": True})
            new = {**old, "url": "https://bbc.com/b", "slug": "new"}
            batch.write_text(json.dumps([old]), encoding="utf-8")
            self.assertEqual(save_response("383_JSON_BEGIN " + json.dumps([new]) + " 383_JSON_END", batch, "append"), 2)
            self.assertEqual(json.loads(batch.read_text(encoding="utf-8")), [old, new])
            original = batch.read_bytes()
            with self.assertRaises(ValueError):
                save_response("383_JSON_BEGIN " + json.dumps([old, {**new, "url": "https://bbc.com/c"}]) + " 383_JSON_END", batch, "append")
            self.assertEqual(batch.read_bytes(), original)


if __name__ == "__main__":
    unittest.main()
