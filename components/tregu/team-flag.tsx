"use client";

// Country flags as inline SVG — Windows renders emoji flags as letter pairs
// ("AR"), so real markup is the only reliable cross-platform option. Rendered
// as rounded squares ("cubic" avatars) per the Polymarket-style trade card.

import { outcomeMediaFor } from "@/lib/tregu-media";

const FLAG_KEYS = ["argjentina", "spanja", "anglia"] as const;
export type FlagKey = (typeof FLAG_KEYS)[number] | "generic";

/** Match a team/outcome label to a flag; falls back to a monogram tile. */
export function flagKeyFor(label: string): FlagKey {
  const l = label.toLowerCase();
  if (l.includes("argjentin") || l.includes("argentin")) return "argjentina";
  if (l.includes("spanj") || l.includes("spain") || l.includes("spanish")) return "spanja";
  if (l.includes("angli") || l.includes("england")) return "anglia";
  return "generic";
}

export default function TeamFlag({
  team,
  size = 44,
  radius = 12,
  label,
}: {
  team: FlagKey | string;
  size?: number;
  radius?: number;
  /** Monogram source for the generic tile. */
  label?: string;
}) {
  // Outcomes with a registered headshot (F1 drivers etc.) wear it instead of
  // a flag or monogram — same rounded-square tile, photo fill.
  const media = outcomeMediaFor(label ?? team);
  if (media?.photo) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={media.photo}
        alt=""
        width={size}
        height={size}
        loading="lazy"
        style={{
          width: size,
          height: size,
          borderRadius: radius,
          objectFit: "cover",
          objectPosition: "center top",
          background: `color-mix(in srgb, ${media.color ?? "#111111"} 18%, #FFFFFF)`,
          display: "block",
          flexShrink: 0,
        }}
        aria-hidden
      />
    );
  }

  const key: FlagKey = FLAG_KEYS.includes(team as (typeof FLAG_KEYS)[number])
    ? (team as FlagKey)
    : flagKeyFor(team);
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 44 44",
    style: { borderRadius: radius, display: "block", flexShrink: 0 } as const,
    "aria-hidden": true as const,
  };

  if (key === "argjentina") {
    return (
      <svg {...common}>
        <rect width="44" height="44" fill="#74ACDF" />
        <rect y="14.67" width="44" height="14.66" fill="#FFFFFF" />
        <circle cx="22" cy="22" r="4.4" fill="#F6B40E" stroke="#85340A" strokeWidth="0.9" />
        <rect width="44" height="44" fill="none" stroke="rgba(17,17,17,0.12)" strokeWidth="1.5" />
      </svg>
    );
  }
  if (key === "spanja") {
    return (
      <svg {...common}>
        <rect width="44" height="44" fill="#AA151B" />
        <rect y="11" width="44" height="22" fill="#F1BF00" />
        <rect x="12" y="18" width="6.5" height="8.5" rx="1" fill="#AA151B" />
        <rect width="44" height="44" fill="none" stroke="rgba(17,17,17,0.12)" strokeWidth="1.5" />
      </svg>
    );
  }
  if (key === "anglia") {
    return (
      <svg {...common}>
        <rect width="44" height="44" fill="#FFFFFF" />
        <rect x="18.5" width="7" height="44" fill="#CE1124" />
        <rect y="18.5" width="44" height="7" fill="#CE1124" />
        <rect width="44" height="44" fill="none" stroke="rgba(17,17,17,0.12)" strokeWidth="1.5" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <rect width="44" height="44" fill="#111111" />
      <text
        x="22"
        y="28"
        textAnchor="middle"
        fill="#F9F6F1"
        fontSize="17"
        fontWeight="700"
        fontFamily="inherit"
      >
        {(label ?? "?").trim().slice(0, 2).toUpperCase()}
      </text>
    </svg>
  );
}
