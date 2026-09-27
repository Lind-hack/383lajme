"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import type { ComponentType } from "react";
import { House } from "lucide-react";
import CoinFace from "./tregu/coin-face";
import { KosovoGlobeIcon, PersonalFeedIcon } from "./tab-icons";

type TabIcon = ComponentType<{ size?: number; strokeWidth?: number }>;

/** Tregu's own gold 383 coin, still: the one coloured mark in the bar. */
function TreguCoinIcon({ size = 22 }: { size?: number }) {
  return (
    <span className="tab-coin">
      <CoinFace size={size + 2} idle={false} shine={false} />
    </span>
  );
}

/**
 * Phones only (globals.css, .m-tabbar): the site's four destinations within a
 * thumb's reach. Below 1024px the header folds into a hamburger, which left
 * Sot, Për ty and Bota për Kosovën two taps away and behind a panel.
 *
 * The active tab carries the same orange as the desktop nav's current link,
 * and its highlight slides between tabs (a shared layoutId) instead of
 * jumping — which is why this lives in the root layout: mounted in the navbar
 * it was rebuilt on every page and had nothing to slide from.
 */
const TABS: { href: string; label: string; icon: TabIcon; live?: boolean }[] = [
  { href: "/", label: "Sot", icon: House },
  { href: "/per-ty", label: "Për ty", icon: PersonalFeedIcon },
  { href: "/tregu", label: "Tregu", icon: TreguCoinIcon, live: true },
  { href: "/bota-per-kosoven", label: "Bota për Kosovën", icon: KosovoGlobeIcon },
];

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

/** Pages that must not carry the bar. */
function hidden(pathname: string) {
  // A market page (and its preview) has its own fixed buy/sell dock; the
  // portfolio does not.
  if (/^\/tregu(-preview)?\/(?!portofoli(\/|$))/.test(pathname)) return true;
  // Admin and the embeddable Toni page have no site header, so no site
  // navigation either.
  return /^\/(admin|toni|tregu-preview)(\/|$)/.test(pathname);
}

export default function MobileTabBar() {
  const pathname = usePathname() ?? "/";
  const reduce = useReducedMotion();
  // The tapped tab lights up at once; the route catches up a moment later.
  const [pending, setPending] = useState<string | null>(null);
  useEffect(() => setPending(null), [pathname]);

  if (hidden(pathname)) return null;

  return (
    <nav className="m-tabbar" aria-label="Navigimi kryesor">
      <ul>
        {TABS.map(({ href, label, icon: Icon, live }) => {
          const active = pending ? pending === href : isActive(pathname, href);
          return (
            <li key={href}>
              <Link
                href={href}
                className="m-tab"
                aria-current={active ? "page" : undefined}
                onClick={() => {
                  if (!isActive(pathname, href)) setPending(href);
                }}
              >
                <motion.span
                  className="m-tab-icon"
                  whileTap={reduce ? undefined : { scale: 0.88 }}
                  transition={{ type: "spring", stiffness: 520, damping: 30 }}
                >
                  {active && (
                    <motion.span
                      layoutId="m-tab-highlight"
                      className="m-tab-highlight"
                      transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 420, damping: 34 }}
                    />
                  )}
                  <motion.span
                    // Re-keyed on activation, so the icon gives one small lift
                    // when its tab becomes current and none on every render.
                    key={active ? "on" : "off"}
                    className="m-tab-glyph"
                    initial={active && !reduce ? { y: 3, scale: 0.9 } : false}
                    animate={{ y: 0, scale: 1 }}
                    transition={{ type: "spring", stiffness: 500, damping: 22 }}
                  >
                    <Icon size={22} strokeWidth={active ? 2.4 : 2} />
                    {live && <i className="m-tab-live" aria-hidden="true" />}
                  </motion.span>
                </motion.span>
                <span className="m-tab-label">{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
