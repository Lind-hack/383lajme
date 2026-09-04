import test from "node:test";
import assert from "node:assert/strict";
import {
  angularRecordedPath,
  RECORDED_RANGE_OPTIONS,
  formatProbabilityTick,
  probabilityDomain,
  recordedRangeDisplaySeries,
  selectRecordedRange,
  smoothRecordedPath,
} from "./tregu-probability-domain.mjs";

test("probability domain falls back to the full honest scale", () => {
  assert.deepEqual(probabilityDomain([]), {
    lo: 0,
    hi: 1,
    rawLo: 0,
    rawHi: 1,
    ticks: [0, 0.25, 0.5, 0.75, 1],
    tickStep: 0.25,
    zoomed: false,
  });
});

test("flat and small real moves use the same 8 point minimum band", () => {
  assert.deepEqual(
    { lo: probabilityDomain([0.5]).lo, hi: probabilityDomain([0.5]).hi },
    { lo: 0.46, hi: 0.54 }
  );
  const moved = probabilityDomain([0.48, 0.52]);
  assert.equal(moved.lo, 0.46);
  assert.equal(moved.hi, 0.54);
  assert.deepEqual(moved.ticks, [0.46, 0.48, 0.5, 0.52, 0.54]);
});

test("near-boundary and broad ranges retain every real extreme", () => {
  const ceiling = probabilityDomain([0.97, 0.99]);
  assert.deepEqual({ lo: ceiling.lo, hi: ceiling.hi }, { lo: 0.92, hi: 1 });
  const broad = probabilityDomain([0.1, 0.9]);
  assert.deepEqual({ lo: broad.lo, hi: broad.hi, zoomed: broad.zoomed }, { lo: 0, hi: 1, zoomed: false });
  const mixed = probabilityDomain([0.18, 0.26, 0.56]);
  assert.deepEqual({ lo: mixed.lo, hi: mixed.hi }, { lo: 0.123, hi: 0.617 });
});

test("domain is deterministic, finite, clamped and never discards an outlier", () => {
  const a = probabilityDomain([Number.NaN, 2, -1, 0.48, 0.53]);
  const b = probabilityDomain([0.53, -1, 2, 0.48]);
  assert.deepEqual(a, b);
  assert.equal(a.rawLo, 0);
  assert.equal(a.rawHi, 1);
  assert.equal(a.lo, 0);
  assert.equal(a.hi, 1);
  assert.ok(a.ticks.length >= 3 && a.ticks.length <= 5);
  assert.ok(a.ticks.every((tick, index) => tick >= a.lo && tick <= a.hi && (index === 0 || tick > a.ticks[index - 1])));
});

test("all requested timeframe keys filter only existing recorded points", () => {
  assert.deepEqual(RECORDED_RANGE_OPTIONS.map((item) => item.key), ["1s", "1m", "5m", "15m", "1h", "4h", "1d", "1w", "Gjithë"]);
  assert.deepEqual(
    RECORDED_RANGE_OPTIONS.slice(0, 8).map((item) => item.ms),
    [1_000, 60_000, 300_000, 900_000, 3_600_000, 14_400_000, 86_400_000, 604_800_000]
  );
  const base = Date.parse("2026-08-24T12:00:00Z");
  const source = [{
    key: "po",
    points: [
      { t: base - 120_000, p: 0.4 },
      { t: base - 30_000, p: 0.45 },
      { t: base, p: 0.51 },
    ],
  }];
  const short = selectRecordedRange(source, "1s");
  assert.deepEqual(short.series[0].points, source[0].points.slice(2));
  assert.ok(short.series[0].points.every((point) =>
    source[0].points.some((sourcePoint) => sourcePoint.t === point.t && sourcePoint.p === point.p)
  ));
  assert.deepEqual(selectRecordedRange(source, "Gjithë").series[0].points, source[0].points);
  assert.equal(selectRecordedRange([{ key: "empty", points: [] }], "Gjithë").end, null);
});

test("smooth geometry passes through every exact point without rectangular steps", () => {
  const path = smoothRecordedPath(
    [{ t: 0, p: 0.4 }, { t: 10, p: 0.6 }, { t: 20, p: 0.5 }],
    (value) => value,
    (value) => value * 100
  );
  assert.match(path, /^M0\.0 40\.0 C/);
  assert.match(path, /10\.0 60\.0 C/);
  assert.match(path, /20\.0 50\.0$/);
  assert.doesNotMatch(path, /[HV]/);
  assert.equal(formatProbabilityTick(0.475, 0.025), "47.5%");
});

test("selected windows carry the last exact value to the boundary without changing source history", () => {
  const end = Date.parse("2026-08-28T12:00:00Z");
  const source = [{
    key: "home",
    points: [
      { t: end - 7_200_000, p: 0.62 },
      { t: end - 1_800_000, p: 0.71 },
      { t: end, p: 0.66 },
    ],
  }];
  const selected = selectRecordedRange(source, "1h");
  const display = recordedRangeDisplaySeries(selected.series, selected.start, selected.end);

  assert.deepEqual(selected.series[0].points, source[0].points.slice(1));
  assert.deepEqual(display[0].points, source[0].points.slice(1));
  assert.deepEqual(display[0].displayPoints, [
    { t: end - 3_600_000, p: 0.62, held: true },
    { t: end - 1_800_000, p: 0.71, held: false },
    { t: end, p: 0.66, held: false },
  ]);
});

test("every series holds its latest exact value through the live right edge", () => {
  const latest = Date.parse("2026-08-28T12:00:00Z");
  const now = latest + 60_000;
  const source = [
    { key: "early", points: [{ t: latest - 120_000, p: 0.42 }] },
    { key: "late", points: [{ t: latest, p: 0.58 }] },
  ];
  const selected = selectRecordedRange(source, "Gjithë", now);
  const display = recordedRangeDisplaySeries(selected.series, selected.start, selected.end);

  assert.equal(selected.end, now);
  assert.deepEqual(display[0].displayPoints.at(-1), { t: now, p: 0.42, held: true });
  assert.deepEqual(display[1].displayPoints.at(-1), { t: now, p: 0.58, held: true });
  assert.deepEqual(display.map((item) => item.points), source.map((item) => item.points));
});

test("angular geometry keeps every exact turn visibly sharp", () => {
  const path = angularRecordedPath(
    [{ t: 0, p: 0.4 }, { t: 10, p: 0.7 }, { t: 20, p: 0.45 }],
    (value) => value,
    (value) => value * 100
  );
  assert.equal(path, "M0.0 40.0 L10.0 70.0 L20.0 45.0");
});
