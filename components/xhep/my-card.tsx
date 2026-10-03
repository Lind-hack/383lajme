"use client";

import { Download, Pencil, RotateCcw, Share2, Smartphone } from "lucide-react";
import { useMemo, useState } from "react";
import { cardArt } from "@/lib/xhep/card-art.mjs";
import type { readProfile } from "@/lib/xhep/profile.mjs";
import { cardPng, downloadBlob, shareBlob, storyPng } from "@/lib/xhep/card-export";
import { xhepDict, type XhepLang } from "@/lib/xhep/i18n";
import { track } from "@/lib/analytics";
import styles from "./xhep.module.css";

type Profile = NonNullable<ReturnType<typeof readProfile>>;

export default function MyCard({
  lang,
  profile,
  qrUrl,
  onEdit,
  onReset,
}: {
  lang: XhepLang;
  profile: Profile;
  qrUrl: string;
  onEdit: () => void;
  onReset: () => void;
}) {
  const t = xhepDict(lang).card;
  const trip = xhepDict(lang).trip;
  const [busy, setBusy] = useState<"pass" | "story" | "share" | null>(null);
  const [note, setNote] = useState("");
  // The generator escapes every visitor-supplied string, so its output is safe to inline.
  const svg = useMemo(
    () => cardArt(profile, { lang, seed: profile.seed ?? "", stamps: profile.stamps ?? [], qrUrl }),
    [profile, lang, qrUrl],
  );
  const fileBase = `kosova-ne-xhep${profile.name ? `-${profile.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}` : ""}`;

  const run = async (kind: "pass" | "story" | "share") => {
    setBusy(kind);
    setNote("");
    try {
      if (kind === "share") {
        const blob = await storyPng(svg, "383ks.com/visit");
        track("xhep_card_share");
        const shared = await shareBlob(blob, `${fileBase}.png`, t.shareText);
        if (!shared) {
          downloadBlob(blob, `${fileBase}-story.png`);
          setNote(t.shareFailed);
        }
      } else {
        const blob = kind === "pass" ? await cardPng(svg) : await storyPng(svg, "383ks.com/visit");
        downloadBlob(blob, kind === "pass" ? `${fileBase}.png` : `${fileBase}-story.png`);
        track("xhep_card_download", { size: kind });
      }
    } catch (error) {
      setNote(String(error instanceof Error ? error.message : error));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className={styles.cardLayout}>
      <figure className={styles.cardFigure} dangerouslySetInnerHTML={{ __html: svg }} />
      <div className={styles.cardSide}>
        <h3>{t.title}</h3>
        {profile.travellingWith && <p className={styles.travellingWith}>{trip.travellingWith(profile.travellingWith)}</p>}
        <p>{t.intro}</p>
        <div className={styles.cardActions}>
          <button type="button" className={styles.primaryButton} disabled={busy !== null} onClick={() => void run("pass")}>
            <Download aria-hidden="true" size={16} />
            {busy === "pass" ? t.preparing : t.downloadPass}
          </button>
          <button type="button" className={styles.secondaryButton} disabled={busy !== null} onClick={() => void run("story")}>
            <Smartphone aria-hidden="true" size={16} />
            {busy === "story" ? t.preparing : t.downloadStory}
          </button>
          <button type="button" className={styles.secondaryButton} disabled={busy !== null} onClick={() => void run("share")}>
            <Share2 aria-hidden="true" size={16} />
            {busy === "share" ? t.preparing : t.share}
          </button>
        </div>
        {note && <p className={styles.cardNote} role="status">{note}</p>}
        <p className={styles.cardQrNote}>{t.qrNote}</p>
        <div className={styles.cardMeta}>
          <button type="button" className={styles.linkButton} onClick={onEdit}>
            <Pencil aria-hidden="true" size={14} />
            {t.edit}
          </button>
          <button
            type="button"
            className={styles.linkButton}
            onClick={() => {
              if (window.confirm(t.resetConfirm)) onReset();
            }}
          >
            <RotateCcw aria-hidden="true" size={14} />
            {t.reset}
          </button>
        </div>
      </div>
    </div>
  );
}
