import unittest
from journalism_quality_gate import journalism_errors


def story(body_extra="", **fields):
    paragraph = " ".join(["Fakte të verifikuara për projektin dhe afatet e njoftuara."] * 6)
    return {"source": "Telegrafi", "title": "Prishtinë nis projektin", "excerpt": "Punimet fillojnë në tetor.",
            "body": "".join(f"<p>{paragraph}</p>" for _ in range(3)) + f"<p>{body_extra}</p>", **fields}


class JournalismTests(unittest.TestCase):
    def test_original_factual_reporting_does_not_need_outlet_credit(self):
        self.assertEqual(journalism_errors(story("Ministria konfirmoi datën e nisjes.")), [])

    def test_generic_primary_and_secondary_publisher_framing_is_rejected(self):
        for extra in ("Sipas Telegrafi, punimet nisin sot.", "Sipas Telegrafit, punimet nisin sot.", "Sipas Kohës, punimet nisin sot.", "Raporton TV Prizreni se punimet nisin sot.", "Telegrafi shkruan se punimet nisin sot.", "Nga mediat Telegrafi dhe TV Prizreni u mësua lajmi."):
            self.assertTrue(any("publisher framing" in error for error in journalism_errors(story(extra))))

    def test_required_attribution_is_allowed_only_in_body_with_reason(self):
        article = story("Sipas Telegrafi, dëshmitari tha se kishte parë punimet.",
                        required_attribution={"kind": "exclusive_reporting", "reason": "Intervista është kryer nga ky botues, jo nga 383."})
        self.assertEqual(journalism_errors(article), [])
        article["title"] = "Sipas Telegrafi, Prishtina nis punimet"
        self.assertTrue(journalism_errors(article))

    def test_outlet_as_speaker_of_the_news_is_rejected(self):
        # Live leads on 2026-10-11 that read as relayed copy.
        for extra in ("Telegrafi vlerëson se punimet nisin sot.", "Telegrafi dhe TV Prizreni bëjnë të ditur se punimet nisin sot.",
                      "Telegrafi thotë se punimet nisin sot.", "Telegrafi zbuloi se punimet nisin sot."):
            self.assertTrue(any("publisher framing" in error for error in journalism_errors(story(extra))), extra)

    def test_justified_attribution_still_never_opens_the_article(self):
        article = story(required_attribution={"kind": "exclusive_reporting", "reason": "Intervista është kryer nga ky botues, jo nga 383."})
        article["body"] = "<p>Sipas Telegrafi, dëshmitari pa punimet.</p>" + article["body"]
        self.assertTrue(any("lead uses" in error for error in journalism_errors(article)))

    def test_an_outlet_as_news_subject_is_not_blanket_banned(self):
        self.assertEqual(journalism_errors(story("Telegrafi hapi një zyrë të re në Prishtinë.")), [])

    def test_weak_structural_copy_is_rejected(self):
        self.assertTrue(journalism_errors({"body": "<p>Vetëm një fjali.</p>"}))


if __name__ == "__main__":
    unittest.main()
