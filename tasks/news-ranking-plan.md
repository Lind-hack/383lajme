# Plan: news notifications, scoring and fresh homepage rankings

1. Stop the five-minute infrastructure alert emails while keeping checks/logging active. News emails must be limited to one launch confirmation and one completion/publication report per hourly slot.
2. Replace uniform ranking defaults with evidence-based editorial factor scores and reasons, reviewed by the existing Luna editor. Keep the weighted score formula and use one 0.2-per-hour decay everywhere that ranks homepage news.
3. Make Njoftimet and Top 5 draw from fresh date-ordered candidates, rank by decayed score, and exclude articles older than 24 hours. Top 5 selects the strongest distinct stories with category variety rather than leftovers from category blocks.
4. Review the complete change, run regression tests and build, push clean main through Railway integration, then verify rendered sections and database scores. Install committed worker only after the active run ends. Re-score recent neutral-score stories with evidence and verify the next scheduled run generates varied scores and only the intended emails.

Evidence: screenshot + live five-minute health journal; prepared defaults all 5; getArticles orders featured/raw score before limit; Njoftimet/Top 5 use raw scores and no freshness cutoff; fallback database score decay is 0.05 instead of 0.2.

Verification: fake-clock tests for 0.2/hour, multi-day exclusion, tie-breaking and fresh low scores; model/ranking score derivation tests; real worker logs and publication scores; live rendered section links/date metadata; monitor interval with zero SMTP sends; exact production SHA and installed runtime.

Completed validation and the observed publication shortfall are recorded in `tasks/news-ranking-todo.md`. Source timestamps are distinct from actual site publication time; age decay begins at site publication, and retries never restart it.
