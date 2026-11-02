import { NextResponse } from "next/server";
import { gatherEvidence, passageFor, relevanceGroupsForQuery } from "@/lib/dosje-sources.mjs";
import { authorised, dbTopics } from "@/lib/dosje-daily-server";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * Step three-and-a-half: more sources for ONE event of a subject.
 *
 * A drafted moment usually rests on the one article it was translated from,
 * and every claim needs a second publisher saying the same thing. The worker
 * names the event in English ("Indictment of Hashim Thaçi"); this gathers the
 * outlets the encyclopaedia cites for that event, kept on the subject by the
 * topic's own relevance groups. Read-only: it claims nothing and writes
 * nothing; the publish step fetches every cited url again itself.
 */
export async function GET(req: Request) {
  if (!authorised(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const params = new URL(req.url).searchParams;
  const slug = params.get("topic") ?? "";
  const query = String(params.get("q") ?? "").trim().slice(0, 120);
  if (!query) return NextResponse.json({ ok: false, reason: "query_required" }, { status: 400 });
  const topic = (await dbTopics()).find((t) => t.slug === slug);
  if (!topic) return NextResponse.json({ ok: false, reason: "unknown_topic" }, { status: 404 });

  const groups = topic.research_groups?.length
    ? topic.research_groups
    : relevanceGroupsForQuery(topic.research_query || topic.title);
  const sources = await gatherEvidence(query, { max: 6, relevanceGroups: groups });
  // The passage is chosen by the event's own words as well as the subject's,
  // so the sentence about this event is in what the model reads.
  const eventWords = query.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 3).map((w) => [w]);
  return NextResponse.json({
    ok: true,
    query,
    sources: sources.map((s) => ({
      url: s.url,
      publisher: s.publisher,
      title: s.title,
      published_date: s.published_date,
      event: s.lead ?? query,
      text: passageFor(String(s.text ?? ""), [...(groups ?? []), ...eventWords], 3000),
    })),
  });
}
