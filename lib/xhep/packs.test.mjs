import { test } from "node:test";
import assert from "node:assert/strict";
import { PACK_CITIES, PACK_ART, PLACES_PER_PACK, packCards, packPlaces, stampState, addHandStamp, normalizePacks, normalizeHandStamps, isPackCity } from "./packs.mjs";
import { normalizeProfile } from "./profile.mjs";
import { signStamp } from "./stamps.mjs";
import { existsSync } from "node:fs";

test("every pack city has art on disk and colours", () => {
  for (const city of PACK_CITIES) {
    const art = PACK_ART[city];
    assert.ok(art, city);
    assert.ok(existsSync(`public${art.src}`), art.src);
    for (const c of [art.crimp, art.accent, art.ink]) assert.match(c, /^#[0-9A-F]{6}$/i);
  }
});

test("a pack is its places, then mural and story, then the stamp card last", () => {
  const cards = packCards("prizren");
  const places = packPlaces("prizren");
  assert.ok(places.length >= 5 && places.length <= PLACES_PER_PACK);
  assert.deepEqual(cards.map((c) => c.kind), [...places.map(() => "place"), "mural", "story", "stamps"]);
  assert.ok(places.every((p) => p.cityId === "prizren"));
  assert.deepEqual(packCards("tirana"), []);
  assert.equal(isPackCity("tirana"), false);
});

test("stamp state: gold beats hand, the scene completes when every place is stamped", () => {
  const places = packPlaces("peje");
  const gold = signStamp("secret", places[0].id, "seed123");
  const profile = { stamps: [gold, "junk"], handStamps: [places[0].id, places[1].id] };
  const state = stampState(profile, "peje");
  assert.equal(state.places[0].stamp, "gold");
  assert.equal(state.places[1].stamp, "hand");
  assert.equal(state.places[2].stamp, null);
  assert.equal(state.done, 2);
  assert.equal(state.complete, false);
  const all = stampState({ handStamps: places.map((p) => p.id) }, "peje");
  assert.equal(all.complete, true);
  assert.equal(stampState(null, "peje").done, 0);
});

test("hand stamps: known places only, once each", () => {
  const id = packPlaces("gjilan")[0].id;
  assert.deepEqual(addHandStamp([], id), [id]);
  assert.deepEqual(addHandStamp([id], id), [id]);
  assert.deepEqual(addHandStamp([], "nowhere"), []);
  assert.deepEqual(normalizeHandStamps([id, id, 5, "nowhere"]), [id]);
  assert.deepEqual(normalizeHandStamps("junk"), []);
});

test("opened packs: known cities with real dates only", () => {
  assert.deepEqual(normalizePacks({ prizren: "2026-10-04T10:00:00Z", tirana: "2026-10-04", peje: "soon", gjilan: 5 }), { prizren: "2026-10-04T10:00:00Z" });
  assert.deepEqual(normalizePacks(null), {});
});

test("a profile from before packs existed still loads", () => {
  const p = normalizeProfile({ name: "Lind", stamps: [] });
  assert.deepEqual(p.packs, {});
  assert.deepEqual(p.handStamps, []);
});
