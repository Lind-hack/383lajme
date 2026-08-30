import test from "node:test";
import assert from "node:assert/strict";

import { buildDosjeCoverage } from "./dosje-coverage.mjs";

test("buildDosjeCoverage groups articles and counts moments and media per dossier", () => {
  const coverage = buildDosjeCoverage({
    topics: [
      { slug: "kfor", title: "KFOR-i në Kosovë", status: "draft" },
      { slug: "dialogu", title: "Dialogu Kosovë–Serbi", status: "approved" },
    ],
    articleTopics: [
      {
        article_slug: "kfor-article",
        topic_slug: "kfor",
        score: 5,
        method: "rule",
        published_at: "2026-08-30T10:00:00Z",
      },
      {
        article_slug: "kfor-article",
        topic_slug: "kfor",
        score: 3,
        method: "rule",
        published_at: "2026-08-30T10:00:00Z",
      },
      {
        article_slug: "missing-article",
        topic_slug: "kfor",
        score: 2,
        method: "rule",
        published_at: null,
      },
      {
        article_slug: "dialogue-article",
        topic_slug: "dialogu",
        score: 4,
        method: "rule",
        published_at: "2026-08-29T10:00:00Z",
      },
    ],
    articles: [
      {
        slug: "kfor-article",
        title: "KFOR hap derën e re të urës së Ibrit",
        source: "Vijesti",
        published_at: "2026-08-30T10:00:00Z",
        category: "Kosovë",
      },
      {
        slug: "dialogue-article",
        title: "Takimi Kosovë–Serbi",
        source: "AP",
        published_at: "2026-08-29T10:00:00Z",
        category: "Kosovë",
      },
    ],
    milestones: [
      { id: "k-draft", topic_slug: "kfor", title: "KFOR moment", status: "draft" },
      { id: "k-source", topic_slug: "kfor", status: "needs_source" },
      { id: "k-approved", topic_slug: "kfor", status: "approved" },
      { id: "d-approved", topic_slug: "dialogu", status: "approved" },
      { id: "d-rejected", topic_slug: "dialogu", status: "rejected" },
    ],
    media: [
      { id: "k-image", milestone_id: "k-draft", topic_slug: null, kind: "image", approved: false, approved_by: null },
      { id: "k-video", milestone_id: null, topic_slug: "kfor", kind: "video", approved: true, approved_by: "admin" },
      { id: "k-rejected-image", milestone_id: null, topic_slug: "kfor", kind: "image", approved: false, approved_by: "admin:rejected" },
      { id: "d-video", milestone_id: "d-approved", topic_slug: null, kind: "video", approved: false, approved_by: null },
    ],
  });

  assert.deepEqual(coverage.map((item) => item.slug), ["kfor", "dialogu"]);

  const kfor = coverage[0];
  assert.equal(kfor.articles.length, 2, "duplicate article-topic rows should become one article link");
  assert.equal(kfor.articles[0].title, "KFOR hap derën e re të urës së Ibrit");
  assert.equal(kfor.articles[0].score, 5, "the strongest duplicate mapping should win");
  assert.equal(kfor.articles[1].missing, true, "a stale mapping should remain visible as missing");
  assert.deepEqual(
    (({ total, approved, draft, needsSource, rejected }) => ({ total, approved, draft, needsSource, rejected }))(kfor.moments),
    { total: 3, approved: 1, draft: 1, needsSource: 1, rejected: 0 }
  );
  assert.equal(kfor.moments.items.length, 3);
  assert.equal(kfor.moments.items[0].title, "KFOR moment");
  assert.equal(kfor.media.items.length, 3);
  assert.equal(kfor.media.items.find((item) => item.kind === "video").approved, true);
  assert.deepEqual(
    (({ total, image, video }) => ({ total, image, video }))(kfor.media),
    {
      total: 3,
      image: { total: 2, approved: 0, review: 1, rejected: 1 },
      video: { total: 1, approved: 1, review: 0, rejected: 0 },
    }
  );

  const dialogue = coverage[1];
  assert.equal(dialogue.articles.length, 1);
  assert.deepEqual(
    (({ total, approved, draft, needsSource, rejected }) => ({ total, approved, draft, needsSource, rejected }))(dialogue.moments),
    { total: 2, approved: 1, draft: 0, needsSource: 0, rejected: 1 }
  );
  assert.deepEqual(dialogue.media.video, { total: 1, approved: 0, review: 1, rejected: 0 });
});
