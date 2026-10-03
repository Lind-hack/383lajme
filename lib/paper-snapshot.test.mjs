import { test } from "node:test";
import assert from "node:assert/strict";
import { encodeSnapshot, decodeSnapshot, isExpired, MAX_CODE_LENGTH } from "./paper-snapshot.mjs";

const paper = {
  date: "2026-10-03",
  name: "Lind",
  style: "nate",
  accent: "blu",
  edition: ["von-der-leyen-ne-prishtine", "kurti-apeli", "sulmet-ne-kyiv"],
  sections: [
    { key: "cat:Sport", slugs: ["kosova-fiton", "drita-humb", "third-is-dropped"] },
    { key: "person:albin-kurti", slugs: ["kurti-ne-bruksel"] },
  ],
};

/** Base64url of any JSON, for hand-crafting hostile codes. */
const craft = (obj) => Buffer.from(JSON.stringify(obj)).toString("base64url");

test("a paper survives the round trip, in order", () => {
  const got = decodeSnapshot(encodeSnapshot(paper));
  assert.deepEqual(got, {
    date: "2026-10-03",
    name: "Lind",
    style: "nate",
    accent: "blu",
    edition: paper.edition,
    sections: [
      { key: "cat:Sport", slugs: ["kosova-fiton", "drita-humb"] },
      { key: "person:albin-kurti", slugs: ["kurti-ne-bruksel"] },
    ],
  });
});

test("the name is left out when the reader turned it off", () => {
  const got = decodeSnapshot(encodeSnapshot({ ...paper, name: "" }));
  assert.equal(got.name, "");
  assert.ok(!Buffer.from(encodeSnapshot({ ...paper, name: "" }), "base64url").toString().includes('"n"'));
});

test("unknown section keys never make it into a code", () => {
  const code = encodeSnapshot({ ...paper, sections: [{ key: "person:nobody", slugs: ["a"] }, { key: "cat:<b>", slugs: ["b"] }] });
  assert.deepEqual(decodeSnapshot(code).sections, []);
});

test("a full paper stays well under the code limit", () => {
  const slug = (i) => `nje-titull-shume-i-gjate-per-nje-lajm-nga-redaksia-e-383-numri-${String(i).padStart(4, "0")}`;
  const big = {
    ...paper,
    edition: Array.from({ length: 10 }, (_, i) => slug(i)),
    sections: ["cat:Sport", "cat:Kosovë", "person:albin-kurti", "city:prishtine"].map((key, i) => ({ key, slugs: [slug(100 + i), slug(200 + i)] })),
  };
  const code = encodeSnapshot(big);
  assert.ok(code.length < MAX_CODE_LENGTH, `code is ${code.length}`);
  assert.equal(decodeSnapshot(code).edition.length, 10);
});

test("hostile or broken codes are rejected whole", () => {
  const good = { v: 1, d: "2026-10-03", s: "klasike", a: "portokalli", e: ["a"], x: [] };
  assert.ok(decodeSnapshot(craft(good)));
  const bad = [
    { ...good, v: 2 },
    { ...good, d: "2026-02-30" },
    { ...good, d: "yesterday" },
    { ...good, s: "neon" },
    { ...good, n: "Lind‮evil" },
    { ...good, n: "lind" },
    { ...good, n: "<img src=x>" },
    { ...good, e: [] },
    { ...good, e: ["UPPER"] },
    { ...good, e: ["a", "a"] },
    { ...good, e: Array.from({ length: 11 }, (_, i) => `s${i}`) },
    { ...good, x: [["cat:Sport", ["a"]]] },
    { ...good, x: [["cat:Sport", ["b", "c", "d"]]] },
    { ...good, x: [["cat:Foo", ["b"]]] },
    { ...good, x: [["cat:Sport", ["b"]], ["cat:Sport", ["c"]]] },
    { ...good, x: [["title", "Fake headline"]] },
  ];
  for (const raw of bad) assert.equal(decodeSnapshot(craft(raw)), null, JSON.stringify(raw));
  for (const junk of [null, 5, "", "!!!", "a".repeat(MAX_CODE_LENGTH + 1), Buffer.from("not json").toString("base64url")]) {
    assert.equal(decodeSnapshot(junk), null);
  }
});

test("a paper expires after 30 Kosovo days", () => {
  assert.equal(isExpired("2026-10-03", "2026-10-03"), false);
  assert.equal(isExpired("2026-10-03", "2026-11-02"), false);
  assert.equal(isExpired("2026-10-03", "2026-11-03"), true);
  // Shared just after midnight in Kosovo while the server's UTC day is still
  // the previous one: a date one day ahead is not "expired".
  assert.equal(isExpired("2026-10-04", "2026-10-03"), false);
  assert.equal(isExpired("2026-10-09", "2026-10-03"), true);
  assert.equal(isExpired("junk", "2026-10-03"), true);
});
