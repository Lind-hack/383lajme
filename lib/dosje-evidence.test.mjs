import test from "node:test";
import assert from "node:assert/strict";

import { pickEvidence, passageFor, tierOf } from "./dosje-sources.mjs";
import { snapQuote } from "./dosje-draft.mjs";

/**
 * Evidence that can actually pass the per-claim rule.
 *
 * Every sentence of a moment needs two publishers quoting it, so the pack has
 * to hold the same EVENT from two outlets — not eight outlets on eight
 * different events. Wikipedia pages are the natural unit: the page on one
 * trial cites several outlets on that trial. Sources are grouped by the page
 * that led to them, and groups that already have two publishers come first.
 */

const src = (publisher, lead, extra = {}) => ({ url: `https://${publisher}.example/${lead}`, publisher, lead, text: "x".repeat(400), tier: 3, ...extra });

test("events covered by two publishers are picked before single-outlet events", () => {
  const pack = pickEvidence(
    [
      src("bbc", "Thaci trial"),
      src("presidency", "Pope visit"),
      src("reuters", "Thaci trial"),
      src("balkaninsight", "Mustafa trial"),
      src("apnews", "Mustafa trial"),
      src("koha", "Lone story"),
    ],
    { max: 4 }
  );
  assert.deepEqual(
    pack.map((s) => `${s.lead}/${s.publisher}`).sort(),
    ["Mustafa trial/apnews", "Mustafa trial/balkaninsight", "Thaci trial/bbc", "Thaci trial/reuters"]
  );
});

test("one outlet cannot fill an event group on its own", () => {
  const pack = pickEvidence([src("bbc", "A"), { ...src("bbc", "A"), url: "https://bbc.example/A2" }, src("bbc", "A", { url: "https://bbc.example/A3" })], { max: 4 });
  // Nothing corroborates A, but the pack still returns what there is (the
  // checks downstream refuse it); it simply is not counted as a pair.
  assert.ok(pack.length >= 1);
});

test("leftover room is filled with the best single sources", () => {
  const pack = pickEvidence([src("bbc", "A"), src("reuters", "A"), src("koha", "B")], { max: 5 });
  assert.equal(pack.length, 3);
});

test("the model is shown the passages about the subject, not the page's opening", () => {
  const text =
    "Menu Home News Sport Weather. Cookie settings. " +
    "The weather in Pristina was mild. " +
    "The Kosovo Specialist Chambers opened the trial of Salih Mustafa on 15 September 2021. " +
    "Mustafa denied the charges. Other news follows here.";
  const out = passageFor(text, [["specialist", "chambers"], ["mustafa"]], 200);
  assert.ok(out.includes("opened the trial of Salih Mustafa on 15 September 2021"));
  assert.ok(!out.startsWith("Menu Home"));
  assert.ok(out.length <= 200);
});

test("with no subject terms on the page, the opening is shown", () => {
  assert.equal(passageFor("Alpha beta. Gamma delta.", [["kosovo"]], 11), "Alpha beta.");
});

test("trusted outlets now include the court itself and major newsrooms", () => {
  assert.equal(tierOf("https://www.scp-ks.org/en/press-releases/x"), 1);
  assert.notEqual(tierOf("https://www.theguardian.com/world/2020/jun/24/x"), null);
  assert.notEqual(tierOf("https://www.aljazeera.com/news/2020/11/5/x"), null);
  assert.equal(tierOf("https://randomblog.example/x"), null);
});

// ── snapping a reworded quote to the real sentence ──────────────────────────

const page =
  "The court said on Thursday it had confirmed the indictment. " +
  "The Kosovo Specialist Chambers opened its first trial on 15 September 2021 against Salih Mustafa, a former KLA commander. " +
  "He pleaded not guilty.";

test("a quote the model reworded slightly is replaced by the sentence actually on the page", () => {
  const snapped = snapQuote("The Kosovo Specialist Chambers opened the first trial on 15 September 2021 against Salih Mustafa", page);
  assert.equal(snapped, "The Kosovo Specialist Chambers opened its first trial on 15 September 2021 against Salih Mustafa, a former KLA commander.");
});

test("an exact quote is kept as it is", () => {
  assert.equal(snapQuote("He pleaded not guilty and more", page), null, "not on the page, too different");
  assert.equal(snapQuote("opened its first trial on 15 September 2021", page), "opened its first trial on 15 September 2021");
});

test("a quote that changes a figure or a name is not snapped", () => {
  assert.equal(snapQuote("The Kosovo Specialist Chambers opened its first trial on 15 September 2022 against Salih Mustafa", page), null);
  assert.equal(snapQuote("The Kosovo Specialist Chambers opened its first trial on 15 September 2021 against Hashim Thaci", page), null);
});

test("an invented quote is not snapped to an unrelated sentence", () => {
  assert.equal(snapQuote("The court convicted all four defendants of war crimes in a landmark ruling", page), null);
});

import { articleText, isBlockedPublisher } from "./dosje-sources.mjs";

test("the article's paragraphs are read, not the menus around them", () => {
  const html =
    "<html><body><nav><a>Home</a> <a>News</a> <a>Sport</a></nav>" +
    "<p>Kosovo President Hashim Thaci has been indicted for war crimes by a special court in The Hague.</p>" +
    "<p>The Kosovo Specialist Chambers said the charges include murder, enforced disappearance and torture.</p>" +
    "<p>Mr Thaci denies the charges and says he will resign if the indictment is confirmed by the court.</p>" +
    "<footer>Cookie settings</footer></body></html>";
  const text = articleText(html);
  assert.ok(text.startsWith("Kosovo President Hashim Thaci has been indicted"));
  assert.ok(!text.includes("Cookie settings"));
  assert.ok(!text.includes("Sport"));
});

test("a page without real paragraphs falls back to all of its text", () => {
  assert.equal(articleText("<div>Short page with only one line of text here.</div>"), "Short page with only one line of text here.");
});

test("outlets that refuse our requests are skipped, not left to waste slots", () => {
  assert.equal(isBlockedPublisher("https://apnews.com/article/x"), true);
  assert.equal(isBlockedPublisher("https://www.reuters.com/world/x"), true);
  assert.equal(isBlockedPublisher("https://www.bbc.com/news/x"), false);
});
