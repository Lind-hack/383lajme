import test from "node:test";
import assert from "node:assert/strict";
import { discoverClusters, checkProposedTopic } from "./dosje-discover.mjs";

const NOW = Date.parse("2026-10-21T08:00:00Z");
const at = (d) => new Date(NOW - d * 86_400_000).toISOString();
const a = (slug, title, excerpt, d) => ({ slug, title, excerpt, category: "Kosovë", publishedAt: at(d) });

const sepa = [
  a("s1", "Kosova hyn në zonën SEPA nga marsi", "Banka Qendrore e Kosovës njofton se pagesat SEPA nisin në mars.", 1),
  a("s2", "Bankat përgatiten për SEPA", "Banka Qendrore e Kosovës kërkon gatishmëri nga bankat për SEPA.", 2),
  a("s3", "Kurti: SEPA kursen 58 milionë euro në vit", "Albin Kurti flet për SEPA dhe Bankën Qendrore.", 4),
];
const noise = [
  a("n1", "Brighton fiton derbin 5-0", "Ndeshja u luajt në Londër.", 1),
  a("n2", "Zjarr në Prizren, shuhet pas dy orësh", "Zjarrfikësit e Prizrenit ndërhynë shpejt.", 2),
  a("n3", "Rritet çmimi i bukës në Gjilan", "Furrtarët e Gjilanit ankohen për miellin.", 3),
];

test("finds a subject the news keeps returning to", () => {
  const clusters = discoverClusters([...sepa, ...noise], [], { now: NOW });
  assert.equal(clusters.length, 1);
  assert.deepEqual(clusters[0].articles.map((x) => x.slug).sort(), ["s1", "s2", "s3"]);
  assert.ok(clusters[0].shared.includes("sepa"));
});

test("one busy day is a story, not a subject", () => {
  const sameDay = sepa.map((x) => ({ ...x, publishedAt: at(1) }));
  assert.equal(discoverClusters(sameDay, [], { now: NOW }).length, 0);
});

test("articles an existing topic already covers are left out", () => {
  const existing = [{ slug: "sepa", title: "SEPA", anchors: ["sepa"], matchGroups: [["sepa"]] }];
  assert.equal(discoverClusters([...sepa, ...noise], existing, { now: NOW }).length, 0);
});

const proposal = {
  slug: "kosova-ne-sepa",
  title: "Kosova në zonën SEPA",
  blurb: "Si hyn Kosova në sistemin evropian të pagesave dhe çfarë ndryshon për qytetarët.",
  anchors: ["sepa"],
  matchGroups: [["sepa"]],
  signals: ["banka qendrore"],
};

test("a proposal that matches its cluster and little else passes", () => {
  const verdict = checkProposedTopic(proposal, { cluster: sepa, others: noise });
  assert.equal(verdict.ok, true, verdict.reasons.join(","));
  assert.equal(verdict.ownMatches, 3);
});

test("vocabulary that matches unrelated news is refused", () => {
  const loose = { ...proposal, anchors: ["kosov"], matchGroups: [["në"]] };
  const verdict = checkProposedTopic({ ...loose, matchGroups: [["fiton"]] }, { cluster: sepa, others: noise });
  assert.equal(verdict.ok, false);
  assert.ok(verdict.reasons.includes("matches_too_few_of_its_cluster"));
});

test("a second name for an existing topic is refused", () => {
  const existing = [{ slug: "sepa", title: "SEPA", anchors: ["sepa"], matchGroups: [["sepa"]] }];
  const verdict = checkProposedTopic(proposal, { cluster: sepa, others: noise, topics: existing });
  assert.ok(verdict.reasons.includes("overlaps_existing_topic"));
});

test("malformed proposals are refused with stable reasons", () => {
  const verdict = checkProposedTopic({ slug: "Bad Slug", title: "x" }, { cluster: sepa, others: noise });
  for (const r of ["slug_invalid", "title_invalid", "blurb_invalid", "no_anchors", "no_match_groups"]) {
    assert.ok(verdict.reasons.includes(r), r);
  }
});
