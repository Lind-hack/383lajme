# Implementation plan: Restore Telegram publishing and live channel preview

Approved by the user: keep this plan and its checklist separate from unfinished Tregu work.

## Requirements and decisions
- Restore automatic news messages and article links to the existing @Lajmet383 channel using its existing news bot. Production evidence: TELEGRAM_NEWS_BOT_TOKEN identifies @Lajmet383_Bot, an administrator with posting rights; TELEGRAM_BOT_TOKEN currently identifies a bot without channel membership.
- Prefer the news-specific token, retaining the existing token as a compatibility fallback. Keep the featured/fresh article selection and bounded sends. Surface send failures as unsuccessful HTTP responses so the schedule cannot report success while publishing fails.
- Read the latest actual public Telegram message on the server, return only plain text, its public post URL and timestamp, and refresh the card while the page is open. Never expose credentials or render third-party HTML.
- Replace the sample text, fake timestamp and Bot label; use the existing 383 logo and a channel label. Keep both configured join links.
- Release through a clean committed push to origin/main and Railway's GitHub integration; verify the exact deployed SHA.

## Ordered tasks
1. Restore authenticated, scheduled publishing and verify an actual new article message with its link in Telegram. Verify an immediate repeat does not resend it. Files: dispatcher route, workflow if needed, existing dispatch helper/tests.
2. Implement bounded public-channel preview fetching/parsing with tests for latest selection, entities, empty channel and malformed/external links. Files: focused preview helper, types, tests, public API route.
3. Connect the preview to the card, refresh safely, use 383 logo and channel wording. Verify desktop rendering, latest text/link/time, refresh and mobile overflow. Files: alerts-cta component and dedicated hook/helper if needed.
4. Run focused tests and production build, perform the requested read-only five-axis/defect-first review, fix findings, commit/push, verify live publishing and latest-message parity.

## Checkpoints and evidence
- Publishing: successful Telegram send, matching public message/article link, ledger entry and repeat without duplicates.
- Preview: response matches newest public channel post; UI uses real message and 383 logo, omits Bot wording, refreshes when endpoint changes.
- Release: focused tests, full build, complete review, clean worktree, deployed main SHA and live UI acceptance.

## Risks
- Existing bot token is used by other systems: change only this dispatcher's token preference.
- GitHub schedule timing can drift: inspect existing schedules and verify a real workflow execution, not only YAML or an enabled flag.
- Public Telegram HTML can change: isolate parser, bound fetch and timeout, validate channel/post URLs, display an honest empty state on failure.
- Concurrent dispatches can duplicate messages: inspect existing ledger/scheduler serialization and address concrete overlap risks before release.
- Channel latest message must remain the source of truth, including messages posted outside this dispatcher.

## Live acceptance follow-up
The restored workflow published messages 61–63 and the repeat posted zero. Live acceptance found existing short links redirecting to Railway's internal localhost:8080 origin. Fix the resolver to use the same canonical public origin as the message-link generator, add proxy regression tests, rebuild/review and release; verify all three published links resolve to public articles before completion.
