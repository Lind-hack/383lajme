import test from "node:test";
import assert from "node:assert/strict";
import { buildNewsMarketOpenEmail } from "./tregu-creation-email.mjs";

test("each opening email shows kind, category, persisted opening odds and graph", () => {
  const message = buildNewsMarketOpenEmail({
    slug: "albin-kurti-votimi", question: "A votohet mocioni për Albin Kurtin?", category: "politike",
    market_image_url: "https://images.example/kurti.jpg", market_image_alt: "Albin Kurti",
    pre_match_analysis: { market_archetype: "scheduled_decision", proposition: { geography: "Kosovo" } },
  }, { market_prob: 0.63, created_at: "2026-09-28T08:00:00.000Z" });
  assert.match(message.subject, /Albin Kurtin/);
  assert.match(message.text, /Vendim i planifikuar/);
  assert.match(message.text, /Kosovë · Politikë/);
  assert.match(message.text, /PO 63\.00%, JO 37\.00%/);
  assert.match(message.html, /Persisted probability graph/);
  assert.match(message.html, /images\.example\/kurti\.jpg/);
});

test("creation email refuses invented opening graph values and escapes supplied copy", () => {
  assert.throws(() => buildNewsMarketOpenEmail({ slug: "x", question: "Q?", category: "bote" }, null), /Persisted opening probability/);
  const message = buildNewsMarketOpenEmail({ slug: "x", question: "<script>alert(1)</script>?", category: "bote", market_image_url: "javascript:evil()" }, { market_prob: 0.5, created_at: "2026-09-28T08:00:00Z" });
  assert.doesNotMatch(message.html, /<script>/);
  assert.doesNotMatch(message.html, /javascript:evil/);
});
