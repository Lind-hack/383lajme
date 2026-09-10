import { test } from "node:test";
import assert from "node:assert/strict";
import { validateNewsProposition, NEWS_CONTRACT_VERSION } from "./tregu-news-contract.mjs";
import { isEligibleNewsDeadlineMarket } from "./tregu-automation.mjs";

const proposition = { resolution_mode: "event_pair", decision: "Formal approval or rejection", yes_condition: "Parliament approves the proposed law", no_condition: "Parliament rejects the proposed law", entities: ["Parliament"], geography: "Kosovo", resolution_source: "Official parliamentary vote record", review_policy: "pause_for_review" };
test("new event pairs require two explicit outcomes and review policy", () => {
  assert.equal(validateNewsProposition({ proposition }), null);
  assert.equal(validateNewsProposition({ proposition: { ...proposition, no_condition: proposition.yes_condition } }), "identical_outcome_conditions");
  assert.equal(validateNewsProposition({ proposition: { ...proposition, entities: [] } }), "missing_entities");
});
test("event review dates cannot trigger legacy decay or expiry loss", () => {
  const market = { status: "open", market_type: "binary", market_classification: "general_news", category: "politike" };
  assert.equal(isEligibleNewsDeadlineMarket(market), true);
  assert.equal(isEligibleNewsDeadlineMarket({ ...market, pre_match_analysis: { contract_version: NEWS_CONTRACT_VERSION, proposition } }), false);
  assert.equal(isEligibleNewsDeadlineMarket({ ...market, pre_match_analysis: { contract_version: NEWS_CONTRACT_VERSION, proposition: { ...proposition, resolution_mode: "deadline_occurrence" } } }), true);
});
