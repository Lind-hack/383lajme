import assert from "node:assert/strict";
import test from "node:test";

import { getDefaultPoll, POLL_QUESTIONS } from "./polls-data.ts";
import { isHedgeOption } from "./sondazhi-draft.mjs";
import {
  PROVISIONAL_THRESHOLD,
  isFinalDay,
  isProvisional,
  tallyFromCounts,
  pollPercentages,
  leadingOption,
  voteCountLabel,
  stakeLabel,
  standingLabel,
  resultStatusLabel,
  yesterdayCallback,
  pollFromRow,
  dateKeyInKosovo,
  previousDateKey,
  countdownLabel,
  msUntilKosovoMidnight,
} from "./sondazhi-data.mjs";

// ─────────────────────────────────────────────────────────────────────────────
// Sample size
// ─────────────────────────────────────────────────────────────────────────────

test("a poll day is final once its date has passed, with no job having to run", () => {
  assert.equal(isFinalDay("2026-08-16", "2026-08-17"), true);
  assert.equal(isFinalDay("2026-08-17", "2026-08-17"), false);
  // A poll scheduled ahead is not retroactively final.
  assert.equal(isFinalDay("2026-08-18", "2026-08-17"), false);
});

test("today's result is provisional only while the sample is thin", () => {
  assert.equal(isProvisional(0, "2026-08-17", "2026-08-17"), true);
  assert.equal(isProvisional(PROVISIONAL_THRESHOLD - 1, "2026-08-17", "2026-08-17"), true);
  assert.equal(isProvisional(PROVISIONAL_THRESHOLD, "2026-08-17", "2026-08-17"), false);
});

test("a finished day is never provisional, however few voted", () => {
  assert.equal(isProvisional(1, "2026-08-16", "2026-08-17"), false);
  assert.equal(resultStatusLabel(1, "2026-08-16", "2026-08-17"), "Rezultati përfundimtar");
});

// ─────────────────────────────────────────────────────────────────────────────
// Tally
// ─────────────────────────────────────────────────────────────────────────────

test("the RPC's sparse count map folds into an array aligned with the options", () => {
  assert.deepEqual(tallyFromCounts({ "0": 3, "1": 2 }, 2), { counts: [3, 2], total: 5 });
});

test("an option nobody picked is zero rather than missing", () => {
  assert.deepEqual(tallyFromCounts({ "1": 4 }, 3), { counts: [0, 4, 0], total: 4 });
});

test("a vote pointing past the end of an edited poll is discarded, not misattributed", () => {
  // Options were trimmed from 4 to 2 after voting opened; index 3 has nowhere to go.
  assert.deepEqual(tallyFromCounts({ "0": 1, "3": 9 }, 2), { counts: [1, 0], total: 1 });
});

test("a missing, empty or malformed tally is an empty poll, never a throw", () => {
  assert.deepEqual(tallyFromCounts(null, 2), { counts: [0, 0], total: 0 });
  assert.deepEqual(tallyFromCounts(undefined, 2), { counts: [0, 0], total: 0 });
  assert.deepEqual(tallyFromCounts({}, 2), { counts: [0, 0], total: 0 });
  assert.deepEqual(tallyFromCounts({ x: 5, "-1": 2, "0": "3" }, 2), { counts: [3, 0], total: 3 });
});

test("percentages always sum to exactly 100, including the thirds that round badly", () => {
  for (const counts of [[1, 1, 1], [2, 1], [1, 1, 1, 1, 1, 1], [7, 11, 13], [1, 2, 3, 4]]) {
    const pct = pollPercentages(counts);
    assert.equal(
      pct.reduce((a, b) => a + b, 0),
      100,
      `${JSON.stringify(counts)} produced ${JSON.stringify(pct)}`
    );
  }
});

test("an unvoted poll is all zeroes rather than a division by zero", () => {
  assert.deepEqual(pollPercentages([0, 0]), [0, 0]);
});

test("the leading option is only named when it genuinely leads", () => {
  assert.equal(leadingOption([3, 2]), 0);
  assert.equal(leadingOption([2, 3]), 1);
  assert.equal(leadingOption([3, 3]), null, "a tie has no winner");
  assert.equal(leadingOption([0, 0]), null, "an empty poll has no winner");
});

// ─────────────────────────────────────────────────────────────────────────────
// Copy
// ─────────────────────────────────────────────────────────────────────────────

test("vote counts read as Albanian, singular and plural", () => {
  assert.equal(voteCountLabel(0), "Bëhu i pari që voton");
  assert.equal(voteCountLabel(1), "1 votë");
  assert.equal(voteCountLabel(2), "2 vota");
});

test("large counts group with a no-break space, never a plain one", () => {
  const label = voteCountLabel(1249);
  assert.ok(label.includes("1 249"), label);
  assert.ok(!label.includes("1 249"), "a plain space would let the number wrap in half");
});

test("the stake line names the count and always asks for the vote", () => {
  assert.equal(stakeLabel(0), "Bëhu i pari që voton sot.");
  assert.match(stakeLabel(1), /Një votë deri tani/);
  assert.match(stakeLabel(7), /^7 vota deri tani/);
  for (const n of [1, 7, 999]) {
    assert.match(stakeLabel(n), /Vota jote e ndryshon rezultatin\./);
  }
});

test("standing tells the reader where they landed, not where the poll did", () => {
  assert.equal(standingLabel(0, [3, 1]), "Ti je me shumicën.");
  assert.equal(standingLabel(1, [3, 1]), "Ti je në pakicë — 1 nga 4.");
  assert.equal(standingLabel(0, [2, 2]), "Je në një rezultat të barabartë.");
});

test("standing is withheld when it would be meaningless or impossible", () => {
  assert.equal(standingLabel(null, [3, 1]), null, "not voted");
  assert.equal(standingLabel(0, [1, 0]), null, "the reader is the only voter");
  assert.equal(standingLabel(5, [3, 1]), null, "index outside the options");
  assert.equal(standingLabel(-1, [3, 1]), null, "negative index");
});

test("an early result says so plainly instead of dressing up a thin sample", () => {
  const early = resultStatusLabel(7, "2026-08-17", "2026-08-17");
  assert.match(early, /Ende herët/);
  assert.match(early, /7 vota/, "the real count is shown, never hidden");
  assert.match(early, /mesnatë/);
});

test("once the sample is real the result stops apologising for itself", () => {
  const settled = resultStatusLabel(PROVISIONAL_THRESHOLD, "2026-08-17", "2026-08-17");
  assert.ok(!settled.includes("Ende herët"), settled);
  assert.match(settled, /mesnatë/);
});

// ─────────────────────────────────────────────────────────────────────────────
// Yesterday's callback
// ─────────────────────────────────────────────────────────────────────────────

const YESTERDAY = {
  pollDate: "2026-08-16",
  question: "A do ta linit Kosovën?",
  options: ["Po", "Jo"],
  sourceArticleSlug: "emigrimi-2026",
};

test("yesterday's winner becomes the strip at the top of today's card", () => {
  assert.deepEqual(yesterdayCallback(YESTERDAY, [61, 39]), {
    pct: 61,
    option: "Po",
    slug: "emigrimi-2026",
  });
});

test("the callback is withheld rather than invented when there is nothing to report", () => {
  assert.equal(yesterdayCallback(null, [1, 2]), null, "no poll yesterday");
  assert.equal(yesterdayCallback(YESTERDAY, null), null, "no counts");
  assert.equal(yesterdayCallback(YESTERDAY, [0, 0]), null, "nobody voted");
  assert.equal(yesterdayCallback(YESTERDAY, [5, 5]), null, "a tie has nothing to announce");
});

test("a callback percentage is the same number the bar would have shown", () => {
  const counts = [1, 1, 1];
  const poll = { ...YESTERDAY, options: ["A", "B", "C"] };
  // A three-way tie has no winner, so nudge one ahead and check the two agree.
  const nudged = [2, 1, 1];
  const cb = yesterdayCallback(poll, nudged);
  assert.equal(cb.pct, pollPercentages(nudged)[0]);
  assert.equal(yesterdayCallback(poll, counts), null);
});

// ─────────────────────────────────────────────────────────────────────────────
// Rows
// ─────────────────────────────────────────────────────────────────────────────

test("a well-formed row becomes a record", () => {
  const rec = pollFromRow({
    poll_date: "2026-08-17",
    question: "  A janë çmimet të larta?  ",
    options: ["Po", "Jo"],
    context_line: "  Banka Qendrore raportoi një rritje.  ",
    source_article_slug: "cmimet",
    status: "approved",
  });
  assert.equal(rec.question, "A janë çmimet të larta?");
  assert.deepEqual(rec.options, ["Po", "Jo"]);
  assert.equal(rec.contextLine, "Banka Qendrore raportoi një rritje.");
  assert.equal(rec.sourceArticleSlug, "cmimet");
  assert.equal(rec.status, "approved");
});

test("options survive having been stored as a json string by an older writer", () => {
  const rec = pollFromRow({
    poll_date: "2026-08-17",
    question: "A?",
    options: '["Po","Jo"]',
  });
  assert.deepEqual(rec.options, ["Po", "Jo"]);
});

test("a row that is not a usable poll resolves to null instead of half-rendering", () => {
  assert.equal(pollFromRow(null), null);
  assert.equal(pollFromRow({}), null);
  assert.equal(pollFromRow({ poll_date: "2026-08-17", question: "  " , options: ["a","b"] }), null);
  assert.equal(pollFromRow({ poll_date: "2026-08-17", question: "A?", options: ["Vetëm një"] }), null,
    "one option is not a poll");
  assert.equal(pollFromRow({ poll_date: "2026-08-17", question: "A?", options: "not json" }), null);
  assert.equal(pollFromRow({ poll_date: "2026-08-17", question: "A?", options: [1, 2] }), null,
    "non-string options are dropped, leaving too few");
});

test("blank optional fields normalise to null rather than empty strings", () => {
  const rec = pollFromRow({
    poll_date: "2026-08-17",
    question: "A?",
    options: ["Po", "Jo"],
    context_line: "   ",
    source_article_slug: "",
  });
  assert.equal(rec.contextLine, null);
  assert.equal(rec.sourceArticleSlug, null);
});

test("a draft is reported as a draft so the homepage can refuse to publish it", () => {
  const draft = pollFromRow({
    poll_date: "2026-08-18", question: "A?", options: ["Po", "Jo"], status: "draft",
  });
  assert.equal(draft.status, "draft");
  // Anything unrecognised is treated as approved, matching the column default.
  const legacy = pollFromRow({ poll_date: "2026-08-18", question: "A?", options: ["Po", "Jo"] });
  assert.equal(legacy.status, "approved");
});

// ─────────────────────────────────────────────────────────────────────────────
// Clock — the poll now shares Reagimi's, which is the point of re-exporting it
// ─────────────────────────────────────────────────────────────────────────────

test("the poll keys its day off Kosovo local time, like the card above it", () => {
  // 22:30 UTC on 16 Aug is already the 17th in Pristina (UTC+2 in summer).
  // The old UTC key would have said the 16th and disagreed with Reagimi.
  assert.equal(dateKeyInKosovo(new Date("2026-08-16T22:30:00Z")), "2026-08-17");
  assert.equal(previousDateKey("2026-08-17"), "2026-08-16");
});

test("yesterday is one day back across a month boundary", () => {
  assert.equal(previousDateKey("2026-09-01"), "2026-08-31");
  assert.equal(previousDateKey("2026-01-01"), "2025-12-31");
});

// ─────────────────────────────────────────────────────────────────────────────
// Countdown
// ─────────────────────────────────────────────────────────────────────────────

test("the countdown reads as Albanian time, dropping units it does not need", () => {
  assert.equal(countdownLabel(6 * 3600e3 + 12 * 60e3), "Mbyllet për 6 orë 12 min");
  assert.equal(countdownLabel(3 * 3600e3), "Mbyllet për 3 orë", "no dangling 0 min");
  assert.equal(countdownLabel(42 * 60e3), "Mbyllet për 42 min", "no leading 0 orë");
});

test("the last minute stops counting rather than ticking down seconds", () => {
  assert.equal(countdownLabel(30e3), "Mbyllet brenda pak çastesh");
  assert.equal(countdownLabel(0), "Mbyllet së shpejti");
  assert.equal(countdownLabel(-1), "Mbyllet së shpejti");
  assert.equal(countdownLabel(NaN), "Mbyllet së shpejti");
});

test("time to Kosovo midnight is always inside a single day", () => {
  const ms = msUntilKosovoMidnight();
  assert.equal(ms > 0, true);
  assert.equal(ms <= 24 * 3600e3, true);
});

test("the countdown is measured against Kosovo's wall clock, not UTC", () => {
  // 21:30 UTC is 23:30 in Pristina in summer, so half an hour remains there
  // while UTC arithmetic would still claim two and a half.
  const ms = msUntilKosovoMidnight(new Date("2026-08-16T21:30:00Z"));
  assert.equal(Math.round(ms / 60000), 30);
});

test("the countdown survives the winter offset as well as the summer one", () => {
  // 22:30 UTC in January is 23:30 in Pristina (UTC+1).
  const ms = msUntilKosovoMidnight(new Date("2026-01-16T22:30:00Z"));
  assert.equal(Math.round(ms / 60000), 30);
});

// ─────────────────────────────────────────────────────────────────────────────
// Fallback question rotation
//
// getDefaultPoll used local-time anchors, so on a DST machine the day-of-year
// floored one short and the card served yesterday's question for most of the
// year. Production runs UTC and was accidentally correct, which is why it went
// unnoticed until a local build disagreed with the live site.
// ─────────────────────────────────────────────────────────────────────────────

test("the rotation is the same on every machine, whatever its timezone", () => {
  // 2026-08-18 is day 230 of the year in UTC. Local-time arithmetic in a DST
  // zone yields 229 and therefore the previous day's question. Indexed off the
  // bank's real length so editing the bank does not falsify the clock test.
  assert.equal(
    getDefaultPoll("2026-08-18").question,
    POLL_QUESTIONS[230 % POLL_QUESTIONS.length].question
  );
});

test("consecutive days advance by exactly one question", () => {
  for (const [a, b] of [
    ["2026-08-17", "2026-08-18"],
    ["2026-03-28", "2026-03-29"], // spring DST transition in Europe
    ["2026-10-24", "2026-10-25"], // autumn DST transition
  ]) {
    const i = POLL_QUESTIONS.indexOf(getDefaultPoll(a));
    const j = POLL_QUESTIONS.indexOf(getDefaultPoll(b));
    assert.equal(j, (i + 1) % POLL_QUESTIONS.length, `${a} -> ${b} did not advance by one`);
  }
});

test("every day of a year resolves to a real question", () => {
  for (let d = 1; d <= 365; d++) {
    const key = new Date(Date.UTC(2026, 0, d, 12)).toISOString().slice(0, 10);
    const poll = getDefaultPoll(key);
    assert.ok(poll && poll.question && poll.options.length >= 2, `broken poll for ${key}`);
  }
});

test("no fallback question offers a way to avoid taking a side", () => {
  // The neutral option is always the safe pick and always wins, which is the
  // behaviour this feature exists to end. The generator refuses these too.
  for (const poll of POLL_QUESTIONS) {
    for (const option of poll.options) {
      assert.equal(
        isHedgeOption(option),
        false,
        `"${option}" in "${poll.question}" is an escape hatch`
      );
    }
  }
});

test("every fallback question is answerable and reads as a question", () => {
  for (const poll of POLL_QUESTIONS) {
    assert.ok(poll.question.length <= 140, `too long: ${poll.question}`);
    assert.ok(poll.options.length >= 2 && poll.options.length <= 4, poll.question);
    assert.equal(new Set(poll.options).size, poll.options.length, `duplicate option: ${poll.question}`);
    for (const o of poll.options) {
      assert.ok(o.trim().length > 0 && o.length <= 44, `bad option "${o}" in ${poll.question}`);
    }
  }
});

test("the bank does not repeat a question", () => {
  const seen = new Set(POLL_QUESTIONS.map((p) => p.question.toLowerCase()));
  assert.equal(seen.size, POLL_QUESTIONS.length);
});
