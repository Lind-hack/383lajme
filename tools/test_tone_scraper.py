"""Tests for the tone pipeline.

Two tiers, on purpose:

  * Everything unmarked is pure-function and offline. It runs anywhere, in
    milliseconds, with no API key, and is what CI should run.
  * `-m live` calls Groq with the golden set. That is the only way to answer
    "did the stance rewrite actually work", but it costs quota, so it is
    opt-in and never runs by default.

    pytest tools/test_tone_scraper.py            # offline
    pytest tools/test_tone_scraper.py -m live    # + the real classifier
"""

import json
import os
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).parent))
import tone_scraper as ts  # noqa: E402

GOLDEN = json.loads((Path(__file__).parent / "fixtures" / "tone_golden.json").read_text("utf-8"))["cases"]


# ── The index math ──────────────────────────────────────────────────────

def test_index_is_50_when_balanced():
    assert ts.country_index(10, 0, 10) == 50


def test_neutral_does_not_move_the_needle():
    assert ts.country_index(5, 0, 5) == ts.country_index(5, 90, 5) == 50


def test_index_poles():
    assert ts.country_index(10, 0, 0) == 100
    assert ts.country_index(0, 0, 10) == 0


def test_index_is_none_with_no_articles():
    assert ts.country_index(0, 0, 0) is None


# ── Stance parsing: the rules that stop a guess becoming a label ────────

def test_unparseable_item_is_unknown_not_a_guess():
    assert ts._parse_stance_item(None)["stance"] == ts.UNKNOWN
    assert ts._parse_stance_item("negative")["stance"] == ts.UNKNOWN
    assert ts._parse_stance_item({"stance": "hostile"})["stance"] == ts.UNKNOWN


def test_non_neutral_without_evidence_falls_back_to_neutral():
    """The whole defect in one rule: a model that calls something hostile has
    to point at the outlet's own words, or it does not get to."""
    out = ts._parse_stance_item({"stance": "negative", "evidence": "", "confidence": "high"})
    assert out["stance"] == "neutral"


def test_non_neutral_with_evidence_stands():
    out = ts._parse_stance_item(
        {"stance": "negative", "evidence": "fragile peace shattered", "confidence": "high"}
    )
    assert out["stance"] == "negative"
    assert out["evidence"] == "fragile peace shattered"


def test_low_confidence_non_neutral_becomes_unknown():
    out = ts._parse_stance_item(
        {"stance": "negative", "evidence": "something", "confidence": "low"}
    )
    assert out["stance"] == ts.UNKNOWN


def test_quote_flag_and_speaker_survive():
    out = ts._parse_stance_item(
        {"stance": "neutral", "is_quote": True, "speaker": "Vučić", "reason": "raporton"}
    )
    assert out["isQuote"] is True
    assert out["speaker"] == "Vučić"
    assert out["reason"] == "raporton"


def test_no_client_yields_unknown_never_a_keyword_guess():
    """The old code ran an English word list here. On a German headline that
    could only ever be wrong."""
    items = [{"title": "Kosovo Krieg Konflikt Krise", "summary": ""}]
    assert [r["stance"] for r in ts.classify_stance_batch(None, items)] == [ts.UNKNOWN]


# ── Foreign-press filter ────────────────────────────────────────────────

@pytest.mark.parametrize("outlet,url", [
    ("KOHA.net", "https://www.koha.net/arber/123"),
    ("Telegrafi", "https://telegrafi.com/x"),
    ("Klan Kosova", "https://klankosova.tv/x"),
    ("DVIDS", "https://www.dvidshub.net/image/9807226/"),
    ("Bundeswehr", "https://www.bundeswehr.de/de/x"),
    ("DAZN", "https://www.dazn.com/x"),
])
def test_blocked_sources_are_not_foreign_press(outlet, url):
    assert ts.is_foreign_press(outlet, url) is False


@pytest.mark.parametrize("outlet,url", [
    ("Der Spiegel", "https://www.spiegel.de/ausland/x"),
    ("AP", "https://apnews.com/article/x"),
    ("Le Monde", "https://www.lemonde.fr/x"),
    ("BBC", "https://www.bbc.com/news/x"),
    ("La Repubblica", "https://www.repubblica.it/x"),
])
def test_real_foreign_press_passes(outlet, url):
    assert ts.is_foreign_press(outlet, url) is True


def test_blocklist_matches_subdomains():
    assert ts.is_foreign_press("Arkiva", "https://arkiva.koha.net/x") is False


# ── Cache key stability ─────────────────────────────────────────────────

def test_cache_key_is_stable_across_punctuation_and_case():
    a = ts.normalize_title("Kosovo PM Kurti egged in parliament — DW")
    b = ts.normalize_title("kosovo pm kurti egged in parliament  dw")
    assert a == b


def test_cache_key_is_bounded():
    assert len(ts.normalize_title("x " * 500)) <= 80


# ── The live golden set ─────────────────────────────────────────────────

@pytest.mark.live
def test_stance_golden_set():
    """Accuracy against hand-labelled hard cases, and — the part that matters —
    zero neutral wire reports called hostile."""
    key = os.environ.get("GROQ_API_KEY")
    if not key:
        pytest.skip("GROQ_API_KEY not set")
    from groq import Groq

    client = Groq(api_key=key)
    results = []
    for i in range(0, len(GOLDEN), ts.CLASSIFY_BATCH_SIZE):
        chunk = GOLDEN[i:i + ts.CLASSIFY_BATCH_SIZE]
        items = [{"title": c["title"], "summary": ""} for c in chunk]
        results.extend(ts.classify_stance_batch(client, items))

    violations, misses = [], []
    for case, got in zip(GOLDEN, results):
        if got["stance"] == case.get("must_not_be"):
            violations.append(f"{case['kind']:18} {case['title'][:62]!r} -> {got['stance']} ({got['reason']})")
        if got["stance"] != case["expected"]:
            misses.append(f"{case['kind']:18} exp {case['expected']:8} got {got['stance']:8} {case['title'][:52]!r}")

    accuracy = 1 - len(misses) / len(GOLDEN)
    report = (
        f"\naccuracy {accuracy:.0%} ({len(GOLDEN) - len(misses)}/{len(GOLDEN)})\n"
        + "\n".join(misses)
    )

    # A hard failure: the specific bug. Reporting a hostile quote, or a grim
    # event told plainly, must never be scored as the outlet being hostile.
    assert not violations, "forbidden labels:\n" + "\n".join(violations) + report
    assert accuracy >= 0.80, report


# ── Evidence contract ───────────────────────────────────────────────────

def test_neutral_never_carries_an_evidence_span():
    """Evidence justifies a non-neutral call. A neutral article holding one is
    data that contradicts its own label, and the UI should not have to guard
    against it."""
    out = ts._parse_stance_item(
        {"stance": "neutral", "evidence": "Schäm dich", "confidence": "high"}
    )
    assert out["stance"] == "neutral"
    assert out["evidence"] == ""


def test_downgraded_call_drops_its_evidence_too():
    out = ts._parse_stance_item(
        {"stance": "negative", "evidence": "", "confidence": "high"}
    )
    assert out["stance"] == "neutral"
    assert out["evidence"] == ""


def test_unknown_carries_no_evidence():
    out = ts._parse_stance_item(
        {"stance": "negative", "evidence": "loaded words", "confidence": "low"}
    )
    assert out["stance"] == ts.UNKNOWN
    assert out["evidence"] == ""


@pytest.mark.parametrize("outlet,url", [
    ("B92", "https://www.b92.net/eng/news/x"),
    ("Blic", "https://www.blic.rs/vesti/x"),
    ("Kurir", "https://www.kurir.rs/x"),
    ("Tanjug", "https://www.tanjug.rs/x"),
    ("N1", "https://n1info.com/vesti/x"),
])
def test_serbian_outlets_are_not_foreign_press(outlet, url):
    """Removing the Serbian feed did not stop Belgrade outlets arriving through
    other countries' editions — B92 was landing in the US feed and coming out
    as the most critical piece of 'American' coverage."""
    assert ts.is_foreign_press(outlet, url) is False


@pytest.mark.parametrize("outlet", [
    "La Repubblica",   # contains "blic"
    "Politiken",       # contains "politika"-adjacent stems
    "The Times",       # short-name collisions generally
])
def test_blocklist_matches_whole_words_only(outlet):
    """Substring matching blocked La Repubblica because 'blic' is inside
    'repubblica'. Outlet names are short enough that this must be exact."""
    assert ts.is_foreign_press(outlet, "https://example.com/x") is True
