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
import { paperPages } from "@/lib/paper-pages.mjs";
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
import Newspaper, { type NewspaperPage } from "./paper/newspaper";
import { EndSheet, FrontSheet, IndexSheet, MoreSheet, SectionSheet, type PaperMeta, type PaperStory } from "./paper/pages";
import { newspaperFonts } from "./paper/fonts";
import "./paper/newspaper.css";

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

  const pages = useMemo(() => paperPages(paper), [paper]);

  // Stories on the page the reader is looking at count as shown once it has
  // sat there a moment; tomorrow, the ones never opened teach the paper.
  const onPageShown = useCallback(
    (indexes: number[]) => {
      if (shownTimer.current) window.clearTimeout(shownTimer.current);
      const items: { article: FeedArticle; primaryKey?: string }[] = [];
      for (const page of indexes.map((i) => pages[i])) {
        if (page?.kind === "front") items.push(...[page.lead, ...page.stories].filter((i): i is NonNullable<typeof i> => Boolean(i)));
        else if (page?.kind === "more") items.push(...page.stories);
        else if (page?.kind === "section") items.push(...page.items.map((i) => ({ article: i.article, primaryKey: page.section.key })));
      }
      if (!items.length) return;
      shownTimer.current = window.setTimeout(() => {
        const list = items.map((i) => ({ slug: i.article.slug, key: i.primaryKey ?? "" })).filter((i) => i.key.includes(":"));
        if (list.length) writeShown(noteShown(readShown(), kosovoDateKey(), list));
      }, SHOWN_AFTER_MS);
    },
    [pages]
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
  // Dardani's three lines are written from this edition, the stories not yet read.
  const briefSlugs = ed
    .filter((i) => !read.has(i.article.slug))
    .slice(0, 6)
    .map((i) => i.article.slug);
  const firstUnread = ed.find((i) => !read.has(i.article.slug)) ?? ed[0];
  const canShare = ed.length > 0;
  const boxes = prefs.boxes;
  const showSignup = justFinished && signedIn === false && !signupDismissed;
  const followNames = paper.allKeys
    .map((k) => keyLabel(k))
    .filter((v): v is string => Boolean(v))
    .slice(0, 3);
  const year = Number(new Intl.DateTimeFormat("en-US", { timeZone: "Europe/Belgrade", year: "numeric" }).format(now));

  const onTaste = (key: string, more: boolean) => {
    save({ ...interests, affinity: nudgeAffinity(interests.affinity, key, more ? TASTE_STEP : -TASTE_STEP) });
    // A follow with its own page moves one place up or down the paper too.
    if (paper.allKeys.includes(key)) savePrefs({ ...prefs, order: moveKey(paper.allKeys, key, more ? -1 : 1) });
  };

  const meta: PaperMeta = {
    title,
    onRename: () => setCustomizing(true),
    edition,
    issue,
    date: dateline(now),
    year,
    follows: followNames,
    count: ed.length,
    minutes: paper.minutes,
    total: pages.length,
    readOnly: false,
    pace,
    seen: { since, read },
    onTaste,
  };

  const story = (item: (typeof ed)[number]): PaperStory => ({ article: item.article, why: whyLine(item, interests) });
  const go = (n: number) => {
    window.location.hash = `faqja-${n}`;
  };

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
        <ul className="np-quiet">
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

  const howItWorks = (
    <>
      <section>
        <h3>Si funksionon gazeta jote</h3>
        <ol className="np-list">
          <li>Zgjodhe tema, njerëz dhe qytete. Secili merr faqen e vet.</li>
          <li>Çdo mëngjes faqet mbushen vetë me lajmet më të reja për to.</li>
          <li>Gazeta mëson nga sa lexon çdo lajm. Tani është {lookInfo?.name.toLowerCase() ?? "e përditshme"}: {lookInfo?.about}.</li>
          <li>Rreshti i ngjyrosur mbi çdo lajm thotë pse është aty. Prek atë për më shumë ose më pak si ai.</li>
        </ol>
      </section>
      <p className="np-privacy">
        Gazeta jote mëson nga ajo që lexon dhe sa gjatë e lexon — vetëm në këtë pajisje. Për përmbledhjen, Dardanit i
        dërgohen vetëm adresat e lajmeve, asnjë e dhënë për ty.
      </p>
      <div className="np-actions">
        <button type="button" className="np-btn np-btn--small np-btn--ghost" onClick={() => setEditing(true)}>
          Ndrysho çka ndjek
        </button>
        {(Object.keys(interests.affinity).length > 0 || read.size > 0) && (
          <button type="button" className="perty-text-btn" onClick={forget}>
            Harro historikun e leximit
          </button>
        )}
      </div>
    </>
  );

  const sheets: NewspaperPage[] = pages.map((page) => {
    if (page.kind === "front") {
      return {
        key: page.key,
        title: page.title,
        node: <FrontSheet meta={meta} lead={page.lead ? story(page.lead) : null} stories={page.stories.map(story)} />,
      };
    }
    if (page.kind === "index") {
      return {
        key: page.key,
        title: page.title,
        // Its boxes fetch: drawn only when it is open.
        prefetch: false,
        node: (
          <IndexSheet meta={meta} n={page.n} contents={page.contents} onJump={go}>
            {boxes.brief && briefSlugs.length >= 2 && <DardaniBrief slugs={briefSlugs} />}
            {boxes.city && <TownToday homeId={home} story={townStory} onPickCity={() => setEditing(true)} />}
            {boxes.numbers && <NumbersBox today={dayCount} days={issue} streak={streak} reads={monthReads} />}
            {boxes.tregu && <TreguBox />}
          </IndexSheet>
        ),
      };
    }
    if (page.kind === "more") {
      return { key: page.key, title: page.title, node: <MoreSheet meta={meta} n={page.n} title={page.title} stories={page.stories.map(story)} /> };
    }
    if (page.kind === "section") {
      const s = page.section;
      const stats = readingStats(interests.affinity, s.key);
      const reads = Math.round(stats.reads);
      const minutes = Math.round(stats.minutes);
      const picked = s.kind === "category" ? (interests.categories as string[]).includes(s.title) : true;
      const intro =
        (s.key === `city:${home}` ? `${s.title} është qyteti yt.` : picked ? `E zgjodhe ${s.title} kur e bëre gazetën.` : `E shtova sepse lexon shpesh për ${s.title}.`) +
        (reads >= 2 ? ` Kohët e fundit ke lexuar ${reads} lajme për këtë${minutes >= 1 ? `, ${minutes} minuta` : ""}.` : "");
      return {
        key: page.key,
        title: page.title,
        node: (
          <SectionSheet
            meta={meta}
            n={page.n}
            title={s.title}
            sectionKey={s.key}
            href={s.href}
            intro={intro}
            hidden={page.hidden}
            stories={page.items.map((i) => ({
              article: i.article,
              // The page's heading already says why the follow is here; a story
              // only says more when it is an older one topping the page up.
              why: i.fromShelf
                ? { short: "Nga muaji", long: `Për ${s.title} këtë javë ka pasur pak lajme, ndaj këtu janë më të fundit nga muaji.`, key: s.key, picked: true }
                : null,
            }))}
          />
        ),
      };
    }
    if (page.kind === "about") {
      return {
        key: page.key,
        title: page.title,
        node: (
          <EndSheet meta={meta} n={page.n} title="Si funksionon">
            {howItWorks}
            {quietNotes(page.quiet)}
          </EndSheet>
        ),
      };
    }
    return {
      key: page.key,
      title: page.title,
      node: (
        <EndSheet meta={meta} n={page.n} title={allRead ? "E mbarove!" : "Kaq për sot."}>
          <div className="np-end-hello">
            {allRead ? <AllReadCheer /> : <DardaniImage name="wave" decorative className="perty-end-img" />}
            <div>
              <p className="np-end-big">
                {allRead ? "I ke lexuar të gjitha." : readCount ? `${readCount} nga ${ed.length} i ke lexuar.` : "Shihemi nesër në mëngjes."}
              </p>
              <p>Ndaje me dikë që i pëlqejnë të njëjtat gjëra — ai sheh pikërisht këto faqe.</p>
            </div>
          </div>
          <div className="np-actions">
            {canShare && (
              <button type="button" className="np-btn np-btn--accent" onClick={() => setSharing(true)}>
                <Share2 size={16} strokeWidth={2.4} aria-hidden="true" />
                Ndaje gazetën
              </button>
            )}
            <button type="button" className="np-btn np-btn--ghost" onClick={() => setCustomizing(true)}>
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
              <div className="np-actions" style={{ marginTop: 8 }}>
                <Link href="/hyr?tab=regjistrohu&next=/per-ty" className="np-btn np-btn--small">
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
          <div className="np-actions">
            <Link href="/" className="np-link">
              Kryesoret e ditës <ArrowRight size={14} strokeWidth={2.4} aria-hidden="true" />
            </Link>
            <button type="button" className="np-link" style={{ background: "none", border: 0, cursor: "pointer" }} onClick={() => openPyet(firstUnread ? `Pse ndodhi kjo: ${firstUnread.article.title}` : undefined)}>
              <MessageCircleQuestion size={14} strokeWidth={2.3} aria-hidden="true" />
              Pyet Dardanin
            </button>
            {wrappedMonth && (
              <Link href={`/muaji/${wrappedMonth}`} className="np-link">
                {monthLabel(wrappedMonth)?.definite} në 383 <ArrowRight size={14} strokeWidth={2.4} aria-hidden="true" />
              </Link>
            )}
          </div>
          {page.about && howItWorks}
          {page.about && quietNotes(page.quiet)}
        </EndSheet>
      ),
    };
  });

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
        <Newspaper
          pages={sheets}
          look={look}
          label={title}
          hint={howto}
          onPageShown={onPageShown}
          onTurn={() => {
            if (!howto) return;
            setFlag(HOWTO_KEY);
            setHowto(false);
          }}
          lead={
            storageFailed ? (
              <p className="np-notice" role="status">
                Shfletuesi yt nuk lejon ruajtjen e zgjedhjeve, ndaj ato vlejnë vetëm për këtë vizitë.
              </p>
            ) : undefined
          }
          tools={
            <>
              {canShare && (
                <button type="button" className="np-tool np-tool--primary" onClick={() => setSharing(true)}>
                  <Share2 size={16} strokeWidth={2.4} aria-hidden="true" />
                  <span className="np-tool-label">Ndaje</span>
                </button>
              )}
              <button type="button" className="np-tool" onClick={() => setCustomizing(true)} aria-label="Rregullo gazetën">
                <SlidersHorizontal size={16} strokeWidth={2.4} aria-hidden="true" />
                <span className="np-tool-label" aria-hidden="true">
                  Rregullo
                </span>
              </button>
              <button type="button" className="np-tool np-tool--icon" onClick={() => setHelping(true)} aria-label="Si funksionon gazeta jote?">
                <HelpCircle size={17} strokeWidth={2.3} aria-hidden="true" />
              </button>
            </>
          }
        />
      )}

      <Sheet open={helping} onClose={() => setHelping(false)} title="Si funksionon gazeta jote" titleId="perty-help-title">
        <ol className="perty-help-list">
          <li>
            <b>E bëre ti.</b> Nga ato që zgjodhe{followNames.length ? ` — ${followNames.join(", ")}` : ""} — secila merr faqen e vet.
          </li>
          <li>
            <b>Mbushet vetë.</b> Çdo mëngjes faqet kanë lajmet më të reja për to.
          </li>
          <li>
            <b>Të njeh.</b> Mëson nga sa lexon çdo lajm. Tani është {lookInfo?.name.toLowerCase() ?? "e përditshme"}: {lookInfo?.about}.
          </li>
          <li>
            <b>Pse e sheh?</b> Rreshti i ngjyrosur mbi çdo lajm të tregon arsyen. Prek atë për më shumë ose më pak si ai.
          </li>
          <li>
            <b>Kthe faqen</b> duke e tërhequr, duke klikuar anën e saj, me rrotëz, me ← → ose duke rrëshqitur me gisht.
          </li>
        </ol>
        <p className="perty-help-privacy">Të gjitha ruhen vetëm në këtë pajisje.</p>
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
