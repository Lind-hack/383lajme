import { test } from "node:test";
import assert from "node:assert/strict";
import { bonusAmount, bonusOdds, jackpotChance } from "./tregu-daily-bonus.mjs";

test("odds cover 10..25 and sum to one", () => {
  for (const streak of [1, 3, 7, 30]) {
    const odds = bonusOdds(streak);
    assert.deepEqual(Object.keys(odds).map(Number), Array.from({ length: 16 }, (_, i) => 10 + i));
    const sum = Object.values(odds).reduce((a, b) => a + b, 0);
    assert.ok(Math.abs(sum - 1) < 1e-9, `streak ${streak} sums to ${sum}`);
  }
});

test("higher amounts are rarer, and 25 is the jackpot", () => {
  const odds = bonusOdds(1);
  for (let amount = 11; amount <= 24; amount++) assert.ok(odds[amount] < odds[amount - 1]);
  assert.ok(odds[25] < odds[15]);
  assert.equal(jackpotChance(1), 0.02);
  assert.ok(Math.abs(jackpotChance(7) - 0.06) < 1e-12);
  assert.equal(jackpotChance(40), jackpotChance(7));
});

test("the streak raises the jackpot and the high amounts, not the low ones", () => {
  const day1 = bonusOdds(1);
  const day7 = bonusOdds(7);
  assert.ok(day7[25] > day1[25]);
  assert.ok(day7[20] > day1[20]);
  assert.ok(day7[10] < day1[10]);
});

test("the roll lands where the odds say", () => {
  const counts = {};
  const n = 200_000;
  for (let i = 0; i < n; i++) {
    const amount = bonusAmount(4, (i + 0.5) / n);
    counts[amount] = (counts[amount] ?? 0) + 1;
  }
  const odds = bonusOdds(4);
  for (const [amount, p] of Object.entries(odds)) {
    assert.ok(Math.abs((counts[amount] ?? 0) / n - p) < 0.002, `${amount}: ${(counts[amount] ?? 0) / n} vs ${p}`);
  }
});
