"use client";

// Multi-outcome event card — the Polymarket face of a grouped event.
// One combined chart (every outcome's live line) above outcome rows:
// name + live % + a buy button in that outcome's colour. Clicking a row's
// button jumps to that outcome's book with PO pre-selected; the card body
// links to the favourite outcome.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { fmtNum } from "@/lib/format";
import type { MarketGroup } from "@/lib/tregu-groups";
import GroupChart from "@/components/tregu/group-chart";

const CATEGORY_LABEL: Record<string, string> = {
  politike: "Politikë",
  ekonomi: "Ekonomi",
  sport: "Sport",
  bote: "Botë",
  "te-tjera": "Të tjera",
};

function closeLabel(iso?: string): string | null {
  if (!iso) return null;
  const ms = new Date(iso).getTime() - Date.now();
  if (Number.isNaN(ms)) return null;
  if (ms <= 0) return "Mbyllur";
  const days = Math.floor(ms / 86_400_000);
  if (days >= 1) return `Mbyllet ${days}d`;
  const hours = Math.floor(ms / 3_600_000);
  if (hours >= 1) return `Mbyllet ${hours}h`;
  return `Mbyllet ${Math.max(1, Math.floor(ms / 60_000))}m`;
}

export default function MarketEventCard({ group }: { group: MarketGroup }) {
  const router = useRouter();
  const remaining = closeLabel(group.closesAt);

  const buy = (e: React.MouseEvent, slug: string) => {
    e.preventDefault();
    e.stopPropagation();
    router.push(`/tregu/${slug}?ana=po`);
  };

  return (
    <Link
      href={`/tregu/${group.outcomes[0].slug}`}
      className="tregu-glass tregu-market tregu-edge tregu-event"
      data-cat={group.category}
      style={{ display: "flex", flexDirection: "column", textDecoration: "none", color: "#111111" }}
    >
      <div className="tregu-market-top">
        <span className="tregu-pill">{CATEGORY_LABEL[group.category] ?? group.category}</span>
        <span className="tregu-market-flag">{group.outcomes.length} rezultate</span>
      </div>

      <p className="tregu-market-q">{group.title}</p>

      <div style={{ margin: "0 0 12px" }}>
        <GroupChart
          height={150}
          series={group.outcomes.map((o) => ({
            label: o.label,
            color: o.color,
            points: o.spark,
            prob: o.prob,
          }))}
        />
      </div>

      <div className="tregu-event-rows">
        {group.outcomes.map((o) => (
          <div key={o.slug} className="tregu-event-row">
            <span className="tregu-event-row-label">
              <span className="tregu-gchart-chip-dot" style={{ background: o.color }} />
              {o.label}
            </span>
            <span className="tregu-event-row-pct">{Math.round(o.prob * 100)}%</span>
            <button
              type="button"
              className="tregu-event-buy"
              style={{ ["--row-color" as string]: o.color }}
              onClick={(e) => buy(e, o.slug)}
            >
              Blej {Math.round(o.prob * 100)}%
            </button>
          </div>
        ))}
      </div>

      <div className="tregu-market-foot">
        <span>
          {group.volume > 0 ? `Vëllimi ${fmtNum(Math.round(group.volume))} 383C` : "Treg i ri"}
          {remaining ? ` · ${remaining}` : ""}
        </span>
        <span className="tregu-market-open">Hap ngjarjen →</span>
      </div>
    </Link>
  );
}
