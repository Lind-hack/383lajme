import { test } from "node:test";
import assert from "node:assert/strict";
import { sqCompare } from "./sq-order.mjs";

test("letters with a hook or dots, and digraphs, sit where the Albanian alphabet puts them", () => {
  const sorted = ["Zvicër", "SHBA", "Greqi", "Çeki", "Gjermani", "Serbi", "Suedi", "Danimarkë", "Dhërmi", "Ëndërr", "Egjipt"].sort(sqCompare);
  assert.deepEqual(sorted, ["Çeki", "Danimarkë", "Dhërmi", "Egjipt", "Ëndërr", "Greqi", "Gjermani", "Serbi", "Suedi", "SHBA", "Zvicër"]);
});

test("case does not change the order, and equal words compare equal", () => {
  assert.equal(sqCompare("serbi", "Serbi") === 0, false); // stable tie-break, but adjacent
  assert.ok(Math.abs(sqCompare("Mali i Zi", "Mali i Zi")) === 0);
  assert.ok(sqCompare("Mal", "Mali i Zi") < 0);
});
