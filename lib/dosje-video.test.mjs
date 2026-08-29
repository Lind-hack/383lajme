import test from "node:test";
import assert from "node:assert/strict";

import { vetChannel, admissible, VETTED_CHANNELS } from "./dosje-video.mjs";

/**
 * The video gate.
 *
 * A confident narrator is more persuasive than a confident sentence, and a
 * reader cannot skim a video for a wrong date. These tests hold the line that
 * an explainer comes from a newsroom, not from an anonymous account.
 */

test("an anonymous commentary channel is refused", () => {
  // The real case: this was the explainer attached to the KFOR dossier, and
  // nothing in the system objected to it.
  assert.equal(vetChannel("HistoryLegends"), null);
  assert.equal(
    admissible({ alive: true, vetted: vetChannel("HistoryLegends") }).reason,
    "channel_not_vetted"
  );
});

test("newsrooms pass, and carry how they are funded", () => {
  for (const [name, funding] of [
    ["BBC Stories", "public"],
    ["Bloomberg Television", "commercial"],
    ["DW News", "public"],
    ["euronews", "public"],
    ["Al Jazeera English", "state-funded"],
    ["TRT World", "state-funded"],
  ]) {
    const v = vetChannel(name);
    assert.ok(v, `${name} should be vetted`);
    assert.equal(v.funding, funding, `${name} funding should be recorded as ${funding}`);
  }
});

test("state funding is disclosed, not hidden and not disqualifying", () => {
  // Two of these cover Kosovo with a stake in the story. Recording it lets a
  // reviewer weigh it; silently dropping them would be its own kind of edit.
  const state = VETTED_CHANNELS.filter((c) => c.funding === "state-funded");
  assert.ok(state.length >= 2);
  for (const c of state) assert.equal(admissible({ alive: true, vetted: c }).ok, true);
});

test("a dead video is refused even from a vetted channel", () => {
  const r = admissible({ alive: false, vetted: vetChannel("BBC Stories") });
  assert.equal(r.ok, false);
  assert.equal(r.reason, "video_unavailable");
});

test("a check that could not run is not treated as a pass", () => {
  // The dangerous default. A network failure must never read as "fine".
  const r = admissible({ alive: null, vetted: vetChannel("BBC Stories") });
  assert.equal(r.ok, false);
  assert.equal(r.reason, "check_failed");
});

test("a lookalike name does not inherit a newsroom's standing", () => {
  for (const fake of ["BBC News Fan Channel", "Reuters Unofficial", "DW News Archive Unofficial"]) {
    const v = vetChannel(fake);
    // Only an exact name, or that name as a whole leading or trailing word.
    if (v) assert.ok(fake.startsWith(v.name) || fake.endsWith(v.name), fake);
  }
  assert.equal(vetChannel("Totally Not BBC"), null);
  assert.equal(vetChannel(""), null);
  assert.equal(vetChannel(null), null);
});

test("the allowlist is an allowlist", () => {
  // A blocklist would assume we can name every bad channel, and the reason
  // this rule exists is that we cannot.
  for (const c of VETTED_CHANNELS) {
    assert.ok(c.name && c.tier >= 1 && c.funding, "every entry declares who it is");
  }
});
