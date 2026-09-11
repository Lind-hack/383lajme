# Plan Review Log: close the six outstanding Tregu items

Phases 0-1 (recon + interrogation) complete — plan locked with Lind via a four-question
decision batch; all four recommendations accepted.

## Phase 2 — Codex adversarial review: NOT RUN (explicit opt-out, reviewer unavailable)

codex-cli 0.146.0 is installed and authenticated, but `~/.codex/config.toml` pins
`model = "gpt-6-astra"`, which the API rejects:

    400 invalid_request_error: The 'gpt-6-astra' model requires a newer version of
    Codex. Please upgrade to the latest app or CLI and try again.

Per the skill's rule ("on auth/model error, surface it — don't silently retry") the round was
not retried against a guessed model. No cross-model review was obtained, so no APPROVED verdict
is claimed for this plan. Claude self-reviewed against the three questions that would have been
put to Codex; that is a weaker check and is recorded as such.

Self-review findings, with dispositions:
- (a) Two-stage generation smuggling unvalidated candidates past the gates: NOT POSSIBLE as
  planned. Stage 2 output still flows through `validateDailyDraftSubmission` →
  `draftViolation` → `evaluateDailyMarketCandidate`, and publication still goes through
  `dailyDraftPublicationReason` and the DB six-per-day limit. The staging change affects
  candidate *production* only. Guard to keep: stage 1 must not be allowed to set
  `contract_version`, or a malformed shortlist could pick the event-contract branch in
  `draftViolation` and bypass the stricter non-event window rule.
- (b) Skipping `fetchPregameRoster` when a bookmaker line exists: the fallback path reads
  `fixture.team_news`, which must remain defined. Must set it to the existing persisted value
  (or `[]`) on the skip branch, otherwise `applyRosterNews(base, undefined)` is reached on a
  later refresh where the bookmaker line has disappeared. Defaulted parameter makes this safe,
  but the persisted-value fallback is preserved deliberately.
- (c) Exactly-once evidence: the production rows show `sport_market_settlements` with a unique
  (market_id, user_id, side) conflict target and every row carrying a non-null
  `transaction_id`. That demonstrates the guard holding under normal operation; it does NOT by
  itself prove behaviour under concurrent duplicate settlement. The handoff records that case
  as separately tested in the disposable Postgres container. Claim is scoped accordingly.

To restore the cross-model check: upgrade codex-cli, or unpin the model in
`~/.codex/config.toml`.
