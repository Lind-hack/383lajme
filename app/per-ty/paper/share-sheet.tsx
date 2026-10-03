"use client";

// "Ndaje gazetën": the reader's front page, sent as a picture and a link.
//
// The link is /gazeta/<code>, a frozen copy of today's front page carried in
// the code itself (lib/paper-snapshot.mjs) — a friend opening /per-ty would see
// their own feed, not this one. The preview shows exactly the picture the
// link carries, so nothing goes out that the reader has not seen.
//
// Instagram has no web share link: on a phone the system share sheet with the
// Stories-sized picture is the only way in; elsewhere the picture is saved and
// the reader is told where to post it.

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { Check, Download, Link2, Share2 } from "lucide-react";
import { track } from "@/lib/analytics";
import { encodeSnapshot } from "@/lib/paper-snapshot.mjs";
import { kosovoDateKey } from "@/lib/home-tregu.mjs";
import { paperName } from "@/lib/reader-name.mjs";
import type { PaperPrefs } from "@/lib/paper-prefs.mjs";
import DardaniImage from "@/components/dardani/dardani-image";
import Sheet from "./sheet";

export type ShareablePaper = {
  edition: string[];
  sections: { key: string; slugs: string[] }[];
};

type Channel = "whatsapp" | "instagram" | "facebook" | "viber" | "telegram" | "x" | "copy" | "download" | "story" | "native";

function WhatsAppIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="currentColor">
      <path d="M12.04 2C6.6 2 2.18 6.42 2.18 11.86c0 1.74.46 3.44 1.32 4.94L2.1 22l5.34-1.4a9.86 9.86 0 0 0 4.6 1.17h.01c5.44 0 9.86-4.42 9.86-9.86S17.48 2 12.04 2Zm5.78 14.01c-.24.68-1.42 1.3-1.95 1.34-.5.05-1.13.07-1.82-.11-.42-.13-.96-.31-1.65-.6-2.9-1.25-4.79-4.17-4.94-4.36-.14-.19-1.18-1.57-1.18-3s.75-2.13 1.02-2.42c.27-.29.58-.36.78-.36h.56c.18 0 .42-.07.66.5.24.58.82 2 .89 2.15.07.14.12.31.02.5-.1.19-.14.31-.29.48-.14.17-.3.38-.43.5-.14.15-.29.3-.12.6.17.29.75 1.24 1.61 2 1.11.99 2.04 1.3 2.33 1.44.29.15.46.12.63-.07.17-.2.72-.84.92-1.13.19-.29.38-.24.65-.14.26.1 1.68.79 1.97.94.29.14.48.21.55.33.07.12.07.7-.17 1.38Z" />
    </svg>
  );
}
function InstagramIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4.2" />
      <circle cx="17.4" cy="6.6" r="1.1" fill="currentColor" stroke="none" />
    </svg>
  );
}
function FacebookIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="currentColor">
      <path d="M13.5 21v-7.6h2.6l.4-3h-3V8.5c0-.87.25-1.46 1.5-1.46h1.6V4.36A21 21 0 0 0 14.27 4.2c-2.3 0-3.87 1.4-3.87 3.98v2.22H7.8v3h2.6V21h3.1Z" />
    </svg>
  );
}
function ViberIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round">
      <path d="M12 3c4.97 0 8 2.4 8 7.5S16.97 18 12 18c-.6 0-1.2-.04-1.75-.12L7 20.5v-3.4C4.9 15.8 4 13.6 4 10.5 4 5.4 7.03 3 12 3Z" />
      <path d="M9.3 7.6c.3-.3.8-.3 1 .1l.7 1.2c.2.3.1.7-.2.9l-.4.3c.4 1 1.1 1.8 2.1 2.3l.3-.4c.2-.3.6-.4.9-.2l1.2.7c.4.2.4.7.1 1-.6.7-1.6.9-2.4.5a7.2 7.2 0 0 1-3.6-3.7c-.4-.9-.2-1.9.3-2.7Z" />
    </svg>
  );
}
function TelegramIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="currentColor">
      <path d="M21.4 4.2 2.9 11.3c-1.26.5-1.25 1.2-.23 1.52l4.75 1.48 1.83 5.62c.22.62.11.86.76.86.5 0 .72-.23 1-.5l2.4-2.33 4.98 3.68c.92.5 1.58.25 1.81-.85l3.28-15.45c.34-1.35-.51-1.96-1.39-1.56ZM8.45 14.1l9.4-5.93c.47-.28.9-.13.55.18l-8.05 7.27-.31 3.33-1.6-4.85Z" />
    </svg>
  );
}
function XIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="currentColor">
      <path d="M17.75 3h3.07l-6.7 7.66L22 21h-6.17l-4.83-6.32L5.46 21H2.4l7.17-8.2L2 3h6.33l4.37 5.78L17.75 3Zm-1.08 16.18h1.7L7.4 4.73H5.58l11.09 14.45Z" />
    </svg>
  );
}

async function fetchFile(src: string, filename: string) {
  const response = await fetch(src);
  if (!response.ok) throw new Error(`image ${response.status}`);
  const blob = await response.blob();
  return new File([blob], filename, { type: "image/png" });
}

function save(file: File) {
  const url = URL.createObjectURL(file);
  const a = document.createElement("a");
  a.href = url;
  a.download = file.name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export default function ShareSheet({
  open,
  onClose,
  paper,
  prefs,
  name,
}: {
  open: boolean;
  onClose: () => void;
  paper: ShareablePaper;
  prefs: PaperPrefs;
  name: string;
}) {
  const [showName, setShowName] = useState(Boolean(name));
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState<Channel | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [canNative, setCanNative] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => setShowName(Boolean(name)), [name]);
  useEffect(() => setCanNative(typeof navigator !== "undefined" && typeof navigator.share === "function"), []);

  const date = useMemo(() => (open ? kosovoDateKey() : ""), [open]);
  const code = useMemo(
    () =>
      date
        ? encodeSnapshot({
            date,
            name: showName ? name : "",
            style: prefs.style,
            accent: prefs.accent,
            edition: paper.edition,
            sections: paper.sections,
          })
        : "",
    [date, showName, name, prefs.style, prefs.accent, paper]
  );
  useEffect(() => setLoaded(false), [code]);

  // The pictures, fetched as soon as the sheet shows this paper. iOS Safari
  // only lets navigator.share() run in the moment right after a tap; awaiting
  // a download first throws NotAllowedError, so the file must already be here.
  const files = useRef<{ code: string; feed?: Promise<File>; story?: Promise<File>; ready: Record<string, File> }>({ code: "", ready: {} });
  useEffect(() => {
    if (!open || !code) return;
    const name = `383-gazeta-${date}`;
    const entry = { code, ready: {} as Record<string, File> } as typeof files.current;
    const load = (key: "feed" | "story", src: string, filename: string) => {
      const p = fetchFile(src, filename);
      p.then((f) => {
        if (files.current === entry) entry.ready[key] = f;
      }).catch(() => {});
      return p;
    };
    entry.feed = load("feed", `/api/og/gazeta/${code}?f=feed`, `${name}.png`);
    entry.story = load("story", `/api/og/gazeta/${code}?f=story`, `${name}-story.png`);
    files.current = entry;
  }, [open, code, date]);

  if (!code) return <Sheet open={open} onClose={onClose} title="Ndaje gazetën" titleId="perty-share-title">{null}</Sheet>;

  const origin = typeof window === "undefined" ? "https://www.383ks.com" : window.location.origin;
  const url = `${origin}/gazeta/${code}`;
  const feedImg = `/api/og/gazeta/${code}?f=feed`;
  const storyImg = `/api/og/gazeta/${code}?f=story`;
  const title = showName && name ? paperName(name) : "Gazeta ime";
  const text = `${title} për sot në 383 📰 Lajmet që zgjodha unë:`;
  const file = `383-gazeta-${date}`;

  function sent(channel: Channel) {
    track("perty_share", { channel });
  }

  function openOut(channel: Channel, href: string) {
    sent(channel);
    window.open(href, "_blank", "noopener,noreferrer");
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      sent("copy");
    } catch {
      setHint("Kopjimi nuk u lejua. Mbaje gishtin te lidhja për ta kopjuar.");
    }
  }

  async function withFile(channel: Channel, kind: "feed" | "story", work: (f: File) => Promise<void>) {
    setHint(null);
    const ready = files.current.code === code ? files.current.ready[kind] : undefined;
    if (!ready) setBusy(channel);
    try {
      const pending = files.current.code === code ? files.current[kind] : undefined;
      await work(ready ?? (await (pending ?? fetchFile(kind === "story" ? storyImg : feedImg, `${file}${kind === "story" ? "-story" : ""}.png`))));
      sent(channel);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setHint("Fotoja nuk u përgatit dot. Provo sërish pas pak.");
    } finally {
      setBusy(null);
    }
  }

  const instagram = () =>
    withFile("instagram", "story", async (f) => {
      if (navigator.canShare?.({ files: [f] })) {
        await navigator.share({ files: [f], title, text: `${text} ${url}` });
      } else {
        save(f);
        setHint("Fotoja u ruajt. Hape Instagram-in dhe shtoje te Stories, me lidhjen e kopjuar si «Link sticker».");
        void navigator.clipboard?.writeText(url).catch(() => {});
      }
    });

  const native = async () => {
    try {
      await navigator.share({ title, text, url });
      sent("native");
    } catch {
      // Dismissed: not an error.
    }
  };

  const enc = encodeURIComponent;
  return (
    <Sheet open={open} onClose={onClose} title="Ndaje gazetën" titleId="perty-share-title" className="perty-sheet--share">
      <div className="perty-share-preview" aria-busy={!loaded}>
        {open && (
          <Image
            key={feedImg}
            src={feedImg}
            alt={`Pamja e gazetës që do të ndash: ${title}`}
            width={1080}
            height={1350}
            unoptimized
            onLoad={() => setLoaded(true)}
            data-loaded={loaded || undefined}
          />
        )}
        {!loaded && (
          <span className="perty-share-wait">
            <DardaniImage name="flying-news" decorative className="perty-share-wait-img" />
            Po e shtyp gazetën…
          </span>
        )}
      </div>

      <label className="perty-cz-switch perty-share-name">
        <span>
          Shfaq emrin tim
          <small>{name ? `«${paperName(name)}»` : "Ende s'ke vendosur emër"}</small>
        </span>
        <input
          type="checkbox"
          role="switch"
          checked={showName && Boolean(name)}
          disabled={!name}
          onChange={(e) => setShowName(e.currentTarget.checked)}
        />
      </label>
      <p className="perty-share-public">Kushdo me lidhjen e sheh këtë faqe dhe këto lajme — asgjë tjetër nga leximet e tua.</p>

      <div className="perty-share-grid">
        <button type="button" className="perty-share-btn" data-ch="whatsapp" onClick={() => openOut("whatsapp", `https://wa.me/?text=${enc(`${text} ${url}`)}`)}>
          <WhatsAppIcon />
          WhatsApp
        </button>
        <button type="button" className="perty-share-btn" data-ch="instagram" onClick={instagram} disabled={busy === "instagram"}>
          <InstagramIcon />
          {busy === "instagram" ? "Po përgatitet…" : "Instagram"}
        </button>
        <button type="button" className="perty-share-btn" data-ch="facebook" onClick={() => openOut("facebook", `https://www.facebook.com/sharer/sharer.php?u=${enc(url)}`)}>
          <FacebookIcon />
          Facebook
        </button>
        <button type="button" className="perty-share-btn" data-ch="viber" onClick={() => {
            // An app link, not a web page: opening it in a new tab leaves a
            // blank tab behind on a computer without Viber.
            sent("viber");
            window.location.href = `viber://forward?text=${enc(`${text} ${url}`)}`;
          }}>
          <ViberIcon />
          Viber
        </button>
        <button type="button" className="perty-share-btn" data-ch="telegram" onClick={() => openOut("telegram", `https://t.me/share/url?url=${enc(url)}&text=${enc(text)}`)}>
          <TelegramIcon />
          Telegram
        </button>
        <button type="button" className="perty-share-btn" data-ch="x" onClick={() => openOut("x", `https://x.com/intent/post?text=${enc(text)}&url=${enc(url)}`)}>
          <XIcon />X
        </button>
        <button type="button" className="perty-share-btn" data-ch="copy" onClick={copy}>
          {copied ? <Check size={20} strokeWidth={2.6} aria-hidden="true" /> : <Link2 size={20} strokeWidth={2.4} aria-hidden="true" />}
          {copied ? "U kopjua" : "Kopjo lidhjen"}
        </button>
        {canNative && (
          <button type="button" className="perty-share-btn" data-ch="native" onClick={native}>
            <Share2 size={20} strokeWidth={2.4} aria-hidden="true" />
            Më shumë…
          </button>
        )}
      </div>

      <div className="perty-share-downloads">
        <button
          type="button"
          className="perty-btn perty-btn--ghost"
          disabled={busy === "download"}
          onClick={() => withFile("download", "feed", async (f) => save(f))}
        >
          <Download size={16} strokeWidth={2.4} aria-hidden="true" />
          {busy === "download" ? "Po ruhet…" : "Shkarko foton"}
        </button>
        <button
          type="button"
          className="perty-btn perty-btn--ghost"
          disabled={busy === "story"}
          onClick={() => withFile("story", "story", async (f) => save(f))}
        >
          <Download size={16} strokeWidth={2.4} aria-hidden="true" />
          {busy === "story" ? "Po ruhet…" : "Për Stories (9:16)"}
        </button>
      </div>
      {hint && (
        <p className="perty-share-hint" role="status">
          {hint}
        </p>
      )}
    </Sheet>
  );
}
