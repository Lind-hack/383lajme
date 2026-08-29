import Link from "next/link";
import { History } from "lucide-react";
import { getArticles } from "@/lib/db";

/**
 * "Nga arkivi" — the genuinely oldest pieces in the pool, sorted by real
 * publish date. This module used to present invented "5 years ago today"
 * content from static mocks, which a news brand cannot ship. It now shows
 * only verified 383 articles, prefers one per category, and renders nothing
 * while the archive is still too young to fill it honestly.
 */

const MONTHS_SQ = [
  "janar", "shkurt", "mars", "prill", "maj", "qershor",
  "korrik", "gusht", "shtator", "tetor", "nëntor", "dhjetor",
];

/** Thirty days before an article counts as archive rather than news. */
const MIN_AGE_MS = 30 * 24 * 60 * 60 * 1000;

function formatArchiveDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getUTCDate()} ${MONTHS_SQ[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

export default async function ThrowbackSection() {
  const all = await getArticles(100, undefined, { withBody: false });
  const cutoff = Date.now() - MIN_AGE_MS;

  const eligible = all
    .filter((a) => {
      const ts = Date.parse(a.publishedAt);
      return Number.isFinite(ts) && ts <= cutoff;
    })
    .sort((a, b) => a.publishedAt.localeCompare(b.publishedAt));

  // One per category first, so three slots cover three parts of the site.
  const picked: typeof eligible = [];
  const seenCategories = new Set<string>();
  for (const a of eligible) {
    if (seenCategories.has(a.category)) continue;
    seenCategories.add(a.category);
    picked.push(a);
  }
  // A young archive beats a repetitive one, but never an invented one.
  for (const a of eligible) {
    if (picked.length >= 3) break;
    if (!picked.includes(a)) picked.push(a);
  }

  if (picked.length < 2) return null;

  return (
    <section style={{ marginBottom: "var(--space-section)" }}>
      <div
        style={{
          background: "rgba(245,158,11,0.06)",
          border: "1px solid rgba(245,158,11,0.25)",
          borderRadius: "24px",
          padding: "clamp(16px, 4vw, 32px)",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            flexWrap: "wrap" as const,
            gap: "8px",
            marginBottom: "24px",
          }}
        >
          <History size={16} strokeWidth={2} style={{ color: "#B45309" }} />
          <span
            style={{
              fontSize: "10px",
              fontWeight: 800,
              letterSpacing: "0.15em",
              textTransform: "uppercase" as const,
              color: "#B45309",
            }}
          >
            Nga arkivi
          </span>
          <span
            style={{
              marginLeft: "auto",
              fontSize: "10px",
              fontWeight: 700,
              letterSpacing: "0.1em",
              textTransform: "uppercase" as const,
              color: "#B45309",
              background: "rgba(180,83,9,0.12)",
              border: "1px solid rgba(180,83,9,0.25)",
              borderRadius: "100px",
              padding: "4px 10px",
            }}
          >
            Më të vjetrat
          </span>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
            gap: "24px",
            alignItems: "start",
          }}
        >
          {picked.map((article) => (
            <Link
              key={article.slug}
              href={`/article/${article.slug}`}
              style={{
                background: "rgba(180,83,9,0.06)",
                border: "1px solid rgba(180,83,9,0.15)",
                borderRadius: "16px",
                padding: "20px",
                display: "block",
                textDecoration: "none",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  marginBottom: "12px",
                }}
              >
                <span
                  style={{
                    fontSize: "10px",
                    fontWeight: 800,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase" as const,
                    color: "#B45309",
                    background: "rgba(180,83,9,0.12)",
                    borderRadius: "100px",
                    padding: "3px 8px",
                  }}
                >
                  {article.category}
                </span>
                <span
                  style={{
                    fontSize: "11px",
                    fontWeight: 600,
                    color: "#92400E",
                    opacity: 0.75,
                  }}
                >
                  {formatArchiveDate(article.publishedAt)}
                </span>
              </div>
              <p
                style={{
                  fontSize: "14px",
                  fontWeight: 700,
                  lineHeight: 1.35,
                  color: "#78350F",
                  margin: "0 0 8px",
                }}
              >
                {article.title}
              </p>
              <p
                style={{
                  fontSize: "13px",
                  lineHeight: 1.55,
                  color: "#92400E",
                  margin: 0,
                  opacity: 0.85,
                  display: "-webkit-box",
                  WebkitLineClamp: 3,
                  WebkitBoxOrient: "vertical" as const,
                  overflow: "hidden",
                }}
              >
                {article.excerpt}
              </p>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
