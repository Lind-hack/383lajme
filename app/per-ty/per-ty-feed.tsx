"use client";

// The personal feed, and the onboarding that leads into it.
//
// Guest-first: everything works with no account, backed by the choices stored
// on this device (lib/interests.mjs). Signing in merges and syncs them across
// devices (lib/interests-sync.ts) — it is offered after the feed appears, never
// asked for before it.
//
// It is a morning edition, read over one coffee and then closed:
//
//   1. a one-block masthead: "Mirëmëngjes, Lind", the date, how long this
//      takes, the reader's town (weather, or the border waits for the diaspora);
//   2. "Në 30 sekonda": Dardani's three lines on this edition;
//   3. "Duhet ta dish sot": the one or two stories every reader should know,
//      whatever they follow (lib/per-ty-must-know);
//   4. "Për ty sot": one numbered list of seven stories (lib/per-ty-edition),
//      read ones kept in place so "3 / 7 lexuar" can move; each says in one
//      line why it is there (lib/perty-why), carries Dardani's two or three
//      sentences so it can be read without opening it (lib/story-summary),
//      and can be turned down ("Më pak si kjo") for the next visit;
//   5. "Kaq për sot": the end — the streak, tomorrow's 07:00 edition, and the
//      follows the week had nothing for, said plainly rather than padded;
//   6. "Më shumë", folded, for anyone who wants to keep going.
//
// On a phone that is one column, in that order. On a laptop or desktop it
// becomes a front page across the whole width: the lead big with the six
// below it on the left; Dardani's lines, the reader's town and the end on the
// right; then one column per thing they follow (lib/per-ty-paper sections)
// in place of the folded "Më shumë".
//
// The reel this replaced (app/per-ty/paper/reel.tsx and its slides) is parked,
// not deleted: it is meant to come back as a row of reels on the homepage.
//
// Visits, reads and tastes are remembered on the device only. GA4 hears what
// was shown, opened and passed over — slug, place, kind, nothing about the
// reader — once they have accepted analytics (lib/perty-measure).

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  ArrowRight,
  BellRing,
  Check,
  Coffee,
  Flame,
  MapPin,
  SlidersHorizontal,
  ThumbsDown,
  UserRound,
  X,
} from "lucide-react";
import TimeAgo from "@/components/time-ago";
import { getCategoryColor } from "@/lib/category-colors";
import { readInterests, writeInterests, hasInterests, nudgeAffinity, recordRead, type Interests } from "@/lib/interests.mjs";
import { articleKeys, rankFeed, type RankedItem } from "@/lib/per-ty-rank.mjs";
import { buildEdition, groupEdition, readingMinutes } from "@/lib/per-ty-edition.mjs";
import { editionDay, followSignature, newForYou, pickDaily, readDaily, writeDaily } from "@/lib/per-ty-daily.mjs";
import { mustKnow } from "@/lib/per-ty-must-know.mjs";
import { buildPaper, quietFollows } from "@/lib/per-ty-paper.mjs";
import { cityById } from "@/lib/cities.mjs";
import { nextStreak, STREAK_KEY } from "@/lib/perty-streak.mjs";
import { forgetVisits, isNewSince, readSlugs, recordVisit } from "@/lib/perty-visits.mjs";
import { personById } from "@/lib/people.mjs";
import { forgetLedger, kosovoParts, noteVisit, readLedger } from "@/lib/reader-ledger.mjs";
import { readName } from "@/lib/reader-name.mjs";
import { lastMonth, monthLabel } from "@/lib/monthly-wrapped.mjs";
import { hasLearnedPaper, learnedPicks, setLearnedPaper, totalReads } from "@/lib/perty-learned.mjs";
import { kosovoDateKey } from "@/lib/home-tregu.mjs";
import { greeting } from "@/lib/perty-personal.mjs";
import { keyLabel, whyLine } from "@/lib/perty-why.mjs";
import { noteShown, readShown, settleSkips, writeShown } from "@/lib/perty-skips.mjs";
import { noteClick, trackPerty, type PertyList } from "@/lib/perty-measure";
import type { CityWeather } from "@/lib/weather";
import { forgetAccountAffinity, mergeOnSignIn, pushInterests } from "@/lib/interests-sync";
import { createClient } from "@/lib/supabase/client";
import DardaniLoop from "@/components/dardani/dardani-loop";
import DardaniImage from "@/components/dardani/dardani-image";
import DardaniFace from "@/components/dardani/dardani-face";
import CoinFace from "@/components/tregu/coin-face";
import PaperReveal from "@/components/paper-reveal";
import Onboarding from "./onboarding";
import MorningPush from "./morning-push";
import { TownToday } from "./paper/boxes";
import "./edition.css";

export type FeedArticle = {
  slug: string;
  title: string;
  excerpt: string;
  category: string;
  city?: string;
  source: string;
  publishedAt: string;
  imageUrl?: string;
  /** Measured width of imageUrl, when known (lib/image-size.mjs). */
  imageWidth?: number;
  engagementScore?: number;
  /** "person:<id>" / "city:<id>" the server found in the full text (lib/per-ty-rank storyTags). */
  tags?: string[];
  /** Dardani's two or three sentences (lib/story-summary), or the story's own when his failed the checks. */
  summary?: string;
  summaryByDardani?: boolean;
  /** The newsroom's clay illustration of the story, when it has one (lib/cover-art). Used only without a photo. */
  coverArt?: string | null;
};

type Item = RankedItem<FeedArticle>;

/** What a row needs to know about this reader's history with the story. */
type Seen = { since: string | null; read: ReadonlySet<string> };

const SIGNUP_DISMISSED = "383:perty-signup-dismissed";
/** sessionStorage: the visit whose arrival has already played. */
const ARRIVED_KEY = "383:perty-arrived";
/** Deep enough for "Më shumë" and for knowing which follows the week covered. */
const RANK_LIMIT = 200;
/** "Më shumë për ty": headlines shown under an opened follow. */
const MORE_PER_FOLLOW = 5;
/** "Më pak si kjo": about two-thirds of a full read, taken off. */
const TASTE_STEP = 1.2;
/** How far back "the newest story from your town" may reach. */
const TOWN_STORY_MS = 48 * 3600_000;
/** On screen this long (and at least half visible), a row counts as shown. */
const SHOWN_AFTER_MS = 1000;
/**
 * A summary on screen this long (and at least half visible) counts as read
 * here: about two sentences at reading pace. Reading the story in Për ty is
 * the point now, so it must teach the ranking, not count as passing it over.
 */
const SUMMARY_READ_MS = 4000;
/** What reading a summary is worth against a full read of the article (1). */
const SUMMARY_READ_WEIGHT = 0.25;

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

const WEEKDAYS = ["e diel", "e hënë", "e martë", "e mërkurë", "e enjte", "e premte", "e shtunë"];
const MONTHS = ["janar", "shkurt", "mars", "prill", "maj", "qershor", "korrik", "gusht", "shtator", "tetor", "nëntor", "dhjetor"];

/**
 * "e martë, 30 shtator", by the Kosovo calendar. Spelled out rather than left to
 * Intl's "sq" locale, which some browsers ship without and fall back to English.
 */
function dateline(now: Date) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", { timeZone: "Europe/Belgrade", weekday: "short", day: "numeric", month: "numeric" })
      .formatToParts(now)
      .map((p) => [p.type, p.value])
  );
  const weekday = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(parts.weekday);
  return `${WEEKDAYS[weekday] ?? ""}, ${parts.day} ${MONTHS[Number(parts.month) - 1] ?? ""}`;
}

/** The first name a signed-in reader gave, if any. */
function firstName(meta: Record<string, unknown> | undefined) {
  const raw = [meta?.first_name, meta?.full_name, meta?.name].find((v) => typeof v === "string" && v.trim());
  const first = typeof raw === "string" ? raw.trim().split(/\s+/)[0] : "";
  return first.length > 1 && first.length <= 24 ? first : "";
}

/** The key "Më pak si kjo" turns down: the follow behind the pick, or the story's topic for a top story. */
function tasteKey(item: Item) {
  if (item.primaryKey?.includes(":")) return item.primaryKey;
  return item.article.category ? `cat:${item.article.category}` : null;
}

/** A group's heading in the panel: the follow, as the reader would say it. */
function groupTitle(group: { key: string; kind: string }, home: string | null) {
  if (group.kind === "learned") return "Nga ajo që lexon";
  if (group.kind === "top") return "Kryesoret e ditës";
  const label = keyLabel(group.key) ?? group.key;
  return group.key === `city:${home}` ? `${label} · qyteti yt` : label;
}

/** The dot beside a group's heading: the topic's own colour, the paper's accent for people and towns. */
function groupColor(group: { key: string; kind: string }) {
  if (group.kind === "category") return getCategoryColor(group.key.replace(/^cat:/, ""));
  if (group.kind === "person" || group.kind === "city") return "var(--pp-accent)";
  return "var(--pp-faint)";
}

export default function PerTyFeed({ pool }: { pool: FeedArticle[] }) {
  const [interests, setInterests] = useState<Interests | null>(null);
  const [editing, setEditing] = useState(false);
  const [justFinished, setJustFinished] = useState(false);
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [name, setName] = useState("");
  const [deviceName, setDeviceName] = useState("");
  const [signupDismissed, setSignupDismissed] = useState(true);
  const [storageFailed, setStorageFailed] = useState(false);
  const [streak, setStreak] = useState(0);
  // Set once this visit has been noted (streak, "new" line), so what GA hears carries it.
  const [visited, setVisited] = useState(false);
  const [now, setNow] = useState<Date | null>(null);
  const [since, setSince] = useState<string | null>(null);
  const [read, setRead] = useState<ReadonlySet<string>>(new Set());
  // Rows turned down this visit (slug → key), shown as such until the next one.
  const [less, setLess] = useState<ReadonlyMap<string, string>>(new Map());
  // The first week of a month, last month's wrapped ("Tetori në 383") is offered.
  const [wrappedMonth, setWrappedMonth] = useState<string | null>(null);
  // A guest with reading behind them is shown the paper Dardani made from it
  // (components/paper-reveal) before the three questions; this is "Zgjidh vetë".
  const [chooseMyself, setChooseMyself] = useState(false);
  const [readsSoFar, setReadsSoFar] = useState(0);
  const [animateArrival, setAnimateArrival] = useState(false);

  useEffect(() => {
    setInterests(readInterests());
    setDeviceName(readName());
    setReadsSoFar(totalReads(readLedger()));
    setSignupDismissed(readFlag(SIGNUP_DISMISSED));
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

  // A visit counts towards the streak only once there is a feed to visit. The
  // same moment fixes the line "new" is measured from for this visit, and
  // settles what was shown on an earlier day and never opened.
  useEffect(() => {
    if (!ready) return;
    const visitSince = recordVisit();
    setSince(visitSince);
    // The arrival plays once per visit: coming back from a story within the
    // same visit keeps the same "since", and must not replay it.
    try {
      const mark = visitSince ?? "first";
      setAnimateArrival(sessionStorage.getItem(ARRIVED_KEY) !== mark);
      sessionStorage.setItem(ARRIVED_KEY, mark);
    } catch {
      setAnimateArrival(false);
    }
    const readNow = new Set(readSlugs());
    setRead(readNow);
    noteVisit();
    if (kosovoParts().day <= 7) setWrappedMonth(lastMonth());
    try {
      const next = nextStreak(JSON.parse(localStorage.getItem(STREAK_KEY) ?? "null"));
      localStorage.setItem(STREAK_KEY, JSON.stringify(next));
      setStreak(next.count);
    } catch {
      setStreak(0);
    }
    const { penalties, log } = settleSkips(readShown(), readNow, kosovoDateKey());
    const keys = Object.keys(penalties ?? {});
    if (keys.length) {
      const current = readInterests();
      let affinity = current.affinity;
      for (const key of keys) affinity = nudgeAffinity(affinity, key, -penalties[key]);
      writeInterests({ ...current, affinity });
      setInterests((prev) => (prev ? { ...prev, affinity } : prev));
    }
    if (!log) writeShown(null);
    setVisited(true);
  }, [ready]);

  const feed = useMemo<Item[]>(
    () => (interests && hasInterests(interests) ? rankFeed(pool, interests, { limit: RANK_LIMIT }) : []),
    [pool, interests]
  );

  // The day's one or two must-knows, kept out of the reader's own seven. Fixed
  // by what was read before this visit, so a story opened now stays put.
  const mustToday = useMemo(
    () => (visited && now ? mustKnow(pool, { now: now.getTime(), read }) : []),
    [pool, visited, now, read]
  );
  const homeFrom = cityById(home)?.from ?? null;
  // Today's paper (lib/per-ty-daily): built once a day from the ranking, minus
  // what was already read, then the same seven all day; matches that arrive
  // later come in on top as "fresh".
  const daily = useMemo(() => {
    if (!visited || !now || !interests) return null;
    const skip = new Set(mustToday.map((a) => a.slug));
    return pickDaily(readDaily(), {
      day: editionDay(now.getTime()),
      signature: followSignature(interests),
      ranked: feed.filter((i) => !skip.has(i.article.slug)),
      read,
      now: now.getTime(),
      // The must-know band carries the day now, so the general top stories only
      // fill the places the reader's own stories leave empty.
      build: (candidates) => buildEdition(candidates, { homeFrom, fillKinds: ["top"] }).edition,
    });
  }, [visited, now, interests, mustToday, feed, read, homeFrom]);
  useEffect(() => {
    if (daily?.rebuilt) writeDaily(daily.record);
  }, [daily]);
  const edition = useMemo(() => daily?.edition ?? [], [daily]);
  const fresh = useMemo(() => daily?.fresh ?? [], [daily]);
  // A must-know that is already one of today's seven is not shown twice.
  const must = useMemo(() => {
    const inEdition = new Set([...edition, ...fresh].map((i) => i.article.slug));
    return mustToday.filter((a) => !inEdition.has(a.slug));
  }, [mustToday, edition, fresh]);
  const minutes = readingMinutes([...must.map((article) => ({ article })), ...edition]);
  // The panel files the seven under what the reader follows (lib/per-ty-edition groupEdition).
  const groups = useMemo(() => groupEdition(edition), [edition]);
  // The wide screen's columns: one per follow, never repeating the seven.
  // Nothing already in the panel or the must-know band, and no column left empty by that.
  const sections = useMemo(() => {
    if (!interests) return [];
    const shown = new Set([...edition, ...fresh].map((i) => i.article.slug).concat(must.map((a) => a.slug)));
    return buildPaper(feed, interests, null, { homeFrom })
      .sections.map((sec) => ({ ...sec, items: sec.items.filter((it) => !shown.has(it.article.slug)) }))
      .filter((sec) => sec.items.length > 0);
  }, [feed, interests, homeFrom, edition, fresh, must]);
  // The newest story from the reader's town in the last two days, for the
  // town box. Matched the way the ranking matches a town.
  const townStory = useMemo(() => {
    if (!home || !now) return null;
    const key = `city:${home}`;
    const from = now.getTime() - TOWN_STORY_MS;
    let best: FeedArticle | null = null;
    // Not one the edition already shows.
    const shown = new Set(edition.map((i) => i.article.slug));
    for (const a of pool) {
      const t = Date.parse(a.publishedAt);
      if (shown.has(a.slug) || !(t >= from) || (best && t <= Date.parse(best.publishedAt))) continue;
      if (articleKeys(a).includes(key)) best = a;
    }
    return best ? { slug: best.slug, title: best.title } : null;
  }, [pool, home, now, edition]);
  // Against the whole week, not just what ranked: a follow is quiet only if no story named it.
  const poolKeys = useMemo(() => pool.map((a) => ({ keys: articleKeys(a) })), [pool]);
  const quiet = useMemo(() => (interests ? quietFollows(poolKeys, interests) : []), [poolKeys, interests]);

  // Once per visit, what the reader was given.
  const viewSent = useRef(false);
  useEffect(() => {
    if (!visited || viewSent.current || !interests) return;
    viewSent.current = true;
    trackPerty("perty_view", {
      stories: edition.length,
      follows: interests.categories.length + interests.people.length + interests.cities.length,
      quiet: quiet.length,
      streak,
    });
  }, [visited, interests, edition.length, quiet.length, streak]);

  // A row on screen a moment counts as shown: GA hears it once, and tomorrow
  // the ones never opened teach the ranking a little (lib/perty-skips).
  const shownOnce = useRef(new Set<string>());
  const onShown = useCallback((item: Item, position: number, list: PertyList) => {
    const slug = item.article.slug;
    if (shownOnce.current.has(slug)) return;
    shownOnce.current.add(slug);
    trackPerty("perty_impression", { slug, position, kind: item.kind, list });
    if (item.primaryKey?.includes(":")) {
      writeShown(noteShown(readShown(), kosovoDateKey(), [{ slug, key: item.primaryKey }]));
    }
  }, []);

  // A summary read in place: a light read for the story's keys, and no longer
  // a story passed over (lib/perty-skips). Once per story per visit.
  const summaryRead = useRef(new Set<string>());
  const onSummaryRead = useCallback((article: FeedArticle, position: number, list: PertyList) => {
    if (!article.summary || summaryRead.current.has(article.slug)) return;
    summaryRead.current.add(article.slug);
    trackPerty("perty_summary_read", { slug: article.slug, position, list });
    // A must-know is put in front of everyone; reading it says nothing about taste.
    if (list === "must") return;
    const log = readShown();
    if (log) writeShown({ ...log, items: log.items.filter((i) => i.slug !== article.slug) });
    const keys = articleKeys(article);
    if (!keys.length) return;
    // Straight to storage, not into this visit's ranking: the list never reshuffles under the reader's thumb.
    const current = readInterests();
    writeInterests({ ...current, affinity: recordRead(current.affinity, keys, Date.now(), SUMMARY_READ_WEIGHT) });
  }, []);

  // A must-know is not a taste: GA hears it, the skip lesson never does.
  const onMustShown = useCallback((slug: string, position: number) => {
    if (shownOnce.current.has(slug)) return;
    shownOnce.current.add(slug);
    trackPerty("perty_impression", { slug, position, kind: "must", list: "must" });
  }, []);

  function save(next: Interests) {
    if (!writeInterests(next)) setStorageFailed(true);
    const stored = readInterests();
    // If storage refused the write, keep the choice for this visit anyway.
    const current = hasInterests(stored) || !hasInterests(next) ? stored : next;
    setInterests(current);
    if (signedIn) pushInterests(current);
  }

  // "Më pak si kjo", and its undo. Saved straight to storage, not into this
  // visit's ranking: the list never reshuffles under the reader's thumb.
  const toggleLess = (item: Item, position: number) => {
    const key = tasteKey(item);
    if (!key) return;
    const undo = less.has(item.article.slug);
    const current = readInterests();
    if (hasInterests(current)) {
      if (!writeInterests({ ...current, affinity: nudgeAffinity(current.affinity, key, undo ? TASTE_STEP : -TASTE_STEP) })) {
        setStorageFailed(true);
      }
    }
    setLess((prev) => {
      const next = new Map(prev);
      if (undo) next.delete(item.article.slug);
      else next.set(item.article.slug, key);
      return next;
    });
    if (!undo) trackPerty("perty_less", { slug: item.article.slug, position, kind: item.kind, key });
  };

  // Before mount the device choices are unknown; render nothing rather than
  // flashing onboarding at a reader who already has a feed.
  if (!interests || !now) return <div className="perty-shell perty-shell--loading" aria-busy="true" />;

  // Reading behind them but nothing chosen: Dardani's picks first, the
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
          // "Zgjidh vetë" after Dardani's picks starts from what he noticed.
          initial={chooseMyself && !hasInterests(interests) ? { ...interests, ...learnedPicks(interests.affinity) } : interests}
          editing={editing}
          onCancel={() => setEditing(false)}
          onDone={(chosen) => {
            save({ ...interests, ...chosen });
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

  // Today's paper is assembled right after mount (the visit is noted first);
  // until then, the quiet shell rather than a flash of "nothing for you".
  if (!daily) return <div className="perty-shell perty-shell--loading" aria-busy="true" />;

  const who = (deviceName || name).trim().split(/\s+/)[0]?.slice(0, 24) ?? "";

  const showSignup = justFinished && signedIn === false && !signupDismissed;
  const seen: Seen = { since, read };
  const readCount = edition.filter((i) => read.has(i.article.slug)).length;
  const allRead = edition.length > 0 && readCount === edition.length;
  // "N të reja për ty": unread, and out since the last visit. Nothing on a first visit.
  const newCount = newForYou([...fresh, ...edition], since, read);
  // Rows that arrived since the last visit enter one after another, in reading order.
  const arrivalOrder = new Map(
    (animateArrival ? [...fresh, ...edition] : [])
      .filter((i) => !read.has(i.article.slug) && isNewSince(i.article, since))
      .map((i, n) => [i.article.slug, n])
  );
  // Dardani's three lines are written from this edition, the stories not yet read.
  const briefSlugs = [
    ...must.map((a) => a.slug),
    ...edition.filter((i) => !read.has(i.article.slug)).map((i) => i.article.slug),
  ].slice(0, 6);
  const positionOf = new Map(edition.map((i, n) => [i.article.slug, n + 1]));

  const forget = () => {
    save({ ...interests, affinity: {} });
    forgetVisits();
    forgetLedger();
    writeShown(null);
    writeDaily(null);
    if (signedIn) void forgetAccountAffinity();
    setRead(new Set());
    setSince(null);
    setLess(new Map());
  };

  return (
    <div className="perty-shell perty-shell--edition perty-paper">
      <header className="perty-ed-mast">
        <DardaniLoop name="greeting" alt="Dardani të përshëndet" className="perty-ed-dardani" />
        <div className="perty-ed-mast-copy">
          <h1 className="perty-ed-hello">{greeting(now, who)}.</h1>
          <p className="perty-ed-line">
            <span className="perty-ed-date">{dateline(now)}</span>
            {edition.length > 0 && (
              <span>
                {edition.length + must.length} {edition.length + must.length === 1 ? "lajm" : "lajme"} · rreth {minutes} min
              </span>
            )}
            {streak >= 2 && (
              <span className="perty-streak" aria-label={`${streak} ditë rresht`}>
                <Flame size={15} strokeWidth={2.4} aria-hidden="true" />
                {streak} ditë
              </span>
            )}
            <HomeCity homeId={home} />
          </p>
          {newCount > 0 && (
            <p className="perty-arrive" role="status">
              <b>{newCount}</b> {newCount === 1 ? "e re për ty" : "të reja për ty"}
              <span className="perty-arrive-since"> që nga vizita e fundit</span>
            </p>
          )}
        </div>
        <button
          type="button"
          className="perty-btn perty-btn--ghost perty-ed-edit"
          onClick={() => setEditing(true)}
          aria-label="Ndrysho interesat"
        >
          <SlidersHorizontal size={16} strokeWidth={2.3} aria-hidden="true" />
          <span>Ndrysho</span>
        </button>
      </header>

      {storageFailed && (
        <p className="perty-note" role="status">
          Shfletuesi yt nuk lejon ruajtjen e zgjedhjeve, ndaj ato vlejnë vetëm për këtë vizitë.
        </p>
      )}

      {showSignup && (
        <aside className="perty-signup" aria-label="Ruaji zgjedhjet">
          <span className="perty-signup-icon" aria-hidden="true">
            <UserRound size={20} strokeWidth={2.2} />
          </span>
          <div>
            <strong>Gati. Këto janë lajmet e tua.</strong>
            <p>Zgjedhjet ruhen në këtë pajisje. Me llogari, i ke njësoj në telefon dhe kompjuter.</p>
          </div>
          <Link href="/hyr?tab=regjistrohu&next=/per-ty" className="perty-btn perty-btn--primary">
            Regjistrohu
          </Link>
          <button
            type="button"
            className="perty-icon-btn"
            aria-label="Mbyll"
            onClick={() => {
              setFlag(SIGNUP_DISMISSED);
              setSignupDismissed(true);
            }}
          >
            <X size={18} strokeWidth={2.4} aria-hidden="true" />
          </button>
        </aside>
      )}

      {edition.length === 0 ? (
        <div className="perty-empty">
          <DardaniLoop name="sleeping" className="perty-empty-loop" />
          <p>
            <strong>Sot s&apos;ka ende lajme për zgjedhjet e tua.</strong> Kjo nuk do të thotë se s&apos;ka lajme —
            shiko kryesoret e ditës, ose shto më shumë tema.
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
      ) : (
        <>
          <div className="perty-front">
          {briefSlugs.length >= 2 && <DardaniBrief slugs={briefSlugs} positionOf={positionOf} />}

          <section className="perty-ed" aria-labelledby="perty-ed-title">
            <div className="perty-panel">
              <header className="perty-panel-head">
                <h2 id="perty-ed-title">Për ty{who ? `, ${who}` : ""}</h2>
                <ReadRing read={readCount} total={edition.length} />
              </header>
              {fresh.length > 0 && (
                <section className="perty-fresh" aria-labelledby="perty-fresh-title">
                  <h3 id="perty-fresh-title" className="perty-fresh-head">
                    <i aria-hidden="true" />
                    Sapo erdhën për ty
                  </h3>
                  <ol className="perty-group-list">
                    {fresh.map((item, j) => (
                      <PanelRow
                        key={item.article.slug}
                        item={item}
                        seen={seen}
                        first={j === 0}
                        why={item.reason}
                        arrival={arrivalOrder.get(item.article.slug)}
                        onOpen={() => noteClick({ slug: item.article.slug, position: j + 1, kind: item.kind, list: "fresh" })}
                        onShown={() => onShown(item, j + 1, "fresh")}
                        onSummaryRead={() => onSummaryRead(item.article, j + 1, "fresh")}
                      />
                    ))}
                  </ol>
                </section>
              )}
              {groups.map((group) => {
                const first = group.items[0];
                const key = tasteKey(first);
                const lessOn = group.items.some((i) => less.has(i.article.slug));
                const label = key ? keyLabel(key) : null;
                return (
                  <section key={group.key} className="perty-group" aria-labelledby={`perty-group-${group.key}`}>
                    <header className="perty-group-head">
                      <h3 id={`perty-group-${group.key}`}>
                        <FollowBadge group={group} />
                        <span className="perty-group-name">
                          {group.kind === "person" || group.kind === "city" || group.kind === "category" ? (
                            <>
                              Sepse ndjek <strong>{groupTitle(group, home)}</strong>
                            </>
                          ) : (
                            <strong>{groupTitle(group, home)}</strong>
                          )}
                        </span>
                        <b aria-label={`${group.items.length} lajme`}>{group.items.length}</b>
                      </h3>
                      {key && group.kind !== "top" && (
                        <button
                          type="button"
                          className="perty-group-less"
                          aria-pressed={lessOn}
                          onClick={() => toggleLess(first, positionOf.get(first.article.slug) ?? 0)}
                        >
                          {lessOn ? (
                            "Zhbëj"
                          ) : (
                            <>
                              <ThumbsDown size={13} strokeWidth={2.3} aria-hidden="true" />
                              <span>Më pak{label ? ` për ${label}` : ""}</span>
                            </>
                          )}
                        </button>
                      )}
                    </header>
                    {lessOn && (
                      <p className="perty-group-note" role="status">
                        Në rregull: më pak{label ? ` për ${label}` : " si kjo"}, nga vizita e ardhshme.
                      </p>
                    )}
                    <ol className="perty-group-list">
                      {group.items.map((item, j) => {
                        const n = positionOf.get(item.article.slug) ?? 0;
                        return (
                          <PanelRow
                            key={item.article.slug}
                            item={item}
                            seen={seen}
                            first={j === 0}
                            why={group.kind === "learned" ? whyLine(item, interests).short : null}
                            arrival={arrivalOrder.get(item.article.slug)}
                            onOpen={() => noteClick({ slug: item.article.slug, position: n, kind: item.kind, list: "edition" })}
                            onShown={() => onShown(item, n, "edition")}
                            onSummaryRead={() => onSummaryRead(item.article, n, "edition")}
                          />
                        );
                      })}
                    </ol>
                  </section>
                );
              })}
            </div>
            {must.length > 0 && (
              <div className="perty-must" role="group" aria-labelledby="perty-must-title">
                <h3 id="perty-must-title" className="perty-must-head">
                  <BellRing size={14} strokeWidth={2.5} aria-hidden="true" />
                  Duhet ta dish sot
                </h3>
                <ul className="perty-ed-list">
                  {must.map((article, i) => (
                    <MustRow
                      key={article.slug}
                      article={article}
                      n={i + 1}
                      seen={seen}
                      onShown={() => onMustShown(article.slug, i + 1)}
                      onSummaryRead={() => onSummaryRead(article, i + 1, "must")}
                    />
                  ))}
                </ul>
              </div>
            )}
          </section>

          <div className="perty-front-town">
            <TownToday homeId={home} story={townStory} onPickCity={() => setEditing(true)} />
          </div>

          <EndCard
            onSeen={() => trackPerty("perty_end", { read: readCount, stories: edition.length })}
            allRead={allRead}
          >
            <div className="perty-end-copy">
              <h2 id="perty-end-title">
                <Coffee size={22} strokeWidth={2.3} aria-hidden="true" />
                Kaq për sot{who ? `, ${who}` : ""}.
              </h2>
              <p>
                {allRead
                  ? "E mbarove gazetën e sotme. Nesër në mëngjes të pret një e re."
                  : `Edhe ${edition.length - readCount} ${edition.length - readCount === 1 ? "lajm" : "lajme"} dhe e ke mbaruar gazetën e sotme.`}
              </p>
              {streak >= 2 && (
                <p className="perty-end-streak">
                  <Flame size={16} strokeWidth={2.4} aria-hidden="true" />
                  <span>
                    <b>{streak} ditë rresht.</b> Kthehu nesër që të mos e prishësh.
                  </span>
                </p>
              )}
              <FinishReward allRead={allRead} remaining={edition.length - readCount} signedIn={signedIn} />
              {quiet.length > 0 && (
                <p className="perty-end-quiet">
                  <b>Pa lajme këtë javë:</b> {quiet.map((q) => q.title).join(", ")}. Kur të ketë, dalin këtu.
                </p>
              )}
              {!home && (
                <p className="perty-end-ask">
                  <MapPin size={15} strokeWidth={2.4} aria-hidden="true" />
                  <span>Zgjidh qytetin tënd: moti dhe lajmet prej andej dalin këtu, të parat.</span>
                </p>
              )}
              <MorningPush />
              <div className="perty-end-actions">
                <Link href="/" className="perty-btn perty-btn--primary">
                  Kryesoret e ditës <ArrowRight size={16} strokeWidth={2.4} aria-hidden="true" />
                </Link>
                <button type="button" className="perty-btn perty-btn--ghost" onClick={() => setEditing(true)}>
                  <SlidersHorizontal size={16} strokeWidth={2.3} aria-hidden="true" />
                  {home ? "Ndrysho interesat" : "Zgjidh qytetin"}
                </button>
              </div>
              {wrappedMonth && (
                <p className="perty-end-wrapped">
                  <Link href={`/muaji/${wrappedMonth}`}>
                    {monthLabel(wrappedMonth)?.definite} në 383 <ArrowRight size={14} strokeWidth={2.4} aria-hidden="true" />
                  </Link>
                </p>
              )}
            </div>
          </EndCard>
          </div>

          {sections.length > 0 && <MoreForYou sections={sections} read={read} />}
        </>
      )}

      <footer className="perty-foot">
        <p>
          Gazeta mëson nga ajo që lexon, ruan dhe komenton. Ruhet në këtë pajisje, dhe në llogarinë tënde kur je i kyçur.
        </p>
        {(Object.keys(interests.affinity ?? {}).length > 0 || read.size > 0) && (
          <button type="button" className="perty-text-btn" onClick={forget}>
            Harro historikun e leximit
          </button>
        )}
      </footer>
    </div>
  );
}

/** Calls `onSeen` once the element has been at least half on screen for `after` ms. */
function useSeen<T extends HTMLElement>(onSeen: () => void, after = SHOWN_AFTER_MS) {
  const ref = useRef<T | null>(null);
  const cb = useRef(onSeen);
  useEffect(() => {
    cb.current = onSeen;
  });
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    let timer: number | null = null;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          if (timer === null) timer = window.setTimeout(() => {
            cb.current();
            io.disconnect();
          }, after);
        } else if (timer !== null) {
          window.clearTimeout(timer);
          timer = null;
        }
      },
      { threshold: 0.5 }
    );
    io.observe(el);
    return () => {
      if (timer !== null) window.clearTimeout(timer);
      io.disconnect();
    };
  }, [after]);
  return ref;
}

/** One row, two moments: shown (a second on screen) and its summary read (SUMMARY_READ_MS). */
function useBothSeen(onShown: () => void, onSummaryRead: () => void) {
  const shown = useSeen<HTMLLIElement>(onShown);
  const read = useSeen<HTMLLIElement>(onSummaryRead, SUMMARY_READ_MS);
  return useCallback(
    (el: HTMLLIElement | null) => {
      shown.current = el;
      read.current = el;
    },
    [shown, read]
  );
}

/**
 * How much of today's seven is read, as a ring that closes. The number inside
 * is the count; the words are for screen readers and announce each change.
 */
function ReadRing({ read, total }: { read: number; total: number }) {
  const r = 17;
  const c = 2 * Math.PI * r;
  const done = total > 0 && read >= total;
  return (
    <p className="perty-ring" data-done={done || undefined} aria-live="polite">
      <span className="perty-ring-art" aria-hidden="true">
        <svg viewBox="0 0 44 44" width="44" height="44">
          <circle className="perty-ring-track" cx="22" cy="22" r={r} />
          <circle
            className="perty-ring-fill"
            cx="22"
            cy="22"
            r={r}
            strokeDasharray={c}
            strokeDashoffset={total > 0 ? c * (1 - Math.min(read, total) / total) : c}
          />
        </svg>
        <span className="perty-ring-n">{done ? <Check size={18} strokeWidth={3} /> : `${read}/${total}`}</span>
      </span>
      <span className="perty-ring-label" aria-hidden="true">
        {done ? "E mbarove!" : "lexuar"}
      </span>
      <span className="perty-sr">
        {read} nga {total} lexuar
      </span>
    </p>
  );
}

/** The face of a follow beside its group: initials for a person, a pin for a town, the topic's colour. */
function FollowBadge({ group }: { group: { key: string; kind: string } }) {
  if (group.kind === "person") {
    const person = personById(group.key.replace(/^person:/, ""));
    const initials = (person?.name ?? "")
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w: string) => w[0])
      .join("")
      .toUpperCase();
    return (
      <span className="perty-badge perty-badge--person" aria-hidden="true">
        {initials || "•"}
      </span>
    );
  }
  if (group.kind === "city") {
    return (
      <span className="perty-badge perty-badge--city" aria-hidden="true">
        <MapPin size={14} strokeWidth={2.5} />
      </span>
    );
  }
  return <i className="perty-badge-dot" aria-hidden="true" style={{ background: groupColor(group) }} />;
}

type RewardState =
  | { status: "idle" | "loading" | "hidden" | "guest" }
  | { status: "ready" | "claimed" | "collected"; amount: number; streak: number }
  | { status: "error"; message: string };

/**
 * Finishing the paper pays a few Tregu coins, once a day, for a signed-in
 * reader (app/api/per-ty/reward, supabase/migrations/0117). Asked for only
 * once the seven are read; if the server has no reward, nothing shows.
 */
function FinishReward({ allRead, remaining, signedIn }: { allRead: boolean; remaining: number; signedIn: boolean | null }) {
  const [state, setState] = useState<RewardState>({ status: "idle" });

  // Asked once the sign-in state is known, so the hint before the end can
  // promise coins only when there are coins to give.
  useEffect(() => {
    if (signedIn === null) return;
    let alive = true;
    setState({ status: "loading" });
    fetch("/api/per-ty/reward")
      .then((r) => (r.ok ? r.json() : { available: false }))
      .then((json) => {
        if (!alive) return;
        if (!json?.available) return setState({ status: "hidden" });
        if (json.signed_in === false) return setState({ status: "guest" });
        const amount = Number(json.amount) || 0;
        const days = Number(json.streak) || 1;
        setState({ status: json.claimed ? "claimed" : "ready", amount, streak: days });
      })
      .catch(() => {
        if (alive) setState({ status: "hidden" });
      });
    return () => {
      alive = false;
    };
  }, [signedIn]);

  if (!allRead) {
    return remaining > 0 && state.status === "ready" ? (
      <p className="perty-reward-hint">
        <CoinFace size={22} idle={false} />
        <span>Mbaroje gazetën dhe merr monedha për Tregun.</span>
      </p>
    ) : null;
  }

  if (state.status === "guest") {
    return (
      <p className="perty-reward-hint">
        <CoinFace size={22} idle={false} />
        <span>
          <Link href="/hyr?tab=regjistrohu&next=/per-ty">Hyr në llogari</Link> dhe merr monedha çdo ditë që e mbaron
          gazetën.
        </span>
      </p>
    );
  }
  if (state.status === "error") {
    return (
      <p className="perty-reward-hint" role="alert">
        {state.message}
      </p>
    );
  }
  if (state.status === "claimed") {
    return (
      <p className="perty-reward-hint">
        <CoinFace size={22} idle={false} />
        <span>Monedhat e sotme i more. Nesër të presin të tjera.</span>
      </p>
    );
  }
  if (state.status === "collected") {
    return (
      <div className="perty-reward perty-reward--done" role="status">
        <span className="perty-reward-coin">
          <CoinFace size={44} spinning />
        </span>
        <p>
          <b>+{state.amount} monedha</b> u shtuan në Tregu. <Link href="/tregu">Luaj me to</Link>
        </p>
      </div>
    );
  }
  if (state.status !== "ready") return null;

  const { amount, streak: days } = state;
  // The server's run of collected days sets the amount; the page shows one streak only (the visit streak above).
  const claim = () => {
    setState({ status: "loading" });
    fetch("/api/per-ty/reward", { method: "POST" })
      .then(async (r) => {
        const json = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(typeof json?.error === "string" ? json.error : "Nuk u morën dot. Provo sërish.");
        const got = Number(json.amount) || amount;
        const run = Number(json.streak) || days;
        setState({ status: "collected", amount: got, streak: run });
        trackPerty("perty_reward_claim", { amount: got, streak: run });
      })
      .catch((e: Error) => setState({ status: "error", message: e.message }));
  };
  return (
    <div className="perty-reward">
      <span className="perty-reward-coin">
        <CoinFace size={44} />
      </span>
      <p>
        <b>{amount} monedha</b> për gazetën e mbaruar
      </p>
      <button type="button" className="perty-btn perty-btn--primary" onClick={claim}>
        Merri
      </button>
    </div>
  );
}

function EndCard({ children, onSeen, allRead }: { children: React.ReactNode; onSeen: () => void; allRead: boolean }) {
  const ref = useSeen<HTMLElement>(onSeen);
  return (
    <section ref={ref} className="perty-end" data-all-read={allRead || undefined} aria-labelledby="perty-end-title">
      <DardaniImage name="wave" decorative className="perty-end-img" />
      {children}
    </section>
  );
}

/** "E re" for a story that arrived since the last visit, "Lexuar" once opened. */
function Mark({ article, seen }: { article: FeedArticle; seen: Seen }) {
  if (seen.read.has(article.slug)) return <span className="perty-mark perty-mark--read">Lexuar</span>;
  if (isNewSince(article, seen.since)) return <span className="perty-mark perty-mark--new">E re</span>;
  return null;
}

/**
 * One story in the "Për ty" panel: headline, Dardani's summary and, for the
 * first story of a group, its photo. Where it is from and how old sit in the
 * text, not in a separate foot. A tick replaces nothing; "Lexuar" says it.
 */
function PanelRow({
  item,
  seen,
  first,
  why,
  arrival,
  onOpen,
  onShown,
  onSummaryRead,
}: {
  item: Item;
  seen: Seen;
  first: boolean;
  why: string | null;
  /** Its place among the rows new since the last visit, which enter one after another. */
  arrival?: number;
  onOpen: () => void;
  onShown: () => void;
  onSummaryRead: () => void;
}) {
  const { article } = item;
  const picture = first ? article.imageUrl || article.coverArt || null : null;
  const ref = useBothSeen(onShown, onSummaryRead);
  return (
    <li
      ref={ref}
      className="perty-prow-item"
      data-arrive={arrival !== undefined || undefined}
      style={arrival !== undefined ? ({ "--arrive": Math.min(arrival, 8) } as React.CSSProperties) : undefined}
    >
      <Link
        href={`/article/${article.slug}`}
        className="perty-prow"
        data-read={seen.read.has(article.slug) || undefined}
        data-first={first || undefined}
        data-thumb={picture ? true : undefined}
        onClick={onOpen}
      >
        <span className="perty-prow-body">
          {why && <span className="perty-prow-why">{why}</span>}
          <strong className="perty-prow-title">{article.title}</strong>
          <Summary article={article} />
          <span className="perty-prow-meta">
            <TimeAgo iso={article.publishedAt} />
            <Mark article={article} seen={seen} />
          </span>
        </span>
        {picture && <Thumb src={picture} lead={first} />}
      </Link>
    </li>
  );
}

/**
 * What the story says, so it can be read here: Dardani's two or three
 * sentences once written, the newsroom's excerpt until then.
 */
function Summary({ article }: { article: FeedArticle }) {
  if (article.summary) return <span className="perty-ed-summary">{article.summary}</span>;
  return article.excerpt ? <span className="perty-ed-excerpt">{article.excerpt}</span> : null;
}

/**
 * A row's photo. `sizes` follows the slot's real width in edition.css (a
 * group's first photo is 200 CSS px on a laptop, 112 on a phone): a `sizes`
 * smaller than the slot is how the old lead came out pixelated.
 */
function Thumb({ src, lead }: { src: string; lead: boolean }) {
  return (
    <span className="perty-ed-thumb">
      <Image
        src={src}
        alt=""
        fill
        priority={lead}
        quality={90}
        sizes={lead ? "(max-width: 640px) 112px, 200px" : "(max-width: 640px) 80px, (max-width: 1023px) 120px, 140px"}
        style={{ objectFit: "cover" }}
      />
    </span>
  );
}

/** One of the day's must-knows: marked as such, with no "Më pak" (it is not a taste). */
function MustRow({
  article,
  n,
  seen,
  onShown,
  onSummaryRead,
}: {
  article: FeedArticle;
  n: number;
  seen: Seen;
  onShown: () => void;
  onSummaryRead: () => void;
}) {
  const picture = article.imageUrl || article.coverArt || null;
  const ref = useBothSeen(onShown, onSummaryRead);
  return (
    <li ref={ref} className="perty-ed-item perty-must-item" data-thumb={picture ? true : undefined}>
      <Link
        href={`/article/${article.slug}`}
        className="perty-ed-row"
        data-read={seen.read.has(article.slug) || undefined}
        onClick={() => noteClick({ slug: article.slug, position: n, kind: "must", list: "must" })}
      >
        <span className="perty-ed-n perty-must-n" aria-hidden="true">
          !
        </span>
        <span className="perty-ed-body">
          <span className="perty-ed-reason">
            Për të gjithë sot
            <Mark article={article} seen={seen} />
          </span>
          <strong className="perty-ed-title">{article.title}</strong>
          <Summary article={article} />
        </span>
        {picture && <Thumb src={picture} lead={false} />}
      </Link>
      <div className="perty-ed-foot">
        <Meta article={article} />
      </div>
    </li>
  );
}

/**
 * "Më shumë për ty": the rest of the week for each follow, folded away. One row
 * of chips (the follow and how many); a tap opens that follow's newest
 * headlines underneath, at most MORE_PER_FOLLOW, one follow at a time. Nothing
 * here repeats the panel or the must-knows above (sections are filtered).
 */
function MoreForYou({
  sections,
  read,
}: {
  sections: { key: string; title: string; kind: string; href: string; items: { article: FeedArticle }[] }[];
  read: ReadonlySet<string>;
}) {
  const [open, setOpen] = useState<string | null>(null);
  const current = sections.find((sec) => sec.key === open) ?? null;
  return (
    <section className="perty-mft" aria-labelledby="perty-mft-title">
      <h2 id="perty-mft-title">Më shumë për ty</h2>
      <div className="perty-mft-chips">
        {sections.map((sec) => (
          <button
            key={sec.key}
            type="button"
            className="perty-mft-chip"
            aria-expanded={open === sec.key}
            aria-controls="perty-mft-list"
            onClick={() => {
              const next = open === sec.key ? null : sec.key;
              setOpen(next);
              if (next) trackPerty("perty_more_open", { group: sec.kind, count: sec.items.length });
            }}
          >
            {sec.title}
            <b>{sec.items.length}</b>
          </button>
        ))}
      </div>
      {current && (
        <div id="perty-mft-list" className="perty-mft-list">
          <ul>
            {current.items.slice(0, MORE_PER_FOLLOW).map((it, j) => (
              <li key={it.article.slug}>
                <Link
                  href={`/article/${it.article.slug}`}
                  data-read={read.has(it.article.slug) || undefined}
                  onClick={() => noteClick({ slug: it.article.slug, position: j + 1, kind: current.kind, list: "more" })}
                >
                  <span>{it.article.title}</span>
                  <TimeAgo iso={it.article.publishedAt} />
                </Link>
              </li>
            ))}
          </ul>
          <Link href={current.href} className="perty-mft-all">
            Të gjitha për {current.title} <ArrowRight size={14} strokeWidth={2.4} aria-hidden="true" />
          </Link>
        </div>
      )}
    </section>
  );
}

function Meta({ article }: { article: FeedArticle }) {
  return (
    <span className="perty-item-meta">
      <b style={{ color: getCategoryColor(article.category) }}>{article.category}</b>
      <i aria-hidden="true">·</i>
      <TimeAgo iso={article.publishedAt} />
    </span>
  );
}

type CityPanelData = {
  name?: string;
  weather?: CityWeather | null;
  border?: {
    entry?: { lo: number; hi: number } | null;
    exit?: { lo: number; hi: number } | null;
    updatedAt?: string | null;
  } | null;
};

/** "15–40 min", or "10 min" when every crossing reads the same. */
function waitRange(range: { lo: number; hi: number } | null | undefined) {
  if (!range) return "—";
  return range.lo === range.hi ? `${range.hi} min` : `${range.lo}–${range.hi} min`;
}

/**
 * The reader's own town, as one line of the masthead: today's weather, or for
 * the diaspora the wait to enter Kosovo. Nothing at all without a home city;
 * the end of the edition asks for one instead.
 */
function HomeCity({ homeId }: { homeId: string | null }) {
  const city = cityById(homeId);
  const [data, setData] = useState<CityPanelData | null>(null);

  useEffect(() => {
    if (!city) return;
    let alive = true;
    fetch(`/api/per-ty/city?id=${encodeURIComponent(city.id)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (alive && json) setData(json as CityPanelData);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [city]);

  if (!city) return null;

  if (city.id === "diaspora") {
    const entry = data?.border?.entry ?? null;
    return (
      <Link href="/visit" className="perty-ed-city">
        <MapPin size={14} strokeWidth={2.5} aria-hidden="true" />
        {entry ? <>Kufiri: hyrje {waitRange(entry)}</> : "Kufiri sot"}
      </Link>
    );
  }

  const weather = data?.weather ?? null;
  return (
    <span className="perty-ed-city">
      <MapPin size={14} strokeWidth={2.5} aria-hidden="true" />
      {city.name}
      {weather && typeof weather.tempC === "number" && (
        <>
          {" "}
          <b>{weather.tempC}°</b> {weather.label?.toLowerCase() ?? ""}
          {typeof weather.rainChance === "number" && weather.rainChance >= 30 ? `, shi ${weather.rainChance}%` : ""}
        </>
      )}
    </span>
  );
}

type BriefLine = { slug: string; text: string };
const BRIEF_KEY = "383:perty-brief";

/**
 * "Në 30 sekonda": Dardani's three lines, written only from the stories of
 * this edition (app/api/per-ty/brief). Kept on the device for the day, for the
 * same stories, so a return visit costs nothing. When the model is down or says
 * nothing usable, the block is simply absent.
 */
function DardaniBrief({ slugs, positionOf }: { slugs: string[]; positionOf: ReadonlyMap<string, number> }) {
  const key = [...slugs].sort().join("|");
  const [lines, setLines] = useState<BriefLine[] | null>(null);

  useEffect(() => {
    let alive = true;
    try {
      const cached = JSON.parse(localStorage.getItem(BRIEF_KEY) ?? "null");
      if (cached?.key === key && Array.isArray(cached?.lines) && Date.now() - Number(cached?.at) < 6 * 3600_000) {
        setLines(cached.lines);
        return;
      }
    } catch {
      // Unreadable cache: ask again.
    }
    setLines(null);
    fetch("/api/per-ty/brief", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slugs }),
    })
      .then((r) => (r.ok ? r.json() : { lines: [] }))
      .then((json) => {
        if (!alive) return;
        const got: BriefLine[] = Array.isArray(json?.lines)
          ? json.lines.filter((l: Partial<BriefLine>) => typeof l?.slug === "string" && typeof l?.text === "string")
          : [];
        setLines(got);
        if (got.length) {
          try {
            localStorage.setItem(BRIEF_KEY, JSON.stringify({ key, at: Date.now(), lines: got }));
          } catch {
            // No storage: the brief is fetched again next visit.
          }
        }
      })
      .catch(() => alive && setLines([]));
    return () => {
      alive = false;
    };
    // `key` carries the slugs; the array itself is new on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  if (lines && lines.length === 0) return null;
  return (
    <section className="perty-brief" aria-labelledby="perty-brief-title" aria-busy={!lines}>
      <header>
        <DardaniFace state="happy" size={34} decorative />
        <h2 id="perty-brief-title">Në 30 sekonda</h2>
      </header>
      {lines ? (
        <ol>
          {lines.map((line) => (
            <li key={line.slug}>
              <Link
                href={`/article/${line.slug}`}
                onClick={() =>
                  noteClick({ slug: line.slug, position: positionOf.get(line.slug) ?? 0, kind: "brief", list: "brief" })
                }
              >
                {line.text}
              </Link>
            </li>
          ))}
        </ol>
      ) : (
        <div className="perty-brief-loading" aria-hidden="true">
          <i />
          <i />
          <i />
        </div>
      )}
    </section>
  );
}
