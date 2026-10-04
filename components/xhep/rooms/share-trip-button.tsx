"use client";

// "Share my trip" anywhere in the packs: makes the story card (share-card.ts)
// and hands it to the phone's share sheet, or saves it.

import { useState } from "react";
import { Share2 } from "lucide-react";
import { progressOf } from "@/lib/xhep/rooms.mjs";
import { myRooms, roomUrl, type Progress } from "@/lib/xhep/rooms-client";
import { tripUrl } from "@/lib/xhep/trip-link.mjs";
import { downloadBlob, shareBlob } from "@/lib/xhep/card-export";
import { track } from "@/lib/analytics";
import type { XhepProfile } from "../packs/use-profile";
import { shareCardPng } from "./share-card";
import { TOGETHER } from "./text";

export default function ShareTripButton({ lang, profile, className, from }: { lang: "en" | "sq"; profile: XhepProfile | null; className?: string; from: string }) {
  const t = TOGETHER[lang];
  const [busy, setBusy] = useState(false);
  const run = async () => {
    setBusy(true);
    try {
      const room = myRooms()[0] ?? null;
      const url = room ? roomUrl(room.code, lang) : profile ? tripUrl(profile, lang) : "https://383ks.com/visit";
      const blob = await shareCardPng({ name: profile?.name ?? "", progress: progressOf(profile) as Progress, url, roomName: room?.name ?? null, t: t.share });
      const file = "383-kosova-ne-xhep.png";
      if (!(await shareBlob(blob, file, `${t.shareMessage} ${url}`))) downloadBlob(blob, file);
      track("xhep_share_card", { mode: "share", from });
    } finally {
      setBusy(false);
    }
  };
  return (
    <button type="button" className={className} onClick={() => void run()} disabled={busy}>
      <Share2 size={17} aria-hidden="true" />
      {busy ? t.making : t.shareButton}
    </button>
  );
}
