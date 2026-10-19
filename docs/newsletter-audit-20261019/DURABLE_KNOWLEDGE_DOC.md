# Weekly newsletter audit

Updated: 2026-10-19. Status: RESOLVED design, delivery and operational decisions.

## Scope
Verify real Sunday scheduling and delivery; keep signup immediate; group weekly
reports into category sections with the same article photos, factual short summaries,
source and full-story link. Keep Sunday 18:00 Kosovo time and the approved Gmail route.

## Evidence checkpoints

- D1 — Source: user and codebase. Sunday 18:00 Europe/Tirane is the agreed cutoff,
  including DST. First eligible edition for the existing subscriber: 25 October 2026.
- D2 — Source: live GitHub run 39168970087. Scheduled workflow succeeded but reported
  sent=0, queued=0, pending=0. Database shows no weekly delivery receipts. The subscriber
  joined after 18 October's cutoff. This is not proof of weekly inbox delivery.
- D3 — Source: live database and systemd. One active subscriber; two old confirmation
  queue jobs marked sent; private SMTP worker active. No calendar dispatch timer existed.
- D4 — Source: source inspection. Existing recaps label categories but do not group them.
  Group stories under clear category headings in both HTML and plain text.
- D5 — Source: site selection code and live archive. The website ranks editorially
  featured reports first; newsletter previously ranked engagement alone. Use featured,
  then engagement and recency, while reserving category coverage and requiring photos.
- D6 — Source: provider receipt and authorized inbox search. Resend accepted the previous
  preview but receipt was not verified in Gmail. Do not call acceptance inbox delivery.
  Test the previously approved Gmail transport separately without retrying an uncertain
  Resend send as the same production delivery.

## Resolved constraints
No direct production upload. Release a clean committed push to origin/main through
Railway's GitHub integration. No rewriting sent issues or changing historic consent.
No generated facts or unrelated stock images. No account confirmation requirement.

## Release gate
Calendar installation/DST, inbox preview receipt, live signup and category/image rendering
are verified below. All 1,378 repository tests and four scheduler tests pass.
The production build passes. The containing commit must match production deployment
metadata before release is reported complete.

## Sources
[GitHub scheduling caveats](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule)
and [systemd calendar timers](https://www.freedesktop.org/software/systemd/man/latest/systemd.timer.html).
GitHub can delay scheduled jobs; a server calendar timer supplies the primary trigger,
with the GitHub workflow retained as a backup using the same idempotent endpoint.


- D7 — Source: real inbox `1a155d1fbdeb0b4f`, received 19 October. Categorized preview
  delivered through the installed Gmail SMTP function; seven sections, eight real
  article images, readable summaries and plain-text fallback verified. This is a
  preview delivery, not a historic Sunday campaign receipt.
- D8 — Source: systemd and real authenticated endpoint call. Calendar timer active;
  next run: 25 October, 17:00 UTC / 18:00 Kosovo. Default Python User-Agent received HTTP 403; explicit
  scheduler identification received HTTP 200 and outside_weekly_window. The installed runner
  uses that working header and refuses redirects. GitHub retained as backup.
- D9 — Source: live browser and database. Single-click signup displayed success with
  only email input and no checkbox/code/inbox step. Existing activation cutoff preserved.
- D10 — Source: controlled production delivery test. A temporary synthetic issue used
  the real database claim, encrypted queue, installed mail worker and weekly receipt.
  Job e9b6db2d535297a9b5d52cb46f40ea292b0778e833635d70c6ad6cc094880320
  became sent with a Gmail receipt; inbox message1a155de63b069a6c confirms arrival.
  It contained eight photos and seven category sections. Synthetic issue, queue job and
  delivery rows were removed afterward; the subscriber and activation time were untouched.
  This validates the production delivery path without pretending a Monday test is a
  regular Sunday campaign.
- D11 — Source: repository checks. All 1,378 tests and four scheduler tests pass;
  the final production build succeeds. Final defect review found no remaining
  actionable issue. Desktop/mobile rendering and actual Gmail receipt are verified;
  Classic Outlook was not available for a native client check.

## Synthesis
The original scheduler was configured but had no eligible weekly audience yet.
The strongest evidence now combines real inbox delivery of the new email, live
signup, DB cutoff/idempotency tests and an active DST-aware server calendar calling
the same production sender. This establishes tested readiness, not proof of future
inbox delivery or historical campaigns. First eligible edition remains 25 October at 18:00 Kosovo time.
Gmail is the approved operational sender; Resend remains available as a configuration
option but its earlier API acceptance must not be called confirmed inbox delivery.
