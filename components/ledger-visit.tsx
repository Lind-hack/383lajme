"use client";

// Marks today as a day with 383 in the reader's ledger (lib/reader-ledger.mjs):
// the issue number of their paper and the streaks in their wrapped. Mounted
// once in the root layout; it notes again on navigation, so a tab left open
// past midnight still counts the new day. Recording a day twice changes
// nothing. Device only. Renders nothing.

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { noteVisit } from "@/lib/reader-ledger.mjs";

export default function LedgerVisit() {
  const pathname = usePathname();
  useEffect(() => {
    noteVisit();
  }, [pathname]);
  return null;
}
