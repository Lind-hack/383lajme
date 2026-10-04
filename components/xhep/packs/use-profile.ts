"use client";

import { useCallback, useEffect, useState } from "react";
import { newSeed, PROFILE_EVENT, readProfile, writeProfile } from "@/lib/xhep/profile.mjs";

export type XhepProfile = NonNullable<ReturnType<typeof readProfile>>;

/**
 * The visitor's Kosova në xhep profile, shared live between the pack shelf,
 * the stamp card and the companion: any write, from any of them, reaches all.
 * Null until mounted (server and first client render agree), then null only
 * while the visitor has no profile at all.
 */
export function useXhepProfile() {
  const [profile, setProfile] = useState<XhepProfile | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const sync = () => setProfile(readProfile());
    sync();
    setLoaded(true);
    window.addEventListener(PROFILE_EVENT, sync);
    // Another tab of the guide.
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(PROFILE_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  /** Change the profile; a visitor without one gets one (with a card seed). */
  const update = useCallback((change: (current: XhepProfile) => Partial<XhepProfile>) => {
    const current = (readProfile() ?? { seed: newSeed() }) as XhepProfile;
    writeProfile({ ...current, seed: current.seed ?? newSeed(), ...change(current) });
  }, []);

  return { profile, loaded, update };
}
