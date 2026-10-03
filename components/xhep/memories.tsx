"use client";

import { Download, ImagePlus, Share2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { CITY_NAMES } from "@/lib/xhep/card-art.mjs";
import { downloadBlob, shareBlob } from "@/lib/xhep/card-export";
import { LAYOUTS, MAX_PHOTOS, VIBES } from "@/lib/xhep/memories-layout.mjs";
import { canvasPng, drawMemories, preparePhoto, type PhotoError, type PreparedPhoto } from "@/lib/xhep/memories-render";
import type { readProfile } from "@/lib/xhep/profile.mjs";
import { xhepDict, type XhepLang } from "@/lib/xhep/i18n";
import { track } from "@/lib/analytics";
import styles from "./xhep.module.css";

type Profile = NonNullable<ReturnType<typeof readProfile>>;
type Vibe = keyof typeof VIBES;

export default function Memories({ lang, profile }: { lang: XhepLang; profile: Profile }) {
  const t = xhepDict(lang).memories;
  const card = xhepDict(lang).card;
  const months = lang === "en"
    ? ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]
    : ["janar", "shkurt", "mars", "prill", "maj", "qershor", "korrik", "gusht", "shtator", "tetor", "nëntor", "dhjetor"];
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [photos, setPhotos] = useState<PreparedPhoto[]>([]);
  const [vibe, setVibe] = useState<Vibe>(profile.interests.includes("skiing") ? "brezovica" : profile.interests.includes("nature") ? "rugova" : "prizren");
  const [layout, setLayout] = useState<string>("grid");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<"download" | "share" | null>(null);

  const subtitle = [
    profile.cities.map((id: string) => CITY_NAMES[id as keyof typeof CITY_NAMES]).join(" · "),
    profile.month ? `${months[profile.month - 1]}${profile.startDate ? ` ${profile.startDate.slice(0, 4)}` : ""}` : null,
  ].filter(Boolean).join(" — ");
  const stampsLabel = profile.stamps.length ? xhepDict(lang).plan.stamped.split(" — ")[0] + ` × ${profile.stamps.length}` : "";

  useEffect(() => {
    if (!canvasRef.current) return;
    drawMemories(canvasRef.current, { photos, vibe, layout, title: t.titleText(profile.name), subtitle, stamps: profile.stamps.length, stampsLabel });
  }, [photos, vibe, layout, profile, subtitle, stampsLabel, t]);

  // Release a photo's object URL and bitmap when it is removed, and all of them on unmount.
  const photosRef = useRef<PreparedPhoto[]>([]);
  photosRef.current = photos;
  const release = (p: PreparedPhoto) => {
    URL.revokeObjectURL(p.url);
    p.bitmap.close();
  };
  useEffect(() => () => photosRef.current.forEach(release), []);
  const removePhoto = (index: number) => {
    const gone = photos[index];
    setPhotos((prev) => prev.filter((_, j) => j !== index));
    if (gone) window.setTimeout(() => release(gone), 0);
  };

  const addFiles = async (files: FileList | null) => {
    if (!files) return;
    setError("");
    const room = MAX_PHOTOS - photos.length;
    const added: PreparedPhoto[] = [];
    for (const file of [...files].slice(0, room)) {
      try {
        added.push(await preparePhoto(file));
      } catch (code) {
        setError(t.errors[(code as PhotoError) in t.errors ? (code as PhotoError) : "decode"]);
      }
    }
    if (added.length) setPhotos((prev) => [...prev, ...added]);
  };

  const exportCard = async (kind: "download" | "share") => {
    if (!canvasRef.current) return;
    setBusy(kind);
    try {
      const blob = await canvasPng(canvasRef.current);
      const name = `kosova-ne-xhep-memories.png`;
      if (kind === "share") {
        const shared = await shareBlob(blob, name, card.shareText);
        if (!shared) downloadBlob(blob, name);
        track("xhep_memories_share", { photos: photos.length, vibe, layout });
      } else {
        downloadBlob(blob, name);
        track("xhep_memories_download", { photos: photos.length, vibe, layout });
      }
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className={styles.memories} aria-labelledby="xhep-memories-title">
      <div className={styles.helpHead}>
        <h3 id="xhep-memories-title">{t.title}</h3>
        <p>{t.intro}</p>
      </div>
      <div className={styles.memoriesLayout}>
        <canvas ref={canvasRef} className={styles.memoriesCanvas} aria-label={t.title} role="img" />
        <div className={styles.memoriesControls}>
          <label className={styles.photoPicker}>
            <ImagePlus aria-hidden="true" size={18} />
            <span>
              <b>{t.add}</b>
              <small>{t.addHint}</small>
            </span>
            <input type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" multiple disabled={photos.length >= MAX_PHOTOS} onChange={(e) => { void addFiles(e.target.files); e.target.value = ""; }} />
          </label>
          <p className={styles.quizHint}>{t.count(photos.length, MAX_PHOTOS)}</p>
          {error && <p className={styles.cardNote} role="alert">{error}</p>}
          {photos.length > 0 && (
            <ul className={styles.thumbs}>
              {photos.map((photo, i) => (
                <li key={photo.url}>
                  <img src={photo.url} alt="" />
                  <button type="button" aria-label={t.remove} onClick={() => removePhoto(i)}>
                    <X aria-hidden="true" size={14} />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <fieldset className={styles.pickRow}>
            <legend>{t.vibe}</legend>
            {(Object.keys(VIBES) as Vibe[]).map((key) => (
              <button type="button" key={key} aria-pressed={vibe === key} className={vibe === key ? styles.chipOn : styles.chip} onClick={() => setVibe(key)}>
                <i className={styles.swatch} style={{ background: VIBES[key].ground }} aria-hidden="true" />
                {t.vibes[key]}
              </button>
            ))}
          </fieldset>
          <fieldset className={styles.pickRow}>
            <legend>{t.layout}</legend>
            {LAYOUTS.map((key) => (
              <button type="button" key={key} aria-pressed={layout === key} className={layout === key ? styles.chipOn : styles.chip} onClick={() => setLayout(key)}>
                {t.layouts[key as keyof typeof t.layouts]}
              </button>
            ))}
          </fieldset>
          <div className={styles.cardActions}>
            <button type="button" className={styles.primaryButton} disabled={busy !== null || photos.length === 0} onClick={() => void exportCard("download")}>
              <Download aria-hidden="true" size={16} />
              {busy === "download" ? t.preparing : t.download}
            </button>
            <button type="button" className={styles.secondaryButton} disabled={busy !== null || photos.length === 0} onClick={() => void exportCard("share")}>
              <Share2 aria-hidden="true" size={16} />
              {busy === "share" ? t.preparing : t.share}
            </button>
          </div>
          <p className={styles.cardQrNote}>{t.privacy}</p>
          <p className={styles.cardQrNote}>{t.showcaseSoon}</p>
        </div>
      </div>
    </section>
  );
}
