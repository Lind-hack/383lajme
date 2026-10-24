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
  ChevronDown,
  Coffee,
  MapPin,
  MessageCircleQuestion,
  SlidersHorizontal,
  ThumbsDown,
  UserRound,
  X,
} from "lucide-react";
import TimeAgo from "@/components/time-ago";
import { getCategoryColor } from "@/lib/category-colors";
import { readInterests, writeInterests, hasInterests, nudgeAffinity, recordRead, type Interests } from "@/lib/interests.mjs";
import { articleKeys, rankFeed, type RankedItem } from "@/lib/per-ty-rank.mjs";
import { buildEdition, readingMinutes } from "@/lib/per-ty-edition.mjs";
import { mustKnow } from "@/lib/per-ty-must-know.mjs";
import { buildPaper, quietFollows } from "@/lib/per-ty-paper.mjs";
import { cityById } from "@/lib/cities.mjs";
import { nextStreak, STREAK_KEY } from "@/lib/perty-streak.mjs";
import { forgetVisits, isNewSince, readSlugs, recordVisit } from "@/lib/perty-visits.mjs";
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
import { openPyet } from "@/lib/pyet-thread";
import DardaniLoop from "@/components/dardani/dardani-loop";
import DardaniImage from "@/components/dardani/dardani-image";
import DardaniFace from "@/components/dardani/dardani-face";
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
/** Deep enough for "Më shumë" and for knowing which follows the week covered. */
const RANK_LIMIT = 200;
/** A folded group shows at most this many. */
const MORE_PER_GROUP = 8;
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
/** A photo at least this wide stays sharp in the lead's big slot on a laptop. */
const LEAD_SHARP_PX = 1000;
/** How far down the edition a sharper photo may be brought up to lead. */
const LEAD_LOOK = 3;

/**
 * The edition with a sharp photo leading: when the first story's photo is
 * small (or unmeasured) and one of the next two has a big one, that one leads.
 * A small outlet photo stretched over half a laptop screen is the pixelation
 * readers saw; no optimizer can add pixels the outlet never published.
 */
function sharpLead<T extends { article: FeedArticle }>(items: T[]): T[] {
  const sharp = (i: T | undefined) => Boolean(i?.article.imageUrl) && (i?.article.imageWidth ?? 0) >= LEAD_SHARP_PX;
  if (items.length < 2 || sharp(items[0])) return items;
  const at = items.slice(1, LEAD_LOOK).findIndex(sharp);
  if (at < 0) return items;
  const out = [...items];
  const [lead] = out.splice(at + 1, 1);
  return [lead, ...out];
}

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

/**
 * How many follow columns per row, at most `max`, so the last row is never one
 * column left alone (5 follows: 3 + 2, not 4 + 1).
 */
function colsFor(count: number, max: number) {
  if (count <= max) return Math.max(1, count);
  for (let n = max; n >= 2; n--) if (count % n !== 1) return n;
  return max;
}

/** The key "Më pak si kjo" turns down: the follow behind the pick, or the story's topic for a top story. */
function tasteKey(item: Item) {
  if (item.primaryKey?.includes(":")) return item.primaryKey;
  return item.article.category ? `cat:${item.article.category}` : null;
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
    setSince(recordVisit());
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
  const must = useMemo(
    () => (visited && now ? mustKnow(pool, { now: now.getTime(), read }) : []),
    [pool, visited, now, read]
  );
  const homeFrom = cityById(home)?.from ?? null;
  const { edition, more } = useMemo(() => {
    const skip = new Set(must.map((a) => a.slug));
    // The must-know band carries the day now, so the general top stories only
    // fill the places the reader's own stories leave empty.
    const built = buildEdition(
      feed.filter((i) => !skip.has(i.article.slug)),
      { homeFrom, fillKinds: ["top"] }
    );
    return { more: built.more, edition: sharpLead(built.edition) };
  }, [feed, homeFrom, must]);
  const minutes = readingMinutes([...must.map((article) => ({ article })), ...edition]);
  // The wide screen's columns: one per follow, never repeating the seven.
  const sections = useMemo(
    () => (interests ? buildPaper(feed, interests, null, { homeFrom }).sections.filter((sec) => sec.items.length > 0) : []),
    [feed, interests, homeFrom]
  );
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

  const who = (deviceName || name).trim().split(/\s+/)[0]?.slice(0, 24) ?? "";
  const following = [
    ...interests.categories,
    ...interests.people.map((id) => keyLabel(`person:${id}`)).filter(Boolean),
    ...interests.cities.map((id) => keyLabel(`city:${id}`)).filter(Boolean),
  ].join(" · ");

  const showSignup = justFinished && signedIn === false && !signupDismissed;
  const seen: Seen = { since, read };
  const readCount = edition.filter((i) => read.has(i.article.slug)).length;
  const allRead = edition.length > 0 && readCount === edition.length;
  // Dardani's three lines are written from this edition, the stories not yet read.
  const briefSlugs = [
    ...must.map((a) => a.slug),
    ...edition.filter((i) => !read.has(i.article.slug)).map((i) => i.article.slug),
  ].slice(0, 6);
  const firstUnread = edition.find((i) => !read.has(i.article.slug)) ?? edition[0];
  const positionOf = new Map(edition.map((i, n) => [i.article.slug, n + 1]));

  const forget = () => {
    save({ ...interests, affinity: {} });
    forgetVisits();
    forgetLedger();
    writeShown(null);
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
            <HomeCity homeId={home} />
          </p>
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
            <header className="perty-ed-head">
              <h2 id="perty-ed-title">Për ty sot</h2>
              <p className="perty-ed-progress" aria-live="polite">
                <span className="perty-ed-bar" aria-hidden="true">
                  <i style={{ width: `${(readCount / edition.length) * 100}%` }} />
                </span>
                {readCount} / {edition.length} lexuar
              </p>
            </header>
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
            <ol className="perty-ed-list">
              {edition.map((item, i) => (
                <EditionRow
                  key={item.article.slug}
                  item={item}
                  n={i + 1}
                  seen={seen}
                  lead={i === 0}
                  why={whyLine(item, interests).short}
                  lessKey={less.get(item.article.slug) ?? null}
                  canLess={tasteKey(item) !== null}
                  onLess={() => toggleLess(item, i + 1)}
                  onShown={() => onShown(item, i + 1, "edition")}
                  onSummaryRead={() => onSummaryRead(item.article, i + 1, "edition")}
                />
              ))}
            </ol>
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
                  ? "I ke lexuar të gjitha. Shihemi nesër me lajmet e reja!"
                  : "Këto ishin lajmet e tua për sot. Shihemi nesër!"}
              </p>
              {streak >= 2 && (
                <p className="perty-end-streak">
                  <b>{streak} ditë rresht.</b> Kthehu nesër që të mos e prishësh.
                </p>
              )}
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
                <button
                  type="button"
                  className="perty-btn perty-btn--ghost"
                  onClick={() => openPyet(firstUnread ? `Pse ndodhi kjo: ${firstUnread.article.title}` : undefined)}
                >
                  <MessageCircleQuestion size={16} strokeWidth={2.3} aria-hidden="true" />
                  Pyet Dardanin
                </button>
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
              <p className="perty-end-following">Ndjek: {following}</p>
            </div>
          </EndCard>
          </div>

          {sections.length > 0 && (
            <div
              className="perty-cols"
              aria-label="Ato që ndjek"
              style={{ "--cols-lg": colsFor(sections.length, 4), "--cols-md": colsFor(sections.length, 3) } as React.CSSProperties}
            >
              {sections.map((sec) => (
                <section key={sec.key} className="perty-col" aria-labelledby={`perty-col-${sec.key}`}>
                  <header className="perty-col-head">
                    <span className="perty-col-kicker">
                      {sec.key === `city:${home}` ? "Qyteti yt" : sec.kind === "person" ? "Njeri që ndjek" : sec.kind === "city" ? "Qytet që ndjek" : "Temë që ndjek"}
                    </span>
                    <h2 id={`perty-col-${sec.key}`}>
                      <Link href={sec.href}>{sec.title}</Link>
                    </h2>
                  </header>
                  <ul>
                    {sec.items.map((it, j) => (
                      <li key={it.article.slug}>
                        <Link
                          href={`/article/${it.article.slug}`}
                          className="perty-col-row"
                          data-first={j === 0 || undefined}
                          data-read={read.has(it.article.slug) || undefined}
                          onClick={() =>
                            noteClick({ slug: it.article.slug, position: j + 1, kind: sec.kind, list: "section" })
                          }
                        >
                          {j === 0 && (it.article.imageUrl || it.article.coverArt) && (
                            <span className="perty-col-img">
                              <Image
                                src={(it.article.imageUrl || it.article.coverArt) as string}
                                alt=""
                                fill
                                quality={90}
                                sizes="(min-width: 1024px) 400px, 1px"
                                style={{ objectFit: "cover" }}
                              />
                            </span>
                          )}
                          <strong>{it.article.title}</strong>
                          <Meta article={it.article} />
                        </Link>
                      </li>
                    ))}
                  </ul>
                  <Link href={sec.href} className="perty-col-all">
                    Të gjitha për {sec.title} <ArrowRight size={14} strokeWidth={2.4} aria-hidden="true" />
                  </Link>
                </section>
              ))}
            </div>
          )}

          {more.length > 0 && (
            <section className="perty-more" aria-labelledby="perty-more-title">
              <h2 id="perty-more-title">Më shumë, nëse ke kohë</h2>
              {more.map((group) => (
                <details
                  key={group.key}
                  className="perty-more-group"
                  onToggle={(e) => {
                    if ((e.currentTarget as HTMLDetailsElement).open) {
                      trackPerty("perty_more_open", { group: group.kind, count: group.items.length });
                    }
                  }}
                >
                  <summary>
                    <span>{group.title}</span>
                    <b>{Math.min(group.items.length, MORE_PER_GROUP)}</b>
                    <ChevronDown size={18} strokeWidth={2.4} aria-hidden="true" />
                  </summary>
                  <ul>
                    {group.items.slice(0, MORE_PER_GROUP).map((item, j) => (
                      <li key={item.article.slug}>
                        <MoreRow
                          item={item}
                          seen={seen}
                          showReason={group.kind === "topics"}
                          onOpen={() =>
                            noteClick({ slug: item.article.slug, position: j + 1, kind: item.kind, list: "more" })
                          }
                        />
                      </li>
                    ))}
                  </ul>
                </details>
              ))}
            </section>
          )}
        </>
      )}

      <footer className="perty-foot">
        <p>
          Renditja mëson nga ajo që lexon, sa gjatë e lexon, çka ruan dhe ku komenton, dhe mban mend çka ke hapur. Ruhet
          në këtë pajisje, dhe në llogarinë tënde kur je i kyçur, që telefoni dhe kompjuteri të mësojnë bashkë.
          Për përmbledhjen, Dardanit i dërgohen vetëm adresat e lajmeve, asnjë e dhënë për ty.
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
 * One story of the edition. The number turns into a tick once it has been
 * opened; the row stays where it was. A picture only when the story has one —
 * an empty grey box is not a picture. Below it, where the story is from and
 * "Më pak si kjo".
 */
function EditionRow({
  item,
  n,
  seen,
  lead,
  why,
  lessKey,
  canLess,
  onLess,
  onShown,
  onSummaryRead,
}: {
  item: Item;
  n: number;
  seen: Seen;
  lead: boolean;
  why: string;
  lessKey: string | null;
  canLess: boolean;
  onLess: () => void;
  onShown: () => void;
  onSummaryRead: () => void;
}) {
  const { article } = item;
  const isRead = seen.read.has(article.slug);
  const picture = article.imageUrl || article.coverArt || null;
  const ref = useBothSeen(onShown, onSummaryRead);
  const lessLabel = lessKey ? keyLabel(lessKey) : null;
  return (
    <li ref={ref} className="perty-ed-item" data-less={lessKey ? true : undefined} data-thumb={picture ? true : undefined}>
      <Link
        href={`/article/${article.slug}`}
        className="perty-ed-row"
        data-read={isRead || undefined}
        data-lead={lead || undefined}
        onClick={() => noteClick({ slug: article.slug, position: n, kind: item.kind, list: "edition" })}
      >
        <span className="perty-ed-n" aria-hidden="true">
          {isRead ? <Check size={15} strokeWidth={3} /> : n}
        </span>
        <span className="perty-ed-body">
          <span className="perty-ed-reason">
            {why}
            <Mark article={article} seen={seen} />
          </span>
          <strong className="perty-ed-title">{article.title}</strong>
          <Summary article={article} />
        </span>
        {picture && <Thumb src={picture} lead={lead} />}
      </Link>
      <div className="perty-ed-foot">
        {lessKey ? (
          <p className="perty-ed-less-note" role="status">
            Në rregull: më pak{lessLabel ? ` për ${lessLabel}` : " si kjo"}, nga vizita e ardhshme.
          </p>
        ) : (
          <Meta article={article} />
        )}
        {canLess && (
          <button
            type="button"
            className="perty-ed-less"
            aria-pressed={Boolean(lessKey)}
            onClick={onLess}
          >
            {lessKey ? (
              "Zhbëj"
            ) : (
              <>
                <ThumbsDown size={14} strokeWidth={2.3} aria-hidden="true" />
                <span>Më pak si kjo</span>
              </>
            )}
          </button>
        )}
      </div>
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
 * A row's photo. `sizes` follows the slot's real width in edition.css: on a
 * laptop the lead fills half the front page (about 600 CSS px), and the old
 * "168px" fetched a photo a quarter that size and stretched it.
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
        sizes={lead ? "(max-width: 640px) 96px, (max-width: 1023px) 168px, 620px" : "(max-width: 640px) 80px, (max-width: 1023px) 120px, 140px"}
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

/** A folded "Më shumë" line: just the headline and where it is from. */
function MoreRow({ item, seen, showReason, onOpen }: { item: Item; seen: Seen; showReason: boolean; onOpen: () => void }) {
  const { article, reason } = item;
  return (
    <Link
      href={`/article/${article.slug}`}
      className="perty-more-row"
      data-read={seen.read.has(article.slug) || undefined}
      onClick={onOpen}
    >
      <strong>{article.title}</strong>
      <span className="perty-more-meta">
        {showReason && <span className="perty-more-reason">{reason.replace(/^Sepse ndjek /, "")}</span>}
        <Meta article={article} />
        <Mark article={article} seen={seen} />
      </span>
    </Link>
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
