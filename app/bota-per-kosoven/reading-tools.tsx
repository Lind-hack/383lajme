"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Share2, Type } from "lucide-react";
import s from "./bota.module.css";

const TEXT_KEY = "383-bota-large-text";

export default function ReadingTools({ children, title }: { children: ReactNode; title: string }) {
  const [large, setLarge] = useState(false);
  const [fallback, setFallback] = useState(false);
  const [url, setUrl] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    setUrl(window.location.href);
    try { setLarge(localStorage.getItem(TEXT_KEY) === "1"); } catch { /* Reading works without storage. */ }
  }, []);

  async function share() {
    setMessage("");
    const link = window.location.href;
    setUrl(link);
    setFallback(false);
    if (navigator.share) {
      try {
        await navigator.share({ title, url: link });
        return;
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(link);
      setMessage("Lidhja u kopjua. Dërgoja dikujt që dëshiron ta lexojë.");
    } catch {
      setFallback(true);
      setMessage("Zgjidh dhe kopjo lidhjen më poshtë për ta dërguar.");
    }
  }

  return (
    <div className={s.reading} data-large-text={large}>
      <div className={s.readingTools} role="group" aria-label="Lexim dhe ndarje">
        <button type="button" aria-pressed={large} onClick={() => {
          const next = !large;
          setLarge(next);
          try { localStorage.setItem(TEXT_KEY, next ? "1" : "0"); } catch { /* Optional preference. */ }
        }}><Type size={20} aria-hidden /> Shkronja më të mëdha</button>
        <button type="button" onClick={share}><Share2 size={20} aria-hidden /> Ndaje me dikë</button>
      </div>
      <p className={s.shareStatus} role="status">{message}</p>
      {fallback && <label className={s.linkFallback}>Lidhja për ta ndarë
        <input value={url} readOnly onFocus={(event) => event.currentTarget.select()} />
      </label>}
      {children}
    </div>
  );
}
