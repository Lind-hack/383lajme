"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import type { ComponentType } from "react";
import { House } from "lucide-react";
import { CoinIcon, KosovoGlobeIcon, PersonalFeedIcon } from "./tab-icons";
import DardaniImage from "./dardani/dardani-image";
import { occasionFor } from "@/lib/dardani-occasions.mjs";
import { openPyet } from "@/lib/pyet-thread";
import { wiggleDelay } from "@/lib/nav-chrome.mjs";

type TabIcon = ComponentType<{ size?: number; strokeWidth?: number }>;
type Tab = { href: string; label: string; title?: string; icon: TabIcon; live?: boolean };

/**
 * Phones only (globals.css, .m-tabbar): the site's destinations within a
 * thumb's reach, with Pyet Dardanin raised in the middle. That is the slot
 * people already know as the main action (TikTok's +), and it makes Dardani
 * a feature of the site rather than a pill squeezed into the header, which
 * on a phone now holds only the logo, search and the menu.
 *
 * The active tab carries the same orange as the desktop nav's current link,
 * and its highlight slides between tabs (a shared layoutId) instead of
 * jumping — which is why this lives in the root layout: mounted in the navbar
 * it was rebuilt on every page and had nothing to slide from.
 */
const LEFT: Tab[] = [
  { href: "/", label: "Sot", icon: House },
  { href: "/per-ty", label: "Për ty", icon: PersonalFeedIcon },
];
const RIGHT: Tab[] = [
  { href: "/tregu", label: "Tregu", icon: CoinIcon, live: true },
  // "Bota për Kosovën" ellipsised in a fifth of a phone; the full name stays
  // for screen readers and as the tooltip.
  { href: "/bota-per-kosoven", label: "Bota", title: "Bota për Kosovën", icon: KosovoGlobeIcon },
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

/**
 * Dardani's face in the raised button. He hops once when the page loads, then
 * gives a small wiggle every 10–15 seconds: enough to say "you can ask me",
 * never a loop that pulls the eye off the headlines. Nothing moves under
 * reduce motion or while the tab is in the background.
 */
function DardaniFace() {
  const reduce = useReducedMotion();
  const faceRef = useRef<HTMLSpanElement>(null);
  const [occasion, setOccasion] = useState<ReturnType<typeof occasionFor>>(null);
  // By the Kosovo date after mount, so a page cached over midnight never
  // shows yesterday's flag.
  useEffect(() => setOccasion(occasionFor()), []);

  useEffect(() => {
    const el = faceRef.current;
    if (reduce || !el || typeof el.animate !== "function") return;
    const hop = el.animate(
      [
        { transform: "translateY(0) scale(1)" },
        { transform: "translateY(-9px) scale(1.04)", offset: 0.35 },
        { transform: "translateY(0) scale(0.97)", offset: 0.62 },
        { transform: "translateY(-2px) scale(1.01)", offset: 0.8 },
        { transform: "translateY(0) scale(1)" },
      ],
      { duration: 720, delay: 450, easing: "cubic-bezier(0.22, 1, 0.36, 1)" },
    );
    let timer = 0;
    const wiggle = () => {
      if (document.visibilityState === "visible") {
        el.animate(
          [
            { transform: "rotate(0deg)" },
            { transform: "rotate(-9deg)", offset: 0.2 },
            { transform: "rotate(7deg)", offset: 0.45 },
            { transform: "rotate(-3deg)", offset: 0.7 },
            { transform: "rotate(0deg)" },
          ],
          { duration: 560, easing: "ease-in-out" },
        );
      }
      timer = window.setTimeout(wiggle, wiggleDelay(Math.random()));
    };
    timer = window.setTimeout(wiggle, wiggleDelay(Math.random()));
    return () => {
      hop.cancel();
      window.clearTimeout(timer);
    };
  }, [reduce]);

  return (
    <span className="m-dardan-face" ref={faceRef} data-occasion={occasion ? "" : undefined}>
      {occasion ? (
        <DardaniImage name={occasion.still} decorative priority className="m-dardan-occasion" style={{ width: "100%", height: "100%" }} />
      ) : (
        // Sized inline: next/image writes its own inline width, which CSS loses to.
        <DardaniImage name="avatar-neutral" decorative priority unoptimized className="m-dardan-still" style={{ width: "108%", height: "auto" }} />
      )}
    </span>
  );
}

export default function MobileTabBar() {
  const pathname = usePathname() ?? "/";
  const reduce = useReducedMotion();
  // The tapped tab lights up at once; the route catches up a moment later.
  const [pending, setPending] = useState<string | null>(null);
  useEffect(() => setPending(null), [pathname]);

  if (hidden(pathname)) return null;

  const renderTab = ({ href, label, title, icon: Icon, live }: Tab) => {
    const active = pending ? pending === href : isActive(pathname, href);
    return (
      <li key={href}>
        <Link
          href={href}
          className="m-tab"
          aria-current={active ? "page" : undefined}
          aria-label={title}
          title={title}
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
          <span className="m-tab-label" aria-hidden={title ? true : undefined}>{label}</span>
        </Link>
      </li>
    );
  };

  return (
    <nav className="m-tabbar" aria-label="Navigimi kryesor">
      <ul>
        {LEFT.map(renderTab)}
        <li className="m-tab-dardan-slot">
          <motion.button
            type="button"
            className="m-dardan"
            onClick={() => openPyet()}
            aria-haspopup="dialog"
            aria-label="Pyet Dardanin"
            whileTap={reduce ? undefined : { scale: 0.92 }}
            transition={{ type: "spring", stiffness: 520, damping: 28 }}
          >
            <span className="m-dardan-disc">
              <DardaniFace />
            </span>
            <span className="m-tab-label m-dardan-label" aria-hidden="true">Pyet</span>
          </motion.button>
        </li>
        {RIGHT.map(renderTab)}
      </ul>
    </nav>
  );
}
