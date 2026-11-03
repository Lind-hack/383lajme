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

import { readMomentJudgement } from "./dosje-judge.mjs";

test("the judge is told the dossier's subject and must confirm an event on that date", () => {
  // 3 Nov run: "23 korrik 1997 — Berisha dhe presidenca: Sali Berisha është
  // ish-president i Shqipërisë" passed every claim check while saying nothing
  // about what happened that day; a hooligans piece became Serbian
  // student-list history.
  const p = judgePrompt({ ...moment, event_date: "1997-07-23", topic: "Sali Berisha dhe opozita shqiptare" });
  assert.match(p.prompt, /Dossier: Sali Berisha dhe opozita shqiptare/);
  assert.match(p.system, /what happened on/i);
  assert.match(p.system, /belong/i);
});

test("a moment-level refusal refuses the moment even when every claim is supported", () => {
  const claims = [{ i: 0, supported: true }, { i: 1, supported: true }];
  assert.equal(readMomentJudgement({ claims, moment: { is_event_on_date: false, belongs_to_dossier: true, problem: "only describes who he is" } }, 2).ok, false);
  assert.equal(readMomentJudgement({ claims, moment: { is_event_on_date: true, belongs_to_dossier: false } }, 2).ok, false);
  assert.equal(readMomentJudgement({ claims }, 2).ok, false, "a missing moment verdict is a refusal");
  assert.equal(readMomentJudgement({ claims, moment: { is_event_on_date: true, belongs_to_dossier: true, event_sentence: 1 } }, 2).ok, true);
});

test("the judge must name the sentence that says what happened, or the moment is refused", () => {
  // 3 Nov re-check: Gemini answered is_event_on_date true for "Sali Berisha është
  // ish-president" because the quote beside it mentioned his resignation. The
  // reader sees the sentence, not the quote, so a bare yes is not enough.
  const claims = [{ i: 0, supported: true }, { i: 1, supported: true }];
  const verdict = (event_sentence) => readMomentJudgement({ claims, moment: { is_event_on_date: true, belongs_to_dossier: true, event_sentence } }, 2);
  assert.equal(verdict(1).ok, true);
  assert.equal(verdict(0).ok, true);
  assert.equal(verdict(-1).ok, false, "no sentence states an event");
  assert.equal(verdict(2).ok, false, "not one of the sentences");
  assert.equal(verdict("1").ok, false, "not an index");
  assert.equal(verdict(undefined).ok, false, "not answered");
  assert.match(verdict(-1).problems.join(" "), /no sentence says what happened/);
});

test("the judge reads the moment's sentences alone, not the quotes, for the event", () => {
  const { system } = judgePrompt(moment);
  assert.match(system, /event_sentence/);
  assert.match(system, /ignore the quotes/i);
});

import { linkJudgePrompt, readLinkJudgement } from "./dosje-judge.mjs";

test("article links are judged in one batch per dossier, by slug", () => {
  const p = linkJudgePrompt(
    { title: "Sali Berisha dhe opozita shqiptare", blurb: "Lideri i PD-së dhe opozita në Shqipëri." },
    [
      { slug: "u21", title: "Kosovë U21 mposht Qipron 2-1", excerpt: "Golat i shënuan Berisha dhe Jashari." },
      { slug: "protesta", title: "Berisha thërret protestë kundër Ramës", excerpt: "" },
    ]
  );
  assert.match(p.prompt, /Sali Berisha dhe opozita shqiptare/);
  assert.match(p.prompt, /u21[\s\S]*protesta/);
  const ok = readLinkJudgement({ articles: [{ slug: "u21", about: false }, { slug: "protesta", about: true }] }, ["u21", "protesta"]);
  assert.deepEqual([...ok], ["protesta"]);
});

test("a link the judge did not clearly accept is not made", () => {
  assert.deepEqual([...readLinkJudgement(null, ["a"])], []);
  assert.deepEqual([...readLinkJudgement({ articles: [{ slug: "a", about: "yes" }] }, ["a"])], []);
  assert.deepEqual([...readLinkJudgement({ articles: [{ slug: "zzz", about: true }] }, ["a"])], [], "an unknown slug is ignored");
});
