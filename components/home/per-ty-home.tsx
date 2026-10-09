"use client";

// "Gazeta jote" on the homepage: the door into Për ty, right after the front
// block, so a reader scrolling Sot meets their own paper instead of having to
// guess what the tab means.
//
// It reads the device only (like the rest of Për ty) and draws one of three
// things:
//
//   1. a reader with a paper: its name and number, how much is read, and the
//      next three stories they have not opened;
//   2. a guest 383 has learned from (lib/perty-learned.mjs): Dardani says the
//      paper is ready, with what he noticed and three stories from it — the
//      reveal on /per-ty asks before anything is saved;
//   3. anyone else: the topics as chips. Each tap redraws three stories from
//      today's pool, so the paper forms while they choose, and "Hape gazetën
//      time" saves the topics and opens it. No account, no questions first.
//
// The homepage is statically cached and shared, so nothing personal is
// rendered on the server: the server sends the same public pool to everyone and
// the box fills in after mount (a fixed-height placeholder holds its place).

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { NAV_CATEGORIES, type NavCategory } from "@/lib/category-map";
import { hasInterests, readInterests, writeInterests, type Interests } from "@/lib/interests.mjs";
import { rankFeed } from "@/lib/per-ty-rank.mjs";
import { buildPaper } from "@/lib/per-ty-paper.mjs";
import { readPrefs } from "@/lib/paper-prefs.mjs";
import { cityById } from "@/lib/cities.mjs";
import { readSlugs } from "@/lib/perty-visits.mjs";
import { daysWithUs, readLedger } from "@/lib/reader-ledger.mjs";
import { paperTitle, readName } from "@/lib/reader-name.mjs";
import { hasLearnedPaper, learnedPicks, pickChips, type LearnedPicks } from "@/lib/perty-learned.mjs";
import { track } from "@/lib/analytics";
import DardaniFace from "@/components/dardani/dardani-face";
import type { FeedArticle } from "@/app/per-ty/per-ty-feed";

type Story = { slug: string; title: string; reason: string };

type View =
  | { kind: "paper"; title: string; issue: number; read: number; total: number; stories: Story[] }
  | { kind: "learned"; picks: LearnedPicks; stories: Story[] }
  | { kind: "new"; interests: Interests };

const PREVIEW = 3;

function stories(items: { article: FeedArticle; reason: string }[], skip: ReadonlySet<string> = new Set()): Story[] {
  return items
    .filter((i) => !skip.has(i.article.slug))
    .slice(0, PREVIEW)
    .map((i) => ({ slug: i.article.slug, title: i.article.title, reason: i.reason }));
}

export default function PerTyHome({ pool }: { pool: FeedArticle[] }) {
  const router = useRouter();
  const [view, setView] = useState<View | null>(null);
  const [picked, setPicked] = useState<NavCategory[]>([]);

  useEffect(() => {
    const interests = readInterests();
    if (hasInterests(interests)) {
      const prefs = readPrefs();
      const feed = rankFeed(pool, interests, { limit: 200 });
      const paper = buildPaper(feed, interests, prefs, { homeFrom: cityById(interests.home)?.from ?? null });
      const opened = new Set(readSlugs());
      setView({
        kind: "paper",
        title: paperTitle(readName(), prefs?.title),
        issue: daysWithUs(readLedger()),
        read: paper.edition.filter((i) => opened.has(i.article.slug)).length,
        total: paper.edition.length,
        stories: stories(paper.edition, opened),
      });
      return;
    }
    const picks = learnedPicks(interests.affinity);
    if (hasLearnedPaper(picks)) {
      setView({ kind: "learned", picks, stories: stories(rankFeed(pool, { ...interests, ...picks }, { limit: 30 })) });
      return;
    }
    setView({ kind: "new", interests });
  }, [pool]);

  // The cold guest's live preview: today's stories for the topics tapped so far.
  const preview = useMemo(() => {
    if (view?.kind !== "new" || picked.length === 0) return [];
    // Only what the taps chose: the day's top stories ranked in alongside them
    // would make every pick look the same.
    return stories(rankFeed(pool, { ...view.interests, categories: picked }, { limit: 30 }).filter((i) => i.kind !== "top"));
  }, [view, picked, pool]);

  if (!view) return <div className="pth pth--loading" aria-hidden="true" />;

  if (view.kind === "paper") {
    return (
      <section id="gazeta-jote" className="pth" aria-labelledby="pth-title">
        <Head face="happy" eyebrow={view.issue > 0 ? `Për ty · Nr. ${view.issue}` : "Për ty"} />
        <h2 id="pth-title" className="pth-title">{view.title}</h2>
        <p className="pth-lede">
          {view.total > 0
            ? view.read >= view.total
              ? `I ke lexuar të ${view.total} lajmet e sotme. Shihemi nesër në 07:00.`
              : `${view.total} lajme për ty sot · ${view.read} / ${view.total} lexuar`
            : "Sot s'ka ende lajme për zgjedhjet e tua."}
        </p>
        <StoryList items={view.stories} />
        <Link href="/per-ty" className="pth-cta" onClick={() => track("perty_home_open", { kind: "paper" })}>
          Hape gazetën tënde <ArrowRight size={17} strokeWidth={2.4} aria-hidden="true" />
        </Link>
      </section>
    );
  }

  if (view.kind === "learned") {
    const noticed = pickChips(view.picks).map((c) => c.label);
    return (
      <section id="gazeta-jote" className="pth" aria-labelledby="pth-title">
        <Head face="happy" eyebrow="Gazeta jote · nga Dardani" />
        <h2 id="pth-title" className="pth-title">Ta bëra gazetën nga ajo që lexove.</h2>
        <p className="pth-lede">Më duket se të interesojnë: {noticed.join(" · ")}</p>
        <StoryList items={view.stories} />
        <Link href="/per-ty" className="pth-cta" onClick={() => track("perty_home_open", { kind: "learned" })}>
          Shihe gazetën tënde <ArrowRight size={17} strokeWidth={2.4} aria-hidden="true" />
        </Link>
        <p className="pth-note">E di vetëm kjo pajisje. Asgjë nuk dërgohet askund.</p>
      </section>
    );
  }

  return (
    <section id="gazeta-jote" className="pth" aria-labelledby="pth-title">
      <Head face="neutral" eyebrow="E re në 383 · Për ty" />
      <h2 id="pth-title" className="pth-title">Bëje 383 gazetën tënde.</h2>
      <p className="pth-lede">Prek çka të intereson. Lajmet e tua dalin këtu menjëherë, pa llogari.</p>
      <div className="pth-chips" role="group" aria-label="Temat">
        {NAV_CATEGORIES.map(({ label }) => {
          const on = picked.includes(label);
          return (
            <button
              key={label}
              type="button"
              className="pth-chip"
              aria-pressed={on}
              onClick={() => setPicked((prev) => (on ? prev.filter((c) => c !== label) : [...prev, label]))}
            >
              {label}
            </button>
          );
        })}
      </div>
      {preview.length > 0 ? (
        <StoryList items={preview} live />
      ) : (
        <p className="pth-hint">Zgjidh një temë dhe shih lajmet e tua të para.</p>
      )}
      <button
        type="button"
        className="pth-cta"
        disabled={picked.length === 0}
        onClick={() => {
          writeInterests({ ...readInterests(), categories: picked });
          track("perty_home_open", { kind: "new", topics: picked.length });
          router.push("/per-ty");
        }}
      >
        Hape gazetën time <ArrowRight size={17} strokeWidth={2.4} aria-hidden="true" />
      </button>
      <p className="pth-note">Zgjedhjet ruhen vetëm në këtë pajisje.</p>
    </section>
  );
}

function Head({ face, eyebrow }: { face: "happy" | "neutral"; eyebrow: string }) {
  return (
    <div className="pth-head">
      <DardaniFace state={face} size={40} decorative />
      <span className="pth-eyebrow">{eyebrow}</span>
    </div>
  );
}

function StoryList({ items, live = false }: { items: Story[]; live?: boolean }) {
  if (items.length === 0) return null;
  return (
    <ol className="pth-list" aria-live={live ? "polite" : undefined}>
      {items.map((s, i) => (
        <li key={s.slug}>
          <span className="pth-num" aria-hidden="true">{i + 1}</span>
          <Link href={`/article/${s.slug}`}>
            <span className="pth-reason">{s.reason}</span>
            <strong>{s.title}</strong>
          </Link>
        </li>
      ))}
    </ol>
  );
}

/**
 * The same door, one line high, at the top of Sot under the category row — on
 * a phone the card itself sits three screens down, under the front block. It
 * says what is waiting and goes there: a reader's paper or Dardani's opens
 * /per-ty, anyone else is taken to the card to pick topics.
 */
export function PerTyHomeStrip() {
  const [line, setLine] = useState<{ text: string; cta: string; href: string } | null>(null);

  useEffect(() => {
    const interests = readInterests();
    if (hasInterests(interests)) {
      setLine({ text: `${paperTitle(readName(), readPrefs()?.title)} është gati për sot`, cta: "Hape", href: "/per-ty" });
    } else if (hasLearnedPaper(learnedPicks(interests.affinity))) {
      setLine({ text: "Dardani ta bëri gazetën tënde", cta: "Shihe", href: "/per-ty" });
    } else {
      setLine({ text: "E re: bëje 383 gazetën tënde", cta: "Provo", href: "#gazeta-jote" });
    }
  }, []);

  if (!line) return <div className="pth-strip pth-strip--loading" aria-hidden="true" />;
  return (
    <Link
      href={line.href}
      className="pth-strip"
      onClick={() => track("perty_home_strip", { href: line.href })}
    >
      <DardaniFace state="happy" size={28} decorative />
      <span className="pth-strip-text">{line.text}</span>
      <span className="pth-strip-cta">
        {line.cta} <ArrowRight size={15} strokeWidth={2.5} aria-hidden="true" />
      </span>
    </Link>
  );
}
