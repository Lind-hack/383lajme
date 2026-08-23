"""Regression tests for the three defects that made the tone index refutable.

Run: python tools/test_tone_sources.py
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from tone_sources import (  # noqa: E402
    audit,
    country_for,
    is_editorial,
    is_local_placename,
)


# ── 1. The wrong Kosovo ──────────────────────────────────────────────────────

def test_polish_village_is_not_the_country():
    # The two the journalist named: a house fire in gmina Cekcyn, and a fire
    # brigade's new truck. Both are about Kosowo, a Polish village.
    assert is_local_placename("Pożar domu w Kosowie, gmina Cekcyn", "", "pl")
    assert is_local_placename("Strażacy z OSP Kosowo odebrali nowy wóz bojowy", "", "pl")


def test_croatian_and_turkish_placenames():
    assert is_local_placename("Požar u selu Kosovo kod Knina", "", "hr")
    assert is_local_placename("Kosova Mahallesinde muhtar seçimi yapıldı", "", "tr")


def test_real_coverage_survives_a_municipality_mention():
    # A country-level signal outranks the local marker, or the filter would eat
    # genuine reporting that happens to name a municipality.
    assert not is_local_placename(
        "Wieś w gminie protestuje, a rząd Kosowa negocjuje z Serbią", "", "pl"
    )
    assert not is_local_placename("Kurti u Prištini o općini Mitrovica", "", "hr")


def test_language_is_a_hint_not_a_requirement():
    # Google does not always tell us the language; the filter still works.
    assert is_local_placename("Pożar w Kosowie, gmina Cekcyn")


def test_ordinary_kosovo_headlines_are_untouched():
    for title in [
        "Kosovo und Serbien einigen sich auf Kennzeichen",
        "Kosovo's president addresses the UN",
        "Kosova ekonomisi büyüyor",
    ]:
        assert not is_local_placename(title), title


# ── 2. Sources that are not journalism ───────────────────────────────────────

def test_score_databases_and_listings_are_not_editorial():
    for outlet, url in [
        ("Sofascore", "https://www.sofascore.com/algeria-kosovo/xyz"),
        ("Transfermarkt", "https://www.transfermarkt.de/kosovo/kader/verein/1"),
        ("Meczyki.pl", "https://meczyki.pl/mecz/kosowo"),
        ("ESPN", "https://www.espn.com/soccer/fixtures/_/league/uefa"),
        ("cosmotetv.gr", "https://www.cosmotetv.gr/programma"),
        ("Wyniki na żywo", "https://www.wynikinazywo.pl/koszykowka/kosowo"),
    ]:
        assert not is_editorial(outlet, url), outlet


def test_institutions_and_academia_are_not_a_country_press():
    for outlet, url in [
        ("UNICEF", "https://www.unicef.org/press-releases/kosovo"),
        ("EEAS", "https://www.eeas.europa.eu/kosovo_en"),
        ("International Padel Federation", "https://www.padelfip.com/kosovo"),
        ("The University of Northern Colorado", "https://www.unco.edu/news/kosovo"),
        ("World Bank", "https://www.worldbank.org/en/country/kosovo"),
    ]:
        assert not is_editorial(outlet, url), outlet


def test_real_newsrooms_are_kept():
    for outlet, url in [
        ("Der Spiegel", "https://www.spiegel.de/ausland/kosovo-a-1"),
        ("Die Presse", "https://www.diepresse.com/kosovo"),
        ("Le Monde", "https://www.lemonde.fr/europe/article/kosovo"),
        ("Kathimerini", "https://www.kathimerini.gr/kosovo/"),
    ]:
        assert is_editorial(outlet, url), outlet


def test_a_sports_desk_of_a_real_paper_is_still_journalism():
    # Blocking "sport" wholesale would remove Blick's newsroom too.
    assert is_editorial("Blick", "https://www.blick.ch/sport/fussball/kosovo-x")


# ── 3. Country attribution follows the outlet, not the feed ──────────────────

def test_the_three_reported_misattributions():
    assert country_for("https://www.diepresse.com/kosovo") == "Austri"
    assert country_for("https://www.blick.ch/sport/kosovo") == "Zvicër"
    assert country_for("https://www.tagesschau.de/ausland/kosovo") == "Gjermani"


def test_german_austrian_and_swiss_press_stay_separate():
    # The heart of it: these three shared an article set because they shared a
    # language, and a shared set is not three measurements.
    assert country_for("https://www.derstandard.at/story/kosovo") == "Austri"
    assert country_for("https://www.nzz.ch/international/kosovo") == "Zvicër"
    assert country_for("https://www.zeit.de/politik/kosovo") == "Gjermani"


def test_cctld_carries_outlets_not_in_the_registry():
    assert country_for("https://www.gostyn24.pl/artykul/pozar") == "Poloni"
    assert country_for("https://www.tvp.pl/bydgoszcz/x") == "Poloni"
    assert country_for("https://www.someregional.hr/vijesti") == "Kroaci"
    assert country_for("https://www.sozcu.com.tr/haber") == "Turqi"


def test_two_label_country_codes():
    assert country_for("https://www.bbc.co.uk/news/world-europe-1") == "Britani"
    assert country_for("https://www.anews.com.tr/world/kosovo") == "Turqi"


def test_transnational_newsrooms_count_for_nobody():
    # Real journalism, but not evidence about any one country's attitude.
    for url in [
        "https://www.aljazeera.com/news/kosovo",
        "https://www.euronews.com/kosovo",
        "https://www.politico.eu/article/kosovo",
    ]:
        assert country_for(url) is None, url


def test_an_unknown_generic_domain_is_dropped_not_guessed():
    # Guessing from the feed is the bug being replaced.
    assert country_for("https://www.some-unknown-site.com/kosovo") is None


def test_serbian_and_us_flag_confusion():
    # srpske.rs was carrying a US flag. It is not US press; .rs is not one of
    # the measured countries, so it must not be attributed at all here.
    assert country_for("https://www.srpske.rs/vijesti/kosovo") is None


# ── The audit used by the rebuild ────────────────────────────────────────────

def test_audit_sorts_rows_into_reasons():
    rows = [
        {"url": "https://www.spiegel.de/kosovo", "outlet": "Der Spiegel", "title": "Kosovo und Serbien"},
        {"url": "https://www.sofascore.com/x", "outlet": "Sofascore", "title": "Kosovo live"},
        {"url": "https://www.gostyn24.pl/x", "outlet": "gostyn24", "title": "Pożar w Kosowie, gmina Cekcyn"},
        {"url": "https://www.aljazeera.com/x", "outlet": "Al Jazeera", "title": "Kosovo talks"},
    ]
    out = audit(rows)
    assert [r["outlet"] for r in out["kept"]] == ["Der Spiegel"]
    assert out["kept"][0]["country"] == "Gjermani"
    assert len(out["non_editorial"]) == 1
    assert len(out["wrong_kosovo"]) == 1
    assert len(out["unattributable"]) == 1


if __name__ == "__main__":
    tests = [v for k, v in sorted(globals().items()) if k.startswith("test_")]
    failed = 0
    for fn in tests:
        try:
            fn()
            print(f"  PASS  {fn.__name__}")
        except AssertionError as exc:
            failed += 1
            print(f"  FAIL  {fn.__name__}: {exc}")
    print(f"\n  {len(tests) - failed} passed, {failed} failed")
    sys.exit(1 if failed else 0)
