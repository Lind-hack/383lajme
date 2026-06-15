import { type Article } from "@/lib/mock-data";
import SectionLabel from "./section-label";

/** Convert an emoji flag to a two-letter country code. */
function flagToCode(flag: string): string {
  const letters = Array.from(flag)
    .map((c) => c.codePointAt(0) ?? 0)
    .filter((cp) => cp >= 0x1f1e6 && cp <= 0x1f1ff)
    .map((cp) => String.fromCharCode(cp - 0x1f1e6 + 65));
  return letters.length === 2 ? letters.join("") : "";
}

interface BotaFletProps {
  articles: Article[];
}

export default function BotaFlet({ articles }: BotaFletProps) {
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
        <SectionLabel label="BOTA FLET" accent="#F59E0B" dark marginBottom={36} />
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
            gap: "20px",
          }}
        >
          {articles.map((article) => (
            <a
              key={article.id}
              href={`/article/${article.slug}`}
              style={{ textDecoration: "none", display: "block", height: "100%" }}
            >
              <div
                className="world-card"
                style={{
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: "var(--radius-md)",
                  overflow: "hidden",
                  display: "flex",
                  flexDirection: "column",
                  height: "100%",
                }}
              >
                <div style={{ height: "3px", background: "#F59E0B", flexShrink: 0 }} />
                <div style={{ padding: "24px", flex: 1, display: "flex", flexDirection: "column" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "12px" }}>
                    {flagToCode(article.sourceFlag) && (
                      <span style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.08em", color: "rgba(255,255,255,0.4)" }}>
                        {flagToCode(article.sourceFlag)}
                      </span>
                    )}
                    <span style={{ fontSize: "11px", fontWeight: 600, color: "rgba(255,255,255,0.5)", letterSpacing: "0.08em" }}>
                      {article.source}
                    </span>
                  </div>
                  <h3 style={{
                    fontSize: "16px",
                    fontFamily: "var(--font-fraunces), 'Fraunces', Georgia, serif",
                    fontStyle: "italic",
                    fontWeight: 700,
                    color: "#FFFFFF",
                    margin: "0 0 10px",
                    lineHeight: 1.35,
                    display: "-webkit-box",
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: "vertical",
                    overflow: "hidden",
                  }}>
                    {article.title}
                  </h3>
                  <p style={{
                    fontSize: "13px",
                    color: "rgba(255,255,255,0.45)",
                    margin: 0,
                    lineHeight: 1.6,
                    display: "-webkit-box",
                    WebkitLineClamp: 3,
                    WebkitBoxOrient: "vertical",
                    overflow: "hidden",
                  }}>
                    {article.excerpt}
                  </p>
                </div>
              </div>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}
