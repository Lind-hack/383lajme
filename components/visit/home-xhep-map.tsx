"use client";

import { useRouter } from "next/navigation";
import ReliefMap from "@/components/xhep/relief-map";

/** The /visit map on the homepage: a medallion opens the box at that city's pack. */
export default function HomeXhepMap({ waits }: { waits: Record<string, number | null> }) {
  const router = useRouter();
  return <ReliefMap lang="sq" waits={waits} onCity={(id) => router.push(`/visit?lang=sq&qyteti=${id}#packs`)} />;
}
