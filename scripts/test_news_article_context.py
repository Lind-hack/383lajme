import unittest
from unittest.mock import patch

import news_article_context as nac


ARTICLE = {
    "id": "news-1", "slug": "rama-shiriti", "title": "Rama sqaron çmimin e shiritit",
    "excerpt": "Përparim Rama tha se tarifa është 8.50 euro për metër.",
    "body": "<p>Përparim Rama tha se tarifa është 8.50 euro për metër.</p>"
            "<p>Shiriti paralajmëron kabllot gjatë gërmimeve.</p>"
            "<p>Kurti e kritikoi çmimin.</p>",
    "category": "Kosovë", "url": "https://example.com/a", "video_clip_url": "",
    "raw_article": {"corroborating_sources": [{"url": "https://example.org/b"}]},
}
EVIDENCE = ("Mayor Përparim Rama said the fee of 8.50 euro per metre covers material and labour. "
            "Prime minister Albin Kurti criticised the price after opposition councillors asked for the contract in June.")


class CardChecks(unittest.TestCase):
    def good(self):
        return {"what": "Rama mbrojti tarifën prej 8.50 euro për metër.",
                "what_quotes": ["fee of 8.50 euro per metre"],
                "why": "Debati nisi kur këshilltarët e opozitës kërkuan kontratën.",
                "why_quotes": ["opposition councillors asked for the contract"]}

    def test_a_card_backed_by_quotes_passes_whole(self):
        card = nac.checked_card(self.good(), ARTICLE, EVIDENCE)
        self.assertEqual(card["what"], self.good()["what"])
        self.assertEqual(card["why"], self.good()["why"])

    def test_invented_quote_loses_only_that_line(self):
        row = self.good()
        row["why_quotes"] = ["a secret deal with the contractor"]
        card = nac.checked_card(row, ARTICLE, EVIDENCE)
        self.assertEqual(card["what"], row["what"])
        self.assertEqual(card["why"], "")

    def test_a_number_nobody_reported_is_refused(self):
        row = self.good()
        row["what"] = "Rama mbrojti tarifën prej 9.50 euro për metër."
        self.assertEqual(nac.checked_card(row, ARTICLE, EVIDENCE)["what"], "")

    def test_a_name_nobody_reported_is_refused(self):
        row = self.good()
        row["why"] = "Debati nisi kur Berisha kërkoi kontratën."
        self.assertEqual(nac.checked_card(row, ARTICLE, EVIDENCE)["why"], "")

    def test_inflected_albanian_names_still_match(self):
        row = self.good()
        row["why"] = "Debati u ashpërsua pas kritikave të Kurtit."
        row["why_quotes"] = ["Albin Kurti criticised the price"]
        self.assertTrue(nac.checked_card(row, ARTICLE, EVIDENCE)["why"])

    def test_copied_source_wording_is_refused(self):
        row = self.good()
        row["why"] = "opposition councillors asked for the contract in June said the mayor"
        evidence = EVIDENCE + " opposition councillors asked for the contract in June said the mayor"
        self.assertEqual(nac.checked_card(row, ARTICLE, evidence)["why"], "")

    def test_a_why_that_repeats_what_is_filler_and_dropped(self):
        row = self.good()
        row["why"] = "Rama mbrojti tarifën prej 8.50 euro për metër sot."
        row["why_quotes"] = row["what_quotes"]
        self.assertEqual(nac.checked_card(row, ARTICLE, EVIDENCE)["why"], "")

    def test_missing_fields_from_the_model_never_crash(self):
        self.assertEqual(nac.checked_card({}, ARTICLE, EVIDENCE), {"what": "", "why": ""})
        self.assertEqual(nac.checked_card({"what": 5, "what_quotes": "x"}, ARTICLE, EVIDENCE), {"what": "", "why": ""})


class EmbedRefs(unittest.TestCase):
    def test_each_platform_normalises_to_a_clean_post(self):
        self.assertEqual(nac.embed_ref("https://www.instagram.com/reel/AbC_12-x/?utm_source=ig_embed"),
                         {"platform": "instagram", "id": "AbC_12-x", "kind": "reel",
                          "url": "https://www.instagram.com/reel/AbC_12-x/"})
        self.assertEqual(nac.embed_ref("https://twitter.com/rama/status/123?s=20")["url"], "https://x.com/rama/status/123")
        self.assertEqual(nac.embed_ref("https://www.tiktok.com/@a.b/video/77")["id"], "77")
        self.assertEqual(nac.embed_ref("https://youtu.be/dQw4w9WgXcQ")["id"], "dQw4w9WgXcQ")
        self.assertEqual(nac.embed_ref("https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=3")["id"], "dQw4w9WgXcQ")

    def test_profiles_and_share_links_are_not_posts(self):
        for url in ("https://www.instagram.com/rama/", "https://x.com/intent/tweet?text=a",
                    "http://x.com/a/status/1", "https://evil.example/p/abc/", ""):
            self.assertIsNone(nac.embed_ref(url))

    def test_instagram_author_comes_from_the_embed_markup(self):
        html = '<a href="https://www.instagram.com/shesonair_tar/?utm_source=ig_embed">A post shared by x</a>'
        self.assertEqual(nac.instagram_author(html), "shesonair_tar")
        self.assertEqual(nac.instagram_author(""), "")
        html = '<a href="https://www.instagram.com/p/AbC/?x=1">View</a>'
        self.assertEqual(nac.instagram_author(html), "")

    def test_the_script_locale_is_not_an_account(self):
        html = '<a href="https://www.instagram.com/reel/AbC/">x</a><script src="//www.instagram.com/en_US/embeds.js"></script>'
        self.assertEqual(nac.instagram_author(html), "")


class Paragraphs(unittest.TestCase):
    def test_counted_like_the_site_counts_them(self):
        self.assertEqual(len(nac.paragraphs(ARTICLE["body"])), 3)
        self.assertEqual(nac.paragraphs("Një.\n\nDy."), ["Një.", "Dy."])
        self.assertEqual(nac.paragraphs("<p>A &amp; B</p>"), ["A & B"])


class Media(unittest.TestCase):
    posts = [{"platform": "x", "id": "1", "kind": "", "url": "https://x.com/a/status/1", "author": "kurti", "text": "t"},
             {"platform": "youtube", "id": "dQw4w9WgXcQ", "kind": "", "url": "https://youtu.be/dQw4w9WgXcQ", "author": "c", "text": "t"}]

    def test_picked_posts_land_after_their_paragraph_and_are_clamped(self):
        picks = [{"post": 0, "after_paragraph": 99, "caption": "Kurti për çmimin"}]
        got = nac.chosen_embeds(picks, self.posts, ARTICLE)
        self.assertEqual(got[0]["after"], 2)
        self.assertEqual(got[0]["author"], "kurti")

    def test_unknown_or_bad_picks_are_ignored(self):
        self.assertEqual(nac.chosen_embeds([{"post": 9}, {"post": "x"}, "nope", {}], self.posts, ARTICLE), [])
        self.assertEqual(nac.chosen_embeds(None, self.posts, ARTICLE), [])

    def test_the_article_own_hero_video_is_not_embedded_twice(self):
        article = {**ARTICLE, "video_clip_url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ"}
        self.assertEqual(nac.chosen_embeds([{"post": 1}], self.posts, article), [])

    def test_at_most_three_embeds_one_per_paragraph(self):
        posts = [{**self.posts[0], "id": str(i), "url": f"https://x.com/a/status/{i}"} for i in range(5)]
        picks = [{"post": i, "after_paragraph": i % 3} for i in range(5)]
        got = nac.chosen_embeds(picks, posts, ARTICLE)
        self.assertEqual(sorted(e["after"] for e in got), [0, 1, 2])

    def test_photos_need_a_credit_a_rights_page_and_a_name_in_the_text(self):
        photos = [
            {"src": "https://upload.wikimedia.org/a.jpg", "credit": "Ana · CC BY 4.0", "page": "https://commons.wikimedia.org/wiki/File:A.jpg", "who": "Albin Kurti"},
            {"src": "https://upload.wikimedia.org/b.jpg", "credit": "", "page": "https://commons.wikimedia.org/wiki/File:B.jpg", "who": "Albin Kurti"},
            {"src": "https://upload.wikimedia.org/c.jpg", "credit": "Ana · CC0", "page": "https://commons.wikimedia.org/wiki/File:C.jpg", "who": "Vjosa Osmani"},
            {"src": "https://example.com/d.jpg", "credit": "Ana · CC0", "page": "https://example.com", "who": "Albin Kurti"},
        ]
        got = nac.chosen_photos(photos, ARTICLE, taken=set())
        self.assertEqual([p["src"] for p in got], ["https://upload.wikimedia.org/a.jpg"])
        self.assertEqual(got[0]["after"], 2)

    def test_photo_never_repeats_the_hero_or_sits_on_a_taken_paragraph(self):
        photo = {"src": "https://upload.wikimedia.org/a.jpg", "credit": "A · CC0", "page": "https://commons.wikimedia.org/wiki/File:A.jpg", "who": "Albin Kurti"}
        self.assertEqual(nac.chosen_photos([photo], ARTICLE, taken={2}), [])
        self.assertEqual(nac.chosen_photos([photo], {**ARTICLE, "image_url": photo["src"]}, taken=set()), [])


class Evidence(unittest.TestCase):
    def test_every_source_url_including_the_post_behind_a_social_story(self):
        article = {**ARTICLE, "raw_article": {"corroborating_sources": [{"url": "https://example.org/b"}, {"url": "http://no"}, "x"],
                                              "social_post": {"link": "https://x.com/a/status/9", "caption": "Teksti i postimit"}}}
        self.assertEqual(nac.source_urls(article), ["https://example.com/a", "https://example.org/b"])
        posts, text = nac.own_post(article)
        self.assertEqual(posts, ["https://x.com/a/status/9"])
        self.assertEqual(text, "Teksti i postimit")

    def test_old_rows_without_raw_article_still_work(self):
        article = {**ARTICLE, "raw_article": None}
        self.assertEqual(nac.source_urls(article), ["https://example.com/a"])
        self.assertEqual(nac.own_post(article), ([], ""))

    def test_a_social_post_url_in_source_slot_is_not_fetched_as_a_page(self):
        self.assertEqual(nac.source_urls({"url": "https://x.com/a/status/9", "raw_article": {}}), [])


class Enrich(unittest.TestCase):
    def test_no_usable_sources_writes_nothing_so_the_next_run_can_retry(self):
        with patch.object(nac, "gather", return_value=("", [])):
            self.assertIsNone(nac.enrich(ARTICLE))

    def test_model_outage_is_a_retry_not_an_empty_result(self):
        with patch.object(nac, "gather", return_value=(EVIDENCE, [])), patch.object(nac, "ask", return_value=None):
            self.assertIsNone(nac.enrich(ARTICLE))

    def test_a_refused_card_with_nothing_to_show_is_marked_empty(self):
        row = {"what": "Rama fitoi 500 euro.", "what_quotes": ["nothing"], "why": "", "why_quotes": [], "subjects": [], "media": []}
        with patch.object(nac, "gather", return_value=(EVIDENCE, [])), patch.object(nac, "ask", return_value=row):
            got = nac.enrich(ARTICLE)
        self.assertEqual(got["status"], "empty")
        self.assertNotIn("what", got)

    def test_a_full_context_is_versioned_and_dated(self):
        row = {"what": "Rama mbrojti tarifën prej 8.50 euro për metër.", "what_quotes": ["fee of 8.50 euro per metre"],
               "why": "", "why_quotes": [], "subjects": ["Albin Kurti"], "media": []}
        with patch.object(nac, "gather", return_value=(EVIDENCE, [])), patch.object(nac, "ask", return_value=row), \
             patch.object(nac, "licensed_photos", return_value=[]) as photos:
            got = nac.enrich(ARTICLE)
        self.assertEqual((got["v"], got["status"]), (1, "ok"))
        self.assertTrue(got["checked_at"])
        photos.assert_called_once_with(["Albin Kurti"])


class StricterWhy(unittest.TestCase):
    def test_a_why_proven_only_by_our_own_article_is_padding(self):
        row = {"what": "Rama mbrojti tarifën prej 8.50 euro për metër.", "what_quotes": ["fee of 8.50 euro per metre"],
               "why": "Shiriti paralajmëron kabllot gjatë gërmimeve.", "why_quotes": ["paralajmëron kabllot gjatë gërmimeve"]}
        card = nac.checked_card(row, ARTICLE, EVIDENCE)
        self.assertTrue(card["what"])
        self.assertEqual(card["why"], "")

    def row(self, **extra):
        return {"what": "Rama mbrojti tarifën prej 8.50 euro për metër.", "what_quotes": ["fee of 8.50 euro per metre"],
                "why": "Debati nisi kur këshilltarët e opozitës kërkuan kontratën.",
                "why_quotes": ["opposition councillors asked for the contract"], "subjects": [], "media": [], **extra}

    def run_with(self, second, row=None, videos=()):
        with patch.object(nac, "gather", return_value=(EVIDENCE, [])), patch.object(nac, "ask", return_value=row or self.row()), \
             patch.object(nac, "second_look", return_value=second) as look, patch.object(nac, "find_videos", return_value=list(videos)):
            return nac.enrich(ARTICLE), look

    def test_a_why_the_second_look_supports_stays(self):
        got, _ = self.run_with({"why_supported": True, "videos": []})
        self.assertIn("why", got)

    def test_a_why_the_second_look_refuses_goes_and_the_card_stays(self):
        got, _ = self.run_with({"why_supported": False, "videos": []})
        self.assertNotIn("why", got)
        self.assertTrue(got["what"])

    def test_a_truthy_string_is_not_a_yes(self):
        got, _ = self.run_with({"why_supported": "false", "videos": []})
        self.assertNotIn("why", got)

    def test_second_look_outage_retries_instead_of_publishing_unchecked(self):
        got, _ = self.run_with(None)
        self.assertIsNone(got)

    def test_no_why_and_no_videos_needs_no_second_call(self):
        got, look = self.run_with({"why_supported": True}, row=self.row(why="", why_quotes=[]))
        self.assertEqual(got["status"], "ok")
        look.assert_not_called()


class VideoMatch(unittest.TestCase):
    def video(self, text, author="c"):
        return {"text": text, "author": author}

    def test_a_similar_word_is_not_the_person(self):
        article = {"title": "Imazhi i Londrimit shfaqet në Times Square"}
        self.assertFalse(nac.video_matches(self.video("15 Cursed Places in London No One Can Explain", "Deserted UK"), article, []))

    def test_one_generic_place_word_is_not_enough(self):
        article = {"title": "Imazhi i Londrimit shfaqet në Times Square"}
        self.assertFalse(nac.video_matches(self.video("Walking through Times at night"), article, []))

    def test_two_headline_names_are_enough(self):
        article = {"title": "Imazhi i Londrimit shfaqet në Times Square"}
        self.assertTrue(nac.video_matches(self.video("Londrim on the Times Square billboard"), article, []))

    def test_the_story_person_in_title_or_channel_is_enough(self):
        article = {"title": "Këngëtarja publikon një këngë"}
        self.assertTrue(nac.video_matches(self.video("hey boyyy (Official Video)", "SlayyyterVEVO"), article, ["Slayyyter"]))
        self.assertFalse(nac.video_matches(self.video("hey boyyy (Official Video)", "someone"), article, ["Slayyyter"]))

    def test_missing_fields_never_crash(self):
        self.assertFalse(nac.video_matches({}, {}, []))


class VideoSearch(unittest.TestCase):
    video = {"platform": "youtube", "id": "CY_mohRjzqM", "kind": "", "url": "https://www.youtube.com/watch?v=CY_mohRjzqM",
             "author": "slayyyter", "text": "Slayyyter - hey boyyy (Official Video)"}

    def test_a_picked_search_result_lands_in_the_text(self):
        row = {"what": "", "what_quotes": [], "why": "", "why_quotes": [], "subjects": ["Slayyyter"], "media": [], "video_search": "Slayyyter hey boyyy"}
        second = {"why_supported": False, "videos": [{"video": 0, "after_paragraph": 1, "caption": "Videoklipi"}]}
        with patch.object(nac, "gather", return_value=(EVIDENCE, [])), patch.object(nac, "ask", return_value=row), \
             patch.object(nac, "find_videos", return_value=[self.video]) as find, patch.object(nac, "second_look", return_value=second), \
             patch.object(nac, "licensed_photos", return_value=[]):
            got = nac.enrich(ARTICLE)
        find.assert_called_once_with("Slayyyter hey boyyy")
        self.assertEqual([(m["platform"], m["id"], m["after"]) for m in got["media"]], [("youtube", "CY_mohRjzqM", 1)])

    def test_a_refused_search_result_shows_nothing(self):
        row = {"what": "", "what_quotes": [], "why": "", "why_quotes": [], "subjects": ["Slayyyter"], "media": [], "video_search": "x y"}
        with patch.object(nac, "gather", return_value=(EVIDENCE, [])), patch.object(nac, "ask", return_value=row), \
             patch.object(nac, "find_videos", return_value=[self.video]), patch.object(nac, "second_look", return_value={"videos": []}), \
             patch.object(nac, "licensed_photos", return_value=[]):
            self.assertEqual(nac.enrich(ARTICLE)["status"], "empty")

    def test_a_video_about_someone_else_never_reaches_the_second_look(self):
        row = {"what": "", "what_quotes": [], "why": "", "why_quotes": [], "subjects": ["Slayyyter"], "media": [], "video_search": "x y"}
        other = {**self.video, "author": "Deserted UK", "text": "15 Cursed Places in London"}
        with patch.object(nac, "gather", return_value=(EVIDENCE, [])), patch.object(nac, "ask", return_value=row), \
             patch.object(nac, "find_videos", return_value=[other]), patch.object(nac, "second_look") as look, \
             patch.object(nac, "licensed_photos", return_value=[]):
            self.assertEqual(nac.enrich(ARTICLE)["status"], "empty")
        look.assert_not_called()

    def test_no_search_when_the_model_asks_for_none(self):
        row = {"what": "", "what_quotes": [], "why": "", "why_quotes": [], "subjects": [], "media": [], "video_search": ""}
        with patch.object(nac, "gather", return_value=(EVIDENCE, [])), patch.object(nac, "ask", return_value=row), \
             patch.object(nac, "find_videos") as find:
            nac.enrich(ARTICLE)
        find.assert_not_called()


if __name__ == "__main__":
    unittest.main()
