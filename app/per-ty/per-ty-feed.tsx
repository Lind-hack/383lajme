"use client";

// The personal paper, and the onboarding that leads into it.
//
// Guest-first: everything works with no account, backed by the choices stored
// on this device (lib/interests.mjs). Signing in merges and syncs them across
// devices (lib/interests-sync.ts) — it is offered after the paper appears,
// never asked for before it.
//
// It is the reader's own newspaper, held open two pages at a time on a wide
// screen and one on a phone, read page by page and then closed
// (app/per-ty/paper/newspaper.tsx, lib/paper-pages.mjs):
//
//   Faqja 1   the front page — their title, the lead, the next three stories;
//   Faqja 2   "Në këtë numër" — every page, the town box, Dardani's thirty
//             seconds and the numbers;
//   then      "Më shumë nga sot" when the edition runs long, then one page per
//             thing they follow, in their order;
//   last      "Kaq për sot": sharing, tomorrow's 07:00 edition, the follows
//             that had nothing this week, and how the paper works.
//
// Nothing is pinned on top of the paper: how it works is one tap away in the
// bar ("Si funksionon?"), and the first visit only shows how to turn a page.
//
// What kind of paper it is — broadsheet, sports sheet, tabloid, international,
// business — follows what they pick and read (lib/paper-look.mjs); how long the
// excerpts run follows how long they stay on a story; every story says in one
// line why it is there (lib/perty-why.mjs) and can be turned up or down. Stories
// shown and passed over teach it too (lib/perty-skips.mjs).
//
// The layout and look are the reader's (lib/paper-prefs.mjs); sharing sends a
// frozen copy (lib/paper-snapshot.mjs). Visits, reads and the paper's settings
// are remembered on the device only.
//
// This component keeps the state and the side effects; the paper/ components
// only draw.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, HelpCircle, MessageCircleQuestion, Share2, SlidersHorizontal } from "lucide-react";
import { readInterests, writeInterests, hasInterests, nudgeAffinity, readingStats, type Interests } from "@/lib/interests.mjs";
import { articleKeys, rankFeed } from "@/lib/per-ty-rank.mjs";
import { buildPaper, coverWord } from "@/lib/per-ty-paper.mjs";
import { moveKey, readPrefs, writePrefs, type PaperPrefs } from "@/lib/paper-prefs.mjs";
import { cityById } from "@/lib/cities.mjs";
import { nextStreak, STREAK_KEY } from "@/lib/perty-streak.mjs";
import { forgetVisits, readSlugs, recordVisit } from "@/lib/perty-visits.mjs";
import { daysWithUs, forgetLedger, kosovoParts, noteVisit, readLedger, summarize } from "@/lib/reader-ledger.mjs";
import { defaultTitle, paperTitle, readName, writeName } from "@/lib/reader-name.mjs";
import { lastMonth, monthLabel } from "@/lib/monthly-wrapped.mjs";
import { hasLearnedPaper, learnedPicks, setLearnedPaper, totalReads } from "@/lib/perty-learned.mjs";
import { kosovoDateKey } from "@/lib/home-tregu.mjs";
import { editionName, lookById, readingMix, readingPace, readLookState, resolveLook, writeLookState, type LookId } from "@/lib/paper-look.mjs";
import { hashForSlide, reelSlides } from "@/lib/paper-reel.mjs";
import { keyLabel, whyLine } from "@/lib/perty-why.mjs";
import { noteShown, readShown, settleSkips, writeShown } from "@/lib/perty-skips.mjs";
import { mergeOnSignIn, pushInterests } from "@/lib/interests-sync";
import { createClient } from "@/lib/supabase/client";
import { openPyet } from "@/lib/pyet-thread";
import DardaniLoop from "@/components/dardani/dardani-loop";
import DardaniImage from "@/components/dardani/dardani-image";
import PaperReveal from "@/components/paper-reveal";
import Onboarding from "./onboarding";
import MorningPush from "./morning-push";
import { dateline } from "./paper/cover";
import { AllReadCheer, DardaniBrief, NumbersBox, TownToday, TreguBox } from "./paper/boxes";
import CustomizeSheet from "./paper/customize-sheet";
import Sheet from "./paper/sheet";
import ShareSheet, { type ShareablePaper } from "./paper/share-sheet";
import Reel, { type ReelScreen } from "./paper/reel";
import { ReactionsProvider } from "./paper/reactions";
import { BoxSlide, CoverSlide, PanelSlide, SectionSlide, StorySlide, type PaperStory, type ReelMeta } from "./paper/slides";
import { newspaperFonts } from "./paper/fonts";
import "./paper/reel.css";

export type FeedArticle = {
  slug: string;
  title: string;
  excerpt: string;
  category: string;
  city?: string;
  source: string;
  publishedAt: string;
  imageUrl?: string;
  engagementScore?: number;
  /** The newsroom's clay illustration of the story, when it has one (lib/cover-art). */
  coverArt?: string | null;
};

const SIGNUP_DISMISSED = "383:perty-signup-dismissed";
/** Set once the reader has turned a page: the "how to turn" hint is not shown again. */
const HOWTO_KEY = "383:paper-howto";
/** How deep the ranking goes: the sections need more than the edition does. */
const RANK_LIMIT = 200;
/** How far back "the newest story from your town" may reach. */
const TOWN_STORY_MS = 48 * 3600_000;
/** On screen this long, a page's stories count as shown (lib/perty-skips). */
const SHOWN_AFTER_MS = 1200;
/** "Më shumë / Më pak si kjo": about two-thirds of a full read either way. */
const TASTE_STEP = 1.2;

function readFlag(key: string) {
  try {
    return localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}
function setFlag(key: string) {
  try {
    localStorage.setItem(key, "1");
  } catch {
    // A reader whose browser refuses storage sees the card again next time.
  }
}

/** The first name a signed-in reader gave, if any. */
function firstName(meta: Record<string, unknown> | undefined) {
  const raw = [meta?.first_name, meta?.full_name, meta?.name].find((v) => typeof v === "string" && v.trim());
  const first = typeof raw === "string" ? raw.trim().split(/\s+/)[0] : "";
  return first.length > 1 && first.length <= 24 ? first : "";
}

export default function PerTyFeed({ pool, shelf }: { pool: FeedArticle[]; shelf: Record<string, FeedArticle[]> }) {
  const [interests, setInterests] = useState<Interests | null>(null);
  const [prefs, setPrefs] = useState<PaperPrefs | null>(null);
  const [editing, setEditing] = useState(false);
  const [customizing, setCustomizing] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [justFinished, setJustFinished] = useState(false);
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [name, setName] = useState("");
  const [signupDismissed, setSignupDismissed] = useState(true);
  const [storageFailed, setStorageFailed] = useState(false);
  const [streak, setStreak] = useState(0);
  const [now, setNow] = useState<Date | null>(null);
  const [since, setSince] = useState<string | null>(null);
  const [read, setRead] = useState<ReadonlySet<string>>(new Set());
  // The reader's own paper: the name they gave this device (it wins over the
  // account's) and the number of days they have come.
  const [deviceName, setDeviceName] = useState("");
  const [issue, setIssue] = useState(0);
  const [monthReads, setMonthReads] = useState(0);
  const [edition, setEdition] = useState("Botimi i mëngjesit");
  // The first week of a month, last month's wrapped ("Tetori në 383") is offered.
  const [wrappedMonth, setWrappedMonth] = useState<string | null>(null);
  // A guest with reading behind them is shown the paper Dardani made from it
  // (components/paper-reveal) before the three questions; this is "Zgjidh vetë".
  const [chooseMyself, setChooseMyself] = useState(false);
  const [readsSoFar, setReadsSoFar] = useState(0);
  // First visit: the paper shows how to turn a page until the reader has.
  const [howto, setHowto] = useState(false);
  // "Si funksionon?" in the bar.
  const [helping, setHelping] = useState(false);
  // The paper's kind as stored.
  const [lookState, setLookState] = useState<ReturnType<typeof readLookState>>(null);
  const shownTimer = useRef<number | null>(null);

  useEffect(() => {
    const stored = readInterests();
    setInterests(stored);
    setPrefs(readPrefs());
    setDeviceName(readName());
    setReadsSoFar(totalReads(readLedger()));
    setSignupDismissed(readFlag(SIGNUP_DISMISSED));
    setHowto(!readFlag(HOWTO_KEY));
    setLookState(readLookState());
    setNow(new Date());
    let alive = true;
    // Auth is only needed for sync. If the client cannot even be built (no
    // Supabase config), the feed carries on as a guest feed.
    Promise.resolve()
      .then(() => createClient().auth.getUser())
      .then(({ data }) => {
        if (!alive) return;
        setSignedIn(Boolean(data?.user));
        setName(firstName(data?.user?.user_metadata));
        if (data?.user) {
          mergeOnSignIn().then((merged) => {
            if (alive && merged) setInterests(merged);
          });
        }
      })
      .catch(() => {
        if (alive) setSignedIn(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  const ready = Boolean(interests && hasInterests(interests));
  const home = interests?.home ?? null;

  // A visit counts towards the streak only once there is a paper to visit. The
  // same moment fixes the line "new" is measured from for this visit, and
  // settles what was shown on an earlier day and passed over.
  useEffect(() => {
    if (!ready) return;
    setSince(recordVisit());
    const readNow = new Set(readSlugs());
    setRead(readNow);
    // This page's effects run before the layout's, so today is noted here too
    // (noting a day twice changes nothing) before the ledger is read.
    noteVisit();
    const ledger = readLedger();
    const parts = kosovoParts();
    setIssue(daysWithUs(ledger));
    setMonthReads(summarize(ledger, { from: parts.month, to: parts.month }).reads);
    setEdition(editionName(ledger));
    if (parts.day <= 7) setWrappedMonth(lastMonth());
    try {
      const next = nextStreak(JSON.parse(localStorage.getItem(STREAK_KEY) ?? "null"));
      localStorage.setItem(STREAK_KEY, JSON.stringify(next));
      setStreak(next.count);
    } catch {
      setStreak(0);
    }
    const { penalties, log } = settleSkips(readShown(), readNow, kosovoDateKey());
    const keys = Object.keys(penalties);
    if (keys.length) {
      const current = readInterests();
      let affinity = current.affinity;
      for (const key of keys) affinity = nudgeAffinity(affinity, key, -penalties[key]);
      writeInterests({ ...current, affinity });
      setInterests((prev) => (prev ? { ...prev, affinity } : prev));
    }
    if (!log) writeShown(null);
  }, [ready]);

  const feed = useMemo(
    () => (interests && hasInterests(interests) ? rankFeed(pool, interests, { limit: RANK_LIMIT }) : []),
    [pool, interests]
  );

  const homeFrom = cityById(home)?.from ?? null;

  // The newest story from the reader's town in the last two days, for the
  // town box. Matched the way the ranking matches a town.
  const townStory = useMemo(() => {
    if (!home || !now) return null;
    const key = `city:${home}`;
    const from = now.getTime() - TOWN_STORY_MS;
    let best: FeedArticle | null = null;
    for (const a of pool) {
      const t = Date.parse(a.publishedAt);
      if (!(t >= from) || (best && t <= Date.parse(best.publishedAt))) continue;
      if (articleKeys(a).includes(key)) best = a;
    }
    return best ? { slug: best.slug, title: best.title } : null;
  }, [pool, home, now]);

  const paper = useMemo(
    () => buildPaper(feed, interests, prefs, { homeFrom, shelf }),
    [feed, interests, prefs, homeFrom, shelf]
  );

  // What kind of paper: from the reading mix, steadied by what it was before,
  // or the one the reader locked.
  const lookResult = useMemo(() => {
    if (!interests || !prefs || !ready) return null;
    return resolveLook(readingMix(interests), lookState, { locked: prefs.look === "auto" ? null : prefs.look });
  }, [interests, prefs, ready, lookState]);
  const look: LookId = lookResult?.look ?? "e-perditshme";
  const autoLook: LookId = useMemo(
    () => (interests && ready ? resolveLook(readingMix(interests), lookState).look : "e-perditshme"),
    [interests, ready, lookState]
  );

  useEffect(() => {
    if (!lookResult?.state) return;
    const stored = lookState;
    if (!stored || stored.look !== lookResult.state.look || stored.since !== lookResult.state.since) {
      writeLookState(lookResult.state);
      setLookState(lookResult.state);
    }
  }, [lookResult, lookState]);

  const pace = useMemo(() => (interests ? readingPace(interests) : "medium"), [interests]);

  // What a shared copy carries: the edition, the first four visible sections
  // with stories, three each, and the paper's kind.
  const shareable = useMemo<ShareablePaper>(
    () => ({
      title: prefs?.title || defaultTitle(deviceName || name),
      leadKey: paper.edition[0]?.primaryKey ?? "",
      look,
      edition: paper.edition.map((i) => i.article.slug),
      sections: paper.sections
        .filter((s) => !s.empty)
        .slice(0, 4)
        .map((s) => ({ key: s.key, slugs: s.items.slice(0, 3).map((i) => i.article.slug) })),
    }),
    [paper, prefs?.title, deviceName, name, look]
  );

  // The last 24 hours rather than "today": just after midnight a calendar day
  // has nothing in it yet, and "0 lajme" reads as a dead paper.
  const dayCount = useMemo(() => {
    if (!now) return 0;
    const from = now.getTime() - 24 * 3600_000;
    return pool.filter((a) => Date.parse(a.publishedAt) >= from).length;
  }, [pool, now]);

  function save(next: Interests) {
    if (!writeInterests(next)) setStorageFailed(true);
    const stored = readInterests();
    // If storage refused the write, keep the choice for this visit anyway.
    const current = hasInterests(stored) || !hasInterests(next) ? stored : next;
    setInterests(current);
    if (signedIn) pushInterests(current);
  }

  function savePrefs(next: PaperPrefs) {
    if (!writePrefs(next)) setStorageFailed(true);
    setPrefs(next);
  }

  // Dardani's three lines are written from this edition, the stories not yet read.
  const briefSlugs = useMemo(
    () =>
      paper.edition
        .filter((i) => !read.has(i.article.slug))
        .slice(0, 6)
        .map((i) => i.article.slug),
    [paper.edition, read]
  );

  // "Shkurt, për sot": each box the reader keeps on is a screen of its own.
  const boxKeys = useMemo(() => {
    const on = prefs?.boxes;
    if (!on) return [];
    return [
      on.brief && briefSlugs.length >= 2 ? "brief" : null,
      on.city ? "city" : null,
      on.numbers ? "numbers" : null,
      on.tregu ? "tregu" : null,
    ].filter((k): k is string => Boolean(k));
  }, [prefs?.boxes, briefSlugs.length]);

  const slides = useMemo(() => reelSlides(paper, { boxes: boxKeys }), [paper, boxKeys]);

  // A story on screen a moment counts as shown; tomorrow, the ones never
  // opened teach the paper (lib/perty-skips).
  const onShown = useCallback(
    (index: number) => {
      if (shownTimer.current) window.clearTimeout(shownTimer.current);
      const slide = slides[index];
      if (slide?.kind !== "story") return;
      const key = slide.section ? slide.section.key : ((slide.item as { primaryKey?: string }).primaryKey ?? "");
      if (!key.includes(":")) return;
      const slug = slide.item.article.slug;
      shownTimer.current = window.setTimeout(() => {
        writeShown(noteShown(readShown(), kosovoDateKey(), [{ slug, key }]));
      }, SHOWN_AFTER_MS);
    },
    [slides]
  );

  useEffect(() => () => {
    if (shownTimer.current) window.clearTimeout(shownTimer.current);
  }, []);

  // Before mount the device choices are unknown; render nothing rather than
  // flashing onboarding at a reader who already has a paper.
  if (!interests || !prefs || !now) return <div className="perty-shell perty-shell--loading" aria-busy="true" />;

  // Reading behind them but nothing chosen: Dardani's paper first, the
  // questions one tap away.
  const picks = !hasInterests(interests) && !editing && !chooseMyself ? learnedPicks(interests.affinity) : null;
  if (picks && hasLearnedPaper(picks)) {
    return (
      <div className="perty-shell perty-shell--wide">
        <PaperReveal
          picks={picks}
          reads={readsSoFar}
          variant="page"
          onOpen={(chosen) => {
            save({ ...interests, ...chosen });
            setLearnedPaper(true);
            setJustFinished(true);
            window.scrollTo({ top: 0 });
          }}
          onSecondary={() => setChooseMyself(true)}
          secondaryLabel="Jo, zgjidh vetë"
        />
      </div>
    );
  }

  if (!hasInterests(interests) || editing) {
    return (
      <div className="perty-shell perty-shell--wide">
        <Onboarding
          pool={pool}
          // "Zgjidh vetë" after Dardani's paper starts from what he noticed.
          initial={chooseMyself && !hasInterests(interests) ? { ...interests, ...learnedPicks(interests.affinity) } : interests}
          editing={editing}
          onCancel={() => setEditing(false)}
          onDone={(picks) => {
            save({ ...interests, ...picks });
            if (!editing) setJustFinished(true);
            setEditing(false);
            // Edited or chosen by hand: no longer a guess to ask about.
            setLearnedPaper(false);
            window.scrollTo({ top: 0 });
          }}
        />
      </div>
    );
  }

  const displayName = deviceName || name;
  const title = paperTitle(displayName, prefs.title);
  const lookInfo = lookById(look);
  const ed = paper.edition;
  const readCount = ed.filter((i) => read.has(i.article.slug)).length;
  const allRead = ed.length > 0 && readCount === ed.length;
  const firstUnread = ed.find((i) => !read.has(i.article.slug)) ?? ed[0];
  const canShare = ed.length > 0;
  const showSignup = justFinished && signedIn === false && !signupDismissed;
  const followNames = paper.allKeys
    .map((k) => keyLabel(k))
    .filter((v): v is string => Boolean(v))
    .slice(0, 3);
  const date = dateline(now);
  const dateCap = date.charAt(0).toUpperCase() + date.slice(1);

  const onTaste = (key: string, more: boolean) => {
    save({ ...interests, affinity: nudgeAffinity(interests.affinity, key, more ? TASTE_STEP : -TASTE_STEP) });
    // A follow with its own screens moves one place up or down the paper too.
    if (paper.allKeys.includes(key)) savePrefs({ ...prefs, order: moveKey(paper.allKeys, key, more ? -1 : 1) });
  };

  const meta: ReelMeta = { readOnly: false, pace, seen: { since, read }, onTaste };
  const firstStory = slides.findIndex((s) => s.kind === "story");
  const storySlugs = slides.flatMap((s) => (s.kind === "story" ? [s.item.article.slug] : []));

  const forget = () => {
    save({ ...interests, affinity: {} });
    forgetVisits();
    forgetLedger();
    writeShown(null);
    setRead(new Set());
    setSince(null);
  };

  const quietNotes = (quiet: { key: string; title: string; kind: string }[]) =>
    quiet.length > 0 && (
      <section>
        <h3>Pa lajme këtë javë</h3>
        <ul className="fy-list-plain">
          {quiet.map((s) => (
            <li key={s.key}>
              <b>{s.title}:</b>{" "}
              {s.kind === "person"
                ? "këtë javë s'ka pasur lajme. Të them sapo të ketë."
                : s.kind === "city"
                  ? `këtë javë s'kemi shkruar për ${s.title}.`
                  : "redaksia s'ka shkruar këtë muaj."}
            </li>
          ))}
        </ul>
      </section>
    );

  const sectionKicker = (kind: string, key: string) =>
    key === `city:${home}` ? "Qyteti yt" : kind === "person" ? "Njeri që ndjek" : kind === "city" ? "Qytet që ndjek" : "Temë që ndjek";

  const screens: ReelScreen[] = slides.map((slide, i) => {
    if (slide.kind === "cover") {
      const lead = ed[0]?.article;
      return {
        key: slide.key,
        kind: "cover",
        title: title,
        node: (
          <CoverSlide
            title={title}
            onRename={() => setCustomizing(true)}
            kicker={`${dateCap} · ${edition}${issue > 0 ? ` · Nr. ${issue}` : ""}`}
            line={`${ed.length === 1 ? "1 lajm" : `${ed.length} lajme`} · ${paper.minutes} min${followNames.length ? ` · për ${followNames.join(", ")}` : ""}`}
            photo={lead ? lead.imageUrl || lead.coverArt || null : null}
            heads={slides
              .filter((s) => s.kind === "story")
              .slice(0, 3)
              .map((s) => ({ title: s.title, href: hashForSlide(s.n) }))}
            start={{ label: readCount ? "Vazhdo leximin" : "Fillo leximin", href: hashForSlide(firstStory > 0 ? firstStory : 1) }}
          />
        ),
      };
    }
    if (slide.kind === "brief") {
      const box =
        slide.box === "brief" ? (
          <DardaniBrief slugs={briefSlugs} />
        ) : slide.box === "city" ? (
          <TownToday homeId={home} story={townStory} onPickCity={() => setEditing(true)} />
        ) : slide.box === "numbers" ? (
          <NumbersBox today={dayCount} days={issue} streak={streak} reads={monthReads} />
        ) : (
          <TreguBox />
        );
      return {
        key: slide.key,
        kind: "brief",
        title: slide.title,
        group: slide.group,
        groupTitle: slide.groupTitle,
        pos: slide.pos,
        of: slide.of,
        node: <BoxSlide label={`Shkurt, për sot · ${slide.pos + 1} nga ${slide.of}`}>{box}</BoxSlide>,
      };
    }
    if (slide.kind === "section") {
      const s = slide.section;
      const stats = readingStats(interests.affinity, s.key);
      const reads = Math.round(stats.reads);
      const minutes = Math.round(stats.minutes);
      const picked = s.kind === "category" ? (interests.categories as string[]).includes(s.title) : true;
      const intro =
        (s.key === `city:${home}` ? `${s.title} është qyteti yt.` : picked ? `E zgjodhe kur e bëre gazetën.` : `E shtova vetë, sepse lexon shpesh për ${s.title}.`) +
        (reads >= 2 ? ` Kohët e fundit ke lexuar ${reads} lajme për këtë${minutes >= 1 ? `, ${minutes} minuta` : ""}.` : "");
      const first = s.items.find((it) => !ed.some((e) => e.article.slug === it.article.slug))?.article ?? s.items[0]?.article;
      return {
        key: slide.key,
        kind: "section",
        title: s.title,
        node: (
          <SectionSlide
            title={s.title}
            kicker={sectionKicker(s.kind, s.key)}
            intro={intro}
            count={slide.count}
            hidden={slide.hidden}
            href={s.href}
            photo={first ? first.imageUrl || first.coverArt || null : null}
            sectionKey={s.key}
            meta={meta}
          />
        ),
      };
    }
    if (slide.kind === "story") {
      const item = slide.item;
      const fromShelf = Boolean((item as { fromShelf?: boolean }).fromShelf);
      const story: PaperStory = {
        article: item.article,
        why: slide.section
          ? fromShelf
            ? { short: "Nga muaji", long: `Për ${slide.section.title} këtë javë ka pasur pak lajme, ndaj këtu janë më të fundit nga muaji.`, key: slide.section.key, picked: true }
            : whyLine({ article: item.article, kind: slide.section.kind, primaryKey: slide.section.key }, interests)
          : whyLine(item as (typeof ed)[number], interests),
      };
      return {
        key: slide.key,
        kind: "story",
        title: slide.title,
        group: slide.group,
        groupTitle: slide.groupTitle,
        pos: slide.pos,
        of: slide.of,
        thumb: item.article.imageUrl || item.article.coverArt || null,
        read: read.has(item.article.slug),
        node: <StorySlide story={story} meta={meta} eager={i <= 3} />,
      };
    }
    return {
      key: slide.key,
      kind: "end",
      title: slide.title,
      node: (
        <PanelSlide kicker={allRead ? "E mbarove" : "Fundi i gazetës"} title={allRead ? "I lexove të gjitha!" : "Kaq për sot."}>
          <div className="fy-end-hello">
            {allRead ? <AllReadCheer /> : <DardaniImage name="wave" decorative className="perty-end-img" />}
            <div>
              <p className="fy-end-big">{readCount ? `${readCount} nga ${ed.length} lajme i ke lexuar.` : "Shihemi nesër në mëngjes."}</p>
              <p>Ndaje me dikë që i pëlqejnë të njëjtat gjëra — ai sheh pikërisht këtë gazetë.</p>
            </div>
          </div>
          <div className="fy-actions-row">
            {canShare && (
              <button type="button" className="fy-btn fy-btn--accent" onClick={() => setSharing(true)}>
                <Share2 size={17} strokeWidth={2.4} aria-hidden="true" />
                Ndaje gazetën
              </button>
            )}
            <button type="button" className="fy-btn fy-btn--ghost" onClick={() => setCustomizing(true)}>
              <SlidersHorizontal size={16} strokeWidth={2.3} aria-hidden="true" />
              Rregullo
            </button>
          </div>
          <MorningPush />
          {streak >= 2 && (
            <p>
              <b>{streak} ditë rresht.</b> Kthehu nesër që të mos e prishësh.
            </p>
          )}
          {showSignup && (
            <section>
              <h3>Në çdo pajisje</h3>
              <p>Zgjedhjet ruhen në këtë pajisje. Me llogari, i ke njësoj në telefon dhe kompjuter.</p>
              <div className="fy-actions-row" style={{ marginTop: 10 }}>
                <Link href="/hyr?tab=regjistrohu&next=/per-ty" className="fy-btn fy-btn--light fy-btn--small">
                  Regjistrohu
                </Link>
                <button
                  type="button"
                  className="perty-text-btn"
                  onClick={() => {
                    setFlag(SIGNUP_DISMISSED);
                    setSignupDismissed(true);
                  }}
                >
                  Jo tani
                </button>
              </div>
            </section>
          )}
          <div className="fy-links">
            <Link href="/">
              Kryesoret e ditës <ArrowRight size={14} strokeWidth={2.4} aria-hidden="true" />
            </Link>
            <button type="button" onClick={() => openPyet(firstUnread ? `Pse ndodhi kjo: ${firstUnread.article.title}` : undefined)}>
              <MessageCircleQuestion size={14} strokeWidth={2.3} aria-hidden="true" />
              Pyet Dardanin
            </button>
            {wrappedMonth && (
              <Link href={`/muaji/${wrappedMonth}`}>
                {monthLabel(wrappedMonth)?.definite} në 383 <ArrowRight size={14} strokeWidth={2.4} aria-hidden="true" />
              </Link>
            )}
          </div>
          <section>
            <h3>Si funksionon gazeta jote</h3>
            <ol className="fy-list-plain">
              <li>Zgjodhe tema, njerëz dhe qytete. Secili ka pjesën e vet këtu.</li>
              <li>Çdo mëngjes gazeta mbushet vetë me lajmet më të reja për to.</li>
              <li>
                Mëson nga sa lexon çdo lajm. Tani është {lookInfo?.name.toLowerCase() ?? "e përditshme"}: {lookInfo?.about}.
              </li>
              <li>Etiketa me ngjyrë mbi çdo lajm thotë pse është aty; 👍 dhe 👎 anash e mësojnë çka do.</li>
            </ol>
          </section>
          {quietNotes(slide.quiet)}
          <p className="fy-privacy">
            Gazeta jote mëson nga ajo që lexon dhe sa gjatë e lexon — vetëm në këtë pajisje. Për përmbledhjen, Dardanit i
            dërgohen vetëm adresat e lajmeve, asnjë e dhënë për ty.
          </p>
          <div className="fy-actions-row">
            <button type="button" className="fy-btn fy-btn--ghost fy-btn--small" onClick={() => setEditing(true)}>
              Ndrysho çka ndjek
            </button>
            {(Object.keys(interests.affinity).length > 0 || read.size > 0) && (
              <button type="button" className="perty-text-btn" onClick={forget}>
                Harro historikun e leximit
              </button>
            )}
          </div>
        </PanelSlide>
      ),
    };
  });

  const tools = (
    <>
      {canShare && (
        <button type="button" className="fy-tool fy-tool--primary" onClick={() => setSharing(true)}>
          <Share2 size={16} strokeWidth={2.4} aria-hidden="true" />
          <span className="fy-tool-label">Ndaje</span>
        </button>
      )}
      <button type="button" className="fy-tool" onClick={() => setCustomizing(true)} aria-label="Rregullo gazetën">
        <SlidersHorizontal size={16} strokeWidth={2.4} aria-hidden="true" />
        <span className="fy-tool-label" aria-hidden="true">
          Rregullo
        </span>
      </button>
      <button type="button" className="fy-tool fy-tool--icon" onClick={() => setHelping(true)} aria-label="Si funksionon gazeta jote?">
        <HelpCircle size={17} strokeWidth={2.3} aria-hidden="true" />
      </button>
    </>
  );

  return (
    <div className={`perty-paper-pages ${newspaperFonts}`}>
      {ed.length === 0 ? (
        <div className="perty-shell perty-shell--wide">
          <div className="perty-empty">
            <DardaniLoop name="sleeping" className="perty-empty-loop" />
            <p>
              <strong>Sot s&apos;ka ende lajme për zgjedhjet e tua.</strong> Kjo nuk do të thotë se s&apos;ka lajme — shiko
              kryesoret e ditës, ose shto më shumë tema.
            </p>
            <div className="perty-head-actions">
              <Link href="/" className="perty-btn perty-btn--primary">
                Kryesoret e ditës
              </Link>
              <button type="button" className="perty-btn perty-btn--ghost" onClick={() => setEditing(true)}>
                Shto tema
              </button>
            </div>
          </div>
        </div>
      ) : (
        <ReactionsProvider slugs={storySlugs}>
          <Reel
            screens={screens}
            look={look}
            label={title}
            name={title}
            sub={`${dateCap} · ${ed.length === 1 ? "1 lajm" : `${ed.length} lajme`} · ${paper.minutes} min`}
            tools={tools}
            hint={howto}
            onShown={onShown}
            onMove={() => {
              if (!howto) return;
              setFlag(HOWTO_KEY);
              setHowto(false);
            }}
          />
        </ReactionsProvider>
      )}
      {storageFailed && (
        <p className="perty-share-hint" role="status">
          Shfletuesi yt nuk lejon ruajtjen e zgjedhjeve, ndaj ato vlejnë vetëm për këtë vizitë.
        </p>
      )}

      <Sheet open={helping} onClose={() => setHelping(false)} title="Si funksionon gazeta jote" titleId="perty-help-title">
        <ol className="fy-help">
          <li>
            <span className="fy-help-icon" aria-hidden="true">
              ✍️
            </span>
            <div>
              <b>E bëre ti</b>
              <p>Nga ato që zgjodhe{followNames.length ? ` — ${followNames.join(", ")}` : ""}.</p>
            </div>
          </li>
          <li>
            <span className="fy-help-icon" aria-hidden="true">
              👆
            </span>
            <div>
              <b>Një lajm për ekran</b>
              <p>Rrëshqit lart në telefon, ose rrotullo / shtyp ↓ në kompjuter, për lajmin tjetër.</p>
            </div>
          </li>
          <li>
            <span className="fy-help-icon" aria-hidden="true">
              🏷️
            </span>
            <div>
              <b>Pse e sheh?</b>
              <p>Etiketa mbi çdo lajm të tregon arsyen, me ngjyrën e rubrikës së vet.</p>
            </div>
          </li>
          <li>
            <span className="fy-help-icon" aria-hidden="true">
              ❤️
            </span>
            <div>
              <b>Mësoje</b>
              <p>
                👍 për më shumë si ai, 👎 për më pak, ose prek dy herë foton. Gazeta mëson edhe nga sa gjatë lexon. Tani është{" "}
                {lookInfo?.name.toLowerCase() ?? "e përditshme"}: {lookInfo?.about}.
              </p>
            </div>
          </li>
          <li>
            <span className="fy-help-icon" aria-hidden="true">
              💬
            </span>
            <div>
              <b>Reago dhe komento</b>
              <p>Shih si u ndjenë të tjerët, dhe thuaj mendimin tënd te komentet.</p>
            </div>
          </li>
          <li>
            <span className="fy-help-icon" aria-hidden="true">
              🔗
            </span>
            <div>
              <b>Ndaje</b>
              <p>Shoku yt merr një lidhje dhe e sheh gazetën tënde të sotme.</p>
            </div>
          </li>
        </ol>
        <p className="perty-help-privacy">Zgjedhjet dhe leximi ruhen vetëm në këtë pajisje.</p>
        <button
          type="button"
          className="perty-btn perty-btn--ghost"
          onClick={() => {
            setHelping(false);
            setEditing(true);
          }}
        >
          Ndrysho çka ndjek
        </button>
      </Sheet>
      <CustomizeSheet
        open={customizing}
        onClose={() => setCustomizing(false)}
        prefs={prefs}
        onChange={savePrefs}
        keys={paper.allKeys}
        name={displayName}
        autoLook={autoLook}
        onRename={(value) => setDeviceName(writeName(value))}
        onAddFollows={() => {
          setCustomizing(false);
          setEditing(true);
          window.scrollTo({ top: 0 });
        }}
      />
      {canShare && (
        <ShareSheet open={sharing} onClose={() => setSharing(false)} paper={shareable} prefs={prefs} name={displayName} />
      )}
    </div>
  );
}
