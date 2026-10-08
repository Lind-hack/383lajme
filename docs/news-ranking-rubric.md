# Evidence-based editorial ranking

Score each story individually from its fetched evidence, not its category alone.
Complete all eight `score_breakdown` values on the 0–10 scale. Never copy a
neutral template, force a minimum score, or make every article a breaking story.
The normalizer computes `engagement_score`; do not calculate it yourself.
Set `score_formula` to `weighted evidence-based editorial ranking v1`.
Write a short Albanian `score_reason` naming the specific stakes and timeliness
that justify the rating. Scores estimate editorial priority, not measured views
or proof of truth. Never embellish facts or headlines to raise a score.

| Factor | Anchors |
| --- | --- |
| relevance | 9–10: directly affects Kosovo/Albania readers; 6–8: clear regional or global significance; 2–5: narrow or remote interest. |
| urgency | 9–10: verified developing emergency, immediate decision/action or major market move; 6–8: consequential new development today; 3–5: routine announcement; 0–2: evergreen advice, recap or old development. Publication alone does not make news urgent. |
| public_impact | 9–10: substantial consequences for many people, safety, rights, jobs or finances; 6–8: clear group-level consequences; 2–5: limited effect; 0–1: little demonstrated effect. |
| local_depth | 8–10: concrete local reporting with named institutions, locations and consequences; 4–7: specific regional context; 0–3: no supported local connection. Never invent a Kosovo angle. |
| controversy_interest | 8–10: consequential documented public dispute, prominent person's verified development or major audience-interest event; 4–7: moderate identifiable interest; 0–3: routine or generic material. Rumours do not earn extra points. |
| credibility | 8–10: clear original reporting, named authoritative attribution and coherent evidence; 5–7: credible attributed reporting with limitations; 0–4: substantial uncertainty. Facts must separately pass verification regardless of rating. |
| corroboration | 8–10: multiple independent readable publishers support the same event; 5–7: one independent second publisher; 0–4: one primary source only. Routine single-source stories remain eligible. Sister sites are not independent. |
| editorial_safety | 8–10: supported, accurately qualified and responsibly attributed; 5–7: material sensitivity handled with clear attribution and uncertainty; 0–4: unresolved serious risk. Sensitive allegations still require independent evidence. |

Weights: relevance .22, urgency .14, public impact .16, local depth .10,
interest .10, credibility .16, corroboration .08, safety .04. The stored base
score stays fixed. Display selection uses `base score - 0.2 × hours since site
publication`, with fractional hours and no future-date boost. Njoftimet and
Top 5 only select stories from the last 24 hours; stale high scores cannot
displace new stories. The independent editor reassesses scores and reasons
after verifying the evidence, including formerly neutral drafts.
