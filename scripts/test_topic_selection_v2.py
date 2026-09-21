import importlib.util
import json
import tempfile
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parent
RULES_PATH = ROOT / "editorial_rules_v2.py"


def load_rules():
    spec = importlib.util.spec_from_file_location("editorial_rules_v2", RULES_PATH)
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(module)
    return module


class TopicSelectionV2Tests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.rules = load_rules()

    def article(self, index, category, title=None, body=None, source="Wire source"):
        r = self.rules
        if title is None:
            title = {
                "Kosovë": "Prishtinë rrit pagat nga 1 tetori",
                "Shqipëri": "Tiranë hap 5 linja të reja urbane",
                "Botë": "BE ndryshon vizat për Kosovën nga 1 tetori",
                "Sport": "Drita fiton 2-1 në Evropë në minutën e 89-të",
                "Showbiz": "Dua Lipa njofton koncertin e ri në Prishtinë",
                "Ekonomi": "Kosovë hap 5 vende pune në energji",
                "Teknologji": "Kosovë përdor sistemin e ri digjital",
            }[category]
        if body is None:
            body = {
                "Kosovë": "Prishtinë dhe qytetarët e Kosovës përballen me këtë ndryshim. " * 40,
                "Shqipëri": "Tiranë dhe banorët e Shqipërisë përballen me këtë ndryshim. " * 40,
                "Botë": "Bashkimi Evropian dhe Kosova preken nga ky vendim ndërkombëtar. " * 40,
                "Sport": "Drita dhe futbolli kosovar janë në qendër të këtij rezultati evropian. " * 40,
                "Showbiz": "Dua Lipa dhe publiku në Prishtinë presin këtë zhvillim të ri. " * 40,
                "Ekonomi": "Kosova dhe familjet në Prishtinë preken nga ky zhvillim ekonomik. " * 40,
                "Teknologji": "Kosova dhe përdoruesit në Prishtinë preken nga ky zhvillim teknologjik. " * 40,
            }[category]
        city = r.infer_city(category, title, body)
        return {
            "id": f"article-{index}",
            "slug": f"article-{index:02d}-verified",
            "url": f"https://primary{index}.example/story",
            "title": title,
            "excerpt": "Një ndryshim konkret me ndikim të verifikueshëm.",
            "body": body,
            "source": source,
            "category": category,
            "city": city,
            "score_breakdown": {"relevance": 8, "public_impact": 8, "urgency": 7, "credibility": 8, "corroboration": 8, "editorial_safety": 8},
            "corroborating_sources": [
                {"source": "Independent source", "url": f"https://secondary{index}.example/confirm"}
            ],
        }

    def test_local_competitors_are_allowed_only_in_their_local_lane(self):
        r = self.rules
        self.assertIsNone(r.source_policy_error("Kosovë", "Telegrafi", "https://telegrafi.com/lajm"))
        self.assertIsNone(r.source_policy_error("Shqipëri", "News24", "https://www.news24.al/lajm"))
        self.assertIsNotNone(r.source_policy_error("Sport", "Telegrafi", "https://telegrafi.com/sport/lajm"))
        self.assertIsNotNone(r.source_policy_error("Kosovë", "News24", "https://www.news24.al/lajm"))
        self.assertIsNotNone(r.source_policy_error("Showbiz", "ABC News", "https://abcnews.al/showbiz"))

    def test_city_inference_uses_priority_order_and_safe_fallbacks(self):
        r = self.rules
        self.assertEqual(r.infer_city("Kosovë", "Gjilan dhe Prishtina: çmimet ndryshojnë", ""), "Prishtinë")
        self.assertEqual(r.infer_city("Shqipëri", "Lajm kombëtar", "Njoftimi u bë në Elbasan."), "Elbasan")
        self.assertEqual(r.infer_city("Kosovë", "Lajm kombëtar", "Pa qytet të përmendur."), "Kosovë")
        self.assertEqual(r.infer_city("Shqipëri", "Lajm kombëtar", "Pa qytet të përmendur."), "Shqipëri")

    def test_title_rules_reject_generic_or_unfocused_titles(self):
        r = self.rules
        self.assertTrue(r.title_errors({"category": "Kosovë", "title": "Zhvillime të reja në dialog"}))
        self.assertTrue(r.title_errors({"category": "Kosovë", "title": "Ndryshon rregulli nga 1 tetori"}))
        self.assertEqual(r.title_errors({"category": "Kosovë", "title": "Prishtinë: 5 ndryshime nga 1 tetori"}), [])

    def test_hard_bans_and_prishtina_test_are_enforced(self):
        r = self.rules
        banned = self.article(1, "Showbiz", title="K-pop grupi njofton albumin e ri")
        self.assertTrue(any("banned" in error for error in r.article_errors(banned)))
        women = self.article(2, "Sport", title="Futbolli i femrave sjell rekord të ri")
        self.assertTrue(any("women" in error for error in r.article_errors(women)))
        low = self.article(4, "Sport", title="Një miqësore vendos rekordin e verës", body="Një ndeshje miqësore mes dy ekipeve pa interes të gjerë. " * 40)
        self.assertTrue(any("without Kosovar interest" in error for error in r.article_errors(low)))
        foreign = self.article(3, "Botë", title="Qyteti i huaj debaton për një park lokal", body="Një mosmarrëveshje e vogël lokale vazhdon. " * 40)
        self.assertTrue(any("Kosovo/Balkans" in error for error in r.article_errors(foreign)))

    def test_valid_batch_meets_mandatory_lane_quotas(self):
        r = self.rules
        articles = []
        index = 1
        for category, count in (("Kosovë", 6), ("Shqipëri", 3), ("Botë", 3), ("Sport", 2), ("Showbiz", 1)):
            for _ in range(count):
                articles.append(self.article(index, category))
                index += 1
        self.assertEqual(r.validate_run(articles), [])

    def test_missing_quota_and_secondary_source_fail(self):
        r = self.rules
        articles = [self.article(i, "Kosovë") for i in range(1, 14)]
        errors = r.validate_run(articles)
        self.assertTrue(any("SHQIPËRI" in error or "Shqipëri" in error for error in errors))
        broken = self.article(99, "Kosovë")
        broken["corroborating_sources"] = [{"source": "Same publisher", "url": broken["url"] + "/second"}]
        errors = r.article_errors(broken)
        self.assertTrue(any("independent" in error for error in errors))

    def test_prefetched_evidence_must_cover_primary_and_secondary_urls(self):
        import topic_selection_gate as gate

        articles = []
        index = 1
        for category, count in (("Kosovë", 6), ("Shqipëri", 3), ("Botë", 3), ("Sport", 2), ("Showbiz", 1)):
            for _ in range(count):
                articles.append(self.article(index, category))
                index += 1
        with tempfile.TemporaryDirectory() as directory:
            evidence_path = Path(directory) / "batch.editor-sources.json"
            evidence_path.write_text(
                json.dumps([
                    {
                        "slug": article["slug"],
                        "evidence": {"status": "text_extracted"},
                        "corroborating": [
                            {"url": article["corroborating_sources"][0]["url"], "evidence": {"status": "text_extracted"}}
                        ],
                    }
                    for article in articles
                ]),
                encoding="utf-8",
            )
            self.assertEqual(gate.evidence_errors(articles, evidence_path), [])
            records = json.loads(evidence_path.read_text(encoding="utf-8"))
            records[0]["corroborating"][0]["evidence"]["status"] = "no_article_text"
            evidence_path.write_text(json.dumps(records), encoding="utf-8")
            self.assertTrue(any("not independently readable" in error for error in gate.evidence_errors(articles, evidence_path)))


if __name__ == "__main__":
    unittest.main()
