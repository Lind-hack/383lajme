/**
 * Build the per-topic coverage view used by the Dosje admin page.
 *
 * This stays pure so the page can read each table independently and the
 * article/moment/media accounting can be regression-tested without Supabase.
 * A mapping is kept even when its article has disappeared: a missing archive
 * row is operationally important and must never look like zero coverage.
 */

const MOMENT_STATUSES = ["approved", "draft", "needsSource", "rejected"];
const MEDIA_KINDS = ["image", "video"];

function momentCounts() {
  return { total: 0, approved: 0, draft: 0, needsSource: 0, rejected: 0, items: [] };
}

function mediaCounts() {
  return {
    total: 0,
    image: { total: 0, approved: 0, review: 0, rejected: 0 },
    video: { total: 0, approved: 0, review: 0, rejected: 0 },
    items: [],
  };
}

function value(row, ...keys) {
  for (const key of keys) {
    if (row && row[key] !== undefined && row[key] !== null) return row[key];
  }
  return null;
}

function normalizedStatus(status) {
  if (status === "needs_source") return "needsSource";
  return status;
}

function isApproved(valueToCheck) {
  return valueToCheck === true || valueToCheck === "true";
}

function articleSort(a, b) {
  const aTime = Date.parse(a.publishedAt ?? "");
  const bTime = Date.parse(b.publishedAt ?? "");
  if (Number.isFinite(aTime) && Number.isFinite(bTime) && aTime !== bTime) {
    return bTime - aTime;
  }
  if (Number.isFinite(aTime) !== Number.isFinite(bTime)) return aTime ? -1 : 1;
  return a.title.localeCompare(b.title, "sq");
}

/**
 * @param {{
 *   topics?: Array<Record<string, any>>,
 *   articleTopics?: Array<Record<string, any>>,
 *   articles?: Array<Record<string, any>>,
 *   milestones?: Array<Record<string, any>>,
 *   media?: Array<Record<string, any>>,
 * }} input
 */
export function buildDosjeCoverage({
  topics = [],
  articleTopics = [],
  articles = [],
  milestones = [],
  media = [],
} = {}) {
  const coverage = topics
    .map((topic) => ({
      slug: String(topic.slug ?? ""),
      title: String(topic.title ?? topic.slug ?? ""),
      status: String(topic.status ?? "draft"),
      articles: [],
      moments: momentCounts(),
      media: mediaCounts(),
    }))
    .filter((topic) => topic.slug);

  const byTopic = new Map(coverage.map((topic) => [topic.slug, topic]));
  const articleBySlug = new Map(articles.map((article) => [String(article.slug ?? ""), article]));
  const milestoneTopic = new Map(
    milestones
      .filter((milestone) => milestone.id && milestone.topic_slug)
      .map((milestone) => [String(milestone.id), String(milestone.topic_slug)])
  );
  const articleByTopicAndSlug = new Map();

  for (const mapping of articleTopics) {
    const topicSlug = String(mapping.topic_slug ?? "");
    const articleSlug = String(mapping.article_slug ?? "");
    const topic = byTopic.get(topicSlug);
    if (!topic || !articleSlug) continue;

    const article = articleBySlug.get(articleSlug);
    const candidate = {
      slug: articleSlug,
      title: String(value(article, "title") ?? articleSlug),
      source: value(article, "source"),
      publishedAt: value(article, "published_at", "publishedAt") ?? value(mapping, "published_at", "publishedAt"),
      score: Number(mapping.score ?? 0),
      method: value(mapping, "method"),
      missing: !article,
    };
    const key = `${topicSlug}:${articleSlug}`;
    const previous = articleByTopicAndSlug.get(key);
    if (!previous || candidate.score > previous.score) {
      articleByTopicAndSlug.set(key, candidate);
    }
  }

  for (const [key, article] of articleByTopicAndSlug) {
    const topicSlug = key.slice(0, key.indexOf(":"));
    const topic = byTopic.get(topicSlug);
    if (topic) topic.articles.push(article);
  }
  for (const topic of coverage) topic.articles.sort(articleSort);

  for (const milestone of milestones) {
    const topic = byTopic.get(String(milestone.topic_slug ?? ""));
    if (!topic) continue;
    topic.moments.total += 1;
    const status = normalizedStatus(String(milestone.status ?? ""));
    if (MOMENT_STATUSES.includes(status)) topic.moments[status] += 1;
    topic.moments.items.push({
      id: String(milestone.id ?? ""),
      title: String(milestone.title ?? ""),
      status: String(milestone.status ?? ""),
      eventDate: value(milestone, "event_date", "eventDate"),
      displayDate: value(milestone, "display_date", "displayDate"),
    });
  }

  for (const item of media) {
    const topicSlug = String(item.topic_slug ?? milestoneTopic.get(String(item.milestone_id ?? "")) ?? "");
    const topic = byTopic.get(topicSlug);
    const kind = String(item.kind ?? "");
    if (!topic || !MEDIA_KINDS.includes(kind)) continue;

    const bucket = topic.media[kind];
    topic.media.total += 1;
    bucket.total += 1;
    if (isApproved(item.approved)) bucket.approved += 1;
    else if (item.approved_by) bucket.rejected += 1;
    else bucket.review += 1;
    topic.media.items.push({
      id: String(item.id ?? ""),
      kind,
      url: value(item, "url"),
      credit: value(item, "credit"),
      sourceUrl: value(item, "source_url", "sourceUrl"),
      milestoneId: value(item, "milestone_id", "milestoneId"),
      approved: isApproved(item.approved),
      approvedBy: value(item, "approved_by", "approvedBy"),
      checkStatus: value(item, "check_status", "checkStatus"),
    });
  }

  return coverage;
}
