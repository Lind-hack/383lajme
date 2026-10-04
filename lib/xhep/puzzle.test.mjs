import { test } from "node:test";
import assert from "node:assert/strict";
import { puzzlePieces, area } from "./puzzle.mjs";

test("seven pieces tile the whole picture exactly", () => {
  const W = 1000, H = 830;
  const pieces = puzzlePieces(W, H, 7);
  assert.equal(pieces.length, 7);
  const total = pieces.reduce((s, p) => s + area(p.points), 0);
  // Tabs move area between neighbours but never create or lose any.
  assert.ok(Math.abs(total - W * H) < 0.5, `pieces cover ${total}, picture is ${W * H}`);
  for (const p of pieces) for (const [x, y] of p.points) assert.ok(x > -1e-6 && x < W + 1e-6 && y > -1e-6 && y < H + 1e-6);
});

test("every piece has a knob or a blank, and cities differ", () => {
  const a = puzzlePieces(1000, 830, 1).map((p) => p.points.length);
  for (const n of a) assert.ok(n > 8, "a piece without tabs is just a rectangle");
  assert.notDeepEqual(puzzlePieces(1000, 830, 1).map((p) => area(p.points).toFixed(0)), puzzlePieces(1000, 830, 99).map((p) => area(p.points).toFixed(0)));
});
