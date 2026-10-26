import unittest
from journalism_quality_gate import journalism_errors


def story(body_extra="", **fields):
    paragraph = " ".join(["Fakte të verifikuara për projektin dhe afatet e njoftuara."] * 6)
    return {"source": "Telegrafi", "title": "Prishtinë nis projektin", "excerpt": "Punimet fillojnë në tetor.",
            "body": "".join(f"<p>{paragraph}</p>" for _ in range(3)) + f"<p>{body_extra}</p>", **fields}


class JournalismTests(unittest.TestCase):
    def test_local_time_is_not_false_publisher_attribution(self):
        self.assertEqual(journalism_errors(story('Qendrat e votimit mbyllen në orën 20:00 sipas kohës lokale.')),[])
        self.assertTrue(journalism_errors(story('Sipas Kohës, qendrat e votimit mbyllen në orën 20:00.')))

    def test_named_time_zones_are_not_koha_attribution(self):
        for zone in ('lindore të SHBA-së', 'qendrore evropiane', 'perëndimore', 'universale'):
            with self.subTest(zone=zone):
                self.assertEqual(journalism_errors(story(f'Ndeshja nis në 12:30 sipas kohës {zone}.')), [])
        for text in ('Sipas Kohës, ndeshja nis në 12:30 sipas kohës lindore të SHBA-së.',
                     'Koha njoftoi orarin e ri sipas kohës lokale.',
                     'Sipas gazetës Koha, ndeshja nis të enjten.'):
            self.assertTrue(any('names a publisher' in error for error in journalism_errors(story(text))))

    def test_official_news_subjects_are_not_misclassified_as_media_publishers(self):
        for source,text in [('OpenAI','OpenAI njofton modelin e ri.'),
                            ('Anthropic','Anthropic publikon udhëzimet e produktit.'),
                            ('Federal Reserve','Federal Reserve njofton ndryshimin e normave.'),
                            ('UEFA','UEFA publikon programin e ndeshjeve.')]:
            with self.subTest(source=source):
                self.assertEqual(journalism_errors(story(text,source=source)),[])
        self.assertEqual(journalism_errors(story('OpenAI njofton modelin e ri.',source='TechCrunch')),[])

    def test_original_factual_reporting_does_not_need_outlet_credit(self):
        self.assertEqual(journalism_errors(story("Ministria konfirmoi datën e nisjes.")), [])

    def test_generic_primary_and_secondary_publisher_framing_is_rejected(self):
        for extra in ("Sipas Telegrafi, punimet nisin sot.", "Sipas Telegrafit, punimet nisin sot.", "Sipas Kohës, punimet nisin sot.", "Raporton TV Prizreni se punimet nisin sot.", "Telegrafi shkruan se punimet nisin sot.", "Nga mediat Telegrafi dhe TV Prizreni u mësua lajmi."):
            self.assertTrue(any("names a publisher" in error for error in journalism_errors(story(extra))))

    def test_no_attribution_reason_lets_a_publisher_into_public_copy(self):
        article = story("Sipas Telegrafi, dëshmitari tha se kishte parë punimet.",
                        required_attribution={"kind": "exclusive_reporting", "reason": "Intervista është kryer nga ky botues, jo nga 383."})
        self.assertTrue(journalism_errors(article))

    def test_outlet_as_speaker_of_the_news_is_rejected(self):
        # Live leads on 2026-10-11 that read as relayed copy.
        for extra in ("Telegrafi vlerëson se punimet nisin sot.", "Telegrafi dhe TV Prizreni bëjnë të ditur se punimet nisin sot.",
                      "Telegrafi thotë se punimet nisin sot.", "Telegrafi zbuloi se punimet nisin sot."):
            self.assertTrue(any("names a publisher" in error for error in journalism_errors(story(extra))), extra)

    def test_an_outlet_as_news_subject_is_not_blanket_banned(self):
        self.assertEqual(journalism_errors(story("Telegrafi hapi një zyrë të re në Prishtinë.")), [])

    def test_weak_structural_copy_is_rejected(self):
        self.assertTrue(journalism_errors({"body": "<p>Vetëm një fjali.</p>"}))


if __name__ == "__main__":
    unittest.main()
