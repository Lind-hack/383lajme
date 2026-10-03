import assert from "node:assert/strict";
import test from "node:test";
import { BASE, INTEREST_MATERIALS } from "./card-art.mjs";
import { QR_MIN_CONTRAST, QR_QUIET_MODULES, contrastRatio, mixHex, qrMatrix, scannableDarks, weakestContrast, wovenQr } from "./qr-art.mjs";

const lightsFor = (accent) => [BASE.cream, mixHex(BASE.cream, accent, 0.22)];

test("contrast ratio matches the WCAG formula", () => {
  assert.equal(Math.round(contrastRatio("#000000", "#FFFFFF") * 100) / 100, 21);
  assert.equal(contrastRatio("#777777", "#777777"), 1);
  assert.equal(mixHex("#000000", "#FFFFFF", 0.5), "#808080");
});

test("every dark/light pair any visitor can get clears the scan threshold", () => {
  const materials = Object.values(INTEREST_MATERIALS);
  for (const accent of materials) {
    const lights = lightsFor(accent.light);
    const grounds = [BASE.kilimRed, ...materials.map((m) => m.hex)].map((g) => mixHex(g, BASE.kilimBlack, 0.35));
    const darks = scannableDarks([...materials.map((m) => m.hex), ...grounds], lights, BASE.kilimBlack);
    assert.ok(weakestContrast(darks, lights) >= QR_MIN_CONTRAST, accent.name);
  }
});

test("dark threads too light to scan are dropped, never woven", () => {
  const lights = lightsFor(INTEREST_MATERIALS.food.light);
  const darks = scannableDarks(["#EE7A5E", INTEREST_MATERIALS.nightlife.hex], lights, BASE.kilimBlack);
  assert.deepEqual(darks, [BASE.kilimBlack, INTEREST_MATERIALS.nightlife.hex]);
  assert.throws(() => wovenQr("x", { x: 0, y: 0, module: 10, darks: ["#EE7A5E"], lights }), /below/);
});

test("the matrix has the three finder patterns in their corners", () => {
  const { size, isDark } = qrMatrix("https://383ks.com/visit");
  for (const [r0, c0] of [[0, 0], [0, size - 7], [size - 7, 0]]) {
    for (let i = 0; i < 7; i += 1) {
      assert.ok(isDark(r0, c0 + i) && isDark(r0 + 6, c0 + i) && isDark(r0 + i, c0) && isDark(r0 + i, c0 + 6));
    }
    assert.ok(!isDark(r0 + 1, c0 + 1) && isDark(r0 + 3, c0 + 3));
  }
});

test("the quiet zone is woven only from light threads, four modules deep", () => {
  const module = 10;
  const lights = lightsFor(INTEREST_MATERIALS.nature.light);
  const darks = [BASE.kilimBlack, INTEREST_MATERIALS.nightlife.hex];
  const { svg, span, size } = wovenQr("https://383ks.com/visit", { x: 100, y: 200, module, darks, lights });
  assert.equal(span, (size + QR_QUIET_MODULES * 2) * module);
  const lo = QR_QUIET_MODULES * module;
  for (const color of darks) {
    const d = svg.match(new RegExp(`<path d="([^"]+)" fill="${color}"`))?.[1] ?? "";
    for (const [, x, y] of d.matchAll(/M([\d.]+) ([\d.]+)/g)) {
      assert.ok(Number(x) >= 100 + lo && Number(x) < 100 + span - lo, `x ${x}`);
      assert.ok(Number(y) >= 200 + lo && Number(y) < 200 + span - lo, `y ${y}`);
    }
  }
});
