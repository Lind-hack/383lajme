"use client";

import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";

export default function StickyMarketBack() {
  const router = useRouter();

  const goBack = () => {
    let hasLocalReferrer = false;
    try {
      hasLocalReferrer = Boolean(document.referrer) && new URL(document.referrer).origin === window.location.origin;
    } catch {
      hasLocalReferrer = false;
    }

    if (hasLocalReferrer && window.history.length > 1) {
      router.back();
      return;
    }
    router.push("/tregu");
  };

  return (
    <button type="button" className="tregu-sticky-back" onClick={goBack} aria-label="Kthehu te faqja e mëparshme">
      <ArrowLeft aria-hidden size={17} strokeWidth={2.4} />
      <span>Kthehu</span>
    </button>
  );
}
