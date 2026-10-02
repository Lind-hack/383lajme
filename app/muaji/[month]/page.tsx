// "Tetori në 383": the month in news, as story cards (lib/monthly-wrapped.mjs).
//
// The cards are the server-drawn images at app/api/og/muaji/[month]/[card], so
// what a reader sees is exactly what they share. A month opens once it is over
// in Kosovo; the newsroom's archive starts in September 2026.

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Navbar from "@/components/navbar";
import { getMonthWrapped, type MonthWrapped } from "@/lib/monthly-wrapped-server";
import { cardsFor, isMonthOver, parseMonth, type WrappedCard } from "@/lib/monthly-wrapped.mjs";
import WrappedStories, { type StoryCard } from "../wrapped-stories";

export const revalidate = 86400;

const FIRST_MONTH = "2026-09";

function open(month: string) {
  return Boolean(parseMonth(month)) && month >= FIRST_MONTH && isMonthOver(month);
}

/** What each card says, for screen readers and as the image's alt text. */
function describe(card: WrappedCard, w: MonthWrapped): { alt: string; story: string | null } {
  if (card === "hyrje") return { alt: `${w.title}: ${w.total} lajme në ${w.days} ditë.`, story: null };
  if (card === "emri" && w.person) {
    return {
      alt: `Emri i muajit: ${w.person.name}, u përmend në ${w.person.count} lajme. Më i lexuari: ${w.person.top?.title ?? ""}`,
      story: w.person.top?.slug ?? null,
    };
  }
  if (card === "dita" && w.busiest) {
    return {
      alt: `Dita më e ngarkuar: ${w.busiest.label}, ${w.busiest.count} lajme. ${w.busiest.top?.title ?? ""}`,
      story: w.busiest.top?.slug ?? null,
    };
  }
  const region = w.regions.find((r) => r.key === card);
  return {
    alt: region ? `${region.label}: ${region.count} lajme. Lajmi i muajit: ${region.top?.title ?? ""}` : w.title,
    story: region?.top?.slug ?? null,
  };
}

export async function generateMetadata({ params }: { params: Promise<{ month: string }> }): Promise<Metadata> {
  const { month } = await params;
  const w = open(month) ? await getMonthWrapped(month) : null;
  if (!w) return { title: "383" };
  const description = `${w.total} lajme nga Kosova, Shqipëria dhe bota — muaji në 383.`;
  return {
    title: w.title,
    description,
    openGraph: { title: w.title, description, images: [{ url: `/api/og/muaji/${month}/hyrje`, width: 1080, height: 1920 }] },
  };
}

export default async function MonthPage({ params }: { params: Promise<{ month: string }> }) {
  const { month } = await params;
  if (!open(month)) notFound();
  const w = await getMonthWrapped(month);
  const cards = cardsFor(w);
  if (!w || cards.length === 0) notFound();

  const stories: StoryCard[] = cards.map((card) => ({
    card,
    src: `/api/og/muaji/${month}/${card}`,
    ...describe(card, w),
  }));

  return (
    <>
      <Navbar />
      <WrappedStories
        month={month}
        title={w.title}
        monthName={w.title.replace(/ në 383$/, "")}
        total={w.total}
        cards={stories}
      />
    </>
  );
}
