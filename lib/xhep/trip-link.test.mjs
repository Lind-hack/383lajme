import assert from "node:assert/strict";
import test from "node:test";
import { cardArt } from "./card-art.mjs";
import { qrMatrix } from "./qr-art.mjs";
import { planTrip } from "./planner.mjs";
import { decodeTrip, encodeTrip, joinTrip, tripUrl } from "./trip-link.mjs";

const owner = { name: "Lena", travellerType: "first", arrival: "drive", crossing: "merdare", interests: ["nature", "food"], cities: ["peje", "prizren"], days: 5, month: 5, budget: "mid", seed: "lenaseed01" };

test("a trip round-trips through the link", () => {
  const back = decodeTrip(encodeTrip(owner));
  for (const key of ["name", "travellerType", "arrival", "crossing", "days", "month", "budget", "seed"]) assert.equal(back[key], owner[key], key);
  assert.deepEqual(back.interests, owner.interests);
  assert.deepEqual(back.cities, owner.cities);
  const flyer = decodeTrip(encodeTrip({ ...owner, arrival: "fly", crossing: null, name: "" }));
  assert.equal(flyer.arrival, "fly");
  assert.equal(flyer.crossing, null);
  assert.equal(flyer.name, "");
});

test("the friend's plan is identical to the owner's", () => {
  assert.deepEqual(planTrip(decodeTrip(encodeTrip(owner))), planTrip(owner));
});

test("garbage, oversized or tampered links decode to null or to safe values", () => {
  for (const bad of [null, "", "x", "2~a~b", "1~".repeat(150), 42]) assert.equal(decodeTrip(bad), null);
  const tampered = decodeTrip("1~<script>~zz~9999~77~?~xyz~zzqq~?~NOT SEED");
  assert.ok(tampered);
  assert.equal(tampered.days, 30);
  assert.equal(tampered.month, null);
  assert.equal(tampered.seed, null);
  assert.deepEqual(tampered.cities, ["prishtine"]);
  assert.doesNotMatch(cardArt(tampered), /<script/);
});

test("the trip link fits a scannable woven QR", () => {
  const url = tripUrl({ ...owner, name: "Arbenita", cities: ["prishtine", "prizren", "peje", "gjakove", "mitrovice", "gjilan"], interests: ["nature", "history", "food", "coffee"] }, "sq");
  assert.ok(url.length < 120, `${url.length} chars`);
  const { size } = qrMatrix(url);
  // 460 px of field at ≥ 6 px a module, with the 4-module quiet zone on both sides.
  assert.ok((size + 8) * 6 <= 460, `${size} modules`);
  assert.match(cardArt(owner, { qrUrl: url }), /data-zone="qr"/);
});

test("joining keeps the trip and the card family, with the friend's own seed and name", () => {
  const trip = decodeTrip(encodeTrip(owner));
  const friend = joinTrip(trip, { name: "Ana", seed: "anaseed999" });
  assert.equal(friend.name, "Ana");
  assert.equal(friend.seed, "anaseed999");
  assert.equal(friend.joinedFrom, "lenaseed01");
  assert.deepEqual(friend.cities, owner.cities);
  assert.deepEqual(planTrip(friend), planTrip(owner));
  assert.notEqual(cardArt(friend, { seed: friend.seed }), cardArt(owner, { seed: owner.seed }));
});
