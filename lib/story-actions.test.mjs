import { test } from "node:test";
import assert from "node:assert/strict";
import { ACTION_WEIGHTS, actionWeight } from "./story-actions.mjs";

test("saving and commenting say more than a full read; unsaving takes it back", () => {
  assert.ok(ACTION_WEIGHTS.save > 1);
  assert.ok(ACTION_WEIGHTS.comment > ACTION_WEIGHTS.save);
  assert.ok(ACTION_WEIGHTS.unsave < 0 && ACTION_WEIGHTS.save + ACTION_WEIGHTS.unsave > 0);
});

test("an action counts only for its own story and only when known", () => {
  assert.equal(actionWeight({ slug: "a", action: "save" }, "a"), ACTION_WEIGHTS.save);
  assert.equal(actionWeight({ slug: "b", action: "save" }, "a"), 0);
  assert.equal(actionWeight({ slug: "a", action: "share" }, "a"), 0);
  assert.equal(actionWeight(null, "a"), 0);
});
