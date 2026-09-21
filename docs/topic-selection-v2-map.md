# Topic Selection v2 — implementation map

| Requirement | Enforcement point | Regression / verification |
|---|---|---|
| Relevance first, Prishtina test, 13–20 outer run | `scripts/editorial_rules_v2.py:validate_run`; runner `topic-selection-v2` stage | `scripts/test_topic_selection_v2.py`; synthetic gate run |
| Mandatory lane quotas | `LANE_QUOTAS` in `editorial_rules_v2.py` | `test_valid_batch_meets_mandatory_lane_quotas`; missing-quota test |
| Local competitor exception only in Kosovë/Shqipëri | `source_policy_error()` plus `codex_automation_support.validate_batch()` | `test_local_competitors_are_allowed_only_in_their_local_lane`; Kallxo integration assertion in `test_codex_automation_support.py` |
| Competitor ban in Botë/Sport/Showbiz | same source policy; Telegrafi Sport/Showbiz marked discovery-only in `cloud_news_discovery.py` | source-policy tests and live feed smoke |
| Exact feed inventory and browser fallback | `scripts/news_sources.json`, `cloud_news_discovery.py` | live smoke: 19 feed audits, current-day entries, browser lanes |
| Social discovery cannot decide topics alone | discovery output reminder + quotas enforced after writer; no social input bypass in gate | runner ordering and quota tests |
| Hard topic bans and Sport/Botë/Showbiz relevance | `article_errors()` in `editorial_rules_v2.py` | K-pop, women's-sport, low-value-sport, no-Kosovo-angle tests |
| WHO/STAKE title hooks, local first three words, ~65 chars | `title_errors()` in `editorial_rules_v2.py`; writer prompt/docs | title-rule tests; schema maxLength 65 |
| Deterministic city tagging | `infer_city()`; normalization overwrites model guesses; `city` required | city priority/fallback tests; frontend city query filter |
| Two independent sources | required `corroborating_sources`, URL-host independence, prefetched evidence status | `topic_selection_gate.py`; evidence test |
| Original rewrite / no copied sentences | `originality_gate.py` compares body/source evidence and drops copied candidates | `test_originality_gate.py`; runner originality stage |
| Existing journalism/image/dedupe gates retained | existing support, journalism, image, dedupe stages | existing support/direct-Supabase suites |
| City reaches publication/frontend | `_article_row()` + migration `0048_news_article_city_topic_v2.sql`; `Article.city`, `mapAutoRow`, category-page filter | `npm test`; `npm run build` |
| Scheduler safety | `run-383-production.sh` canonical-worktree guard and Linear-only queue; no activation in this change | `bash -n`; cron list confirms 383 jobs paused |

The canonical production path is the `scripts/` implementation in
`/opt/data/workspaces/383lajme`. The archived `383lajme-prod-*` overlay remains
rejected by the runner guard and was not used for publication.
