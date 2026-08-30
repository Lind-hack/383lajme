import Link from "next/link";
import type { Article } from "@/lib/mock-data";
import { dosjeFeedEntries } from "@/lib/dosje-feed.mjs";

export default function DosjeFeedIndex({ articles }: { articles: Article[] }) {
  const entries = dosjeFeedEntries(articles).filter((entry): entry is NonNullable<typeof entry> => entry !== null);
  if (!entries.length) return null;

  return (
    <section
      aria-labelledby="dosje-ne-lajme"
      style={{
        margin: "0 0 42px",
        borderTop: "2px solid #e4322b",
        borderBottom: "1px solid #e8e3db",
        padding: "17px 0 4px",
      }}
    >
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: "14px", flexWrap: "wrap" }}>
        <h2 id="dosje-ne-lajme" style={{ margin: 0, fontSize: "12px", fontWeight: 900, letterSpacing: "0.14em", textTransform: "uppercase", color: "#a9362d" }}>
          Dosje në lajme
        </h2>
        <span style={{ fontSize: "12px", color: "#777", fontWeight: 600 }}>
          {entries.length} {entries.length === 1 ? "artikull me Dosje" : "artikuj me Dosje"}
        </span>
      </div>
      <p style={{ margin: "8px 0 15px", color: "#5f5b56", fontSize: "14px", lineHeight: 1.5 }}>
        Këto janë lajmet që lidhen me një Dosje. Hape lajmin ose shko direkt te kronologjia e tij.
      </p>
      <div style={{ display: "grid", gap: "0" }}>
        {entries.map((entry) => (
          <div
            key={`${entry.articleSlug}:${entry.dossierSlug}`}
            style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "16px", flexWrap: "wrap", borderTop: "1px solid #eee9e2", padding: "13px 0" }}
          >
            <Link href={entry.articleHref} style={{ minWidth: 0, flex: "1 1 420px", color: "#171513", textDecoration: "none" }}>
              <span style={{ display: "block", marginBottom: "4px", color: "#777", fontSize: "10px", fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase" }}>
                Artikull
              </span>
              <strong style={{ display: "block", fontSize: "16px", lineHeight: 1.3 }}>{entry.articleTitle}</strong>
            </Link>
            <Link
              href={entry.dossierHref}
              aria-label={`Hap Dosjen: ${entry.dossierTitle}`}
              style={{ display: "inline-flex", alignItems: "center", gap: "7px", flex: "0 0 auto", border: "1px solid rgba(228,50,43,.35)", borderRadius: "999px", background: "#fff7f3", padding: "8px 12px", color: "#a9362d", textDecoration: "none", fontSize: "11px", fontWeight: 800 }}
            >
              <span aria-hidden="true" style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#e4322b" }} />
              <span>Dosje: {entry.dossierTitle} →</span>
            </Link>
          </div>
        ))}
      </div>
    </section>
  );
}
