import test from "node:test";
import assert from "node:assert/strict";

import { judgePrompt, readJudgement } from "./dosje-judge.mjs";

/**
 * The second reader.
 *
 * Code can prove a quote is on the page and that its numbers and date match.
 * It cannot prove that an Albanian sentence says what an English quote says:
 * "the court convicts" against a quote about an indictment passes every
 * deterministic rule. So a separate model, which did not write the moment,
 * reads each claim beside its quotes. It can only refuse. Silence, a missing
 * answer or a malformed one counts as refusal.
 */

const moment = {
  title: "Gjyqi i parë në Dhomat e Specializuara",
  claims: {
    sentences: [
      {
        sentence: "Më 15 shtator 2021 fillon gjyqi i parë kundër Salih Mustafës.",
        quotes: [
          { source: 0, text: "The first trial at the Kosovo Specialist Chambers opened on 15 September 2021" },
          { source: 1, text: "Salih Mustafa went on trial on 15 September 2021" },
        ],
      },
      {
        sentence: "Mustafa akuzohet për torturë.",
        quotes: [
          { source: 0, text: "Mustafa is charged with torture and murder" },
          { source: 1, text: "accused of torture of detainees" },
        ],
      },
    ],
  },
};

test("the prompt shows every claim beside its own quotes", () => {
  const p = judgePrompt(moment);
  assert.match(p.prompt, /\[0\][\s\S]*15 shtator 2021[\s\S]*opened on 15 September 2021/);
  assert.match(p.prompt, /\[1\][\s\S]*torturë[\s\S]*charged with torture/);
  assert.ok(p.system.length > 50);
});

test("every claim supported → accepted", () => {
  const r = readJudgement({ claims: [{ i: 0, supported: true }, { i: 1, supported: true }] }, 2);
  assert.deepEqual(r, { ok: true, problems: [] });
});

test("one claim the quotes do not state → refused, with the reason kept", () => {
  const r = readJudgement(
    { claims: [{ i: 0, supported: true }, { i: 1, supported: false, problem: "quotes do not say convicted" }] },
    2
  );
  assert.equal(r.ok, false);
  assert.deepEqual(r.problems, ["[1] quotes do not say convicted"]);
});

test("a claim the judge skipped counts as unsupported", () => {
  const r = readJudgement({ claims: [{ i: 0, supported: true }] }, 2);
  assert.equal(r.ok, false);
  assert.match(r.problems[0], /^\[1\]/);
});

test("no answer or a malformed one refuses everything", () => {
  assert.equal(readJudgement(null, 2).ok, false);
  assert.equal(readJudgement({ claims: "yes" }, 2).ok, false);
  assert.equal(readJudgement({ claims: [{ i: 0, supported: "true" }, { i: 1, supported: true }] }, 2).ok, false);
});

test("the judge sees the moment's date and when each quote was published", () => {
  // The 2 Nov 2026 trial run merged Thaçi's November 2020 plea with his April
  // 2023 trial opening ("went on trial on Monday", BBC 2023) under one date.
  const p = judgePrompt({
    ...moment,
    display_date: "9 nëntor 2020",
    event_date: "2020-11-09",
    claims: {
      sentences: [
        {
          sentence: "Ai doli në gjyq me tre bashkë të pandehur.",
          quotes: [{ source: 0, text: "He went on trial on Monday with three co-defendants", published: "2023-04-03" }],
        },
      ],
    },
  });
  assert.match(p.prompt, /2020-11-09/);
  assert.match(p.prompt, /published 2023-04-03/);
  assert.match(p.system, /different time|different date/i);
});
