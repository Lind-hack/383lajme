import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ROUTER_PROMPT,
  GUARD_PROMPT,
  buildRouterPrompt,
  parseRoute,
  replyLanguage,
  guessLanguage,
  isDistress,
  parseGuard,
  buildGuardPrompt,
  fixedReply,
} from "./pyet-guard.mjs";
import { refusalFor, REFUSAL, REFUSAL_THIN } from "./pyet-prompt.mjs";

test("a readable route is kept, anything else is null so the archive decides", () => {
  assert.deepEqual(parseRoute({ route: "General", lang: "EN" }), { route: "general", lang: "en", distress: false });
  assert.deepEqual(parseRoute({ route: "chat", lang: "fr", distress: true }), { route: "chat", lang: null, distress: true });
  assert.equal(parseRoute({ route: "opinion" }), null);
  assert.equal(parseRoute(null), null);
  assert.equal(parseRoute("news"), null);
  // Only a real true counts as distress.
  assert.equal(parseRoute({ route: "chat", distress: "yes" }).distress, false);
});

test("the router sends unsure cases to news and to blocked, and sees the last exchange", () => {
  assert.ok(/unsure between news and general, choose news/.test(ROUTER_PROMPT));
  assert.ok(/unsure whether something is blocked,\s*choose blocked/.test(ROUTER_PROMPT));
  const p = buildRouterPrompt("po pse?", [
    { question: "a", answer: "b" },
    { question: "Çka ndodhi me rrugën?", answer: "U mbyll." },
    { question: "x".repeat(900), answer: "y" },
  ]);
  assert.ok(p.includes("Çka ndodhi me rrugën?"));
  assert.ok(!p.includes("Reader: a\n"));
  assert.ok(!p.includes("x".repeat(301)));
  assert.ok(p.endsWith("po pse?"));
});

test("Dardani replies in the reader's language, then the site's, then Albanian", () => {
  assert.equal(replyLanguage("en", "sq"), "en");
  assert.equal(replyLanguage(null, "de"), "de");
  assert.equal(replyLanguage("fr", "xx"), "sq");
  assert.equal(guessLanguage("Hello Dardani"), "en");
  assert.equal(guessLanguage("thanks!"), "en");
  assert.equal(guessLanguage("Tung vlla"), null);
  assert.equal(guessLanguage("Faleminderit"), null);
});

test("a reader in danger is caught before any model, in every language", () => {
  for (const m of ["nuk du me jetu ma", "S'du me jetu", "dua të vdes", "I want to kill myself", "ich will nicht mehr leben", "po mendoj per vetvrasje"]) {
    assert.equal(isDistress(m), true, m);
  }
  for (const m of ["si je?", "a vdes bari ne dimer?", "jetoj ne Prishtine", "du me ble veture"]) {
    assert.equal(isDistress(m), false, m);
  }
  assert.deepEqual(parseRoute({ route: "distress" }), { route: "chat", lang: null, distress: true });
});

test("the guard fails closed", () => {
  assert.deepEqual(parseGuard({ ok: true }), { ok: true });
  assert.equal(parseGuard({ ok: "true" }).ok, false);
  assert.equal(parseGuard(null).ok, false);
  assert.equal(parseGuard({ ok: false, reason: "politics" }).reason, "politics");
  assert.ok(/Kosovo–Serbia/.test(GUARD_PROMPT));
  assert.ok(buildGuardPrompt("si je", "mirë").includes("Dardani's reply:\nmirë"));
});

test("fixed replies exist in every language, and distress always names 112", () => {
  for (const lang of ["sq", "en", "de"]) {
    for (const kind of ["blocked", "distress", "fallback", "unsure"]) assert.ok(fixedReply(kind, lang).length > 10);
    assert.ok(fixedReply("distress", lang).includes("112"));
  }
  assert.equal(fixedReply("blocked", "fr"), fixedReply("blocked", "sq"));
});

test("news refusals follow the reader's language and keep the Albanian ones as the base", () => {
  assert.equal(refusalFor("sq"), REFUSAL);
  assert.equal(refusalFor("sq", true), REFUSAL_THIN);
  const en = refusalFor("en");
  assert.equal(en.headline, "I don't have a story on this.");
  assert.equal(en.ctaHref, REFUSAL.ctaHref);
  assert.notEqual(refusalFor("de", true).headline, refusalFor("de").headline);
});
