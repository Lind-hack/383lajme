import { cache } from "react";
import { getArticlesBySlugsLight } from "@/lib/db";
import { decodeSnapshot, isExpired, type Snapshot } from "@/lib/paper-snapshot.mjs";
import { describeSection, type SectionInfo } from "@/lib/per-ty-paper.mjs";
import { kosovoDateKey } from "@/lib/home-tregu.mjs";
import type { Article } from "@/lib/mock-data";

export type SharedPaper =
  | { status: "invalid" }
  | { status: "expired"; snapshot: Snapshot }
  | {
      status: "ok";
      snapshot: Snapshot;
      edition: Article[];
      sections: (SectionInfo & { items: Article[] })[];
    };

/**
 * A shared front page (/gazeta/<code>) with its stories, as the page and its
 * card image both need it. Same validation and the same expiry for both, so
 * a card never outlives its page. Titles of sections come from the canonical
 * lists (describeSection), never from the link. Stories that have since been
 * removed are dropped; one query fetches every story, light columns, in the
 * sharer's order.
 */
export const loadSharedPaper = cache(async (code: string): Promise<SharedPaper> => {
  const snapshot = decodeSnapshot(code);
  if (!snapshot) return { status: "invalid" };
  if (isExpired(snapshot.date, kosovoDateKey())) return { status: "expired", snapshot };

  const all = [...snapshot.edition, ...snapshot.sections.flatMap((s) => s.slugs)];
  const found = await getArticlesBySlugsLight(all);
  const bySlug = new Map(found.map((a) => [a.slug, a]));
  const pick = (slugs: string[]) => slugs.map((s) => bySlug.get(s)).filter((a): a is Article => Boolean(a));

  const edition = pick(snapshot.edition);
  const sections = snapshot.sections
    .map((s) => {
      const about = describeSection(s.key);
      return about ? { ...about, items: pick(s.slugs) } : null;
    })
    .filter((s): s is SectionInfo & { items: Article[] } => Boolean(s && s.items.length));

  if (edition.length === 0) return { status: "invalid" };
  return { status: "ok", snapshot, edition, sections };
});
