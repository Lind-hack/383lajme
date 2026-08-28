"use client";

import { useState } from "react";
import { Check, Copy, Download, Facebook, MessageCircle, Send, Share2 } from "lucide-react";

interface MarketShareActionsProps {
  slug: string;
  title: string;
  selection: string;
  probability: number;
  volume: number;
  accent: string;
}

export default function MarketShareActions({
  slug,
  title,
  selection,
  probability,
  volume,
  accent,
}: MarketShareActionsProps) {
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const pageUrl = `https://www.383ks.com/tregu/${encodeURIComponent(slug)}`;
  const shareText = `${title} — ${selection} ${Math.round(probability * 100)}% në 383 Tregu`;
  const encodedUrl = encodeURIComponent(pageUrl);
  const encodedText = encodeURIComponent(shareText);

  const copyLink = async () => {
    await navigator.clipboard.writeText(pageUrl);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  const downloadPng = async () => {
    setDownloading(true);
    try {
      const query = new URLSearchParams({
        title,
        selection,
        probability: String(probability),
        volume: String(volume),
        accent,
      });
      const response = await fetch(`/api/tregu/share-card?${query}`);
      if (!response.ok) throw new Error("share-card");
      const objectUrl = URL.createObjectURL(await response.blob());
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = `383-tregu-${slug}.png`;
      anchor.click();
      URL.revokeObjectURL(objectUrl);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <details className="tregu-share-actions">
      <summary><Share2 size={15} aria-hidden /> Shpërndaje</summary>
      <div className="tregu-share-menu" aria-label="Mënyrat e shpërndarjes">
        <button type="button" onClick={downloadPng} disabled={downloading}>
          <Download size={16} aria-hidden /> {downloading ? "Duke krijuar…" : "Ruaj PNG"}
        </button>
        <a href={`https://wa.me/?text=${encodedText}%20${encodedUrl}`} target="_blank" rel="noreferrer">
          <MessageCircle size={16} aria-hidden /> WhatsApp
        </a>
        <a href={`https://t.me/share/url?url=${encodedUrl}&text=${encodedText}`} target="_blank" rel="noreferrer">
          <Send size={16} aria-hidden /> Telegram
        </a>
        <a href={`https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`} target="_blank" rel="noreferrer">
          <Facebook size={16} aria-hidden /> Facebook
        </a>
        <button type="button" onClick={copyLink}>
          {copied ? <Check size={16} aria-hidden /> : <Copy size={16} aria-hidden />}
          {copied ? "U kopjua" : "Kopjo linkun"}
        </button>
      </div>
    </details>
  );
}
