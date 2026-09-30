"use client";

// "Lajmet sipas interesave të tua" — the homepage entry to Për ty.
//
// The single most important decision here: picking topics and seeing the result
// requires NO account. The blueprint is explicit that a reader should see what
// personalisation does for them before being asked for anything, and the
// existing `bookmarks` key already established that this site lets guests keep
// state on their own device. Signing in later syncs those choices across
// devices and unlocks the optional email; it is not the price of entry.
//
// The preview filters an in-memory pool the page already loaded. No fetch, no
// spinner, no failure mode — the result appears in the same frame as the tap,
// which is what makes the feature legible in one glance. A network round trip
// here would buy nothing and add three states to design.

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Heart, ListChecks, Sparkles, Mail } from "lucide-react";
import { NAV_CATEGORIES, type NavCategory } from "@/lib/category-map";
import {
  readInterests,
  writeInterests,
  toggleCategory,
  matchArticles,
} from "@/lib/interests.mjs";
import SectionLabel from "@/components/section-label";
import { toast } from "@/components/ui/toast";

export type PreviewArticle = {
  slug: string;
  title: string;
  category: string;
  source: string;
};

const STEPS = [
  { icon: ListChecks, label: "Zgjidh temat" },
  { icon: Sparkles, label: "Shiko Për ty" },
  { icon: Mail, label: "Email, nëse dëshiron" },
];

export default function PerTyBlock({ pool }: { pool: PreviewArticle[] }) {
  // Starts empty on both server and client so the first paint matches. The
  // reader's stored choices arrive in the effect below, after hydration.
  const [categories, setCategories] = useState<NavCategory[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setCategories(readInterests().categories);
    setReady(true);
  }, []);

  // Persisting in an effect rather than inside the click handler. Two taps in
  // the same tick both read the same `categories` from their render closure, so
  // writing there made the second overwrite the first and silently lose a
  // choice — easy to hit with a fast thumb on a phone. The functional update
  // below composes correctly, and this effect saves whatever it settles on.
  //
  // The `ready` guard matters: without it the initial empty state would be
  // written over the reader's stored interests before the read effect has run.
  useEffect(() => {
    if (!ready) return;
    if (!writeInterests({ ...readInterests(), categories })) {
      toast("Shfletuesi nuk i ruan dot zgjedhjet në këtë pajisje.", "error");
    }
  }, [categories, ready]);

  const matches = useMemo(
    () => matchArticles(pool, { v: 1, categories, topics: [] }, 3),
    [pool, categories]
  );

  function onToggle(label: string) {
    setCategories((prev) => toggleCategory(prev, label));
  }

  const chosen = categories.length > 0;

  return (
    <section className="home-perty" aria-labelledby="home-perty-title">
      <div className="home-perty-main">
        <SectionLabel
          label={
            <span id="home-perty-title" className="home-perty-heading">
              <Heart size={18} strokeWidth={2.4} aria-hidden="true" />
              Lajmet sipas interesave të tua
            </span>
          }
        />

        <p className="home-perty-lede">
          Zgjidh temat që të interesojnë. Rezultatin e sheh menjëherë, këtu — pa
          llogari dhe pa email.
        </p>

        <ol className="home-perty-steps">
          {STEPS.map((step, i) => (
            <li key={step.label}>
              <span className="home-perty-step-icon">
                <step.icon size={18} strokeWidth={2.2} aria-hidden="true" />
              </span>
              <span>{step.label}</span>
              {i < STEPS.length - 1 && (
                <span className="home-perty-step-arrow" aria-hidden="true">
                  →
                </span>
              )}
            </li>
          ))}
        </ol>

        <div
          className="home-perty-chips"
          role="group"
          aria-label="Zgjidh temat që të interesojnë"
        >
          {NAV_CATEGORIES.map((cat) => {
            const active = categories.includes(cat.label);
            return (
              <button
                key={cat.slug}
                type="button"
                onClick={() => onToggle(cat.label)}
                aria-pressed={active}
                className="home-perty-chip"
                data-active={active ? "true" : undefined}
              >
                {cat.label}
              </button>
            );
          })}
        </div>

        <div className="home-perty-result" aria-live="polite">
          {!ready ? null : !chosen ? (
            <p className="home-perty-empty">
              Zgjidh një temë më lart dhe lajmet shfaqen menjëherë këtu.
            </p>
          ) : matches.length === 0 ? (
            <p className="home-perty-empty">
              Sot nuk ka lajme të reja nga temat që zgjodhe. Do t&apos;i shohësh
              sapo të publikohen.
            </p>
          ) : (
            <ul className="home-perty-matches">
              {matches.map((article) => (
                <li key={article.slug}>
                  <Link href={`/article/${article.slug}`}>
                    <strong>{article.title}</strong>
                    {/* The blueprint calls this the reason label: a reader must
                        be able to see WHY something was recommended. */}
                    <span>Sepse ndjek {article.category}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="home-perty-actions">
          <Link href="/per-ty" className="home-perty-cta">
            {chosen ? "Hap Për ty" : "Zgjidh temat"} <span aria-hidden="true">→</span>
          </Link>
          {chosen && (
            <span className="home-perty-note">
              Ruhen në këtë pajisje. Hyr për t&apos;i përdorur kudo.
            </span>
          )}
        </div>
      </div>

      {/* A picture of the optional morning email, not a signup form. One header,
          a title, three lines. The footer already holds the only email field on
          this page; a second capture point here is exactly the clutter this
          redesign exists to remove, and every extra control would compete with
          the topic chips, which are the actual thing to do in this block. */}
      <aside className="home-perty-mail" aria-label="Shembull i emailit të mëngjesit">
        <header>
          <span>Shembull email-i</span>
          <b>Së shpejti</b>
        </header>
        <h4>Mëngjesi yt me 383</h4>
        <ol>
          {(matches.length > 0 ? matches : pool.slice(0, 3)).map((article) => (
            <li key={article.slug}>{article.title}</li>
          ))}
        </ol>
      </aside>
    </section>
  );
}
