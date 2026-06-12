import Link from "next/link";
import { type Article, timeAgo } from "@/lib/mock-data";
import { FONT } from "@/lib/tokens";
import SectionLabel from "./section-label";

/** Convert an emoji flag (regional indicator pair) to a two-letter country code. */
function flagToCode(flag: string): string {
  const letters = Array.from(flag)
    .map((c) => c.codePointAt(0) ?? 0)
    .filter((cp) => cp >= 0x1f1e6 && cp <= 0x1f1ff)
    .map((cp) => String.fromCharCode(cp - 0x1f1e6 + 65));
  return letters.length === 2 ? letters.join("") : "";
}

interface BotaFletProps {
  /** Expects 3 articles: [0] = lead (left), [1,2] = stack (right) */
  articles: Article[];
}

function Overline({ flag, source }: { flag: string; source: string }) {
  const code = flagToCode(flag);
  return (
    <div
      style={{
        fontSize: "10px",
        fontWeight: 800,
        letterSpacing: "0.2em",
        textTransform: "uppercase",
        color: "#F59E0B",
        marginBottom: "8px",
      }}
    >
      {code ? `${code} · ${source}` : source}
    </div>
  );
}

function LeadItem({ article }: { article: Article }) {
  return (
    <Link href={`/article/${article.slug}`} style={{ textDecoration: "none", display: "block" }} className="bota-item">
      <Overline flag={article.sourceFlag} source={article.source} />
      <h3
        style={{
          fontFamily: FONT.serif,
          fontSize: "clamp(24px, 2.4vw, 34px)",
          fontWeight: 600,
          lineHeight: 1.15,
          letterSpacing: "-0.01em",
          color: "#FFFFFF",
          margin: "0 0 14px",
        }}
      >
        {article.title}
      </h3>
      {article.excerpt && (
        <p
          style={{
            fontSize: "14px",
            lineHeight: 1.65,
            color: "rgba(255,255,255,0.5)",
            margin: 0,
            display: "-webkit-box",
            WebkitLineClamp: 3,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {article.excerpt}
        </p>
      )}
      <div style={{ marginTop: "12px", fontSize: "11px", color: "rgba(255,255,255,0.35)" }}>
        {timeAgo(article.publishedAt)}
      </div>
    </Link>
  );
}

function StackItem({ article, hasDivider }: { article: Article; hasDivider: boolean }) {
  return (
    <>
      {hasDivider && (
        <div style={{ height: "1px", background: "rgba(255,255,255,0.1)", margin: "20px 0" }} />
      )}
      <Link href={`/article/${article.slug}`} style={{ textDecoration: "none", display: "block" }} className="bota-item">
        <Overline flag={article.sourceFlag} source={article.source} />
        <h3
          style={{
            fontFamily: FONT.serif,
            fontSize: "18px",
            fontWeight: 600,
            lineHeight: 1.3,
            letterSpacing: "-0.01em",
            color: "#FFFFFF",
            margin: "0 0 8px",
            display: "-webkit-box",
            WebkitLineClamp: 3,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {article.title}
        </h3>
        <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.35)" }}>
          {timeAgo(article.publishedAt)}
        </div>
      </Link>
    </>
  );
}

export default function BotaFlet({ articles }: BotaFletProps) {
  const lead = articles[0];
  const stack = articles.slice(1, 3);

  if (!lead) return null;

  return (
    <section
      style={{
        background: "#1A1A1A",
        padding: "64px 24px",
        position: "relative",
        zIndex: 1,
      }}
    >
      <div style={{ maxWidth: "1280px", margin: "0 auto" }}>
        <SectionLabel label="BOTA FLET" accent="#F59E0B" dark rule="double" marginBottom={36} />

        <div className="bota-grid" style={{ gap: "0" }}>
          {/* Lead — left column */}
          <div style={{ paddingRight: "48px" }}>
            <LeadItem article={lead} />
          </div>

          {/* Stack — right column with left rule */}
          {stack.length > 0 && (
            <div
              style={{
                borderLeft: "1px solid rgba(255,255,255,0.12)",
                paddingLeft: "48px",
              }}
            >
              {stack.map((article, i) => (
                <StackItem key={article.id} article={article} hasDivider={i > 0} />
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
