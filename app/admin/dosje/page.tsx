import { cookies } from "next/headers";
import { isAdminAuthed } from "@/lib/admin-auth";
import { totpEnabled } from "@/lib/admin-totp";

import { createAdminClient } from "@/lib/supabase/admin";
import { buildDosjeCoverage } from "@/lib/dosje-coverage.mjs";
import {
  loginAction,
  logoutAction,
  saveMilestoneAction,
  approveMilestoneAction,
  rejectMilestoneAction,
  approveTopicAction,
  retireTopicAction,
  approveMediaAction,
  rejectMediaAction,
  confirmSourcesAction,
} from "./actions";

export const dynamic = "force-dynamic";

/**
 * The queue where history is checked before anyone reads it.
 *
 * The screen is built around one question: can the person approving actually
 * verify this without leaving the page? So each citation is a live link with
 * its publisher, its fetch status and the sentence it supports, and the two
 * publishers the database will demand are counted here in advance — an
 * approval that cannot succeed is disabled with the reason, rather than offered
 * and then refused.
 */

type Citation = {
  id: string;
  url: string;
  publisher: string | null;
  source_title: string | null;
  source_date: string | null;
  quote: string | null;
  http_status: number | null;
  fetched_at: string | null;
  /** Consecutive failed re-checks. A rotted source must not count as verified. */
  fail_count: number | null;
  last_ok_at: string | null;
};

type Topic = {
  slug: string;
  title: string;
  blurb: string;
  status: string;
};

type ArticleTopicRow = {
  article_slug: string;
  topic_slug: string;
  score: number | null;
  method: string | null;
  published_at: string | null;
  decided_at: string | null;
};

type ArticleRow = {
  slug: string;
  title: string;
  source: string | null;
  published_at: string | null;
  category: string | null;
};

type MilestoneRef = {
  id: string;
  topic_slug: string;
  status: string;
};

type MediaRow = {
  id: string;
  milestone_id: string | null;
  topic_slug: string | null;
  kind: string;
  url: string;
  credit: string | null;
  source_url: string | null;
  license: string | null;
  relation: string | null;
  checked_at: string | null;
  check_status: number | null;
  approved: boolean;
  approved_by: string | null;
  dosje_milestones: { title: string; display_date: string; topic_slug?: string } | null;
};

type Coverage = {
  slug: string;
  title: string;
  status: string;
  articles: Array<{
    slug: string;
    title: string;
    source: string | null;
    publishedAt: string | null;
    score: number;
    method: string | null;
    missing: boolean;
  }>;
  moments: {
    total: number;
    approved: number;
    draft: number;
    needsSource: number;
    rejected: number;
    items: Array<{ id: string; title: string; status: string; eventDate: string | null; displayDate: string | null }>;
  };
  media: {
    total: number;
    image: { total: number; approved: number; review: number; rejected: number };
    video: { total: number; approved: number; review: number; rejected: number };
    items: Array<{
      id: string;
      kind: string;
      url: string | null;
      credit: string | null;
      sourceUrl: string | null;
      milestoneId: string | null;
      approved: boolean;
      approvedBy: string | null;
      checkStatus: number | null;
    }>;
  };
};

type Milestone = {
  id: string;
  topic_slug: string;
  event_date: string;
  display_date: string;
  date_precision: string;
  tag: string | null;
  title: string;
  summary: string;
  why: string | null;
  status: string;
  drafted_by: string | null;
  drafted_at: string;
  claims: Record<string, unknown> | null;
  dosje_citations: Citation[] | null;
};

const SANS = "13px/1.55 ui-sans-serif, system-ui, -apple-system, sans-serif";

/**
 * A citation counts when it last answered — the same rule the database
 * enforces in dosje_citation_is_live.
 *
 * This used to test only `http_status === 200` and ignore the failure count,
 * so a citation that had rotted still lit the approve button green. The
 * trigger then refused it, or worse, agreed and republished a moment with a
 * dead source under a badge promising two live ones.
 */
const DEAD_AFTER = 3;

function verifiedPublishers(cites: Citation[]): string[] {
  return [
    ...new Set(
      cites
        .filter(
          (c) => c.http_status === 200 && (c.fail_count ?? 0) < DEAD_AFTER && c.publisher
        )
        .map((c) => String(c.publisher).toLowerCase().trim())
    ),
  ];
}

function coverageDate(value: string | null): string {
  return value ? String(value).slice(0, 10) : "pa datë";
}

function momentStatusLabel(status: string): string {
  if (status === "needs_source") return "ka nevojë për burim";
  if (status === "approved") return "miratuar";
  if (status === "rejected") return "refuzuar";
  return status || "e panjohur";
}

function mediaStatusLabel(item: Coverage["media"]["items"][number]): string {
  if (item.approved) return "miratuar";
  if (item.approvedBy) return "refuzuar";
  return "në shqyrtim";
}

export default async function DosjeAdminPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const store = await cookies();
  const authed = await isAdminAuthed();

  if (!authed) {
  return (
      <main style={{ maxWidth: "380px", margin: "80px auto", padding: "0 20px", font: SANS }}>
        <h1 style={{ font: "600 20px/1.2 ui-sans-serif, system-ui, sans-serif", margin: "0 0 6px" }}>
          Dosje — miratimi
        </h1>
        <p style={{ color: "#666", margin: "0 0 18px" }}>
          Asgjë nuk publikohet pa dy burime të verifikuara.
        </p>
        {params.err && (
          <p style={{ color: "#c0392b", margin: "0 0 12px" }}>Fjalëkalim i pasaktë.</p>
        )}
        <form action={loginAction} style={{ display: "flex", gap: "8px" }}>
          <input
            type="password"
            name="password"
            placeholder="Fjalëkalimi"
            style={{ flex: 1, padding: "9px 11px", border: "1px solid #ccc", borderRadius: "7px", font: SANS }}
          />
          {totpEnabled() && (
            <input
              type="text"
              name="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              placeholder="Kodi"
              style={{ width: "110px", padding: "9px 11px", border: "1px solid #ccc", borderRadius: "7px", font: SANS, letterSpacing: "0.2em" }}
            />
          )}
          <button type="submit" style={{ padding: "9px 15px", borderRadius: "7px", border: "none", background: "#111", color: "#fff", font: SANS, cursor: "pointer" }}>
            Hyr
          </button>
        </form>
      </main>
    );
  }

  const supabase = createAdminClient();
  let drafts: Milestone[] = [];
  let topics: Topic[] = [];
  let approvedByTopic: Record<string, number> = {};
  let media: MediaRow[] = [];
  let allMilestones: MilestoneRef[] = [];
  let allMedia: MediaRow[] = [];
  let articleTopics: ArticleTopicRow[] = [];
  let articles: ArticleRow[] = [];
  let loadError: string | null = null;
  let coverageError: string | null = null;

  if (!supabase) {
    loadError = "Supabase nuk është konfiguruar.";
  } else {
    const { data, error } = await supabase
      .from("dosje_milestones")
      .select("*, dosje_citations(*)")
      .in("status", ["draft", "needs_source"])
      .order("drafted_at", { ascending: false })
      .limit(50);
    // The migration may not have been applied yet; say so plainly rather than
    // rendering an empty queue that looks like "nothing to review".
    if (error) loadError = error.message;
    else drafts = (data ?? []) as Milestone[];

    const { data: t, error: topicsError } = await supabase
      .from("dosje_topics")
      .select("slug, title, blurb, status")
      .order("title");
    if (topicsError) coverageError = topicsError.message;
    topics = (t ?? []) as Topic[];

    const { data: milestoneRows, error: milestoneError } = await supabase
      .from("dosje_milestones")
      .select("id, topic_slug, status")
      .limit(1000);
    if (milestoneError) coverageError = coverageError ?? milestoneError.message;
    allMilestones = (milestoneRows ?? []) as MilestoneRef[];
    approvedByTopic = allMilestones.reduce<Record<string, number>>((acc, row) => {
      if (row.status !== "approved") return acc;
      acc[row.topic_slug] = (acc[row.topic_slug] ?? 0) + 1;
      return acc;
    }, {});

    const { data: m, error: mediaError } = await supabase
      .from("dosje_media")
      .select("*, dosje_milestones(title, display_date, topic_slug)")
      .in("kind", ["image", "video"])
      .limit(1000);
    if (mediaError) coverageError = coverageError ?? mediaError.message;
    allMedia = (m ?? []) as unknown as MediaRow[];
    media = allMedia
      .filter((row) => !row.approved && !row.approved_by)
      .slice(0, 30);

    const { data: mappingRows, error: mappingError } = await supabase
      .from("dosje_article_topics")
      .select("article_slug, topic_slug, score, method, published_at, decided_at")
      .order("published_at", { ascending: false })
      .order("decided_at", { ascending: false })
      .limit(1000);
    if (mappingError) coverageError = coverageError ?? mappingError.message;
    articleTopics = (mappingRows ?? []) as ArticleTopicRow[];

    const articleSlugs = [...new Set(articleTopics.map((row) => row.article_slug).filter(Boolean))];
    if (articleSlugs.length) {
      const { data: articleRows, error: articlesError } = await supabase
        .from("news_articles")
        .select("slug, title, source, published_at, category")
        .in("slug", articleSlugs);
      if (articlesError) coverageError = coverageError ?? articlesError.message;
      articles = (articleRows ?? []) as ArticleRow[];
    }
  }

  const coverage = buildDosjeCoverage({
    topics,
    articleTopics,
    articles,
    milestones: allMilestones,
    media: allMedia,
  }) as Coverage[];
  const coverageByTopic = new Map(coverage.map((item) => [item.slug, item]));

  return (
    <main style={{ maxWidth: "860px", margin: "36px auto 90px", padding: "0 20px", font: SANS, color: "#1a1a1a" }}>
      <header style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: "6px" }}>
        <h1 style={{ font: "600 21px/1.2 ui-sans-serif, system-ui, sans-serif", margin: 0 }}>
          Dosje — miratimi
        </h1>
        <form action={logoutAction}>
          <button type="submit" style={{ border: "none", background: "none", color: "#777", font: SANS, cursor: "pointer" }}>
            Dil
          </button>
        </form>
      </header>

      <p style={{ color: "#666", margin: "0 0 22px" }}>
        {drafts.length} {drafts.length === 1 ? "moment pret" : "momente presin"} shqyrtim.
        Një moment miratohet vetëm me dy burime të verifikuara nga botues të ndryshëm.
      </p>

      {params.err && (
        <p style={{ padding: "10px 12px", borderRadius: "7px", background: "#fdecea", color: "#a5281b", margin: "0 0 16px" }}>
          {decodeURIComponent(params.err)}
        </p>
      )}
      {params.approved && (
        <p style={{ padding: "10px 12px", borderRadius: "7px", background: "#eaf7ee", color: "#1e7a3c", margin: "0 0 16px" }}>
          U miratua.
        </p>
      )}

      {/* Dossiers. A topic and its moments are approved separately: one is a
          claim about an event, the other a decision that the subject deserves
          a file. Nothing renders publicly until the topic itself is approved. */}
      {topics.length > 0 && (
        <section style={{ marginBottom: "26px", border: "1px solid #e2e2e2", borderRadius: "11px", padding: "14px 16px", background: "#fcfcfc" }}>
          <div style={{ fontSize: "11.5px", letterSpacing: ".03em", textTransform: "uppercase", color: "#8a8a8a", marginBottom: "10px" }}>
            Dosjet
          </div>
          {topics.map((t) => {
            const item = coverageByTopic.get(t.slug);
            const n = item?.moments.approved ?? approvedByTopic[t.slug] ?? 0;
            const live = t.status === "approved";
            return (
              <div key={t.slug} style={{ padding: "8px 0 10px", borderBottom: "1px solid #f0f0f0" }}>
                <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: "8px 10px" }}>
                  <span style={{ flex: "1 1 260px", minWidth: 0 }}>
                    <strong>{t.title}</strong>
                    <span style={{ color: "#999" }}>
                      {" · "}{n} {n === 1 ? "moment i miratuar" : "momente të miratuara"}
                    </span>
                  </span>
                  <span style={{ fontSize: "11.5px", padding: "2px 8px", borderRadius: "20px", background: live ? "#eaf7ee" : "#f1f1f1", color: live ? "#1e7a3c" : "#777" }}>
                    {live ? "publike" : t.status}
                  </span>
                  {live ? (
                    <form action={retireTopicAction}>
                      <input type="hidden" name="slug" value={t.slug} />
                      <button type="submit" style={{ padding: "5px 11px", borderRadius: "6px", border: "1px solid #ccc", background: "#fff", font: SANS, cursor: "pointer" }}>
                        Hiq nga faqja
                      </button>
                    </form>
                  ) : (
                    <form action={approveTopicAction}>
                      <input type="hidden" name="slug" value={t.slug} />
                      <button
                        type="submit"
                        disabled={n === 0}
                        title={n === 0 ? "Pa asnjë moment të miratuar" : undefined}
                        style={{ padding: "5px 11px", borderRadius: "6px", border: "none", background: n === 0 ? "#d8d8d8" : "#1e7a3c", color: "#fff", font: SANS, cursor: n === 0 ? "not-allowed" : "pointer" }}
                      >
                        Publiko dosjen
                      </button>
                    </form>
                  )}
                </div>

                {item ? (
                  <details style={{ marginTop: "9px", border: "1px solid #ececec", borderRadius: "8px", background: "#fff" }}>
                    <summary style={{ cursor: "pointer", padding: "9px 11px", color: "#555", fontSize: "12px", listStylePosition: "inside" }}>
                      <strong>Mbulimi:</strong>{" "}
                      {item.articles.length} artikuj · {item.moments.total} momente · {item.media.image.total} foto · {item.media.video.total} video
                    </summary>
                    <div style={{ padding: "0 12px 13px" }}>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: "8px", margin: "3px 0 15px" }}>
                        <div style={{ padding: "9px 10px", background: "#fafafa", borderRadius: "7px" }}>
                          <strong>Momente</strong>
                          <div style={{ color: "#666", fontSize: "12px", marginTop: "3px" }}>
                            {item.moments.total} gjithsej · {item.moments.approved} miratuara · {item.moments.draft + item.moments.needsSource} në shqyrtim
                          </div>
                        </div>
                        <div style={{ padding: "9px 10px", background: "#fafafa", borderRadius: "7px" }}>
                          <strong>Foto</strong>
                          <div style={{ color: "#666", fontSize: "12px", marginTop: "3px" }}>
                            {item.media.image.total} gjithsej · {item.media.image.approved} miratuara · {item.media.image.review} në shqyrtim
                          </div>
                        </div>
                        <div style={{ padding: "9px 10px", background: "#fafafa", borderRadius: "7px" }}>
                          <strong>Video</strong>
                          <div style={{ color: "#666", fontSize: "12px", marginTop: "3px" }}>
                            {item.media.video.total} gjithsej · {item.media.video.approved} miratuara · {item.media.video.review} në shqyrtim
                          </div>
                        </div>
                      </div>

                      <div style={{ marginTop: "10px" }}>
                        <div style={{ fontSize: "11.5px", letterSpacing: ".03em", textTransform: "uppercase", color: "#8a8a8a", marginBottom: "6px" }}>
                          Artikujt që hapin këtë dosje — {item.articles.length}
                        </div>
                        {item.articles.length === 0 ? (
                          <p style={{ color: "#777", margin: 0, fontSize: "12px" }}>Nuk ka artikull të lidhur ende.</p>
                        ) : (
                          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                            {item.articles.map((article) => (
                              <li key={article.slug} style={{ padding: "8px 0", borderTop: "1px solid #f1f1f1" }}>
                                <div style={{ display: "flex", gap: "8px", alignItems: "baseline", flexWrap: "wrap" }}>
                                  {article.missing ? (
                                    <span style={{ color: "#a5281b", fontWeight: 600 }}>{article.title}</span>
                                  ) : (
                                    <a href={`/article/${encodeURIComponent(article.slug)}`} style={{ color: "#0b57d0", fontWeight: 600, textDecoration: "none" }}>
                                      {article.title}
                                    </a>
                                  )}
                                  <span style={{ color: article.missing ? "#a5281b" : "#777", fontSize: "11.5px" }}>
                                    {article.missing ? "artikulli mungon në arkiv" : `${item.moments.total} momente në këtë dosje`}
                                  </span>
                                </div>
                                <div style={{ color: "#888", fontSize: "11.5px", marginTop: "3px" }}>
                                  {article.source ?? "pa burim"} · {coverageDate(article.publishedAt)} · score {article.score}
                                </div>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>

                      {item.moments.items.length > 0 && (
                        <div style={{ marginTop: "14px" }}>
                          <div style={{ fontSize: "11.5px", letterSpacing: ".03em", textTransform: "uppercase", color: "#8a8a8a", marginBottom: "6px" }}>
                            Momentet e kësaj dosjeje
                          </div>
                          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                            {item.moments.items.map((moment) => (
                              <li key={moment.id} style={{ display: "flex", gap: "8px", justifyContent: "space-between", flexWrap: "wrap", padding: "5px 0", borderTop: "1px solid #f1f1f1", fontSize: "12px" }}>
                                <span>{moment.title || "(pa titull)"}</span>
                                <span style={{ color: "#777" }}>{coverageDate(moment.eventDate)} · {momentStatusLabel(moment.status)}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {item.media.items.length > 0 && (
                        <div style={{ marginTop: "14px" }}>
                          <div style={{ fontSize: "11.5px", letterSpacing: ".03em", textTransform: "uppercase", color: "#8a8a8a", marginBottom: "6px" }}>
                            Media e lidhur me këtë dosje
                          </div>
                          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                            {item.media.items.map((mediaItem) => (
                              <li key={mediaItem.id} style={{ display: "flex", gap: "8px", justifyContent: "space-between", flexWrap: "wrap", padding: "5px 0", borderTop: "1px solid #f1f1f1", fontSize: "12px" }}>
                                <span>
                                  <strong>{mediaItem.kind === "image" ? "Foto" : "Video"}</strong>{" · "}
                                  {mediaItem.url ? <a href={mediaItem.url} target="_blank" rel="noreferrer" style={{ color: "#0b57d0", wordBreak: "break-all" }}>{mediaItem.credit || mediaItem.url}</a> : "pa URL"}
                                </span>
                                <span style={{ color: "#777" }}>{mediaStatusLabel(mediaItem)}{mediaItem.checkStatus ? ` · HTTP ${mediaItem.checkStatus}` : ""}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </details>
                ) : coverageError ? (
                  <div style={{ color: "#a5281b", fontSize: "12px", margin: "7px 0 0" }}>Mbulimi nuk u lexua: {coverageError}</div>
                ) : null}
              </div>
            );
          })}
        </section>
      )}

      {loadError && (
        <p style={{ padding: "12px 14px", borderRadius: "8px", background: "#fff6e5", color: "#8a5a00" }}>
          Tabelat e dosjeve nuk u lexuan dot: {loadError}
          <br />
          <span style={{ color: "#9a7330" }}>
            Ndoshta migrimi 0051/0052 nuk është aplikuar ende.
          </span>
        </p>
      )}
      {coverageError && (
        <p style={{ padding: "10px 12px", borderRadius: "7px", background: "#fff6e5", color: "#8a5a00", margin: "0 0 16px" }}>
          Mbulimi i artikujve nuk u lexua plotësisht: {coverageError}
        </p>
      )}

      {/* Proposed photographs.
          Approving one asserts the picture is of that event. The archive
          cannot supply that — 383 begins in 2026 — so every candidate here
          comes from the page of a source the moment already cites, and the
          decision stays with a person because a fetch cannot make it. */}
      {media.length > 0 && (
        <section style={{ marginBottom: "26px" }}>
          <div style={{ fontSize: "11.5px", letterSpacing: ".03em", textTransform: "uppercase", color: "#8a8a8a", marginBottom: "10px" }}>
            Media për shqyrtim — {media.length}
          </div>
          {media.map((mm) => (
            <div key={mm.id} style={{ display: "flex", gap: "12px", alignItems: "flex-start", border: "1px solid #e2e2e2", borderRadius: "10px", padding: "12px", marginBottom: "10px", background: "#fff" }}>
              {/* A video is a thumbnail and a channel, not a photograph. Showing
                  it as one gave the reviewer a broken image and no way to judge. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={
                  mm.kind === "video"
                    ? `https://i.ytimg.com/vi/${(mm.url.match(/[?&]v=([^&]+)/) || [])[1] ?? ""}/mqdefault.jpg`
                    : mm.url
                }
                alt=""
                style={{ width: "150px", height: "100px", objectFit: "cover", borderRadius: "7px", background: "#f0f0f0" }}
              />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600 }}>
                  {mm.kind === "video"
                    ? (mm.credit ?? "Video")
                    : (mm.dosje_milestones?.title ?? "(moment i panjohur)")}
                </div>
                <div style={{ color: "#777", fontSize: "12px", margin: "2px 0 6px" }}>
                  {mm.kind === "video"
                    ? "Shpjegues për të gjithë dosjen"
                    : `${mm.dosje_milestones?.display_date} · ${mm.credit ?? "pa kredit"}`}
                </div>
                {mm.source_url && (
                  <a href={mm.source_url} target="_blank" rel="noreferrer" style={{ color: "#0b57d0", fontSize: "12px", wordBreak: "break-all" }}>
                    burimi që e mbron këtë moment →
                  </a>
                )}
                <div style={{ display: "flex", gap: "8px", marginTop: "9px" }}>
                  <form action={approveMediaAction}>
                    <input type="hidden" name="id" value={mm.id} />
                    <button type="submit" style={{ padding: "6px 12px", borderRadius: "6px", border: "none", background: "#1e7a3c", color: "#fff", font: SANS, cursor: "pointer" }}>
                      {mm.kind === "video" ? "Publiko shpjeguesin" : "Kjo është foto e ngjarjes"}
                    </button>
                  </form>
                  <form action={rejectMediaAction}>
                    <input type="hidden" name="id" value={mm.id} />
                    <button type="submit" style={{ padding: "6px 12px", borderRadius: "6px", border: "1px solid #ccc", background: "#fff", font: SANS, cursor: "pointer" }}>
                      Jo
                    </button>
                  </form>
                </div>
              </div>
            </div>
          ))}
        </section>
      )}

      {!loadError && drafts.length === 0 && (
        <p style={{ color: "#777" }}>Radha është bosh.</p>
      )}

      {drafts.map((m) => {
        const cites = m.dosje_citations ?? [];
        const publishers = verifiedPublishers(cites);
        const edited = Boolean((m.claims as Record<string, unknown>)?.edited_after_verification);
        const blocked =
          publishers.length < 2
            ? `Duhen dy botues të verifikuar — ka ${publishers.length}.`
            : edited
              ? "Teksti u ndryshua pas verifikimit; burimet duhen rikontrolluar."
              : null;

        return (
          <article
            key={m.id}
            style={{ border: "1px solid #e2e2e2", borderRadius: "11px", padding: "18px", marginBottom: "18px", background: "#fff" }}
          >
            <div style={{ display: "flex", gap: "10px", color: "#8a8a8a", fontSize: "11.5px", letterSpacing: ".03em", textTransform: "uppercase", marginBottom: "8px" }}>
              <span>{m.topic_slug}</span>
              <span>·</span>
              <span>{m.display_date}</span>
              <span>·</span>
              <span>saktësia: {m.date_precision}</span>
              {m.drafted_by && <><span>·</span><span>{m.drafted_by}</span></>}
            </div>

            <form action={saveMilestoneAction}>
              <input type="hidden" name="id" value={m.id} />
              <input
                name="title"
                defaultValue={m.title}
                style={{ width: "100%", font: "600 16px/1.35 ui-sans-serif, system-ui, sans-serif", padding: "7px 9px", border: "1px solid #ddd", borderRadius: "7px", marginBottom: "8px" }}
              />
              <textarea
                name="summary"
                defaultValue={m.summary}
                rows={4}
                style={{ width: "100%", font: SANS, padding: "8px 9px", border: "1px solid #ddd", borderRadius: "7px", marginBottom: "8px" }}
              />
              <textarea
                name="why"
                defaultValue={m.why ?? ""}
                rows={2}
                placeholder="Pse ka rëndësi"
                style={{ width: "100%", font: SANS, padding: "8px 9px", border: "1px solid #ddd", borderRadius: "7px", marginBottom: "10px" }}
              />
              <button type="submit" style={{ padding: "7px 13px", borderRadius: "7px", border: "1px solid #ccc", background: "#fafafa", font: SANS, cursor: "pointer" }}>
                Ruaj ndryshimet
              </button>
            </form>

            {/* The citations, as links — an approver who cannot open the source
                is not checking anything, only agreeing. */}
            <div style={{ marginTop: "14px", borderTop: "1px solid #eee", paddingTop: "12px" }}>
              <div style={{ fontSize: "11.5px", letterSpacing: ".03em", textTransform: "uppercase", color: "#8a8a8a", marginBottom: "8px" }}>
                Burimet — {publishers.length} botues të verifikuar
              </div>
              {cites.length === 0 && <p style={{ color: "#a33", margin: 0 }}>Pa asnjë burim.</p>}
              {cites.map((c) => (
                <div key={c.id} style={{ marginBottom: "10px", paddingLeft: "10px", borderLeft: `2px solid ${c.http_status === 200 ? "#2e7d32" : "#c9a227"}` }}>
                  <a href={c.url} target="_blank" rel="noreferrer" style={{ color: "#0b57d0", wordBreak: "break-all" }}>
                    {c.source_title || c.url}
                  </a>
                  <div style={{ color: "#777", fontSize: "12px", marginTop: "2px" }}>
                    {c.publisher ?? "?"}
                    {c.source_date ? ` · ${c.source_date}` : ""}
                    {" · "}
                    {c.http_status === 200
                      ? `verifikuar${c.fetched_at ? " " + c.fetched_at.slice(0, 10) : ""}`
                      : "i paverifikuar"}
                  </div>
                  {c.quote && (
                    <blockquote style={{ margin: "5px 0 0", padding: "6px 9px", background: "#f7f7f7", borderRadius: "6px", color: "#444", fontSize: "12.5px" }}>
                      “{c.quote}”
                    </blockquote>
                  )}
                </div>
              ))}
            </div>

            <div style={{ display: "flex", gap: "9px", alignItems: "center", marginTop: "12px" }}>
              <form action={approveMilestoneAction}>
                <input type="hidden" name="id" value={m.id} />
                <button
                  type="submit"
                  disabled={Boolean(blocked)}
                  style={{
                    padding: "8px 15px",
                    borderRadius: "7px",
                    border: "none",
                    background: blocked ? "#d8d8d8" : "#1e7a3c",
                    color: "#fff",
                    font: SANS,
                    cursor: blocked ? "not-allowed" : "pointer",
                  }}
                >
                  Mirato
                </button>
              </form>
              <form action={rejectMilestoneAction}>
                <input type="hidden" name="id" value={m.id} />
                <button type="submit" style={{ padding: "8px 15px", borderRadius: "7px", border: "1px solid #ccc", background: "#fff", font: SANS, cursor: "pointer" }}>
                  Refuzo
                </button>
              </form>
              {/* The way back. Editing after verification blocks approval,
                  correctly — but with no way to clear it a moment was stuck
                  forever and only SQL could rescue it. This is the reviewer
                  stating they have re-read the sources against the new
                  wording, which is exactly the assertion the flag stands for. */}
              {edited && (
                <form action={confirmSourcesAction}>
                  <input type="hidden" name="id" value={m.id} />
                  <button type="submit" style={{ padding: "8px 15px", borderRadius: "7px", border: "1px solid #1e7a3c", background: "#fff", color: "#1a6b35", font: SANS, cursor: "pointer" }}>
                    I rikontrollova burimet
                  </button>
                </form>
              )}
              {blocked && <span style={{ color: "#a5281b" }}>{blocked}</span>}
            </div>
          </article>
        );
      })}
    </main>
  );
}
