# Tregu Live Football Odds Algorithm

## Purpose

This is the canonical live-pricing policy for every eligible virtual/educational Tregu football market. It turns verified live match observations into bounded, explainable probabilities and timestamped chart snapshots.

The objective is **responsive but truthful** prices: goals, red cards, game control, and time remaining materially move probability; unchanged or unavailable data never creates invented movement.

## Source authority and eligibility

1. **ESPN is authoritative** for fixture identity, teams, kickoff, score, clock/status, official final state, market lock, and settlement.
2. **Supplemental stats** may be used only while ESPN reports a live state. Flashscore can supplement xG, shots, shots on target, possession, corners, cards, and big chances when publicly available.
3. Groq/Google are not match telemetry sources. They belong to the separate verified-news workflow.
4. A match is eligible only when its market has a valid official event mapping and ESPN returns an official score/status.
5. Missing stats contribute zero weight. Never infer a card, big chance, xG, shot, score, or minute.

## Tick cadence

Run every two minutes for every eligible open live market:

```text
fetch official ESPN state
→ fetch allowed supplemental live metrics
→ normalize fields by team
→ compare to the last persisted state
→ calculate reference probabilities
→ apply market movement cap
→ atomically persist odds, state, evidence, and snapshots
→ public page polls/realtime-renders the new rows
```

No Vercel deployment is required for a data tick. Deployments publish code only.

## Inputs

For each team, normalize where present:

```text
score
minute / official live status
red_cards
yellow_cards
xg
big_chances
shots_on_target
shots
possession
corners
```

Define the home/away or team-A/team-B difference from the perspective of team A:

```text
goal_diff = score_A - score_B
red_advantage = red_cards_B - red_cards_A
yellow_advantage = yellow_cards_B - yellow_cards_A
xg_diff = xg_A - xg_B
big_chance_diff = big_chances_A - big_chances_B
sot_diff = shots_on_target_A - shots_on_target_B
shot_diff = shots_A - shots_B
possession_diff = possession_A - possession_B
corner_diff = corners_A - corners_B
```

## Probability model

Start with the previously persisted complementary reference probability, or a configured pre-match baseline if no live snapshot exists. Produce a score `S_A`, then convert it to complementary probabilities.

### 1. Scoreline: dominant signal

Goals are the strongest live input. Their effect grows as the clock advances.

```text
score_weight(minute) = 0.18 + 0.0035 × min(minute, 90)
S_score = goal_diff × score_weight(minute)
```

A two-goal lead therefore moves substantially more than a one-goal lead, and the same lead is more decisive in the final minutes.

### 2. Red cards: major signal

A red card is a large disadvantage because the team plays with fewer players.

```text
S_red = red_advantage × 0.14
```

This is intentionally second only to the scoreline. Multiple-red-card scenarios accumulate but all final movement remains bounded by the per-tick cap.

### 3. Live dominance: bounded supporting evidence

```text
S_dominance =
  0.045 × xg_diff
+ 0.018 × big_chance_diff
+ 0.014 × sot_diff
+ 0.006 × shot_diff
+ 0.0018 × possession_diff
+ 0.003 × corner_diff
+ 0.005 × yellow_advantage
```

Clamp `S_dominance` to `[-0.10, +0.10]`. Possession and corners are supporting signals; they must never outweigh actual goals or red cards.

### 4. Time remaining

When one team leads, time remaining compounds the leader's advantage:

```text
if goal_diff ≠ 0:
  S_time = sign(goal_diff) × (minute / 90) × min(0.16, 0.045 × abs(goal_diff))
else:
  S_time = 0
```

When level, dominance does not become more important simply because time passes. It decays modestly as the opportunity to convert it shrinks:

```text
if goal_diff = 0:
  S_dominance_adjusted = S_dominance × (1 - min(minute, 120) / 150)
else:
  S_dominance_adjusted = S_dominance
```

### 5. Convert to complementary prices

```text
S_A = S_score + S_red + S_time + S_dominance_adjusted
P_A_reference = clamp(0.50 + S_A, 0.02, 0.98)
P_B_reference = 1 - P_A_reference
```

For three-way markets, reserve a time-decaying draw probability and normalize all outcomes. For legacy paired-binary team books, `P_A + P_B` must equal exactly `1.00`.

## Movement controls

1. **Per-tick cap:** no individual application may move an open market by more than 10 percentage points.
2. **Complementarity:** paired binaries always sum to 100% after rounding rules are applied.
3. **Materiality:** persist a new odds snapshot only when there is a verified state/stat/clock change and the computed price differs from the latest persisted price by at least the configured precision threshold (for example, 0.1 percentage point).
4. **No artificial volatility:** a chart records real computed probability anchors only. Presentation may zoom to the live day and scale the vertical range, but may not invent dips or spikes.
5. **Evidence:** each persisted update stores source URLs, official timestamp/status, input metrics used, reasoning, and prior/new probabilities.

## Finality and settlement

Only official ESPN final state may settle a football market.

```text
ESPN official final
→ lock related books immediately
→ set winner PO / loser JO
→ display market closed / rewards processing
→ schedule idempotent virtual settlement after seven minutes
```

No supplemental source, news source, model output, or chart state may settle or override ESPN finality.

## User-facing chart behavior

- Append one timestamped snapshot for each material calculated change.
- Poll/realtime refresh the public market page after persisted updates.
- Default live chart view to the most recent day so current match dynamics are not flattened by older history.
- Show current probabilities, source attribution, and a crosshair that reads exact recorded snapshots.

## Validation checklist for each new live-football integration

- [ ] Official ESPN event mapping exists.
- [ ] ESPN score/status is present and live.
- [ ] Team orientation is correct for every market outcome.
- [ ] Score, red-card, dominance, and time weights produce complementary bounded prices.
- [ ] Missing metrics do not create values.
- [ ] No-change tick writes no invented probability movement.
- [ ] Final ESPN state locks and settles only through the idempotent final path.
- [ ] Existing positions/transactions are untouched by price updates.
