"use client";

// The personal paper, and the onboarding that leads into it.
//
// Guest-first: everything works with no account, backed by the choices stored
// on this device (lib/interests.mjs). Signing in merges and syncs them across
// devices (lib/interests-sync.ts) — it is offered after the paper appears,
// never asked for before it.
//
// It is the reader's own newspaper, photocopied and handed to them, read page
// by page over one coffee and then closed (app/per-ty/paper/newspaper.tsx):
//
//   Faqja 1   the front page — their title, the lead under the giant word of
//             why it leads, the next stories in columns, "Në këtë numër", the
//             town box and Dardani's thirty seconds;
//   Faqja 2…  "Më shumë nga sot" when the edition runs long, then one page per
//             thing they follow, in their order;
//   last      "Kaq për sot": sharing, tomorrow's 07:00 edition, the follows
//             that had nothing this week, and how the paper works.
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
import { ArrowRight, HelpCircle, MessageCircleQuestion, Share2, SlidersHorizontal, X } from "lucide-react";
import { readInterests, writeInterests, hasInterests, nudgeAffinity, readingStats, type Interests } from "@/lib/interests.mjs";
import { articleKeys, rankFeed } from "@/lib/per-ty-rank.mjs";
import { buildPaper, coverWord } from "@/lib/per-ty-paper.mjs";
import { moveKey, readPrefs, writePrefs, type PaperPrefs } from "@/lib/paper-prefs.mjs";
import { cityById } from "@/lib/cities.mjs";
import { nextStreak, STREAK_KEY } from "@/lib/perty-streak.mjs";
import { forgetVisits, readSlugs, recordVisit } from "@/lib/perty-visits.mjs";
import { daysWithUs, forgetLedger, kosovoParts, noteVisit, readLedger, summarize } from "@/lib/reader-ledger.mjs";
import { defaultTitle, paperTitle, readName, writeName } from "@/lib/reader-name.mjs";
import { absence, followUp } from "@/lib/perty-dardani-line.mjs";
import { lastMonth, monthLabel } from "@/lib/monthly-wrapped.mjs";
import { hasLearnedPaper, isLearnedPaper, learnedPicks, setLearnedPaper, totalReads } from "@/lib/perty-learned.mjs";
import { kosovoDateKey } from "@/lib/home-tregu.mjs";
import { editionName, lookById, readingMix, readingPace, readLookState, resolveLook, writeLookState, type LookId } from "@/lib/paper-look.mjs";
import { FRONT_STORIES, paperPages } from "@/lib/paper-pages.mjs";
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
import Masthead from "./paper/masthead";
import { dateline } from "./paper/cover";
import { AllReadCheer, DardaniBrief, NumbersBox, TownToday, TreguBox } from "./paper/boxes";
import CustomizeSheet from "./paper/customize-sheet";
import ShareSheet, { type ShareablePaper } from "./paper/share-sheet";
import Newspaper, { type NewspaperPage } from "./paper/newspaper";
import { BackSheet, FrontSheet, MoreSheet, SectionSheet, type PaperMeta, type PaperStory } from "./paper/pages";
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
/** Set once the reader has read (or closed) "Si funksionon gazeta jote". */
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

/** "Sporti" → "gazetë sporti", for the slip that says the paper changed. */
const LOOK_NOUN: Record<LookId, string> = {
  "e-perditshme": "e përditshme serioze",
  sporti: "gazetë sporti",
  tabloid: "tabloid",
  bota: "botim ndërkombëtar",
  biznes: "gazetë biznesi",
};

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
  // account's), the number of days they have come, and how long they were away.
  const [deviceName, setDeviceName] = useState("");
  const [naming, setNaming] = useState(false);
  const [issue, setIssue] = useState(0);
  const [monthReads, setMonthReads] = useState(0);
  const [away, setAway] = useState<{ missed: number; last: string } | null>(null);
  const [edition, setEdition] = useState("Botimi i mëngjesit");
  // The first week of a month, last month's wrapped ("Tetori në 383") is offered.
  const [wrappedMonth, setWrappedMonth] = useState<string | null>(null);
  // A guest with reading behind them is shown the paper Dardani made from it
  // (components/paper-reveal) before the three questions; this is "Zgjidh vetë".
  const [chooseMyself, setChooseMyself] = useState(false);
  const [readsSoFar, setReadsSoFar] = useState(0);
  // The paper was built from reading, not chosen: Dardani asks once if he got it right.
  const [learned, setLearned] = useState(false);
  // "Si funksionon gazeta jote": open the first time, and whenever asked.
  const [howto, setHowto] = useState(false);
  // The paper's kind as stored, and the change to announce, if it just changed.
  const [lookState, setLookState] = useState<ReturnType<typeof readLookState>>(null);
  const [lookChange, setLookChange] = useState<null | { from: LookId; to: LookId; share: number }>(null);
  const shownTimer = useRef<number | null>(null);

  useEffect(() => {
    const stored = readInterests();
    setInterests(stored);
    setPrefs(readPrefs());
    setDeviceName(readName());
    setReadsSoFar(totalReads(readLedger()));
    setLearned(isLearnedPaper());
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
    setAway(absence(ledger, parts.date));
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
      if (lookResult.changed) setLookChange(lookResult.changed);
    }
  }, [lookResult, lookState]);

  const pace = useMemo(() => (interests ? readingPace(interests) : "medium"), [interests]);

  // What a shared copy carries: the edition, the first four visible sections
  // with stories, two each, and the paper's kind.
  const shareable = useMemo<ShareablePaper>(
    () => ({
      title: prefs?.title || defaultTitle(deviceName || name),
      leadKey: paper.edition[0]?.primaryKey ?? "",
      look,
      edition: paper.edition.map((i) => i.article.slug),
      sections: paper.sections
        .filter((s) => !s.empty)
        .slice(0, 4)
        .map((s) => ({ key: s.key, slugs: s.items.slice(0, 2).map((i) => i.article.slug) })),
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
    (index: number) => {
      if (shownTimer.current) window.clearTimeout(shownTimer.current);
      const page = pages[index];
      if (!page) return;
      const items =
        page.kind === "front"
          ? [page.lead, ...page.stories].filter(Boolean)
          : page.kind === "more"
            ? page.stories
            : page.kind === "section"
              ? page.section.items.map((i) => ({ article: i.article, primaryKey: page.section.key }))
              : [];
      shownTimer.current = window.setTimeout(() => {
        const list = items
          .map((i) => ({ slug: i!.article.slug, key: (i as { primaryKey?: string }).primaryKey ?? "" }))
          .filter((i) => i.key.includes(":"));
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
            setLearned(true);
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
            setLearned(false);
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
  // One thing Dardani noticed, or nothing: being away first, then a story that
  // continues one the reader already read.
  const next = away ? null : followUp(ed, pool, read);
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
    onRename: () => setNaming(true),
    motto: lookInfo?.motto ?? "",
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
  const closeHowto = () => {
    setFlag(HOWTO_KEY);
    setHowto(false);
  };

  // Notes clipped above the front page, most important first, at most a few.
  const notes = (
    <>
      {howto && (
        <aside className="np-note" aria-labelledby="np-howto-title">
          <h2 id="np-howto-title">Kjo është gazeta jote.</h2>
          <ol>
            <li>
              E bëmë nga ato që zgjodhe{followNames.length ? `: ${followNames.join(", ")}` : ""}.
            </li>
            <li>Çdo ditë mbushet vetë me lajmet e reja për to. Sa më shumë lexon, aq më mirë të njeh.</li>
            <li>Mbi çdo lajm, një shënim i kuq të tregon pse është aty. Prek shënimin për më shumë ose më pak si ai.</li>
            <li>Kthe faqen me shigjetat, me këndin poshtë djathtas, ose duke rrëshqitur me gisht.</li>
          </ol>
          <div className="np-note-actions">
            <button type="button" className="np-btn" onClick={closeHowto}>
              E kuptova, fillo leximin
            </button>
          </div>
        </aside>
      )}
      {naming && (
        <aside className="np-note">
          <Masthead
            name={displayName}
            now={now}
            naming={naming}
            setNaming={setNaming}
            onRename={(value) => setDeviceName(writeName(value))}
          />
        </aside>
      )}
      {lookChange && (
        <p className="np-slip" role="status">
          <span>
            Gazeta jote tani është {LOOK_NOUN[lookChange.to]} — sepse rreth {lookChange.share}% të kohës lexon për{" "}
            {lookById(lookChange.to)?.cats.join(" e ")}.
          </span>
          <button type="button" onClick={() => setLookChange(null)}>
            Mbaje kështu
          </button>
          <button
            type="button"
            onClick={() => {
              savePrefs({ ...prefs, look: lookChange.from });
              setLookChange(null);
            }}
          >
            Ktheje si ishte
          </button>
        </p>
      )}
      {learned && (
        <p className="np-slip" role="status">
          <span>Këtë gazetë e bëra nga ajo që lexove. A e kam qëlluar?</span>
          <button
            type="button"
            onClick={() => {
              setLearnedPaper(false);
              setLearned(false);
            }}
          >
            Po
          </button>
          <button type="button" onClick={() => setEditing(true)}>
            Ndrysho
          </button>
        </p>
      )}
      {(away || next) && (
        <p className="np-slip" role="status">
          {away ? (
            <span>Mungove {away.missed} ditë! Të kam mbajtur më të rëndësishmet këtu.</span>
          ) : next ? (
            <span>
              E ke lexuar «{next.before.title}». Sot ka vazhdim: <Link href={`/article/${next.after.slug}`}>{next.after.title}</Link>
            </span>
          ) : null}
        </p>
      )}
      {wrappedMonth && (
        <p className="np-slip">
          <Link href={`/muaji/${wrappedMonth}`}>
            {monthLabel(wrappedMonth)?.definite} në 383 është gati →
          </Link>
        </p>
      )}
      {storageFailed && (
        <p className="np-slip" role="status">
          Shfletuesi yt nuk lejon ruajtjen e zgjedhjeve, ndaj ato vlejnë vetëm për këtë vizitë.
        </p>
      )}
      {showSignup && (
        <p className="np-slip">
          <span>Zgjedhjet ruhen në këtë pajisje. Me llogari, i ke njësoj në telefon dhe kompjuter.</span>
          <Link href="/hyr?tab=regjistrohu&next=/per-ty">Regjistrohu</Link>
          <button
            type="button"
            aria-label="Mbyll"
            onClick={() => {
              setFlag(SIGNUP_DISMISSED);
              setSignupDismissed(true);
            }}
          >
            <X size={16} strokeWidth={2.4} aria-hidden="true" />
          </button>
        </p>
      )}
    </>
  );

  const rail = (
    <>
      {boxes.city && <TownToday homeId={home} story={townStory} onPickCity={() => setEditing(true)} />}
      {boxes.brief && briefSlugs.length >= 2 && <DardaniBrief slugs={briefSlugs} />}
      {boxes.numbers && <NumbersBox today={dayCount} days={issue} streak={streak} reads={monthReads} />}
      {boxes.tregu && <TreguBox />}
    </>
  );

  const go = (n: number) => {
    window.location.hash = `faqja-${n}`;
  };

  const sheets: NewspaperPage[] = pages.map((page) => {
    if (page.kind === "front") {
      const lead = page.lead ? story(page.lead) : null;
      return {
        key: page.key,
        title: page.title,
        node: (
          <FrontSheet
            meta={meta}
            lead={lead}
            leadWord={page.lead ? coverWord(page.lead.article, page.lead.primaryKey) : ""}
            stories={page.stories.map(story)}
            contents={page.contents}
            onJump={go}
            rail={rail}
            before={notes}
            stamp={
              <>
                <b>Kopje personale</b>
                vetëm për {displayName || "ty"}
              </>
            }
          />
        ),
      };
    }
    if (page.kind === "more") {
      return {
        key: page.key,
        title: page.title,
        node: <MoreSheet meta={meta} n={page.n} stories={page.stories.map(story)} from={2 + FRONT_STORIES} />,
      };
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
            stories={s.items.map((i) => ({
              article: i.article,
              why: i.fromShelf
                ? { short: `Nga ${s.title}, kjo javë s'pati më të reja`, long: `Për ${s.title} këtë javë ka pasur pak lajme, ndaj këtu janë më të fundit nga muaji.`, key: s.key, picked: true }
                : whyLine({ article: i.article, kind: s.kind, primaryKey: s.key }, interests),
            }))}
          />
        ),
      };
    }
    return {
      key: page.key,
      title: page.title,
      node: (
        <BackSheet meta={meta} n={page.n}>
          <div className="np-back-end">
            {allRead ? <AllReadCheer /> : <DardaniImage name="wave" decorative className="perty-end-img" />}
            <h2>{allRead ? "E mbarove!" : "Kaq për sot."}</h2>
            <p>
              {allRead
                ? "I ke lexuar të gjitha. Ndaje me dikë që i pëlqejnë të njëjtat gjëra — shihemi nesër!"
                : `Këto ishin lajmet e tua për sot${readCount ? `: ${readCount} nga ${ed.length} i ke lexuar` : ""}. Shihemi nesër!`}
            </p>
            <div className="np-back-actions">
              {canShare && (
                <button type="button" className="np-btn np-btn--spot" onClick={() => setSharing(true)}>
                  <Share2 size={17} strokeWidth={2.4} aria-hidden="true" />
                  Ndaje gazetën tënde
                </button>
              )}
              <button type="button" className="np-btn np-btn--ghost" onClick={() => setCustomizing(true)}>
                <SlidersHorizontal size={16} strokeWidth={2.3} aria-hidden="true" />
                Rregullo gazetën
              </button>
            </div>
            <MorningPush />
            {streak >= 2 && (
              <p className="np-text">
                <b>{streak} ditë rresht.</b> Kthehu nesër që të mos e prishësh.
              </p>
            )}
            <div className="np-back-actions">
              <Link href="/" className="np-btn np-btn--ghost">
                Kryesoret e ditës <ArrowRight size={16} strokeWidth={2.4} aria-hidden="true" />
              </Link>
              <button
                type="button"
                className="np-btn np-btn--ghost"
                onClick={() => openPyet(firstUnread ? `Pse ndodhi kjo: ${firstUnread.article.title}` : undefined)}
              >
                <MessageCircleQuestion size={16} strokeWidth={2.3} aria-hidden="true" />
                Pyet Dardanin
              </button>
            </div>
          </div>
          <div>
            {page.quiet.length > 0 && (
              <section className="np-box" style={{ marginBottom: 20 }}>
                <h3 className="np-box-title">Pa lajme këtë javë</h3>
                <ul className="np-quiet">
                  {page.quiet.map((s) => (
                    <li key={s.key}>
                      <b>{s.title}:</b>{" "}
                      {s.kind === "person"
                        ? `këtë javë s'ka pasur lajme. Të them sapo të ketë.`
                        : s.kind === "city"
                          ? `këtë javë s'kemi shkruar për ${s.title}.`
                          : `redaksia s'ka shkruar këtë muaj.`}
                    </li>
                  ))}
                </ul>
              </section>
            )}
            <section className="np-box" style={{ marginBottom: 20 }}>
              <h3 className="np-box-title">Si funksionon gazeta jote</h3>
              <ol className="np-howto-list">
                <li>Zgjodhe tema, njerëz dhe qytete. Secili merr faqen e vet.</li>
                <li>Çdo mëngjes faqet mbushen me lajmet më të reja për to.</li>
                <li>
                  Gazeta mëson nga sa minuta lexon çdo lajm. Tani është {lookInfo?.name.toLowerCase() ?? "e përditshme"}: {lookInfo?.about}.
                </li>
                <li>Shënimi i kuq mbi çdo lajm thotë pse është aty.</li>
              </ol>
              <button type="button" className="perty-text-btn" onClick={() => setEditing(true)} style={{ marginTop: 10 }}>
                Ndrysho çka ndjek
              </button>
            </section>
            <p className="np-privacy">
              Gazeta jote mëson nga ajo që lexon dhe sa gjatë e lexon, dhe mban mend çka ke hapur — vetëm në këtë pajisje.
              Për përmbledhjen, Dardanit i dërgohen vetëm adresat e lajmeve, asnjë e dhënë për ty.
            </p>
            {(Object.keys(interests.affinity).length > 0 || read.size > 0) && (
              <button
                type="button"
                className="perty-text-btn"
                onClick={() => {
                  save({ ...interests, affinity: {} });
                  forgetVisits();
                  forgetLedger();
                  writeShown(null);
                  setRead(new Set());
                  setSince(null);
                }}
              >
                Harro historikun e leximit
              </button>
            )}
          </div>
        </BackSheet>
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
          hint={howto || justFinished}
          onPageShown={onPageShown}
          tools={
            <>
              {canShare && (
                <button type="button" className="np-tool" onClick={() => setSharing(true)}>
                  <Share2 size={16} strokeWidth={2.4} aria-hidden="true" />
                  Ndaje
                </button>
              )}
              <button type="button" className="np-tool" onClick={() => setCustomizing(true)}>
                <SlidersHorizontal size={16} strokeWidth={2.4} aria-hidden="true" />
                Rregullo
              </button>
              <button
                type="button"
                className="np-tool np-tool--quiet"
                onClick={() => {
                  setHowto(true);
                  window.location.hash = "faqja-1";
                }}
              >
                <HelpCircle size={16} strokeWidth={2.4} aria-hidden="true" />
                Si funksionon?
              </button>
            </>
          }
        />
      )}

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
