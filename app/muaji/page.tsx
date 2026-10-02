import { redirect } from "next/navigation";
import { lastMonth } from "@/lib/monthly-wrapped.mjs";

/** /muaji always opens the newest finished month. */
export const dynamic = "force-dynamic";

export default function LatestMonth() {
  redirect(`/muaji/${lastMonth()}`);
}
