# Tregu news market flow

Observed 2026-09-28 from the repository graph, current source, and the Oracle VPS (`92.4.221.154`). The [full repository graph](../graphify-out/graph.html) was last built on 2026-09-24; this focused path was checked against the current files.

```mermaid
flowchart LR
  A[Persisted news_articles] --> B[GET daily-drafts context]
  B --> C[VPS daily runner at 07:20 Europe/Belgrade]
  C --> D[AI candidate generation]
  D --> E[POST daily-drafts validation and quality gate]
  E --> F[markets + geography/topic metadata]
  F --> G[opening snapshot + creation email queue]
  F --> H[/tregu filters and admin review]
  R[VPS original-page research packet] --> I[news reprice worker]
  I --> J[news oracle snapshot]
  J --> H
  H --> K[admin sourced adjustment or PO/JO resolution]
```

## Current operational state

- `tregu-daily-drafts.timer` is enabled and scheduled for 07:20 Europe/Belgrade. Its shortlist and contract stages run through the VPS Codex OAuth profile `tregudaily` with `gpt-6-luna` and `agent.reasoning_effort: xhigh`. The runner verifies that profile setting and fails rather than silently using another model.
- `383-tregu-reprice.timer` and `383-tregu-market-email.timer` are enabled. The separate two-minute repricer still uses Groq with Gemini fallback; the one-minute opening-email worker delivers queued creation mail.
- The VPS research service writes a private `market-research/latest.json` packet with extracted original publisher pages. Repricing now requires a fresh per-market packet, strict subject relevance, and two independent cited hosts. An elapsed review date alone can no longer move odds or pay out a market.
- A read-only check of the 2026-09-28 12:20 UTC packet found 45 parser-eligible original pages across six of seven open markets. One page was rejected as truncated; the remaining market had no extracted evidence. This confirms the packet schema and freshness checks against the live producer, but does not prove a particular article satisfies a market's decision criteria.
- Production is Railway at `https://383ks.com`; verify the GitHub-main SHA with `/api/deployment-info`. The old Vercel alias is retired.
- The original VPS checkout has unrelated local changes. Keep automation on a clean detached worktree and preserve that checkout. Production releases follow `AGENTS.md`: a clean commit pushed to `origin/main`, then Railway's matching GitHub deployment.
- The daily creation route previously used `getLatestArticles`, which may fall back to local or mock content when Supabase is unavailable. It now uses `getLatestPersistedArticles` in both context and validation, so creation fails closed on a news database outage.

## Category contract

New non-sports drafts use two independent labels in `pre_match_analysis`:

| Field | Values | Purpose |
| --- | --- | --- |
| `news_geography` | `kosove`, `shqiperi`, `bote` | Where the decision or measured outcome belongs |
| `news_topic` | `politike`, `ekonomi`, `shoqeri`, `siguri`, `teknologji` | What the market concerns |

The legacy `markets.category` remains for older consumers and sport handling. The daily runner asks for both axes and the quality gate requires them for `news-event-v3`. Daily output is evidence-led, with no fixed quota per geography or topic. The market API can filter a Kosovo economy market under both `kosove` and `ekonomi`. Legacy markets without a trustworthy geographic label remain in “Të gjitha” rather than being assigned a guessed location.

## Management rules

The daily runner may automatically open only validated `news-event-v3` contracts. A candidate must cite two independent publisher families, define both PO and JO outcomes, and name an authoritative resolution source. The admin panel shows geography and topic; sourced manual odds adjustments and sourced PO/JO resolution are separate operations. Creation mail is queued on first open and includes opening odds and the saved opening chart point. Keep the email retry worker scheduled after the release.

Subject imagery first uses attributed, exact-name assets for Vetëvendosje and Albin Kurti, then a unique image from a cited article whose title names the full subject. Markets without a credible matching image receive distinct question-specific art. The admin image editor can replace that art with a sourced portrait or logo; the market detail page links to the image source and shows the stored credit when available.

## Release checks

1. Confirm existing migration `0076` and validate new migrations `0087` and `0088` against the target database; run relevant tests plus `npm run build`.
2. Commit the intended files and push to `origin/main` using a clean checkout, preserving unrelated local/VPS changes.
3. Wait for Railway's GitHub deployment at that SHA; verify `https://383ks.com/api/deployment-info` and the Tregu/F1 checks in `AGENTS.md`.
4. Update the VPS automation checkout safely. Verify `tregu-daily-drafts.timer` points to it and the `tregudaily` Hermes profile has Codex OAuth access with `agent.reasoning_effort: xhigh`. Dry-run daily creation before its next 07:20 run without creating duplicate markets.
