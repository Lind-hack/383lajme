"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, Download, Link2, MessageCircle, Share2, X } from "lucide-react";

interface MarketShareActionsProps {
  slug: string;
  title: string;
  selection: string;
  probability: number;
  volume: number;
  accent: string;
  /** Category label for the card's chip ("Sport", "Kosovë"). */
  category?: string;
  /** The selected line's recorded history, 0..1, oldest first. */
  points?: number[];
}

/* Brand glyphs, drawn on a 24 grid in one weight. Each tile carries its
   platform's own colour so the list is scannable before it is readable. */
function TelegramGlyph() {
  return (
    <svg viewBox="0 0 24 24" width="17" height="17" aria-hidden>
      <path fill="currentColor" d="M21.6 4.2 18.4 19.3c-.2 1.1-.9 1.3-1.8.8l-4.9-3.6-2.4 2.3c-.3.3-.5.5-1 .5l.4-5 9-8.1c.4-.3-.1-.5-.6-.2L6 13l-4.8-1.5c-1-.3-1.1-1 .2-1.5L20.2 2.9c.9-.3 1.7.2 1.4 1.3Z" />
    </svg>
  );
}
function FacebookGlyph() {
  return (
    <svg viewBox="0 0 24 24" width="17" height="17" aria-hidden>
      <path fill="currentColor" d="M13.6 21.5v-8.1h2.8l.4-3.3h-3.2V8c0-.9.3-1.6 1.6-1.6h1.7V3.5c-.3 0-1.3-.1-2.5-.1-2.5 0-4.1 1.5-4.1 4.3v2.4H7.5v3.3h2.8v8.1h3.3Z" />
    </svg>
  );
}
function XGlyph() {
  return (
    <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden>
      <path fill="currentColor" d="M17.8 3h3.1l-6.8 7.7L22 21h-6.2l-4.9-6.4L5.3 21H2.2l7.2-8.3L1.8 3h6.4l4.4 5.8L17.8 3Zm-1.1 16.2h1.7L7.4 4.7H5.6l11.1 14.5Z" />
    </svg>
  );
}

/** Keep the query short: the chart needs shape, not every snapshot. */
function samplePoints(points: number[] | undefined, max = 48): string {
  const clean = (points ?? []).filter((p) => Number.isFinite(p));
  if (clean.length < 2) return "";
  const step = Math.max(1, clean.length / max);
  const out: number[] = [];
  for (let i = 0; i < clean.length; i += step) out.push(clean[Math.floor(i)]);
  if (out[out.length - 1] !== clean[clean.length - 1]) out.push(clean[clean.length - 1]);
  return out.map((p) => Math.round(p * 1000)).join(",");
}

/**
 * Share a market: link to a platform, or the trade as an image card.
 *
 * The menu used to be an absolutely positioned <details> panel inside the
 * market header. The header is its own stacking layer, so on pages where the
 * chart or stats panels below it sit on a higher layer the menu opened
 * *underneath* them and could not be clicked. It now renders into <body> with
 * fixed positioning, above everything, anchored to the button — and on phones
 * it becomes a bottom sheet instead of a dropdown squeezed against the edge.
 */
export default function MarketShareActions({
  slug,
  title,
  selection,
  probability,
  volume,
  accent,
  category,
  points,
}: MarketShareActionsProps) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState<"save" | "native" | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [anchor, setAnchor] = useState<{ top?: number; bottom?: number; right: number; maxHeight: number } | null>(null);
  const [sheet, setSheet] = useState(false);
  const [canNativeShare, setCanNativeShare] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const menuId = useId();

  const pageUrl = `https://383ks.com/tregu/${encodeURIComponent(slug)}`;
  const pct = Math.round(probability * 100);
  const shareText = `${title} — ${selection} ${pct}% në 383 Tregu`;
  const encodedUrl = encodeURIComponent(pageUrl);
  const encodedText = encodeURIComponent(shareText);

  const cardUrl = useMemo(() => {
    const query = new URLSearchParams({
      title,
      selection,
      probability: String(probability),
      volume: String(Math.round(volume)),
      accent,
    });
    if (category) query.set("category", category);
    const sampled = samplePoints(points);
    if (sampled) query.set("points", sampled);
    return `/api/tregu/share-card?${query}`;
  }, [title, selection, probability, volume, accent, category, points]);

  useEffect(() => {
    setCanNativeShare(typeof navigator !== "undefined" && typeof navigator.share === "function");
  }, []);

  const place = useCallback(() => {
    const rect = trigger.current?.getBoundingClientRect();
    if (!rect) return;
    setSheet(window.innerWidth < 640);
    const right = Math.max(12, window.innerWidth - rect.right);
    const below = window.innerHeight - rect.bottom - 20;
    const above = rect.top - 20;
    // Open downward when it fits (or when below is still the roomier side);
    // otherwise flip above the button. Either way cap it to the viewport.
    setAnchor(
      below >= 520 || below >= above
        ? { top: rect.bottom + 8, right, maxHeight: below }
        : { bottom: window.innerHeight - rect.top + 8, right, maxHeight: above }
    );
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open, place]);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      const target = event.target as Node;
      if (panel.current?.contains(target) || trigger.current?.contains(target)) return;
      setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        trigger.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    panel.current?.querySelector<HTMLElement>("a, button")?.focus({ preventScroll: true });
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(pageUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setFailed("Kopjimi nuk u lejua nga shfletuesi.");
    }
  };

  const fetchCard = async () => {
    const response = await fetch(cardUrl);
    if (!response.ok) throw new Error("share-card");
    return response.blob();
  };

  const saveImage = async () => {
    setBusy("save");
    setFailed(null);
    try {
      const objectUrl = URL.createObjectURL(await fetchCard());
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = `383-tregu-${slug}.png`;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    } catch {
      setFailed("Imazhi nuk u krijua. Provo përsëri.");
    } finally {
      setBusy(null);
    }
  };

  /* Phones: hand the image itself to the system sheet (Instagram, TikTok,
     WhatsApp…) when the browser allows files, the link otherwise. */
  const nativeShare = async () => {
    setBusy("native");
    setFailed(null);
    try {
      const file = new File([await fetchCard()], `383-tregu-${slug}.png`, { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title, text: `${shareText}\n${pageUrl}` });
      } else {
        await navigator.share({ title, text: shareText, url: pageUrl });
      }
    } catch (error) {
      if ((error as DOMException)?.name !== "AbortError") setFailed("Shpërndarja nuk u krye.");
    } finally {
      setBusy(null);
    }
  };

  const menu = open && anchor && (
    <>
      {sheet && <div className="tregu-share-scrim" aria-hidden />}
      <div
        ref={panel}
        id={menuId}
        className="tregu-share-pop"
        data-sheet={sheet || undefined}
        role="dialog"
        aria-label="Shpërndaje tregun"
        style={sheet ? undefined : { top: anchor.top, bottom: anchor.bottom, right: anchor.right, maxHeight: anchor.maxHeight }}
      >
        <div className="tregu-share-head">
          <strong>Shpërndaje</strong>
          <button type="button" className="tregu-share-x" onClick={() => setOpen(false)} aria-label="Mbyll">
            <X size={16} />
          </button>
        </div>

        <figure className="tregu-share-preview">
          {/* The exact image the save and share buttons produce. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={cardUrl} alt={`Karta e tregut: ${title}, ${selection} ${pct}%`} width={1080} height={1350} loading="lazy" />
        </figure>

        <div className="tregu-share-grid">
          <a className="tregu-share-app" data-app="whatsapp" href={`https://wa.me/?text=${encodedText}%20${encodedUrl}`} target="_blank" rel="noreferrer">
            <span className="tregu-share-tile"><MessageCircle size={17} strokeWidth={2.4} aria-hidden /></span>
            WhatsApp
          </a>
          <a className="tregu-share-app" data-app="telegram" href={`https://t.me/share/url?url=${encodedUrl}&text=${encodedText}`} target="_blank" rel="noreferrer">
            <span className="tregu-share-tile"><TelegramGlyph /></span>
            Telegram
          </a>
          <a className="tregu-share-app" data-app="facebook" href={`https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`} target="_blank" rel="noreferrer">
            <span className="tregu-share-tile"><FacebookGlyph /></span>
            Facebook
          </a>
          <a className="tregu-share-app" data-app="x" href={`https://x.com/intent/post?text=${encodedText}&url=${encodedUrl}`} target="_blank" rel="noreferrer">
            <span className="tregu-share-tile"><XGlyph /></span>
            X
          </a>
        </div>

        <div className="tregu-share-row">
          <button type="button" className="tregu-share-wide" data-app="save" onClick={() => void saveImage()} disabled={busy !== null}>
            <Download size={16} aria-hidden /> {busy === "save" ? "Duke krijuar…" : "Ruaj imazhin"}
          </button>
          <button type="button" className="tregu-share-wide" data-app="copy" onClick={() => void copyLink()}>
            {copied ? <Check size={16} aria-hidden /> : <Link2 size={16} aria-hidden />}
            {copied ? "U kopjua" : "Kopjo linkun"}
          </button>
        </div>
        {canNativeShare && (
          <button type="button" className="tregu-share-native" onClick={() => void nativeShare()} disabled={busy !== null}>
            <Share2 size={16} aria-hidden /> {busy === "native" ? "Duke përgatitur…" : "Shpërndaj imazhin…"}
          </button>
        )}
        {failed && <p className="tregu-share-error" role="alert">{failed}</p>}
      </div>
    </>
  );

  return (
    <div className="tregu-share-actions">
      <button
        ref={trigger}
        type="button"
        className="tregu-share-trigger"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((value) => !value)}
      >
        <Share2 size={15} aria-hidden /> Shpërndaje
      </button>
      {menu ? createPortal(menu, document.body) : null}
    </div>
  );
}
