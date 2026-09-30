"use client";

// The personal feed, and the onboarding that leads into it.
//
// Guest-first: everything works with no account, backed by the choices stored
// on this device (lib/interests.mjs). Signing in merges and syncs them across
// devices (lib/interests-sync.ts) — it is offered after the feed appears, never
// asked for before it.
//
// Every item says why it is here, the day's top stories are always mixed in,
// and Kryesoret stays one tap away, so personalisation never becomes the only
// way to reach the day's general news.
//
// It reads as the reader's own morning paper: Dardani greets them by the time
// of day in Kosovo, the best story for them leads, and the rest is filed under
// why it is here — the people they follow, their city, their topics — with the
// day's top stories kept in a strip of their own.

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowRight, MessageCircleQuestion, SlidersHorizontal, UserRound, X } from "lucide-react";
import TimeAgo from "@/components/time-ago";
import { getCategoryColor } from "@/lib/category-colors";
import {
  readInterests,
  writeInterests,
  hasInterests,
  type Interests,
} from "@/lib/interests.mjs";
import { rankFeed } from "@/lib/per-ty-rank.mjs";
import { personById } from "@/lib/people.mjs";
import { cityById } from "@/lib/cities.mjs";
import { nextStreak, STREAK_KEY } from "@/lib/perty-streak.mjs";
import { mergeOnSignIn, pushInterests } from "@/lib/interests-sync";
import { createClient } from "@/lib/supabase/client";
import { openPyet } from "@/lib/pyet-thread";
import DardaniLoop from "@/components/dardani/dardani-loop";
import DardaniImage from "@/components/dardani/dardani-image";
import DardaniFace from "@/components/dardani/dardani-face";
import Onboarding from "./onboarding";

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

function initials(name: string) {
  return name
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
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

  useEffect(() => {
    setInterests(readInterests());
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

  // A visit counts towards the streak only once there is a feed to visit.
  useEffect(() => {
    if (!ready) return;
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

  // Filed under why each story is here. The lead is the best of them, and
  // prefers one with a picture so the paper opens on an image.
  const paper = useMemo(() => {
    const personal = feed.filter((i) => i.kind !== "top");
    const lead = personal.find((i) => i.article.imageUrl) ?? personal[0] ?? null;
    const rest = personal.filter((i) => i !== lead);
    const byReason = (kind: Item["kind"]) => {
      const groups = new Map<string, Item[]>();
      for (const item of rest.filter((i) => i.kind === kind)) {
        groups.set(item.reason, [...(groups.get(item.reason) ?? []), item]);
      }
      return [...groups.entries()];
    };
    return {
      lead,
      people: byReason("person"),
      cities: byReason("city"),
      topics: rest.filter((i) => i.kind === "category" || i.kind === "learned"),
      top: feed.filter((i) => i.kind === "top"),
      count: personal.length,
    };
  }, [feed]);

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

  const summary = [
    ...interests.categories,
    ...interests.people.map((id) => personById(id)?.name).filter(Boolean),
    ...interests.cities.map((id) => cityById(id)?.name).filter(Boolean),
  ].join(" · ");

  const showSignup = justFinished && signedIn === false && !signupDismissed;
  const { lead, people, cities, topics, top, count } = paper;

  return (
    <div className="perty-shell perty-shell--wide perty-paper">
      <header className="perty-mast">
        <div className="perty-mast-copy">
          <h1 className="perty-mast-title">
            {greeting(now)}
            {name ? `, ${name}` : ""}.
          </h1>
          <p className="perty-mast-line">
            <span className="perty-mast-date">{dateline(now)}</span>
            {count > 0 && (
              <>
                {" · "}Sot kam <b>{count}</b> {count === 1 ? "lajm" : "lajme"} për ty.
              </>
            )}
          </p>
          <p className="perty-summary">{summary}</p>
          <div className="perty-head-actions">
            <button type="button" className="perty-btn perty-btn--ghost" onClick={() => setEditing(true)}>
              <SlidersHorizontal size={16} strokeWidth={2.3} aria-hidden="true" />
              Ndrysho interesat
            </button>
            <Link href="/" className="perty-link">
              Kryesoret <ArrowRight size={15} strokeWidth={2.4} aria-hidden="true" />
            </Link>
          </div>
        </div>
        <div className="perty-mast-dardani">
          <DardaniLoop name="greeting" alt="Dardani të përshëndet" className="perty-mast-loop" />
          {streak >= 2 && (
            <p className="perty-streak">
              <DardaniImage name="streak" decorative className="perty-streak-img" />
              <span>
                <b>{streak} ditë rresht!</b>
                <small>Kthehu nesër që të mos e prishësh.</small>
              </span>
            </p>
          )}
        </div>
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

      {!lead ? (
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
          <div className="perty-front">
            <Lead item={lead} />
            {top.length > 0 && (
              <section className="perty-top" aria-labelledby="perty-top-title">
                <h2 id="perty-top-title">Kryesoret e ditës</h2>
                <ol>
                  {top.map(({ article }) => (
                    <li key={article.slug}>
                      <Link href={`/article/${article.slug}`}>
                        <strong>{article.title}</strong>
                        <span>
                          <b style={{ color: getCategoryColor(article.category) }}>{article.category}</b>
                          {" · "}
                          <TimeAgo iso={article.publishedAt} />
                        </span>
                      </Link>
                    </li>
                  ))}
                </ol>
              </section>
            )}
          </div>

          <DardaniNote
            face="happy"
            text="Ke një pyetje për lajmin e parë? Ta shpjegoj unë, vetëm nga artikujt e 383."
            action="Pyet Dardanin"
            onAction={() => openPyet(`Pse ndodhi kjo: ${lead.article.title}`)}
          />

          {people.map(([reason, items]) => {
            const person = reason.replace(/^Sepse ndjek /, "");
            return (
              <section key={reason} className="perty-section" aria-label={person}>
                <h2 className="perty-section-title">
                  <span className="perty-person-mark" aria-hidden="true">
                    {initials(person)}
                  </span>
                  {person}
                </h2>
                <div className="perty-row">
                  {items.map((item) => (
                    <StoryCard key={item.article.slug} item={item} showReason={false} />
                  ))}
                </div>
              </section>
            );
          })}

          {cities.map(([reason, items]) => (
            <section key={reason} className="perty-section" aria-label={reason}>
              <h2 className="perty-section-title">{reason}</h2>
              <div className="perty-row">
                {items.map((item) => (
                  <StoryCard key={item.article.slug} item={item} showReason={false} />
                ))}
              </div>
            </section>
          ))}

          {topics.length > 0 && (
            <section className="perty-section" aria-labelledby="perty-topics-title">
              <h2 className="perty-section-title" id="perty-topics-title">
                Temat e tua
              </h2>
              <ol className="perty-list">
                {topics.map((item) => (
                  <li key={item.article.slug} className="perty-item" data-kind={item.kind}>
                    <StoryRow item={item} />
                  </li>
                ))}
              </ol>
            </section>
          )}

          {(people.length > 0 || topics.length > 3) && (
            <DardaniNote
              face="neutral"
              text="Dikë tjetër që ndjek? Shto emra ose tema, dhe unë i sjell të parët."
              action="Shto interesa"
              onAction={() => setEditing(true)}
            />
          )}
        </>
      )}

      <footer className="perty-foot">
        <p>Renditja mëson pak nga ajo që lexon dhe pyet — vetëm në këtë pajisje, pa u dërguar askund.</p>
        {Object.keys(interests.affinity).length > 0 && (
          <button type="button" className="perty-text-btn" onClick={() => save({ ...interests, affinity: {} })}>
            Harro historikun e leximit
          </button>
        )}
      </footer>
    </div>
  );
}

function Lead({ item }: { item: Item }) {
  const { article, reason } = item;
  return (
    <article className="perty-lead">
      <Link href={`/article/${article.slug}`} className="perty-lead-link">
        {article.imageUrl && (
          <span className="perty-lead-img">
            <Image
              src={article.imageUrl}
              alt=""
              fill
              priority
              sizes="(max-width: 900px) 100vw, 60vw"
              style={{ objectFit: "cover" }}
            />
          </span>
        )}
        <span className="perty-lead-body">
          <span className="perty-reason">{reason}</span>
          <strong className="perty-lead-title">{article.title}</strong>
          {article.excerpt && <span className="perty-lead-excerpt">{article.excerpt}</span>}
          <Meta article={article} />
        </span>
      </Link>
    </article>
  );
}

function StoryCard({ item, showReason = true }: { item: Item; showReason?: boolean }) {
  const { article, reason } = item;
  return (
    <Link href={`/article/${article.slug}`} className="perty-card">
      <span className="perty-card-img">
        {article.imageUrl ? (
          <Image src={article.imageUrl} alt="" fill sizes="(max-width: 640px) 70vw, 280px" style={{ objectFit: "cover" }} />
        ) : (
          <span className="perty-thumb-empty" style={{ background: getCategoryColor(article.category) }} />
        )}
      </span>
      {showReason && <span className="perty-reason">{reason}</span>}
      <strong className="perty-card-title">{article.title}</strong>
      <Meta article={article} />
    </Link>
  );
}

function StoryRow({ item }: { item: Item }) {
  const { article, reason } = item;
  return (
    <Link href={`/article/${article.slug}`} className="perty-item-link">
      <span className="perty-thumb">
        {article.imageUrl ? (
          <Image src={article.imageUrl} alt="" fill sizes="(max-width: 640px) 96px, 132px" style={{ objectFit: "cover" }} />
        ) : (
          <span className="perty-thumb-empty" style={{ background: getCategoryColor(article.category) }} />
        )}
      </span>
      <span className="perty-item-body">
        <span className="perty-reason">{reason}</span>
        <strong className="perty-item-title">{article.title}</strong>
        <Meta article={article} />
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

/** Dardani, between sections, with one thing to do. */
function DardaniNote({
  face,
  text,
  action,
  onAction,
}: {
  face: "happy" | "neutral";
  text: string;
  action: string;
  onAction: () => void;
}) {
  return (
    <aside className="perty-dnote">
      <DardaniFace state={face} size={52} decorative />
      <p>{text}</p>
      <button type="button" className="perty-btn perty-btn--ghost" onClick={onAction}>
        <MessageCircleQuestion size={16} strokeWidth={2.3} aria-hidden="true" />
        {action}
      </button>
    </aside>
  );
}
