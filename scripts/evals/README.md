# News desk evals

Local, no-publish measurements of the Showbiz, Ekonomi and Botë desks. Nothing here runs in
production: the runner is started in QA mode and a stand-in model answers for Luna.

## What each script measures

| Script | Question it answers |
| --- | --- |
| `run_desk.sh <desk> <n> [minutes]` | Runs the real `news_reliable_desks.py` once in QA mode. Every model prompt and answer is saved under `runs/<desk>/run-<n>/model-calls.d/`. |
| `funnel.py` | Per run: readable stories, reviewed, competitive, ready, drafts, approvals, shortfall reasons, model calls. |
| `collect.py [prefix]` | Per story: where it ended (approved, editor drop, originality refusal, gate, never written) and why. |
| `interest.py <in.json> <out.json>` | Would an average Kosovo reader open this headline? 1–5 from a judge model, with the share of fillers (1–2). |
| `live_audit.py` | Reads the live site: what/why card, "Në shifra", embeds, lead-photo host and word count per article. |
| `ctx_eval.py <out.json> <limit>` | Runs the real what/why job (nothing saved) on the drafts the runs wrote, and keeps the model's answer and evidence. |
| `ctx_replay.py <scripts-dir> <out.json>` | Replays those stored answers through the card and chart checks of any checkout, to compare two versions without new first calls. |

## Setup

- `L383_EVAL_ROOT` (default `D:/383-evals`): holds `wt-showbiz`, `wt-ekonomi`, `wt-bote` (one
  `git worktree` each, with `.env.local` copied in) and `runs/`.
- `L383_EVAL_ENV`: a file with `GOOGLE_AI_API_KEY=` for the what/why job (free Gemini).
- The stand-in is `claude -p --model haiku` (set `L383_EVAL_MODEL` to change it). It is reached
  only through `shim/` on `PYTHONPATH`, and only when both `L383_EVAL_SHIM=1` and
  `L383_QA_ONLY=1` are set.

## Reading the numbers honestly

- The stand-in is not Luna. Counts and the reasons stories die transfer; prose quality does not.
- The local database key sees old history only, so duplicate and "already published" checks
  are barely exercised.
- X and Instagram lookups need the VPS, so own-post and witness embeds are not measured.
- Runs share one home connection: source timeouts are more common than on the VPS.
- Each run uses the Claude subscription. Thirty-odd calls per run add up: three desks side by
  side for an hour reached the 5-hour limit.

## Baseline, 9–10 November 2026 (before the fixes on this branch)

- Live site, 288 articles: "Pse ndodhi" on 8, 2 and 9 of 96 (Showbiz, Ekonomi, Botë); no
  "Në shifra"; 52%, 62% and 62% of headlines scored as fillers.
- Two full runs per desk: 33 drafts written, 10 approved. Lost to the editor 8, to the
  originality review 6, to the word-overlap gate 3, to other gates 4.
- What/why on 19 drafts: a reason was offered 19 times and kept 7 times.
