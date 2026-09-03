import test from "node:test";
import assert from "node:assert/strict";
import { relevanceGroupsForQuery, sourceMatchesProfile, fetchSource, publisherOf, WAYBACK_AVAILABILITY, timestampForQuery } from "./dosje-sources.mjs";
test("sourceMatchesProfile rejects a reputable but unrelated page", () => {
  assert.equal(sourceMatchesProfile({ title: "Brazil joins BRICS", text: "The summit discussed trade and membership." }, [["kosovo", "president"], ["kosovo", "parliament"]]), false);
});
test("sourceMatchesProfile accepts the same event context", () => {
  assert.equal(sourceMatchesProfile({ title: "Kosovo parliament fails to elect president", text: "Lawmakers missed the constitutional deadline after months of political deadlock and a new election was triggered." }, [["kosovo", "president"], ["kosovo", "parliament"], ["kosovo", "deadlock"]]), true);
});
test("relevanceGroupsForQuery profiles Kosovo institutional crisis terms", () => {
  const groups = relevanceGroupsForQuery("Kosovo presidential election parliamentary deadlock 2025 2026");
  assert.ok(groups.some((group) => group.includes("kosovo") && group.includes("president")));
  assert.ok(groups.some((group) => group.includes("kosovo") && group.includes("parliament")));
});

/**
 * Link rot is the normal case for a dossier that reaches back decades, not an
 * edge case. Measured against the real thing: for "Resolution 1244", four of
 * the seven urls Wikipedia cites are dead, and three of those four are un.org —
 * the Tier 1 primary-document host. Without a snapshot the model is handed
 * nothing to cite, every draft fails validateMilestoneDraft, and the research
 * route returns 422 verify_failed, which the cron reports as success.
 */

const okPage = (body) => ({
  ok: true,
  status: 200,
  text: async () => `<html><head><title>t</title></head><body>${body}</body></html>`,
});
const notFound = { ok: false, status: 404, text: async () => "" };

test("fetchSource does not reach for an archive when the url is alive", async () => {
  const seen = [];
  const res = await fetchSource("https://news.bbc.co.uk/live", {
    fetchImpl: async (u) => { seen.push(String(u)); return okPage("the council adopted the resolution"); },
  });
  assert.equal(res.http_status, 200);
  assert.equal(res.via_archive, false);
  assert.equal(res.archive_url, null);
  assert.equal(seen.length, 1, "a living url must cost exactly one request");
});

test("a dead url is recovered from the closest snapshot", async () => {
  const res = await fetchSource("https://un.org/dead/1244", {
    timestamp: "19990610",
    fetchImpl: async (u) => {
      const url = String(u);
      if (url.startsWith(WAYBACK_AVAILABILITY)) {
        assert.ok(url.includes("timestamp=19990610"), "the event's own date should steer the snapshot");
        return { ok: true, status: 200, json: async () => ({
          archived_snapshots: { closest: { available: true, url: "http://web.archive.org/web/1999/https://un.org/dead/1244" } },
        }) };
      }
      if (url.startsWith("https://web.archive.org/")) return okPage("resolution 1244 establishes an international presence");
      return notFound;
    },
  });
  assert.equal(res.via_archive, true);
  assert.match(res.text, /resolution 1244/i);
  assert.ok(res.archive_url.startsWith("https://"), "the snapshot url is upgraded to https");
});

test("recovery keeps the original publisher, so the two-publisher rule still bites", async () => {
  const res = await fetchSource("https://un.org/dead/1244", {
    fetchImpl: async (u) => String(u).startsWith(WAYBACK_AVAILABILITY)
      ? { ok: true, status: 200, json: async () => ({ archived_snapshots: { closest: { available: true, url: "https://web.archive.org/web/1999/x" } } }) }
      : String(u).startsWith("https://web.archive.org/") ? okPage("text") : notFound,
  });
  // Were url rewritten to web.archive.org, every recovered source would share
  // one publisher and insufficient_publishers could never fire again.
  assert.equal(res.url, "https://un.org/dead/1244");
  assert.equal(res.publisher, publisherOf("https://un.org/dead/1244"));
  assert.notEqual(res.publisher, "web.archive.org");
});

test("no snapshot means an honest failure row, not a fabricated success", async () => {
  const res = await fetchSource("https://un.org/gone", {
    fetchImpl: async (u) => String(u).startsWith(WAYBACK_AVAILABILITY)
      ? { ok: true, status: 200, json: async () => ({ archived_snapshots: {} }) }
      : notFound,
  });
  assert.equal(res.http_status, 404);
  assert.equal(res.via_archive, false);
  assert.equal(res.text, "");
});

test("an archive lookup that itself fails cannot take the fetch down with it", async () => {
  const res = await fetchSource("https://un.org/gone", {
    fetchImpl: async (u) => {
      if (String(u).startsWith(WAYBACK_AVAILABILITY)) throw new Error("archive.org unreachable");
      return notFound;
    },
  });
  assert.equal(res.http_status, 404, "the original status must survive an archive outage");
  assert.equal(res.via_archive, false);
});

test("the subject's own year steers which snapshot is fetched", () => {
  assert.equal(timestampForQuery("Kosovo War 1999 Resolution 1244"), "19990601");
  assert.equal(timestampForQuery("Brussels Agreement 2013 dialogue"), "20130601");
  assert.equal(timestampForQuery("no year here at all"), null, "no year means take the closest capture");
});
