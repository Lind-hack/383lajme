"use client";

import Link from "next/link";

import { f1DriverHeadshot, f1TeamColor } from "@/lib/f1-driver-presentation";

/**
 * The three drivers most likely to win, on the card itself.
 *
 * A race card used to say only what the market thought as a single headline
 * percentage, which is the one number a reader cannot act on: it names a
 * probability without naming whose it is. Three rows answer the question the
 * card is actually asked — who wins this — and they are ranked, so the gap
 * between first and third is read rather than computed.
 *
 * The bar is the order-book depth bar of the Tregu floor, reused rather than
 * reinvented: same idiom, same job, sized to the probability it reports. It
 * carries the constructor's colour because on this one market type the colour
 * IS the identity, and it never appears beside a PO/JO control, so the floor's
 * two-colour rule is not in play here.
 *
 * Portraits come from the official 2026 media library through
 * f1DriverHeadshot. They are decorative — the name carries the meaning — so
 * they are aria-hidden, and a driver whose portrait is missing or blocked
 * falls back to their three-letter code rather than a hole in the row.
 */

export interface F1TopThreeDriver {
  key: string;
  label: string;
  team?: string | null;
  team_colour?: string | null;
  headshot_url?: string | null;
  probability: number;
  /**
   * The line under the name. A championship row earns its place with points and
   * the gap to the leader; a race row has neither yet, so it names the team.
   */
  meta?: string | null;
}

/** Ranked, highest first, capped at three. */
export function topThreeDrivers(
  outcomes: Array<Record<string, unknown>> | null | undefined,
  probabilities: Record<string, number> | null | undefined
): F1TopThreeDriver[] {
  return (outcomes ?? [])
    .map((outcome) => {
      const key = String((outcome as { key?: unknown }).key ?? "");
      return {
        key,
        label: String((outcome as { label?: unknown }).label ?? key),
        team: (outcome as { team?: string | null }).team ?? null,
        team_colour: (outcome as { team_colour?: string | null }).team_colour ?? null,
        headshot_url: (outcome as { headshot_url?: string | null }).headshot_url ?? null,
        probability: Number(probabilities?.[key] ?? 0),
      };
    })
    .filter((driver) => driver.key && Number.isFinite(driver.probability))
    .sort((a, b) => b.probability - a.probability)
    .slice(0, 3);
}

export default function F1TopThree({
  drivers,
  label = "Tre favoritët",
  hrefFor,
  tabIndex,
}: {
  drivers: F1TopThreeDriver[];
  label?: string;
  /** When given, each row deep-links to that driver's side of the market. */
  hrefFor?: (driver: F1TopThreeDriver) => string;
  tabIndex?: number;
}) {
  if (!drivers.length) return null;
  // The bar is read against the leader, not against 100%: at these odds every
  // bar would otherwise sit in the first third of its track and the ranking
  // would be carried by the number alone.
  const leader = Math.max(...drivers.map((driver) => driver.probability), 0.0001);

  return (
    <ol className="tregu-f1-top3" aria-label={label}>
      {drivers.map((driver, index) => {
        const colour = f1TeamColor(driver.team ?? "", driver.team_colour ?? undefined);
        const portrait = f1DriverHeadshot(driver.key, driver.headshot_url ?? undefined);
        const percent = Math.round(driver.probability * 100);
        const inner = (
          <>
            <span className="tregu-f1-top3-rank" aria-hidden>{index + 1}</span>
            <span className="tregu-f1-top3-face" aria-hidden>
              {portrait ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={portrait} alt="" referrerPolicy="no-referrer" loading="lazy" decoding="async" />
              ) : (
                <span className="tregu-f1-top3-initials">{driver.key.slice(0, 3)}</span>
              )}
            </span>
            <span className="tregu-f1-top3-who">
              <strong>{driver.label}</strong>
              {driver.meta ?? driver.team ? <small>{driver.meta ?? driver.team}</small> : null}
              <span className="tregu-f1-top3-bar" aria-hidden />
            </span>
            <strong className="tregu-f1-top3-odd">
              {percent}<span aria-hidden>%</span>
              <span className="tregu-sr-only"> për qind gjasa për fitore</span>
            </strong>
          </>
        );
        const style = {
          ["--f1-team" as string]: colour,
          ["--f1-share" as string]: `${Math.max(4, (driver.probability / leader) * 100)}%`,
        };
        const href = hrefFor?.(driver);
        return (
          <li key={driver.key}>
            {href ? (
              <Link className="tregu-f1-top3-row" href={href} style={style} tabIndex={tabIndex}>
                {inner}
              </Link>
            ) : (
              <div className="tregu-f1-top3-row" style={style}>{inner}</div>
            )}
          </li>
        );
      })}
    </ol>
  );
}
