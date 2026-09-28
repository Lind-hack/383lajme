import type { CSSProperties } from "react";
import { isImageEmblem, leagueColor, scopeOf, type LeagueSummary } from "@/lib/tregu-leagues";

type EmblemLeague = Pick<LeagueSummary, "emblem" | "color" | "scope_kind" | "scope_value" | "kind" | "name">;

/** A league's mark: its uploaded or brand image, else an emoji, on its colour. */
export default function LeagueEmblem({ league, size = 44 }: { league: EmblemLeague; size?: number }) {
  const emblem = league.emblem || (league.kind === "public" ? scopeOf(league).emblem : "🏆");
  return (
    <span
      className="lg-emblem"
      style={{ "--size": `${size}px`, "--lg-color": leagueColor(league) } as CSSProperties}
      aria-hidden
    >
      {isImageEmblem(emblem) ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={emblem} alt="" loading="lazy" />
      ) : (
        <span>{emblem}</span>
      )}
    </span>
  );
}
