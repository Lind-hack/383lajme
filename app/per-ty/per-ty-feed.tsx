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

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowRight, SlidersHorizontal, UserRound, X } from "lucide-react";
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
import { mergeOnSignIn, pushInterests } from "@/lib/interests-sync";
import { createClient } from "@/lib/supabase/client";
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

export default function PerTyFeed({ pool }: { pool: FeedArticle[] }) {
  const [interests, setInterests] = useState<Interests | null>(null);
  const [editing, setEditing] = useState(false);
  const [justFinished, setJustFinished] = useState(false);
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [signupDismissed, setSignupDismissed] = useState(true);
  const [storageFailed, setStorageFailed] = useState(false);

  useEffect(() => {
    setInterests(readInterests());
    setSignupDismissed(readFlag(SIGNUP_DISMISSED));
    let alive = true;
    // Auth is only needed for sync. If the client cannot even be built (no
    // Supabase config), the feed carries on as a guest feed.
    Promise.resolve()
      .then(() => createClient().auth.getUser())
      .then(({ data }) => {
        if (!alive) return;
        setSignedIn(Boolean(data?.user));
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

  const feed = useMemo(
    () => (interests && hasInterests(interests) ? rankFeed(pool, interests) : []),
    [pool, interests]
  );

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
  if (!interests) return <div className="perty-shell perty-shell--loading" aria-busy="true" />;

  if (!hasInterests(interests) || editing) {
    return (
      <div className="perty-shell">
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
  const personal = feed.filter((i) => i.kind !== "top");

  return (
    <div className="perty-shell">
      <header className="perty-head">
        <div>
          <h1 className="perty-title">Për ty</h1>
          <p className="perty-summary">{summary}</p>
        </div>
        <div className="perty-head-actions">
          <button type="button" className="perty-btn perty-btn--ghost" onClick={() => setEditing(true)}>
            <SlidersHorizontal size={16} strokeWidth={2.3} aria-hidden="true" />
            Ndrysho interesat
          </button>
          <Link href="/" className="perty-link">
            Kryesoret <ArrowRight size={15} strokeWidth={2.4} aria-hidden="true" />
          </Link>
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

      {personal.length === 0 ? (
        <div className="perty-empty">
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
        <ol className="perty-list">
          {feed.map(({ article, reason, kind }) => (
            <li key={article.slug} className="perty-item" data-kind={kind}>
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
                </span>
              </Link>
            </li>
          ))}
        </ol>
      )}

      <footer className="perty-foot">
        <p>
          Renditja mëson pak nga ajo që lexon — vetëm në këtë pajisje, pa u dërguar askund.
        </p>
        {Object.keys(interests.affinity).length > 0 && (
          <button
            type="button"
            className="perty-text-btn"
            onClick={() => save({ ...interests, affinity: {} })}
          >
            Harro historikun e leximit
          </button>
        )}
      </footer>
    </div>
  );
}
