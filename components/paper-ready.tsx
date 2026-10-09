"use client";

// Dardani's offer at the end of an article: after the reader's third real read
// on this device, and only while they have no paper of their own, he says he
// has already made one from what they read (lib/perty-learned.mjs).
//
// It waits for the read itself: components/reading-affinity.tsx sends
// READ_EVENT once a read has been recorded, so the count and the picks shown
// include this article. Shown once, then not again for a week, tapped or not.

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { readInterests, writeInterests, hasInterests } from "@/lib/interests.mjs";
import { readLedger } from "@/lib/reader-ledger.mjs";
import {
  learnedPicks,
  noteOffer,
  readLastOffer,
  setLearnedPaper,
  shouldOffer,
  totalReads,
  type LearnedPicks,
} from "@/lib/perty-learned.mjs";
import { track } from "@/lib/analytics";
import PaperReveal from "@/components/paper-reveal";

/** Fired on window by ReadingAffinity once a full read has been recorded. */
export const READ_EVENT = "383:read";
/** Fired on window when the offer appears, so the Pyet bubble steps aside. */
export const PAPER_OFFER_EVENT = "383:paper-offer";

export default function PaperReady() {
  const router = useRouter();
  const [offer, setOffer] = useState<{ picks: LearnedPicks; reads: number } | null>(null);

  useEffect(() => {
    const check = () => {
      const interests = readInterests();
      const picks = learnedPicks(interests?.affinity);
      const reads = totalReads(readLedger());
      if (!shouldOffer({ reads, picks, chosen: hasInterests(interests), lastOffer: readLastOffer() })) return;
      noteOffer();
      setOffer({ picks, reads });
      window.dispatchEvent(new Event(PAPER_OFFER_EVENT));
      track("paper_offer_shown", { reads });
    };
    window.addEventListener(READ_EVENT, check);
    return () => window.removeEventListener(READ_EVENT, check);
  }, []);

  if (!offer) return null;
  return (
    <div className="paper-ready">
      <PaperReveal
        picks={offer.picks}
        reads={offer.reads}
        variant="card"
        onOpen={(picks) => {
          writeInterests({ ...readInterests(), ...picks });
          setLearnedPaper(true);
          track("paper_offer_open", { reads: offer.reads });
          router.push("/per-ty");
        }}
        onSecondary={() => {
          track("paper_offer_later", { reads: offer.reads });
          setOffer(null);
        }}
        secondaryLabel="Jo tani"
      />
    </div>
  );
}
