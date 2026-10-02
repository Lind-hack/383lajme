"use client";

// The personal feed, and the onboarding that leads into it.
//
// Guest-first: everything works with no account, backed by the choices stored
// on this device (lib/interests.mjs). Signing in merges and syncs them across
// devices (lib/interests-sync.ts) — it is offered after the feed appears, never
// asked for before it.
//
// It is a morning edition, read over one coffee and then closed. Full page
// width, like the rest of the site; on a desktop the seven take the wide
// column and Dardani's three lines the narrow one beside it:
//
//   1. a one-block masthead: greeting, date, how long this takes, the
//      reader's town (weather, or the border waits for the diaspora);
//   2. "Në 30 sekonda": Dardani's three lines on this edition;
//   3. "Për ty sot": one numbered list of seven stories (lib/per-ty-edition),
//      read ones kept in place so "3 / 7 lexuar" can move;
//   4. "Kaq për sot": the end, with Kryesoret one tap away;
//   5. "Më shumë", folded, for anyone who wants to keep going.
//
// Every story says why it is here. Visits and reads are remembered on the
// device only.

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  ArrowRight,
  Check,
  ChevronDown,
  Coffee,
  MapPin,
  MessageCircleQuestion,
  SlidersHorizontal,
  UserRound,
  X,
} from "lucide-react";
import TimeAgo from "@/components/time-ago";
import { getCategoryColor } from "@/lib/category-colors";
import {
  readInterests,
  writeInterests,
  hasInterests,
  type Interests,
} from "@/lib/interests.mjs";
import { rankFeed } from "@/lib/per-ty-rank.mjs";
import { buildEdition } from "@/lib/per-ty-edition.mjs";
import { personById } from "@/lib/people.mjs";
import { cityById } from "@/lib/cities.mjs";
import { nextStreak, STREAK_KEY } from "@/lib/perty-streak.mjs";
import { forgetVisits, isNewSince, readSlugs, recordVisit } from "@/lib/perty-visits.mjs";
import { daysWithUs, forgetLedger, kosovoParts, noteVisit, readLedger } from "@/lib/reader-ledger.mjs";
import { paperName, readName, writeName } from "@/lib/reader-name.mjs";
import { absence, followUp } from "@/lib/perty-dardani-line.mjs";
import type { CityWeather } from "@/lib/weather";
import { mergeOnSignIn, pushInterests } from "@/lib/interests-sync";
import { createClient } from "@/lib/supabase/client";
import { openPyet } from "@/lib/pyet-thread";
import DardaniLoop from "@/components/dardani/dardani-loop";
import DardaniImage from "@/components/dardani/dardani-image";
import DardaniFace from "@/components/dardani/dardani-face";
import Onboarding from "./onboarding";
import MorningPush from "./morning-push";

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

type Item = { article: FeedArticle; reason: string; kind: "person" | "city" | "category" | "learned" | "top" };

/** What a row needs to know about this reader's history with the story. */
type Seen = { since: string | null; read: ReadonlySet<string> };

const SIGNUP_DISMISSED = "383:perty-signup-dismissed";

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

/** Morning, afternoon or evening — by the clock in Kosovo, not the reader's. */
function greeting(now: Date) {
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Belgrade", hour: "numeric", hourCycle: "h23" }).format(now)
  );
  if (hour >= 4 && hour < 11) return "Mirëmëngjes";
  if (hour >= 11 && hour < 18) return "Mirëdita";
  return "Mirëmbrëma";
}

const WEEKDAYS = ["e diel", "e hënë", "e martë", "e mërkurë", "e enjte", "e premte", "e shtunë"];
const MONTHS = ["janar", "shkurt", "mars", "prill", "maj", "qershor", "korrik", "gusht", "shtator", "tetor", "nëntor", "dhjetor"];

/**
 * "e martë, 30 shtator", by the Kosovo calendar. Spelled out rather than left to
 * Intl's "sq" locale, which some browsers ship without and fall back to English.
 */
function dateline(now: Date) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "Europe/Belgrade",
      weekday: "short",
      day: "numeric",
      month: "numeric",
    })
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

export default function PerTyFeed({ pool }: { pool: FeedArticle[] }) {
  const [interests, setInterests] = useState<Interests | null>(null);
  const [editing, setEditing] = useState(false);
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
  const [away, setAway] = useState<{ missed: number; last: string } | null>(null);

  useEffect(() => {
    setInterests(readInterests());
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
    setRead(new Set(readSlugs()));
    // This page's effects run before the layout's, so today is noted here too
    // (noting a day twice changes nothing) before the ledger is read.
    noteVisit();
    const ledger = readLedger();
    setIssue(daysWithUs(ledger));
    setAway(absence(ledger, kosovoParts().date));
    try {
      const next = nextStreak(JSON.parse(localStorage.getItem(STREAK_KEY) ?? "null"));
      localStorage.setItem(STREAK_KEY, JSON.stringify(next));
      setStreak(next.count);
    } catch {
      setStreak(0);
    }
  }, [ready]);

  const feed = useMemo<Item[]>(
    () => (interests && hasInterests(interests) ? (rankFeed(pool, interests) as Item[]) : []),
    [pool, interests]
  );

  const homeFrom = cityById(home)?.from ?? null;
  const { edition, more, minutes } = useMemo(() => buildEdition(feed, { homeFrom }), [feed, homeFrom]);

  function save(next: Interests) {
    if (!writeInterests(next)) setStorageFailed(true);
    const stored = readInterests();
    // If storage refused the write, keep the choice for this visit anyway.
    const current = hasInterests(stored) || !hasInterests(next) ? stored : next;
    setInterests(current);
    if (signedIn) pushInterests(current);
  }

  // Before mount the device choices are unknown; render nothing rather than
  // flashing onboarding at a reader who already has a feed.
  if (!interests || !now) return <div className="perty-shell perty-shell--loading" aria-busy="true" />;

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

  const following = [
    ...interests.categories,
    ...interests.people.map((id) => personById(id)?.name).filter(Boolean),
    ...interests.cities.map((id) => cityById(id)?.name).filter(Boolean),
  ].join(" · ");

  const showSignup = justFinished && signedIn === false && !signupDismissed;
  const seen: Seen = { since, read };
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

  return (
    <div className="perty-shell perty-shell--wide perty-paper">
      <header className="perty-ed-mast">
        <DardaniLoop name="greeting" alt="Dardani të përshëndet" className="perty-ed-dardani" />
        <div className="perty-ed-mast-copy">
          <p className="perty-ed-kicker">
            <button
              type="button"
              className="perty-ed-paper"
              onClick={() => setNaming(true)}
              aria-label={displayName ? "Ndrysho emrin" : "Vendos emrin tënd"}
            >
              {paperName(displayName)}
            </button>
            {issue > 0 && <span className="perty-ed-issue">Nr. {issue}</span>}
            {!displayName && !naming && (
              <button type="button" className="perty-ed-ask-name" onClick={() => setNaming(true)}>
                Si të thërras?
              </button>
            )}
          </p>
          {naming && (
            <form
              className="perty-ed-name-form"
              onSubmit={(e) => {
                e.preventDefault();
                const value = new FormData(e.currentTarget).get("name");
                setDeviceName(writeName(typeof value === "string" ? value : ""));
                setNaming(false);
              }}
            >
              <label htmlFor="perty-name">Si të thërras?</label>
              <input
                id="perty-name"
                name="name"
                defaultValue={displayName}
                autoComplete="given-name"
                maxLength={24}
                placeholder="Emri yt"
                autoFocus
              />
              <button type="submit" className="perty-btn perty-btn--primary">
                Ruaj
              </button>
              <button type="button" className="perty-text-btn" onClick={() => setNaming(false)}>
                Anulo
              </button>
            </form>
          )}
          <h1 className="perty-ed-hello">
            {greeting(now)}
            {displayName ? `, ${displayName}` : ""}.
          </h1>
          <p className="perty-ed-line">
            <span className="perty-ed-date">{dateline(now)}</span>
            {edition.length > 0 && (
              <span>
                {edition.length} {edition.length === 1 ? "lajm" : "lajme"} · rreth {minutes} min
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
          {/* On a desktop the edition takes the wide column and Dardani's three
              lines sit beside it; on a phone they come first, above it. */}
          <div className="perty-ed-layout">
          {briefSlugs.length >= 2 && <DardaniBrief slugs={briefSlugs} />}

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
            <ol className="perty-ed-list">
              {edition.map((item, i) => (
                <li key={item.article.slug}>
                  <EditionRow item={item} n={i + 1} seen={seen} lead={i === 0} />
                </li>
              ))}
            </ol>
          </section>
          </div>

          <section className="perty-end" aria-labelledby="perty-end-title">
            <DardaniImage name="wave" decorative className="perty-end-img" />
            <div className="perty-end-copy">
              <h2 id="perty-end-title">
                <Coffee size={22} strokeWidth={2.3} aria-hidden="true" />
                Kaq për sot.
              </h2>
              <p>
                {allRead
                  ? "I ke lexuar të gjitha. Shihemi nesër me lajmet e reja!"
                  : "Këto ishin lajmet e tua për sot. Shihemi nesër!"}
              </p>
              <MorningPush />
              {streak >= 2 && (
                <p className="perty-end-streak">
                  <b>{streak} ditë rresht.</b> Kthehu nesër që të mos e prishësh.
                </p>
              )}
              {!home && (
                <p className="perty-end-ask">
                  <MapPin size={15} strokeWidth={2.4} aria-hidden="true" />
                  <span>Zgjidh qytetin tënd: moti dhe lajmet prej andej dalin këtu, të parat.</span>
                </p>
              )}
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
              <p className="perty-end-following">Ndjek: {following}</p>
            </div>
          </section>

          {more.length > 0 && (
            <section className="perty-more" aria-labelledby="perty-more-title">
              <h2 id="perty-more-title">Më shumë, nëse ke kohë</h2>
              <div className="perty-more-groups">
              {more.map((group) => (
                <details key={group.key} className="perty-more-group">
                  <summary>
                    <span>{group.title}</span>
                    <b>{group.items.length}</b>
                    <ChevronDown size={18} strokeWidth={2.4} aria-hidden="true" />
                  </summary>
                  <ul>
                    {group.items.map((item) => (
                      <li key={item.article.slug}>
                        <MoreRow item={item} seen={seen} showReason={group.kind === "topics"} />
                      </li>
                    ))}
                  </ul>
                </details>
              ))}
              </div>
            </section>
          )}
        </>
      )}

      <footer className="perty-foot">
        <p>
          Renditja mëson pak nga ajo që lexon dhe pyet, dhe mban mend çka ke hapur — vetëm në këtë pajisje.
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
              setSince(null);
            }}
          >
            Harro historikun e leximit
          </button>
        )}
      </footer>
    </div>
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
 * an empty grey box is not a picture.
 */
function EditionRow({ item, n, seen, lead }: { item: Item; n: number; seen: Seen; lead: boolean }) {
  const { article, reason } = item;
  const isRead = seen.read.has(article.slug);
  return (
    <Link
      href={`/article/${article.slug}`}
      className="perty-ed-row"
      data-read={isRead || undefined}
      data-lead={lead || undefined}
    >
      <span className="perty-ed-n" aria-hidden="true">
        {isRead ? <Check size={15} strokeWidth={3} /> : n}
      </span>
      <span className="perty-ed-body">
        <span className="perty-ed-reason">
          {reason}
          <Mark article={article} seen={seen} />
        </span>
        <strong className="perty-ed-title">{article.title}</strong>
        {article.excerpt && <span className="perty-ed-excerpt">{article.excerpt}</span>}
        <Meta article={article} />
      </span>
      {article.imageUrl && (
        <span className="perty-ed-thumb">
          <Image
            src={article.imageUrl}
            alt=""
            fill
            priority={lead}
            sizes={lead ? "(max-width: 640px) 96px, 168px" : "(max-width: 640px) 80px, 120px"}
            style={{ objectFit: "cover" }}
          />
        </span>
      )}
    </Link>
  );
}

/** A folded "Më shumë" line: just the headline and where it is from. */
function MoreRow({ item, seen, showReason }: { item: Item; seen: Seen; showReason: boolean }) {
  const { article, reason } = item;
  return (
    <Link href={`/article/${article.slug}`} className="perty-more-row" data-read={seen.read.has(article.slug) || undefined}>
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
      {article.source && (
        <>
          <i aria-hidden="true">·</i>
          <span>{article.source}</span>
        </>
      )}
    </span>
  );
}

type CityPanelData = {
  name: string;
  weather: CityWeather | null;
  border: {
    entry: { lo: number; hi: number } | null;
    exit: { lo: number; hi: number } | null;
    updatedAt: string | null;
  } | null;
};

/** "15–40 min", or "10 min" when every crossing reads the same. */
function waitRange(range: { lo: number; hi: number } | null) {
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
      {weather && (
        <>
          {" "}
          <b>{weather.tempC}°</b> {weather.label.toLowerCase()}
          {weather.rainChance !== null && weather.rainChance >= 30 ? `, shi ${weather.rainChance}%` : ""}
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
function DardaniBrief({ slugs }: { slugs: string[] }) {
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
        const got: BriefLine[] = Array.isArray(json?.lines) ? json.lines : [];
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
              <Link href={`/article/${line.slug}`}>{line.text}</Link>
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
