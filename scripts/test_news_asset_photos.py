import copy
import unittest
from unittest.mock import patch

import news_asset_photos as assets
import news_image_policy as policy


def story(title="Bitcoin price rises after ETF inflows", category="Ekonomi"):
    return {"title": title, "category": category}


def reviewed_page(code="BTC"):
    entry = next(row for row in assets.inventory()["photos"] if row["asset"] == code)
    return {"title": entry["title"], "imageinfo": [{
        "sha1": entry["original_sha1"], "width": 4000, "height": 2500,
        "url": "https://upload.wikimedia.org/wikipedia/commons/a/aa/test.jpg",
        "descriptionurl": "https://commons.wikimedia.org/wiki/" + entry["title"].replace(" ", "_"),
        "extmetadata": {key: {"value": value} for key, value in {
            "Artist": entry["creator"], "LicenseShortName": entry["license"],
            "LicenseUrl": policy.LICENSES[entry["license"]], "DateTimeOriginal": entry["taken"],
            "ImageDescription": "physical coin photograph"}.items()}}]}


class AssetPhotos(unittest.TestCase):
    def test_exact_market_subject_and_desk(self):
        for title, code in [("Çmimi i Bitcoin rritet pas flukseve në ETF", "BTC"),
                            ("Ethereum price falls", "ETH"), ("Kursi i euros bie kundrejt dollarit", "EUR")]:
            self.assertEqual(assets.market_asset(story(title)), code)
        for title in ["Bitcoin Cash price rises", "Ethereum Classic price falls", "Bitcoin Core security update",
                      "Bitcoin hack wipes out market gains", "Factory investment rises to 420 million euro",
                      "Bitcoin and Ethereum prices rise", "Euro 2028 ticket prices rise", "Bitcoin mining software released",
                      "Bitcoin mining stocks rise", "BTC Digital price rises", "ETH Zurich market research"]:
            self.assertIsNone(assets.market_asset(story(title)), title)
        self.assertIsNone(assets.market_asset(story(category="Teknologji")))
        self.assertEqual(assets.market_asset({**story("BTC price rises"), "body": "Bitcoin ETF inflows rose."}), "BTC")

    def test_visual_approval_requires_exact_original_current_rights_and_capture_date(self):
        page = reviewed_page()
        self.assertIsNotNone(assets.curated_page(page, "BTC"))
        for key, value in [("sha1", "changed"), ("title", "File:Bitcoin chart.jpg"),
                           ("LicenseShortName", "CC BY-NC 4.0"), ("Artist", "Someone else"),
                           ("DateTimeOriginal", ""), ("DateTimeOriginal", "2026-10-24")]:
            altered = copy.deepcopy(page)
            if key == "title":
                altered[key] = value
            elif key == "sha1":
                altered["imageinfo"][0][key] = value
            else:
                altered["imageinfo"][0]["extmetadata"][key]["value"] = value
            self.assertIsNone(assets.curated_page(altered, "BTC"), key)
        self.assertIsNone(assets.curated_page(page, "ETH"))

    def test_normal_rights_size_source_distinctness_and_batch_reuse_still_apply(self):
        page = reviewed_page()
        lead = story()
        with patch.object(assets, "_current_pages", return_value=[page]), \
                patch.object(policy, "_research", return_value=([], [], [])):
            options = assets.asset_options(lead, {}, {})
        self.assertEqual(len(options), 1)
        photo = options[0]["photo"]
        self.assertIn("Foto ilustruese", photo["image_caption"])
        with patch.object(policy, "photo_fingerprint", return_value=(1600, 1000, "abc", 1234)):
            self.assertEqual(policy.finalize_photo({"_source_fingerprints": [(1600, 1000, "abc", 1234)]}, options[0]), {})
            self.assertEqual(policy.finalize_photo({"_reserve_photo": lambda _: False}, options[0]), {})
            finalized = policy.finalize_photo({}, options[0])
        self.assertTrue(assets.valid_asset_photo(lead, finalized))
        article = {**lead, **finalized}
        with patch.object(policy, "trusted_photo", return_value=finalized):
            self.assertEqual(policy.image_errors(article), [])
            self.assertTrue(policy.image_errors({**article, "title": "Ethereum price falls"}))
            self.assertTrue(policy.image_errors({**article, "image_caption": "Bitcoin today"}))
        page["imageinfo"][0]["extmetadata"]["Restrictions"] = {"value": "trademark"}
        with patch.object(assets, "_current_pages", return_value=[page]), \
                patch.object(policy, "_research", return_value=([], [], [])):
            self.assertEqual(assets.asset_options(lead, {}, {}), [])


if __name__ == "__main__":
    unittest.main()
