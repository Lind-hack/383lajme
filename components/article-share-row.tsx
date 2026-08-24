"use client";

import { useState } from "react";
import { Link2, Share2 } from "lucide-react";

/**
 * Sharing for phones. The sidebar that carries the share buttons is hidden
 * below 1024px, so until this existed a reader on a phone — which is most of
 * them — had no way to share an article except copying the address bar.
 *
 * The link is built from the slug rather than window.location.href: that is
 * stable between server and client (no hydration mismatch), and it shares the
 * canonical URL instead of whatever query string the reader arrived with.
 */

const SITE = "https://www.383ks.com";

interface Props {
  slug: string;
  title: string;
}

export default function ArticleShareRow({ slug, title }: Props) {
  const [copied, setCopied] = useState(false);

  const url = `${SITE}/article/${slug}`;
  const encodedUrl = encodeURIComponent(url);
  const encodedTitle = encodeURIComponent(title);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked (insecure context, denied permission) — ignore */
    }
  }

  async function nativeShare() {
    // Present on virtually every mobile browser; absent on most desktops,
    // where the sidebar covers sharing anyway.
    if (typeof navigator === "undefined" || !navigator.share) {
      void copyLink();
      return;
    }
    try {
      await navigator.share({ title, url });
    } catch {
      /* the reader dismissed the sheet — not an error */
    }
  }

  const base: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
    padding: "12px 14px",
    borderRadius: "var(--radius-sm)",
    textDecoration: "none",
    fontSize: "14px",
    fontWeight: 600,
    fontFamily: "inherit",
    border: "none",
    cursor: "pointer",
    minHeight: "44px",
  };

  return (
    <div className="article-share-row" style={{ margin: "28px 0 8px" }}>
      <p
        style={{
          fontSize: "11px",
          fontWeight: 800,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          color: "#6B6B6B",
          margin: "0 0 10px",
        }}
      >
        Ndaj
      </p>

      <div style={{ display: "flex", gap: "8px" }}>
        <a
          href={`https://wa.me/?text=${encodedTitle}%20${encodedUrl}`}
          target="_blank"
          rel="noopener noreferrer"
          style={{ ...base, background: "#25D366", color: "#FFFFFF", flex: 2 }}
        >
          <svg viewBox="0 0 24 24" width="17" height="17" fill="currentColor" aria-hidden="true">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893A11.821 11.821 0 0020.464 3.488" />
          </svg>
          WhatsApp
        </a>

        <button
          type="button"
          onClick={nativeShare}
          aria-label="Ndaj artikullin"
          style={{ ...base, background: "#111111", color: "#FFFFFF", flex: 1 }}
        >
          <Share2 size={16} strokeWidth={2} />
          Ndaj
        </button>

        <button
          type="button"
          onClick={copyLink}
          aria-label="Kopjo linkun e artikullit"
          style={{
            ...base,
            background: copied ? "#E8F5E9" : "#F3F4F6",
            border: `1px solid ${copied ? "#A5D6A7" : "#E8E3DB"}`,
            color: "#111111",
            flex: 1,
          }}
        >
          <Link2 size={16} strokeWidth={2} />
          {copied ? "U kopjua" : "Kopjo"}
        </button>
      </div>

      <style>{`
        /* The sidebar owns sharing from 1024px up; this row owns it below. */
        @media (min-width: 1024px) {
          .article-share-row { display: none; }
        }
      `}</style>
    </div>
  );
}
