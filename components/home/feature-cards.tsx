// The three things 383 has that a Kosovo news reader cannot get elsewhere.
//
// Card anatomy, and the reason for it: icon and title on one row, the blurb
// under it, then the feature's own substance inside a CONTAINED panel, then one
// action. Nothing overlaps anything.
//
// The previous version floated text and data panels directly on top of the
// artwork, which cost legibility twice over — the map's brightest routes ran
// straight under the highlight box, and the border photograph was almost
// entirely hidden behind a four-row table. Giving the visual its own inset
// panel means the artwork can be fully visible and the text can be fully
// readable, instead of the two negotiating for the same pixels.
//
// The inset panel is dark on every card, including the orange ones. That is
// what stops the orange route-map from disappearing into an orange card.
//
// The honesty rules are unchanged: lead with a real finding rather than a bare
// number, and when a source is unavailable the card keeps explaining and keeps
// linking, but stops claiming to know today's answer.

import Link from "next/link";
import Image from "next/image";
import { Globe2, MapPinned } from "lucide-react";
import TreguCard from "./tregu-card";

export type BotaFinding = {
  outlet: string;
  line: string;
  countryCount?: number;
  articleCount?: number;
} | null;

export type WaitRange = { lo: number; hi: number } | null;

export type BorderSummary = {
  entry: WaitRange;
  exit: WaitRange;
  updatedAt: string | null;
} | null;

/** "Pa pritje" is only honest at zero; anything else prints the real range. */
function waitLabel(range: WaitRange): string {
  if (!range) return "Pa të dhëna";
  if (range.hi === 0) return "Pa pritje";
  if (range.lo === range.hi) return `${range.hi} min`;
  return `${range.lo}–${range.hi} min`;
}

function waitTone(range: WaitRange): "ok" | "warn" | "bad" | "unknown" {
  if (!range) return "unknown";
  if (range.hi >= 30) return "bad";
  if (range.hi >= 15) return "warn";
  return "ok";
}

export default function FeatureCards({
  bota,
  border,
  borderImage,
}: {
  bota?: BotaFinding;
  border?: BorderSummary;
  borderImage?: string | null;
}) {
  return (
    <section className="home-features" aria-label="Çfarë ka 383">
      {/* ── Bota për Kosovën ─────────────────────────────────────────────── */}
      <article className="home-feature home-feature--orange">
        <header className="home-feature-head">
          <span className="home-feature-icon">
            <Globe2 size={22} strokeWidth={2.2} aria-hidden="true" />
          </span>
          <h3>Bota për Kosovën</h3>
        </header>

        <p className="home-feature-blurb">
          Shiko si raportojnë mediat ndërkombëtare për Kosovën dhe kupto tonin e
          tyre.
        </p>

        <div className="home-feature-panel home-feature-panel--map">
          <Image
            src="/images/home/bota-map.png"
            alt=""
            fill
            sizes="(max-width: 1080px) 100vw, 400px"
            style={{ objectFit: "cover", objectPosition: "center" }}
          />
          {bota && (
            <div className="home-panel-caption">
              <strong>{bota.outlet}</strong>
              <span>{bota.line}</span>
            </div>
          )}
        </div>

        {bota?.articleCount ? (
          <p className="home-feature-meta">
            {bota.articleCount} artikuj
            {bota.countryCount ? ` · ${bota.countryCount} vende` : ""}
          </p>
        ) : (
          <p className="home-feature-meta">Analiza e sotme po përgatitet</p>
        )}

        <Link href="/bota-per-kosoven" className="home-feature-cta">
          Shiko analizën <span aria-hidden="true">→</span>
        </Link>
      </article>

      {/* ── Tregu ────────────────────────────────────────────────────────── */}
      <TreguCard />

      {/* ── Diaspora ─────────────────────────────────────────────────────── */}
      <article className="home-feature home-feature--orange">
        <header className="home-feature-head">
          <span className="home-feature-icon">
            <MapPinned size={22} strokeWidth={2.2} aria-hidden="true" />
          </span>
          <h3>Diaspora</h3>
        </header>

        <p className="home-feature-blurb">
          Planifiko udhëtimin tënd. Kontrollo kufirin, zbulo qytetet — gjithçka që
          të duhet për Kosovën.
        </p>

        <div className="home-feature-panel home-feature-panel--photo">
          {borderImage && (
            <Image
              src={borderImage}
              alt=""
              fill
              sizes="(max-width: 1080px) 100vw, 400px"
              style={{ objectFit: "cover", objectPosition: "center 62%" }}
            />
          )}

          {border ? (
            // A compact badge, not a table. It sits in the corner so the
            // photograph stays readable as a photograph.
            <div className="home-wait-badge">
              <span data-tone={waitTone(border.entry)}>
                <i aria-hidden="true" />
                Hyrje: {waitLabel(border.entry)}
              </span>
              <span data-tone={waitTone(border.exit)}>
                <i aria-hidden="true" />
                Dalje: {waitLabel(border.exit)}
              </span>
            </div>
          ) : (
            <div className="home-wait-badge home-wait-badge--down">
              <span data-tone="unknown">
                <i aria-hidden="true" />
                Të dhënat mungojnë
              </span>
            </div>
          )}
        </div>

        <p className="home-feature-meta">
          {border?.updatedAt ? `MPB · ${border.updatedAt}` : "Burimi: MPB"}
        </p>

        <Link href="/visit" className="home-feature-cta">
          Kontrollo kufirin <span aria-hidden="true">→</span>
        </Link>
      </article>
    </section>
  );
}
