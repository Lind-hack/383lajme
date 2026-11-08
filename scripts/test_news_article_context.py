import sys
import types
import unittest
from unittest.mock import patch

import news_article_context as nac

REAL_EVENT_POSTS = nac.event_posts  # kept before setUpModule patches it out


def setUpModule():
    # Own-account reads go to Wikidata and the scout's accounts; tests that need them patch it again.
    global _no_accounts
    global _no_search
    _no_accounts = patch.object(nac, "account_posts", return_value=[])
    _no_accounts.start()
    _no_search = patch.object(nac, "event_posts", return_value=[])
    _no_search.start()


def tearDownModule():
    _no_accounts.stop()
    _no_search.stop()


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
            {"src": "https://upload.wikimedia.org/a.jpg", "credit": "Ana · CC BY 4.0", "page": "https://commons.wikimedia.org/wiki/File:A.jpg", "who": "Përparim Rama"},
            {"src": "https://upload.wikimedia.org/b.jpg", "credit": "", "page": "https://commons.wikimedia.org/wiki/File:B.jpg", "who": "Përparim Rama"},
            {"src": "https://upload.wikimedia.org/c.jpg", "credit": "Ana · CC0", "page": "https://commons.wikimedia.org/wiki/File:C.jpg", "who": "Vjosa Osmani"},
            {"src": "https://example.com/d.jpg", "credit": "Ana · CC0", "page": "https://example.com", "who": "Përparim Rama"},
        ]
        got = nac.chosen_photos(photos, ARTICLE, taken=set())
        self.assertEqual([p["src"] for p in got], ["https://upload.wikimedia.org/a.jpg"])
        self.assertEqual(got[0]["after"], 0)

    def test_a_side_character_named_only_in_the_body_gets_no_photo(self):
        # Live 2026-11-07: Russell's story showed Hamilton and Antonelli, Lawson's showed Tsolov.
        kurti = {"src": "https://upload.wikimedia.org/k.jpg", "credit": "A · CC0", "page": "https://commons.wikimedia.org/wiki/File:K.jpg", "who": "Albin Kurti"}
        self.assertEqual(nac.chosen_photos([kurti], ARTICLE, taken=set()), [])

    def test_photo_never_repeats_the_hero_or_sits_on_a_taken_paragraph(self):
        photo = {"src": "https://upload.wikimedia.org/a.jpg", "credit": "A · CC0", "page": "https://commons.wikimedia.org/wiki/File:A.jpg", "who": "Përparim Rama"}
        self.assertEqual(nac.chosen_photos([photo], ARTICLE, taken={0})[0]["after"], 1)
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
        article = {"title": "Slayyyter publikon një këngë"}
        self.assertTrue(nac.video_matches(self.video("hey boyyy (Official Video)", "SlayyyterVEVO"), article, ["Slayyyter"]))
        self.assertFalse(nac.video_matches(self.video("hey boyyy (Official Video)", "someone"), article, ["Slayyyter"]))

    def test_missing_fields_never_crash(self):
        self.assertFalse(nac.video_matches({}, {}, []))


class LiveFailures(unittest.TestCase):
    """Each case is a real mistake from the first day on 383ks.com (2026-11-07)."""

    def test_a_body_only_name_does_not_make_a_video_belong_to_the_story(self):
        article = {"title": "Gonxhja dhe Zhupa debatojnë në Tiranë për bllokimin e rrugëve"}
        video = {"author": "Report TV", "text": "Nuk ju lënë as të rrini në trotuar/Malaj ironizon PD për protestat: Mendoni se do t'ju japin votën?"}
        self.assertFalse(nac.video_matches(video, article, ["Erjon Malaj", "Ina Zhupa"]))

    def test_a_headline_person_in_the_video_title_is_enough(self):
        article = {"title": "Antonelli synon fitoren në Brazil pas titullit të F1"}
        video = {"author": "FORMULA 1", "text": "Kimi Antonelli Is The F1 World Champion!"}
        self.assertTrue(nac.video_matches(video, article, ["Kimi Antonelli"]))

    def test_a_caption_may_only_name_people_the_video_shows(self):
        article = {**ARTICLE, "title": "Antonelli synon fitoren në Brazil pas titullit të F1",
                   "body": "<p>Antonelli mori urime nga Senna.</p>"}
        posts = [{"platform": "youtube", "id": "oNWNW8CGdXc", "kind": "", "url": "https://www.youtube.com/watch?v=oNWNW8CGdXc",
                  "author": "F1 Chequered Flag", "text": "Kimi Antonelli celebrating with Bono & Toto Wolff after winning Championship in Mexico"}]
        evidence = "Antonelli received messages from the Senna family."
        bad = nac.chosen_embeds([{"post": 0, "caption": "Antonelli kaloi kohë me familjen Senna."}], posts, article, evidence)
        self.assertEqual(bad[0]["caption"], "")
        good = nac.chosen_embeds([{"post": 0, "caption": "Antonelli feston me Toto Wolff."}], posts, article, evidence)
        self.assertEqual(good[0]["caption"], "Antonelli feston me Toto Wolff.")

    def test_two_search_videos_per_article_at_most(self):
        video = {"platform": "youtube", "id": "", "kind": "", "url": "", "author": "FORMULA 1", "text": "Slayyyter hey boyyy"}
        videos = [{**video, "id": f"aaaaaaaaaa{i}", "url": f"https://www.youtube.com/watch?v=aaaaaaaaaa{i}"} for i in range(3)]
        row = {"what": "", "what_quotes": [], "why": "", "why_quotes": [], "subjects": ["Slayyyter"], "media": [], "video_search": "x"}
        second = {"videos": [{"video": i, "after_paragraph": i} for i in range(3)]}
        article = {**ARTICLE, "title": "Slayyyter publikon Hey Boyyy"}
        with patch.object(nac, "gather", return_value=(EVIDENCE, [])), patch.object(nac, "ask", return_value=row), \
             patch.object(nac, "find_videos", return_value=videos), patch.object(nac, "second_look", return_value=second), \
             patch.object(nac, "licensed_photos", return_value=[]):
            got = nac.enrich(article)
        self.assertEqual(len([m for m in got["media"] if m["platform"] == "youtube"]), 2)


class MixedQuotes(unittest.TestCase):
    """Live 2026-11-07: 19 of 24 reasons died because one of three quotes came from our own article."""

    def test_article_and_source_quotes_together_keep_the_why(self):
        row = {"why": "Debati nisi kur këshilltarët e opozitës kërkuan kontratën.",
               "why_quotes": ["opposition councillors asked for the contract", "paralajmëron kabllot gjatë gërmimeve"]}
        self.assertTrue(nac.checked_card(row, ARTICLE, EVIDENCE)["why"])

    def test_one_invented_quote_still_sinks_the_line(self):
        row = {"why": "Debati nisi kur këshilltarët e opozitës kërkuan kontratën.",
               "why_quotes": ["opposition councillors asked for the contract", "a quote that exists nowhere at all"]}
        checks = {}
        self.assertEqual(nac.checked_card(row, ARTICLE, EVIDENCE, checks)["why"], "")
        self.assertEqual(checks["why"], "invented_quote")

    def test_a_titled_post_from_a_source_page_must_also_be_about_the_headline_person(self):
        # Live: a Report TV clip of Erjon Malaj, embedded on a source page, sat in the Gonxhja-Zhupa story.
        article = {**ARTICLE, "title": "Gonxhja dhe Zhupa debatojnë në Tiranë për bllokimin e rrugëve"}
        malaj = {"platform": "youtube", "id": "wHmyoHeBPic", "kind": "", "url": "https://www.youtube.com/watch?v=wHmyoHeBPic",
                 "author": "Report TV", "text": "Malaj ironizon PD për protestat"}
        own = {"platform": "instagram", "id": "DfZzeEQjiWI", "kind": "p", "url": "https://www.instagram.com/p/DfZzeEQjiWI/", "author": "", "text": ""}
        row = {"what": "", "what_quotes": [], "why": "", "why_quotes": [], "subjects": ["Ina Zhupa", "Erjon Malaj"],
               "media": [{"post": 0, "after_paragraph": 0}, {"post": 1, "after_paragraph": 1}]}
        with patch.object(nac, "gather", return_value=(EVIDENCE, [malaj, own])), patch.object(nac, "ask", return_value=row), \
             patch.object(nac, "licensed_photos", return_value=[]):
            got = nac.enrich(article)
        self.assertEqual([m["platform"] for m in got["media"]], ["instagram"])


class MoreContext(unittest.TestCase):
    """2026-11-07: Lind asked for far more photos and video on every article, still only real and licensed."""

    article = {**ARTICLE, "title": "Blue Origin teston Northstar për raketën New Glenn në Humenné",
               "body": "<p>Blue Origin njoftoi testin.</p><p>Motori Northstar do të zëvendësojë BE-4.</p><p>Raketa New Glenn fluturon nga Florida.</p>",
               "image_url": ""}

    def photo(self, who, name):
        return {"src": f"https://upload.wikimedia.org/{name}.jpg", "credit": "A · CC BY 4.0",
                "page": f"https://commons.wikimedia.org/wiki/File:{name}.jpg", "who": who}

    def test_headline_things_and_places_get_photos_not_only_people(self):
        got = nac.chosen_photos([self.photo("Blue Origin", "bo"), self.photo("New Glenn", "ng"), self.photo("Humenné", "hu")],
                                self.article, taken=set())
        self.assertEqual([p["who"] for p in got], ["Blue Origin", "New Glenn", "Humenné"])

    def test_an_english_spelling_unlike_the_albanian_headline_is_left_out(self):
        # Texas vs "Teksas": loosening the match would also let London pass for Londrim.
        article = {**self.article, "title": "Blue Origin teston në Teksas"}
        self.assertEqual(nac.chosen_photos([self.photo("Texas", "tx")], article, taken=set()), [])

    def test_a_photo_goes_where_the_text_names_it(self):
        got = nac.chosen_photos([self.photo("New Glenn", "ng")], self.article, taken=set())
        self.assertEqual(got[0]["after"], 2)

    def test_a_headline_place_the_body_never_names_takes_the_first_free_paragraph(self):
        got = nac.chosen_photos([self.photo("Humenné", "hu")], self.article, taken={0})
        self.assertEqual(got[0]["after"], 1)

    def test_a_named_paragraph_that_is_taken_falls_to_the_next_free_one(self):
        got = nac.chosen_photos([self.photo("New Glenn", "ng")], self.article, taken={2})
        self.assertEqual(got[0]["after"], 0)

    def test_no_free_paragraph_means_no_photo(self):
        self.assertEqual(nac.chosen_photos([self.photo("Humenné", "hu")], self.article, taken={0, 1, 2}), [])

    def test_still_nothing_the_headline_does_not_name(self):
        self.assertEqual(nac.chosen_photos([self.photo("Jeff Bezos", "jb")], self.article, taken=set()), [])

    def test_this_job_asks_only_the_model_that_answers(self):
        # gemini-2.5-flash answered 429 or 404 to every call on 2026-11-07: two wasted requests each.
        self.assertEqual(nac.os.environ.get("L383_SOCIAL_MODELS"), "gemini-3.1-flash-lite")


class SecondDay(unittest.TestCase):
    """Real picks from the 2026-11-07 dry run with more media."""

    def test_one_shared_word_of_a_place_is_not_the_place(self):
        article = {"title": "Imazhi i Londrimit shfaqet në Times Square për ditëlindjen e tij"}
        busker = {"author": "The Polyglot Photographer", "text": "One Busker Made An Entire London Square Sing Together (Full Video)"}
        self.assertFalse(nac.video_matches(busker, article, ["Times Square"]))
        right = {"author": "fan", "text": "Londrim birthday billboard in Times Square"}
        self.assertTrue(nac.video_matches(right, article, ["Times Square"]))

    def test_a_full_name_in_the_video_title_matches(self):
        article = {"title": "Antonelli synon fitoren në Brazil pas titullit të F1"}
        self.assertTrue(nac.video_matches({"author": "FORMULA 1", "text": "Kimi Antonelli Is The F1 World Champion!"}, article, ["Kimi Antonelli"]))

    def test_a_photo_years_older_than_the_story_is_decoration(self):
        article = {**ARTICLE, "title": "Norris: Përmirësimet e McLarenit në Brazil", "body": "<p>McLaren sjell përmirësime.</p><p>Norris foli.</p>", "image_url": ""}
        old = {"src": "https://upload.wikimedia.org/Hakkinen_france_2000.jpg", "credit": "A · CC BY-SA 3.0",
               "page": "https://commons.wikimedia.org/wiki/File:Hakkinen_france_2000.jpg", "who": "McLaren"}
        new = {"src": "https://upload.wikimedia.org/2026_Chinese_GP_-_McLaren.jpg", "credit": "A · CC BY 4.0",
               "page": "https://commons.wikimedia.org/wiki/File:2026_Chinese_GP_-_McLaren.jpg", "who": "McLaren"}
        undated = {"src": "https://upload.wikimedia.org/Lando_Norris.jpg", "credit": "A · CC BY 4.0",
                   "page": "https://commons.wikimedia.org/wiki/File:Lando_Norris.jpg", "who": "Lando Norris"}
        got = nac.chosen_photos([old, new, undated], article, taken=set())
        self.assertEqual([p["src"].rsplit("/", 1)[-1] for p in got], ["2026_Chinese_GP_-_McLaren.jpg", "Lando_Norris.jpg"])

    def test_a_photo_without_a_named_creator_is_refused(self):
        # video_edition_media falls back to "Wikimedia Commons" when the file names no artist.
        article = {**ARTICLE, "image_url": ""}
        photo = {"src": "https://upload.wikimedia.org/r.jpg", "credit": "Wikimedia Commons · CC BY-SA 4.0",
                 "page": "https://commons.wikimedia.org/wiki/File:R.jpg", "who": "Përparim Rama"}
        self.assertEqual(nac.chosen_photos([photo], article, taken=set()), [])

    def test_only_the_lead_photo_wikipedia_chose_is_used(self):
        # Commons "depicts" tags brought a women's handball photo for Bayer 04 Leverkusen's football story.
        fake = types.SimpleNamespace(
            wiki_pages=lambda subjects: {"Bayer 04 Leverkusen": {"image": "Leverkusen_logo.svg", "lat": None, "qid": "Q1"},
                                          "Albin Kurti": {"image": "Albin_Kurti_2022.jpg", "lat": None, "qid": "Q2"}},
            story_photos=lambda story, subjects, pages: [
                {"src": "https://upload.wikimedia.org/h.jpg", "file": "File:2023-09-09_Handball,_Bundesliga_Frauen.jpg", "who": "Bayer 04 Leverkusen"},
                {"src": "https://upload.wikimedia.org/k.jpg", "file": "File:Albin Kurti 2022.jpg", "who": "Albin Kurti"},
                {"src": "https://upload.wikimedia.org/k2.jpg", "file": "File:Albin_Kurti_rally.jpg", "who": "Albin Kurti"}])
        with patch.dict(sys.modules, {"video_edition_media": fake}):
            got = nac.licensed_photos(["Bayer 04 Leverkusen", "Albin Kurti"])
        self.assertEqual([p["src"] for p in got], ["https://upload.wikimedia.org/k.jpg"])

    def test_file_years_are_read_from_the_name(self):
        self.assertEqual(nac.file_year("GS-B.Leverkusen_13.2.2008-1.jpg"), 2008)
        self.assertEqual(nac.file_year("2010_Malaysian_GP_opening_lap.jpg"), 2010)
        self.assertEqual(nac.file_year("Albin_Kurti_2022.jpg"), 2022)
        self.assertIsNone(nac.file_year("NS-21_InternPhoto.jpg"))
        self.assertIsNone(nac.file_year("ITB56439.jpg"))


class OwnAccounts(unittest.TestCase):
    """2026-11-07: the headline person's own X and Instagram posts, found through Wikidata."""

    def test_official_usernames_come_from_wikidata_claims(self):
        entities = {"Q1": {"claims": {"P2002": [{"mainsnak": {"datavalue": {"value": "ediramaal"}}}],
                                      "P2003": [{"mainsnak": {"datavalue": {"value": "ediramaal"}}, "rank": "deprecated"},
                                                {"mainsnak": {"datavalue": {"value": "edirama.al"}}}]}},
                    "Q2": {"claims": {}}, "Q3": {"missing": ""}}
        self.assertEqual(nac.accounts_from_claims(entities), {"Q1": {"x": "ediramaal", "ig": "edirama.al"}})

    def test_bad_usernames_are_never_used(self):
        entities = {"Q1": {"claims": {"P2002": [{"mainsnak": {"datavalue": {"value": "../../etc"}}}]}}}
        self.assertEqual(nac.accounts_from_claims(entities), {})

    def test_only_headline_subjects_are_looked_up(self):
        article = {**ARTICLE, "title": "Edi Rama publikon detaje për Bypass-in e Tiranës"}
        pages = {"Edi Rama": {"qid": "Q1"}, "Erion Veliaj": {"qid": "Q9"}}
        with patch.object(nac, "wiki_lookup", return_value=pages), \
             patch.object(nac, "wikidata_entities", return_value={"Q1": {"claims": {"P2002": [{"mainsnak": {"datavalue": {"value": "ediramaal"}}}]}}}) as wd:
            got = nac.subject_accounts(["Edi Rama", "Erion Veliaj"], article)
        wd.assert_called_once_with(["Q1"])
        self.assertEqual(got, [{"name": "Edi Rama", "x": "ediramaal"}])

    def test_own_posts_go_to_the_second_look_and_two_at_most_are_kept(self):
        article = {**ARTICLE, "title": "Rama sqaron çmimin e shiritit"}
        own = [{"platform": "x", "id": str(i), "kind": "", "url": f"https://x.com/ramaperparim/status/{i}", "author": "Përparim Rama",
                "text": "Shiriti kushton 8.50 euro", "account": True} for i in range(1, 4)]
        row = {"what": "", "what_quotes": [], "why": "", "why_quotes": [], "subjects": ["Përparim Rama"], "media": [], "video_search": ""}
        second = {"videos": [{"video": i, "after_paragraph": i} for i in range(3)]}
        with patch.object(nac, "gather", return_value=(EVIDENCE, [])), patch.object(nac, "ask", return_value=row), \
             patch.object(nac, "account_posts", return_value=own), patch.object(nac, "second_look", return_value=second) as look, \
             patch.object(nac, "licensed_photos", return_value=[]):
            got = nac.enrich(article)
        self.assertEqual(len(look.call_args.args[3]), 3)
        self.assertEqual([m["platform"] for m in got["media"]], ["x", "x"])

    def test_an_own_post_is_not_refused_for_not_naming_its_author(self):
        # Rama's own tweet does not say "Rama": the account is the proof, and the second look judges the topic.
        article = {**ARTICLE, "title": "Rama sqaron çmimin e shiritit"}
        own = [{"platform": "x", "id": "7", "kind": "", "url": "https://x.com/ramaperparim/status/7", "author": "Përparim Rama",
                "text": "Shiriti kushton 8.50 euro për metër", "account": True}]
        row = {"what": "", "what_quotes": [], "why": "", "why_quotes": [], "subjects": ["Përparim Rama"], "media": [], "video_search": ""}
        with patch.object(nac, "gather", return_value=(EVIDENCE, [])), patch.object(nac, "ask", return_value=row), \
             patch.object(nac, "account_posts", return_value=own), patch.object(nac, "second_look", return_value={"videos": [{"video": 0}]}), \
             patch.object(nac, "licensed_photos", return_value=[]):
            got = nac.enrich(article)
        self.assertEqual([m["id"] for m in got["media"]], ["7"])


class OwnPostTopic(unittest.TestCase):
    """An account proves who posted, not what about: @TimesSquareNYC's "place to be" post was captioned as Londrim's billboard."""

    def test_a_post_naming_only_its_own_subject_is_off_topic(self):
        article = {"title": "Imazhi i Londrimit shfaqet në Times Square për ditëlindjen e tij"}
        post = {"author": "Times Square", "text": "Times Square is the place to be! #TimesSquare #NYC #NewYork #VisitNYC"}
        self.assertFalse(nac.own_post_on_topic(post, article, ["Times Square"]))

    def test_a_post_naming_another_headline_name_is_on_topic(self):
        article = {"title": "Reform UK zgjedh Angus MacIntyre si zëdhënës për mbrojtjen"}
        post = {"author": "Reform UK", "text": "We are delighted to announce Angus MacIntyre as our defence spokesman."}
        self.assertTrue(nac.own_post_on_topic(post, article, ["Reform UK"]))

    def test_a_headline_topic_word_is_enough(self):
        article = {"title": "Rama sqaron çmimin e shiritit"}
        post = {"author": "Përparim Rama", "text": "Shiriti kushton 8.50 euro për metër"}
        self.assertTrue(nac.own_post_on_topic(post, article, ["Përparim Rama"]))

    def test_an_off_topic_own_post_never_reaches_the_second_look(self):
        article = {**ARTICLE, "title": "Imazhi i Londrimit shfaqet në Times Square për ditëlindjen e tij"}
        own = [{"platform": "x", "id": "2118772538872582619", "kind": "", "url": "https://x.com/TimesSquareNYC/status/2118772538872582619",
                "author": "Times Square", "text": "Times Square is the place to be! #TimesSquare #NYC", "account": True}]
        row = {"what": "", "what_quotes": [], "why": "", "why_quotes": [], "subjects": ["Times Square"], "media": [], "video_search": ""}
        with patch.object(nac, "gather", return_value=(EVIDENCE, [])), patch.object(nac, "ask", return_value=row),              patch.object(nac, "account_posts", return_value=own), patch.object(nac, "second_look") as look,              patch.object(nac, "licensed_photos", return_value=[]):
            nac.enrich(article)
        look.assert_not_called()


class Scope(unittest.TestCase):
    def test_every_desk_gets_context(self):
        for category, expected in (("Botë", True), ("Bote", True), ("Showbiz", True), ("Ekonomi", True),
                                   ("Kosovë", True), ("Sport", True), ("Shëndetësi", True), ("", False), (None, False)):
            self.assertEqual(nac.in_scope({"category": category}), expected, category)

    def test_waiting_skips_rows_without_a_desk_and_asks_for_the_publish_date(self):
        rows = [{"slug": "a", "category": ""}, {"slug": "b", "category": "Sport"}, {"slug": "c", "category": "Ekonomi"}]
        with patch.object(nac, "supabase_get", return_value=rows) as get:
            got = nac.waiting(24, 1)
        self.assertEqual([r["slug"] for r in got], ["b"])
        self.assertIn("published_at", get.call_args.args[0])

    def test_one_named_article_is_never_filtered(self):
        with patch.object(nac, "supabase_get", return_value=[{"slug": "a", "category": "Sport"}]):
            self.assertEqual(len(nac.waiting(24, 5, slug="a")), 1)


class ReviewRound3(unittest.TestCase):
    def test_a_headline_name_matches_only_at_a_word_start(self):
        self.assertFalse(nac.in_headline("Edi Rama", {"title": "Ramazani nis në Tiranë"}))
        self.assertTrue(nac.in_headline("Edi Rama", {"title": "Rama sqaron çmimin"}))
        self.assertTrue(nac.in_headline("Albin Kurti", {"title": "Kurtit i kërkohet dorëheqja"}))

    def test_missing_mode_takes_only_articles_without_media_or_why_and_three_tries_at_most(self):
        rows = [{"slug": "none", "category": "Botë", "raw_article": {}},
                {"slug": "full", "category": "Botë", "raw_article": {"context": {"status": "ok", "why": "x", "media": [{"kind": "photo"}]}}},
                {"slug": "no-why", "category": "Botë", "raw_article": {"context": {"status": "ok", "media": [{"kind": "photo"}]}}},
                {"slug": "no-media", "category": "Showbiz", "raw_article": {"context": {"status": "ok", "why": "x", "media": []}}},
                {"slug": "tired", "category": "Ekonomi", "raw_article": {"context": {"status": "empty", "tries": 3}}},
                {"slug": "old-row", "category": "Ekonomi", "raw_article": None}]
        self.assertEqual([r["slug"] for r in nac.still_missing(rows)], ["none", "no-why", "no-media", "old-row"])

    def test_a_rerun_never_replaces_good_context_with_less(self):
        good = {"status": "ok", "what": "a", "media": [{"kind": "photo"}]}
        self.assertFalse(nac.worth_saving({"status": "empty"}, good))
        self.assertFalse(nac.worth_saving({"status": "ok", "what": "a", "media": []}, good))
        self.assertTrue(nac.worth_saving({"status": "ok", "what": "a", "why": "b", "media": [{"kind": "photo"}]}, good))
        self.assertTrue(nac.worth_saving({"status": "empty"}, None))
        self.assertTrue(nac.worth_saving({"status": "ok", "what": "a", "media": []}, {"status": "empty"}))

    def test_tries_are_counted_across_runs(self):
        self.assertEqual(nac.with_tries({"status": "empty"}, {"status": "empty", "tries": 2})["tries"], 3)
        self.assertEqual(nac.with_tries({"status": "ok"}, None)["tries"], 1)
        self.assertEqual(nac.with_tries({"status": "ok"}, {"tries": "x"})["tries"], 1)


class Checks(unittest.TestCase):
    """Why a line was dropped is stored, so a day of runs can be measured instead of guessed."""

    def test_each_drop_has_a_reason(self):
        cases = {
            "none_offered": {"why": ""},
            "invented_quote": {"why": "Debati nisi kur këshilltarët kërkuan kontratën.", "why_quotes": ["nothing like this"]},
            "no_outside_quote": {"why": "Shiriti paralajmëron kabllot gjatë gërmimeve.", "why_quotes": ["paralajmëron kabllot gjatë gërmimeve"]},
            "unknown_number": {"why": "Debati nisi kur 40 këshilltarë kërkuan kontratën.", "why_quotes": ["opposition councillors asked for the contract"]},
            "unknown_name": {"why": "Debati nisi kur Berisha kërkoi kontratën.", "why_quotes": ["opposition councillors asked for the contract"]},
        }
        for reason, row in cases.items():
            checks = {}
            nac.checked_card(row, ARTICLE, EVIDENCE, checks)
            self.assertEqual(checks.get("why"), reason, reason)

    def test_a_kept_line_has_no_reason(self):
        checks = {}
        nac.checked_card({"what": "Rama mbrojti tarifën prej 8.50 euro për metër.", "what_quotes": ["fee of 8.50 euro per metre"]},
                         ARTICLE, EVIDENCE, checks)
        self.assertNotIn("what", checks)

    def test_the_stored_context_carries_the_reasons(self):
        row = {"what": "Rama mbrojti tarifën prej 8.50 euro për metër.", "what_quotes": ["fee of 8.50 euro per metre"],
               "why": "Debati nisi kur këshilltarët e opozitës kërkuan kontratën.", "why_quotes": ["opposition councillors asked for the contract"],
               "subjects": [], "media": []}
        with patch.object(nac, "gather", return_value=(EVIDENCE, [])), patch.object(nac, "ask", return_value=row), \
             patch.object(nac, "find_videos", return_value=[]), patch.object(nac, "second_look", return_value={"why_supported": False}):
            got = nac.enrich(ARTICLE)
        self.assertEqual(got["checks"]["why"], "second_look_refused")


class VideoSearch(unittest.TestCase):
    video = {"platform": "youtube", "id": "CY_mohRjzqM", "kind": "", "url": "https://www.youtube.com/watch?v=CY_mohRjzqM",
             "author": "slayyyter", "text": "Slayyyter - hey boyyy (Official Video)"}

    def test_a_picked_search_result_lands_in_the_text(self):
        row = {"what": "", "what_quotes": [], "why": "", "why_quotes": [], "subjects": ["Slayyyter"], "media": [], "video_search": "Slayyyter hey boyyy"}
        second = {"why_supported": False, "videos": [{"video": 0, "after_paragraph": 1, "caption": "Videoklipi"}]}
        with patch.object(nac, "gather", return_value=(EVIDENCE, [])), patch.object(nac, "ask", return_value=row), \
             patch.object(nac, "find_videos", return_value=[self.video]) as find, patch.object(nac, "second_look", return_value=second), \
             patch.object(nac, "licensed_photos", return_value=[]):
            got = nac.enrich({**ARTICLE, "title": "Slayyyter publikon Hey Boyyy"})
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


class MarketChart(unittest.TestCase):
    """A chart of the price a business story is about, from free official data, never a guess."""

    def story(self, title, category="Ekonomi"):
        return {**ARTICLE, "title": title, "category": category, "published_at": "2026-11-06T10:00:00+00:00"}

    def test_a_coin_or_currency_in_an_economy_headline_picks_its_series(self):
        self.assertEqual(nac.chart_asset(self.story("ETF-të e bitcoinit në SHBA me 75 milionë hyrje neto"))["id"], "bitcoin")
        self.assertEqual(nac.chart_asset(self.story("Banka e Anglisë rrit normën, hapa të tjerë"))["currency"], "GBP")
        self.assertEqual(nac.chart_asset(self.story("Dollari bie pas vendimit të Fed-it"))["currency"], "USD")
        self.assertEqual(nac.chart_asset(self.story("Lira turke në rënie të re"))["currency"], "TRY")

    def test_other_desks_and_lookalike_words_get_no_chart(self):
        self.assertIsNone(nac.chart_asset(self.story("Bitcoin rritet", category="Botë")))
        # "lirë" is cheap and "jenë" is "are"; "Ethernet" is not Ether.
        self.assertIsNone(nac.chart_asset(self.story("Banesat më të lira në Prishtinë")))
        self.assertIsNone(nac.chart_asset(self.story("Kabllot Ethernet shtrenjtohen")))
        self.assertIsNone(nac.chart_asset(self.story("KESCO: konsumi i rrymës u rrit 4.1 për qind")))

    def test_hourly_prices_become_one_close_a_day(self):
        day = 86_400_000
        start = 1_791_504_000_000  # 2026-10-09 00:00 UTC
        pairs = [[start, 10.0], [start + day // 2, 11.0], [start + day, 12.0], [start + day + 3_600_000, 13.5]]
        self.assertEqual(nac.daily_closes(pairs), [["2026-10-09", 11.0], ["2026-10-10", 13.5]])

    def test_a_chart_backfill_takes_only_old_economy_cards_without_one(self):
        card = {"v": 1, "status": "ok", "what": "W", "why": "Y", "media": [{"kind": "photo"}]}
        old = {**self.story("Dollari bie pas vendimit"), "raw_article": {"context": card}}
        charted = {**old, "raw_article": {"context": {**card, "chart": {"points": []}}}}
        fresh = {**self.story("Dollari bie"), "raw_article": {}}
        other = {**self.story("KESCO rrit tarifat"), "raw_article": {"context": card}}
        self.assertEqual(nac.chart_pending([old, charted, fresh, other]), [old])

    def test_a_backfilled_chart_leaves_the_card_as_it_was(self):
        card = {"v": 1, "status": "ok", "what": "W", "why": "Y", "media": [{"kind": "photo"}], "tries": 2}
        chart = {"label": "Bitcoin", "points": [["2026-11-01", 1.0]]}
        self.assertEqual(nac.with_chart(card, chart), {**card, "chart": chart})
        self.assertEqual(nac.with_chart({"v": 1, "status": "empty", "media": []}, chart)["status"], "ok")

    def test_ecb_rates_are_read_from_its_csv(self):
        csv_text = ("KEY,FREQ,TIME_PERIOD,OBS_VALUE,TITLE\n"
                    "EXR.D.GBP.EUR.SP00.A,D,2026-11-05,0.8712,\"Pound, euro\"\n"
                    "EXR.D.GBP.EUR.SP00.A,D,2026-11-06,0.8740,\"Pound, euro\"\n"
                    "EXR.D.GBP.EUR.SP00.A,D,2026-11-07,,\"Pound, euro\"\n")
        self.assertEqual(nac.ecb_closes(csv_text), [["2026-11-05", 0.8712], ["2026-11-06", 0.874]])

    def test_the_series_ends_at_publication(self):
        closes = [[f"2026-10-{d:02d}", 80000.0 + d] for d in range(7, 32)] + [["2026-11-01", 1.0], ["2026-11-07", 2.0]]
        with patch.object(nac, "crypto_closes", return_value=closes) as crypto:
            got = nac.market_chart(self.story("Bitcoin kalon 80 mijë dollarë"))
        crypto.assert_called_once()
        self.assertEqual(got["points"][-1][0], "2026-11-01")
        self.assertEqual((got["label"], got["unit"], got["source"]), ("Bitcoin", "USD", "CoinGecko"))
        self.assertTrue(got["source_url"].startswith("https://www.coingecko.com/"))

    def test_too_few_points_or_a_failed_read_show_no_chart(self):
        with patch.object(nac, "crypto_closes", return_value=[["2026-11-01", 1.0]] * 3):
            self.assertIsNone(nac.market_chart(self.story("Bitcoin bie")))
        with patch.object(nac, "crypto_closes", return_value=[]):
            self.assertIsNone(nac.market_chart(self.story("Bitcoin bie")))
        with patch.object(nac, "ecb_closes", side_effect=AssertionError("must not be read")), \
             patch.object(nac, "get_text", return_value=None):
            self.assertIsNone(nac.market_chart(self.story("Paundi bie")))

    def test_a_chart_alone_is_worth_showing_and_counts_as_richer(self):
        chart = {"label": "Bitcoin", "points": [["2026-11-01", 1.0]] * 6}
        row = {"what": "", "what_quotes": [], "why": "", "why_quotes": [], "subjects": [], "media": [], "video_search": ""}
        with patch.object(nac, "gather", return_value=(EVIDENCE, [])), patch.object(nac, "ask", return_value=row), \
             patch.object(nac, "market_chart", return_value=chart):
            got = nac.enrich(self.story("Bitcoin bie"))
        self.assertEqual((got["status"], got["chart"]), ("ok", chart))
        self.assertGreater(nac.richness(got), nac.richness({**got, "chart": None}))


if __name__ == "__main__":
    unittest.main()


class EventPosts(unittest.TestCase):
    """Anyone's footage of the event itself: an eyewitness, a fan in the stadium. Shown in the
    platform's own player, never copied, and only when it plainly is this event."""

    def test_a_post_sharing_two_headline_words_is_on_topic(self):
        article = {"title": "Zjarr i madh në tregun e Gjilanit, digjen dhjetëra tezga"}
        self.assertTrue(nac.event_post_on_topic({"text": "Zjarri ne tregun e Gjilanit tani"}, article))

    def test_one_shared_word_is_a_coincidence(self):
        article = {"title": "Zjarr i madh në tregun e Gjilanit, digjen dhjetëra tezga"}
        self.assertFalse(nac.event_post_on_topic({"text": "Pamje nga Gjilani sot, mot i bukur"}, article))
        self.assertFalse(nac.event_post_on_topic({"text": ""}, article))

    def test_witness_posts_reach_the_second_look_marked_and_two_at_most_are_kept(self):
        article = {**ARTICLE, "title": "Rama sqaron çmimin e shiritit në Prishtinë"}
        seen = [{"platform": "x", "id": str(i), "kind": "", "url": f"https://x.com/someone/status/{i}", "author": "someone",
                 "text": "Shiriti i Rames ne Prishtine sot", "likes": 900 - i, "witness": True} for i in range(1, 5)]
        row = {"what": "", "what_quotes": [], "why": "", "why_quotes": [], "subjects": [], "media": [], "video_search": "",
               "social_search": "shiriti Prishtine"}
        second = {"videos": [{"video": i, "after_paragraph": i} for i in range(4)]}
        with patch.object(nac, "gather", return_value=(EVIDENCE, [])), patch.object(nac, "ask", return_value=row),              patch.object(nac, "event_posts", return_value=seen), patch.object(nac, "second_look", return_value=second) as look,              patch.object(nac, "licensed_photos", return_value=[]):
            got = nac.enrich(article)
        self.assertTrue(all(v.get("witness") for v in look.call_args.args[3]))
        self.assertIn('"witness": true', nac.second_prompt(article, {}, [], look.call_args.args[3]))
        self.assertEqual([m["id"] for m in got["media"]], ["1", "2"])

    def test_off_topic_search_results_never_reach_the_second_look(self):
        seen = [{"platform": "x", "id": "9", "kind": "", "url": "https://x.com/a/status/9", "author": "a", "text": "good morning", "witness": True}]
        row = {"what": "", "what_quotes": [], "why": "", "why_quotes": [], "subjects": [], "media": [], "video_search": "", "social_search": "x"}
        with patch.object(nac, "gather", return_value=(EVIDENCE, [])), patch.object(nac, "ask", return_value=row),              patch.object(nac, "event_posts", return_value=seen), patch.object(nac, "second_look") as look,              patch.object(nac, "licensed_photos", return_value=[]):
            nac.enrich(ARTICLE)
        look.assert_not_called()

    def test_a_news_outlet_or_tv_account_is_never_a_witness(self):
        article = {**ARTICLE, "title": "Zjarr i madh në tregun e Gjilanit"}
        for author, url in (("Klan Kosova", "https://x.com/klankosova/status/1"), ("Breaking News 24", "https://x.com/bn24/status/1"),
                            ("someone", "https://x.com/gjilani_lajme/status/1"), ("Example", "https://x.com/example/status/1")):
            post = {"author": author, "url": url, "text": "Zjarri ne tregun e Gjilanit"}
            self.assertTrue(nac.outlet_account(post, article), author)
        self.assertFalse(nac.outlet_account({"author": "Arben K.", "url": "https://x.com/arbenk/status/1"}, article))

    def test_the_search_asks_around_the_publish_date(self):
        article = {**ARTICLE, "published_at": "2026-11-06T10:00:00+00:00"}
        with patch.object(nac, "read_accounts", return_value=[]) as read:
            REAL_EVENT_POSTS(article, "zjarr Gjilan")
        ask = read.call_args.args[0]
        self.assertEqual((ask["search"], ask["x"], ask["ig"]), (["zjarr Gjilan"], [], []))
        self.assertNotIn("tags", ask)
        self.assertTrue(ask["since"].startswith("2026-11-04") and ask["until"].startswith("2026-11-07"))


class Figures(unittest.TestCase):
    """"Në shifra": a story's own numbers drawn as bars, each one found in the article or a source."""

    ROW = {"title": "Tarifa për metër", "unit": "€", "items": [{"label": "Shiriti", "value": 8.5}, {"label": "Puna", "value": 3}],
           "quotes": ["the fee of 8.50 euro per metre", "Labour adds 3 euro"]}
    TEXT = EVIDENCE + " Labour adds 3 euro."

    def test_numbers_from_the_sources_become_bars(self):
        got = nac.checked_figures(self.ROW, ARTICLE, self.TEXT)
        self.assertEqual(got, {"title": "Tarifa për metër", "unit": "€", "items": [{"label": "Shiriti", "value": 8.5}, {"label": "Puna", "value": 3}]})

    def test_a_number_nowhere_in_the_sources_drops_the_whole_chart(self):
        row = {**self.ROW, "items": [{"label": "Shiriti", "value": 8.5}, {"label": "Puna", "value": 7}]}
        self.assertIsNone(nac.checked_figures(row, ARTICLE, self.TEXT))

    def test_one_bar_an_invented_quote_or_an_outlet_label_is_no_chart(self):
        self.assertIsNone(nac.checked_figures({**self.ROW, "items": self.ROW["items"][:1]}, ARTICLE, self.TEXT))
        self.assertIsNone(nac.checked_figures({**self.ROW, "quotes": ["a fee nobody quoted ever"]}, ARTICLE, self.TEXT))
        self.assertIsNone(nac.checked_figures({**self.ROW, "title": "Sipas example"}, ARTICLE, self.TEXT))
        self.assertIsNone(nac.checked_figures(None, ARTICLE, self.TEXT))

    def test_numbers_match_in_either_way_of_writing_them(self):
        self.assertTrue(nac.number_in(1200, "rreth 1.200 banorë"))
        self.assertTrue(nac.number_in(8.5, "8,5 për qind"))
        self.assertTrue(nac.number_in(45, "45%"))
        self.assertFalse(nac.number_in(12, "1.200"))
        # A decimal is never read as a whole number: 41.5 is not 415, 8,5 is not 85.
        self.assertFalse(nac.number_in(415, "41.5 për qind"))
        self.assertFalse(nac.number_in(85, "8,5 për qind"))
        self.assertTrue(nac.number_in(1250000, "1,250,000 vota"))

    def test_each_number_must_stand_in_the_quotes_not_anywhere(self):
        # 3 is in the article ("Kurti", "June" ... and "Labour adds 3 euro"), but no quote holds it.
        row = {**self.ROW, "quotes": ["the fee of 8.50 euro per metre covers material"]}
        self.assertIsNone(nac.checked_figures(row, ARTICLE, self.TEXT))
        row = {**self.ROW, "quotes": ["the fee of 8.50 euro per metre", "Labour adds 3 euro"]}
        self.assertIsNotNone(nac.checked_figures(row, ARTICLE, self.TEXT))
