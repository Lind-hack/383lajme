"use client";

// The personal feed, and the onboarding that leads into it.
//
// Guest-first: everything works with no account, backed by the choices stored
// on this device (lib/interests.mjs). Signing in merges and syncs them across
// devices (lib/interests-sync.ts) — it is offered after the feed appears, never
// asked for before it.
//
// It is the reader's own newspaper, read over one coffee and then closed:
//
//   1. the nameplate — "Gazeta e Lindit", issue number, date — with Share and
//      Rregullo (paper/masthead);
//   2. the front page: the lead story big, then the rest of the edition
//      numbered (paper/front-page, lib/per-ty-paper), "3 / 7 lexuar";
//      Dardani's thirty seconds beside it;
//   3. the boxes: home town, numbers of the day, one Tregu question;
//   4. one open section per thing the reader follows, in their order;
//   5. "Kaq për sot": the end, with sharing and tomorrow's 07:00 edition.
//
// The layout and look are the reader's (lib/paper-prefs.mjs); sharing sends a
// frozen copy (lib/paper-snapshot.mjs). Visits, reads and the paper's settings
// are remembered on the device only.
//
// This component keeps the state and the side effects; the paper/ components
// only draw.

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Coffee, MessageCircleQuestion, Share2, SlidersHorizontal, UserRound, X } from "lucide-react";
import { readInterests, writeInterests, hasInterests, type Interests } from "@/lib/interests.mjs";
import { rankFeed } from "@/lib/per-ty-rank.mjs";
import { buildPaper } from "@/lib/per-ty-paper.mjs";
import { readPrefs, writePrefs, type PaperPrefs } from "@/lib/paper-prefs.mjs";
import { cityById } from "@/lib/cities.mjs";
import { nextStreak, STREAK_KEY } from "@/lib/perty-streak.mjs";
import { forgetVisits, readSlugs, recordVisit } from "@/lib/perty-visits.mjs";
import { daysWithUs, forgetLedger, kosovoParts, noteVisit, readLedger, summarize } from "@/lib/reader-ledger.mjs";
import { readName, writeName } from "@/lib/reader-name.mjs";
import { absence, followUp } from "@/lib/perty-dardani-line.mjs";
import { lastMonth, monthLabel } from "@/lib/monthly-wrapped.mjs";
import { kosovoDateKey } from "@/lib/home-tregu.mjs";
import { mergeOnSignIn, pushInterests } from "@/lib/interests-sync";
import { createClient } from "@/lib/supabase/client";
import { openPyet } from "@/lib/pyet-thread";
import DardaniLoop from "@/components/dardani/dardani-loop";
import DardaniImage from "@/components/dardani/dardani-image";
import DardaniFace from "@/components/dardani/dardani-face";
import Onboarding from "./onboarding";
import MorningPush from "./morning-push";
import Masthead from "./paper/masthead";
import FrontPage, { type Seen } from "./paper/front-page";
import PaperSection from "./paper/section";
import { AllReadCheer, CityBox, DardaniBrief, NumbersBox, TreguBox } from "./paper/boxes";
import CustomizeSheet from "./paper/customize-sheet";
import ShareSheet, { type ShareablePaper } from "./paper/share-sheet";

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
};

const SIGNUP_DISMISSED = "383:perty-signup-dismissed";
/** The Kosovo day the paper last "printed" in; it prints once a day. */
const PRINTED_KEY = "383:paper-printed";
/** The read stories as of the last time this page was drawn, for the tick pop. */
const SEEN_READ_KEY = "383:paper-seen-read";
/** How deep the ranking goes: the sections need more than the edition does. */
const RANK_LIMIT = 200;

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

/** The day this page load decided to print, so asking twice gives one answer. */
let printedThisLoad: string | null = null;

/**
 * True on the first open of today's paper (Kosovo day), and for the rest of
 * that page load; marks the day printed. Idempotent within a load, because
 * React may run a mount effect twice (StrictMode) and the second ask must not
 * cancel the first.
 */
function firstPrintToday() {
  try {
    const today = kosovoDateKey();
    if (printedThisLoad === today) return true;
    if (localStorage.getItem(PRINTED_KEY) === today) return false;
    localStorage.setItem(PRINTED_KEY, today);
    printedThisLoad = today;
    return true;
  } catch {
    return false;
  }
}

/** Stories read since the page was last drawn in this tab session. */
function newlyRead(read: ReadonlySet<string>) {
  try {
    const before = JSON.parse(sessionStorage.getItem(SEEN_READ_KEY) ?? "null");
    sessionStorage.setItem(SEEN_READ_KEY, JSON.stringify([...read]));
    if (!Array.isArray(before)) return new Set<string>();
    const prior = new Set(before);
    return new Set([...read].filter((slug) => !prior.has(slug)));
  } catch {
    return new Set<string>();
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
  const [justRead, setJustRead] = useState<ReadonlySet<string>>(new Set());
  const [print, setPrint] = useState(false);
  // The reader's own paper: the name they gave this device (it wins over the
  // account's), the number of days they have come, and how long they were away.
  const [deviceName, setDeviceName] = useState("");
  const [issue, setIssue] = useState(0);
  const [monthReads, setMonthReads] = useState(0);
  const [away, setAway] = useState<{ missed: number; last: string } | null>(null);
  // The first week of a month, last month's wrapped ("Tetori në 383") is offered.
  const [wrappedMonth, setWrappedMonth] = useState<string | null>(null);

  useEffect(() => {
    const stored = readInterests();
    setInterests(stored);
    setPrefs(readPrefs());
    // Decided in the same render that first draws the paper, so it never
    // paints fully set and then jumps back to blank to "print".
    if (hasInterests(stored)) setPrint(firstPrintToday());
    setDeviceName(readName());
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
  // same moment fixes the line "new" is measured from for this visit.
  useEffect(() => {
    if (!ready) return;
    setSince(recordVisit());
    const readNow = new Set(readSlugs());
    setRead(readNow);
    setJustRead(newlyRead(readNow));
    // This page's effects run before the layout's, so today is noted here too
    // (noting a day twice changes nothing) before the ledger is read.
    noteVisit();
    const ledger = readLedger();
    const parts = kosovoParts();
    setIssue(daysWithUs(ledger));
    setAway(absence(ledger, parts.date));
    setMonthReads(summarize(ledger, { from: parts.month, to: parts.month }).reads);
    if (parts.day <= 7) setWrappedMonth(lastMonth());
    try {
      const next = nextStreak(JSON.parse(localStorage.getItem(STREAK_KEY) ?? "null"));
      localStorage.setItem(STREAK_KEY, JSON.stringify(next));
      setStreak(next.count);
    } catch {
      setStreak(0);
    }
  }, [ready]);

  const feed = useMemo(
    () => (interests && hasInterests(interests) ? rankFeed(pool, interests, { limit: RANK_LIMIT }) : []),
    [pool, interests]
  );

  const homeFrom = cityById(home)?.from ?? null;
  const paper = useMemo(
    () => buildPaper(feed, interests, prefs, { homeFrom, shelf }),
    [feed, interests, prefs, homeFrom, shelf]
  );

  // What a shared copy carries: the edition, and the first four visible
  // sections with stories, two each.
  const shareable = useMemo<ShareablePaper>(
    () => ({
      edition: paper.edition.map((i) => i.article.slug),
      sections: paper.sections
        .filter((s) => !s.empty)
        .slice(0, 4)
        .map((s) => ({ key: s.key, slugs: s.items.slice(0, 2).map((i) => i.article.slug) })),
    }),
    [paper]
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

  // Before mount the device choices are unknown; render nothing rather than
  // flashing onboarding at a reader who already has a feed.
  if (!interests || !prefs || !now) return <div className="perty-shell perty-shell--loading" aria-busy="true" />;

  if (!hasInterests(interests) || editing) {
    return (
      <div className="perty-shell perty-shell--wide">
        <Onboarding
          pool={pool}
          initial={interests}
          editing={editing}
          onCancel={() => setEditing(false)}
          onDone={(picks) => {
            save({ ...interests, ...picks });
            if (!editing) setJustFinished(true);
            setEditing(false);
            window.scrollTo({ top: 0 });
          }}
        />
      </div>
    );
  }

  const { edition, sections, minutes } = paper;
  const showSignup = justFinished && signedIn === false && !signupDismissed;
  const seen: Seen = { since, read, justRead };
  const readCount = edition.filter((i) => read.has(i.article.slug)).length;
  const allRead = edition.length > 0 && readCount === edition.length;
  // Dardani's three lines are written from this edition, the stories not yet read.
  const briefSlugs = edition
    .filter((i) => !read.has(i.article.slug))
    .slice(0, 6)
    .map((i) => i.article.slug);
  const firstUnread = edition.find((i) => !read.has(i.article.slug)) ?? edition[0];
  const displayName = deviceName || name;
  // One thing Dardani noticed, or nothing: being away first, then a story that
  // continues one the reader already read.
  const next = away ? null : followUp(edition, pool, read);
  const canShare = edition.length > 0;
  const boxes = prefs.boxes;
  const showBoxes = boxes.city || boxes.numbers || boxes.tregu;
  // The stagger index for "the paper prints": masthead 0, then down the page.
  const sectionsFrom = edition.length + 3;

  return (
    <div
      className="perty-shell perty-shell--wide perty-paper"
      data-style={prefs.style}
      data-accent={prefs.accent}
      data-print-run={print || undefined}
    >
      <Masthead
        name={displayName}
        issue={issue}
        now={now}
        count={edition.length}
        minutes={minutes}
        onRename={(value) => setDeviceName(writeName(value))}
        onCustomize={() => setCustomizing(true)}
        onShare={canShare ? () => setSharing(true) : null}
      />

      {(away || next) && (
        <p className="perty-ed-say" role="status">
          <DardaniFace state="happy" size={30} decorative />
          {away ? (
            <span>Mungove {away.missed} ditë! Të kam mbajtur më të rëndësishmet këtu poshtë.</span>
          ) : next ? (
            <span>
              E ke lexuar «{next.before.title}». Sot ka vazhdim:{" "}
              <Link href={`/article/${next.after.slug}`}>{next.after.title}</Link>
            </span>
          ) : null}
        </p>
      )}

      {wrappedMonth && (
        <Link href={`/muaji/${wrappedMonth}`} className="perty-ed-wrapped">
          <span aria-hidden="true">✦</span> {monthLabel(wrappedMonth)?.definite} në 383 është gati
          <ArrowRight size={15} strokeWidth={2.4} aria-hidden="true" />
        </Link>
      )}

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
            <strong>Gati. Kjo është gazeta jote.</strong>
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
            <strong>Sot s&apos;ka ende lajme për zgjedhjet e tua.</strong> Kjo nuk do të thotë se
            s&apos;ka lajme — shiko kryesoret e ditës, ose shto më shumë tema.
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
          {/* On a desktop the front page takes the wide column and Dardani's
              three lines sit beside it; on a phone they come after the lead. */}
          <div className="perty-ed-layout">
            {boxes.brief && briefSlugs.length >= 2 && <DardaniBrief slugs={briefSlugs} print={2} />}

            <section className="perty-ed" aria-labelledby="perty-ed-title">
              <header className="perty-ed-head" data-print style={{ "--i": 1 } as React.CSSProperties}>
                <h2 id="perty-ed-title">Për ty sot</h2>
                <p className="perty-ed-progress" aria-live="polite">
                  <span className="perty-ed-bar" aria-hidden="true">
                    <i style={{ width: `${(readCount / edition.length) * 100}%` }} />
                  </span>
                  {readCount} / {edition.length} lexuar
                </p>
              </header>
              <FrontPage items={edition} seen={seen} printFrom={2} />
            </section>
          </div>

          {showBoxes && (
            <div className="perty-boxes" data-print style={{ "--i": sectionsFrom - 1 } as React.CSSProperties}>
              {boxes.city && <CityBox homeId={home} onPickCity={() => setEditing(true)} />}
              {boxes.numbers && <NumbersBox today={dayCount} days={issue} streak={streak} reads={monthReads} />}
              {boxes.tregu && <TreguBox />}
            </div>
          )}

          {paper.allHidden ? (
            <p className="perty-sec-allhidden">
              <span>I ke fshehur të gjitha faqet e tua.</span>
              <button type="button" className="perty-text-btn" onClick={() => savePrefs({ ...prefs, hidden: [] })}>
                Shfaqi përsëri
              </button>
            </p>
          ) : (
            sections.length > 0 && (
              <div className="perty-secs">
                {sections.map((section, i) => (
                  <PaperSection key={section.key} section={section} seen={seen} print={sectionsFrom + i} />
                ))}
              </div>
            )
          )}

          <section className="perty-end" aria-labelledby="perty-end-title" data-all-read={allRead || undefined}>
            {allRead ? <AllReadCheer /> : <DardaniImage name="wave" decorative className="perty-end-img" />}
            <div className="perty-end-copy">
              <h2 id="perty-end-title">
                <Coffee size={22} strokeWidth={2.3} aria-hidden="true" />
                {allRead ? "E ke mbaruar gazetën!" : "Kaq për sot."}
              </h2>
              <p>
                {allRead
                  ? "I ke lexuar të gjitha. Ndaje me dikë që i pëlqejnë të njëjtat gjëra — shihemi nesër!"
                  : "Këto ishin lajmet e tua për sot. Shihemi nesër!"}
              </p>
              {canShare && (
                <button type="button" className="perty-btn perty-btn--primary perty-end-share" onClick={() => setSharing(true)}>
                  <Share2 size={17} strokeWidth={2.4} aria-hidden="true" />
                  Ndaje gazetën tënde
                </button>
              )}
              <MorningPush />
              {streak >= 2 && (
                <p className="perty-end-streak">
                  <b>{streak} ditë rresht.</b> Kthehu nesër që të mos e prishësh.
                </p>
              )}
              <div className="perty-end-actions">
                <Link href="/" className="perty-btn perty-btn--ghost">
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
                <button type="button" className="perty-btn perty-btn--ghost" onClick={() => setCustomizing(true)}>
                  <SlidersHorizontal size={16} strokeWidth={2.3} aria-hidden="true" />
                  Rregullo gazetën
                </button>
              </div>
            </div>
          </section>
        </>
      )}

      <footer className="perty-foot">
        <p>
          Gazeta jote mëson pak nga ajo që lexon dhe pyet, dhe mban mend çka ke hapur — vetëm në këtë pajisje.
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
              setRead(new Set());
              setJustRead(new Set());
              setSince(null);
            }}
          >
            Harro historikun e leximit
          </button>
        )}
      </footer>

      <CustomizeSheet
        open={customizing}
        onClose={() => setCustomizing(false)}
        prefs={prefs}
        onChange={savePrefs}
        keys={paper.allKeys}
        name={displayName}
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
