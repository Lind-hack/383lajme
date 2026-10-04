"use client";

// Help for your trip, below the packs: the sourced route, arrival, prices,
// phrases and dates, fitted to the visitor's answers when they have given them.

import XhepHelp, { type LiveFuel } from "./help";
import { useXhepProfile } from "./packs/use-profile";
import type { XhepLang } from "@/lib/xhep/i18n";

export default function TripHelp({ lang, fuel }: { lang: XhepLang; fuel: LiveFuel | null }) {
  const { profile, loaded } = useXhepProfile();
  if (!loaded) return null;
  return <XhepHelp key={profile?.updatedAt ?? "none"} lang={lang} profile={profile} fuel={fuel} />;
}
