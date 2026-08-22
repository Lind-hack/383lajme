import importlib.util
from datetime import datetime, timezone, timedelta
from pathlib import Path

spec = importlib.util.spec_from_file_location("prune_news_retention", Path(__file__).with_name("prune_news_retention.py"))
module = importlib.util.module_from_spec(spec)
assert spec.loader
spec.loader.exec_module(module)


def test_retains_article_at_or_newer_than_five_day_cutoff():
    now = datetime(2026, 7, 24, 12, tzinfo=timezone.utc)
    cutoff = now - timedelta(days=5)
    assert module.is_retained({"published_at": cutoff.isoformat()}, cutoff)
    assert module.is_retained({"published_at": (cutoff + timedelta(seconds=1)).isoformat()}, cutoff)


def test_expires_article_older_than_five_days():
    cutoff = datetime(2026, 7, 19, 12, tzinfo=timezone.utc)
    assert not module.is_retained({"published_at": "2026-07-19T11:59:59+00:00"}, cutoff)


def test_missing_date_is_not_deleted_automatically():
    cutoff = datetime(2026, 7, 19, 12, tzinfo=timezone.utc)
    assert module.is_retained({}, cutoff)


if __name__ == "__main__":
    test_retains_article_at_or_newer_than_five_day_cutoff()
    test_expires_article_older_than_five_days()
    test_missing_date_is_not_deleted_automatically()
    print("retention tests passed")
