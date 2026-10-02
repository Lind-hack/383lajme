"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { EASE, DUR } from "@/lib/tokens";
import UserMenu from "./user-menu";
import NavBalance from "./nav-balance";
import NavSidePanel from "./nav-side-panel";
import CoinToast from "./tregu/coin-toast";
import SearchOverlay from "./search-overlay";
import { treguHeroBehindChrome } from "@/components/tregu/video-hero";
import { NAV_CATEGORIES } from "@/lib/category-map";
import { occasionFor } from "@/lib/dardani-occasions.mjs";
import { PYET_OPEN_EVENT } from "@/lib/pyet-thread";
import DardaniImage from "./dardani/dardani-image";

/** Derived from lib/category-map, so the navbar, the side panel (which imports
 *  this), the footer and the pill row cannot drift apart. Order and membership
 *  are changed in one place. */
export const NAV_LINKS = NAV_CATEGORIES.map(({ label, slug }) => ({
  label,
  href: `/kategori/${slug}`,
}));

/**
 * The site's destinations. The navbar used to be the seven news categories,
 * which answered "what kind of story?" while a newcomer was still asking "what
 * is this site?". The categories now sit in their own icon row under the
 * header (components/category-rail), and Tregu has its live pill on the right.
 *
 * Sot and Për ty sit side by side: the shared view of today and the reader's
 * own, always one tap apart, and the public homepage is never silently
 * replaced by the personal one.
 */
export const PRIMARY_NAV = [
  { label: "Sot", href: "/" },
  { label: "Për ty", href: "/per-ty" },
  { label: "Bota për Kosovën", href: "/bota-per-kosoven" },
  { label: "Kosova në xhep", href: "/visit" },
] as const;

/**
 * Tregu with its live dot, and the Pyet Dardanin pill, which opens Pyet
 * Dardanin. Shown in both the full and the collapsed header.
 *
 * Dardani bobs his head in the pill's circle: his clean still face, moved by
 * CSS. The headbob video was tried and dropped — its right eye flashes white or
 * ghosts in about a third of its frames, too many to repair without stutter.
 * On an occasion (Flag Day,
 * Independence Day, New Year, a national-team match day) he wears it instead:
 * the occasion still, chosen by the Kosovo date after mount so a page cached
 * over midnight never shows yesterday's flag.
 */
function RightPills({ treguActive, onAsk }: { treguActive: boolean; onAsk: () => void }) {
  const [occasion, setOccasion] = useState<ReturnType<typeof occasionFor>>(null);
  useEffect(() => setOccasion(occasionFor()), []);

  return (
    <div className="nav-right-pills">
      <Link href="/tregu" className="nav-tregu-link" data-active={treguActive ? "true" : undefined}>
        <span className="nav-tregu-dot" aria-hidden="true" />
        <span className="nav-tregu-word">Tregu</span>
      </Link>
      <button
        type="button"
        className="nav-dardan"
        onClick={onAsk}
        aria-haspopup="dialog"
        title={occasion?.copy}
      >
        <span className="nav-dardan-face" data-occasion={occasion ? "" : undefined}>
          {occasion ? (
            <DardaniImage name={occasion.still} decorative priority className="nav-dardan-occasion" />
          ) : (
            <DardaniImage
              name="avatar-neutral"
              decorative
              priority
              unoptimized
              className="nav-dardan-bob"
              style={{ width: "108%", height: "auto" }}
            />
          )}
        </span>
        <span className="nav-dardan-label">Pyet Dardanin</span>
      </button>
    </div>
  );
}

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  // On /tregu the dark overlay holds until the hero actually ends — not at
  // 80px, which left a cream bar cutting across the video mid-hero.
  const [heroUp, setHeroUp] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchMode, setSearchMode] = useState<"kerko" | "pyet">("kerko");
  const pathname = usePathname();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchMode("kerko");
        setSearchOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 80);
      // On /tregu the dark overlay holds until the hero actually ends — not
      // at 80px, which left a cream bar cutting across the video mid-hero.
      setHeroUp(pathname === "/tregu" && treguHeroBehindChrome(window.scrollY));
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [pathname]);

  // Up to 1024px the compact header is used regardless of scroll: the Tregu
  // and Pyet Dardanin pills plus sign-in leave too little room for the
  // destination links, which were clipped mid-word at tablet widths. Phones
  // always got this layout; before it they had a clipped, non-obviously
  // scrollable row and no way to reach login/signup until they scrolled 80px.
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 1024px)");
    const onChange = () => setIsMobile(mq.matches);
    onChange();
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const collapsed = scrolled || isMobile;
  // On the Tregu hub the header melts into the full-screen video hero until
  // the user scrolls: transparent background, ink text flipped to white
  // (color overrides live in globals.css under header[data-overlay]).
  const overlay = pathname === "/tregu" && heroUp;
  const treguActive = Boolean(pathname?.startsWith("/tregu"));
  // Pyet Dardanin opened from elsewhere on the page (a "Pyet Dardanin" button
  // on a feed story), optionally with its question already asked.
  const [pyetSeed, setPyetSeed] = useState({ question: "", nonce: 0 });
  useEffect(() => {
    const onOpen = (event: Event) => {
      const question = (event as CustomEvent<{ question?: string }>).detail?.question ?? "";
      setSearchMode("pyet");
      setSearchOpen(true);
      if (question) setPyetSeed((prev) => ({ question, nonce: prev.nonce + 1 }));
    };
    window.addEventListener(PYET_OPEN_EVENT, onOpen);
    return () => window.removeEventListener(PYET_OPEN_EVENT, onOpen);
  }, []);

  const openSearch = (mode: "kerko" | "pyet") => {
    setSearchMode(mode);
    setSearchOpen(true);
  };

  return (
    <header
      data-overlay={overlay ? "true" : undefined}
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 50,
        background: overlay ? "transparent" : "#F9F6F1",
        borderBottom: overlay
          ? "1px solid transparent"
          : scrolled
            ? "1px solid #E8E3DB"
            : "1px solid rgba(17,17,17,0.08)",
        boxShadow: scrolled ? "0 2px 20px rgba(0,0,0,0.06)" : "none",
        transition: "background 0.3s ease, border-color 0.3s ease, box-shadow 0.3s ease",
      }}
    >
      <div
        style={{
          maxWidth: "1500px",
          margin: "0 auto",
          padding: "0 clamp(20px, 2vw, 32px)",
          height: "72px",
          display: "flex",
          alignItems: "center",
          gap: "8px",
        }}
      >
        {/* Logo — always visible, never scrolls away */}
        <Link
          href="/"
          className="logo-mark"
          style={{
            textDecoration: "none",
            display: "flex",
            alignItems: "baseline",
            gap: "4px",
            flexShrink: 0,
            marginRight: "24px",
          }}
        >
          <span
            style={{
              fontSize: "34px",
              fontWeight: 800,
              color: overlay ? "#FFFFFF" : "#111111",
              letterSpacing: "-0.04em",
              lineHeight: 1,
              transition: "color 0.3s ease",
            }}
          >
            383
          </span>
          <span
            className="logo-dot"
            style={{
              width: "6px",
              height: "6px",
              borderRadius: "50%",
              background: "#FF4422",
              display: "inline-block",
              marginBottom: "4px",
              flexShrink: 0,
            }}
          />
        </Link>

        {/* Crossfade between the full nav and the collapsed hamburger so the
            two states slide/fade into each other instead of popping. */}
        <AnimatePresence mode="wait" initial={false}>
          {collapsed ? (
            <motion.div
              key="collapsed"
              initial={{ opacity: 0, x: 6 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 6 }}
              transition={{ duration: DUR.slow, ease: EASE }}
              style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center" }}
            >
              {/* Spacer pushes the controls to the right */}
              <div style={{ flex: 1, minWidth: 0 }} />
              <RightPills treguActive={treguActive} onAsk={() => openSearch("pyet")} />
              {/* Search survives the collapse. It is the one thing that can
                  stand in for the categories that just disappeared, so burying
                  it inside the hamburger would cost the most at exactly the
                  moment the nav has the least. */}
              <button
                type="button"
                className="nav-search-btn"
                onClick={() => openSearch("kerko")}
                aria-label="Kërko"
                style={{ margin: "0 8px" }}
              >
                <Search size={19} strokeWidth={2.5} aria-hidden="true" />
              </button>
              <button
                className="nav-menu-btn"
                onClick={() => setMenuOpen(true)}
                aria-label="Hap menunë"
                aria-expanded={menuOpen}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "5px",
                  width: "44px",
                  height: "44px",
                  borderRadius: "12px",
                  border: "1.5px solid #E8E3DB",
                  background: "#FFFFFF",
                  cursor: "pointer",
                  flexShrink: 0,
                }}
              >
                <span className="hamburger-bar" aria-hidden />
                <span className="hamburger-bar" aria-hidden />
                <span className="hamburger-bar" aria-hidden />
              </button>
            </motion.div>
          ) : (
            <motion.div
              key="full"
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -6 }}
              transition={{ duration: DUR.slow, ease: EASE }}
              style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: "8px" }}
            >
              {/* Scrollable nav pills */}
              <div
                className="nav-scroll"
                style={{
                  flex: 1,
                  minWidth: 0,
                  display: "flex",
                  alignItems: "center",
                  overflowX: "auto",
                  WebkitOverflowScrolling: "touch",
                }}
              >
                {PRIMARY_NAV.map((link) => {
                  // "/" would otherwise match every path, so Sot is exact.
                  const active =
                    link.href === "/"
                      ? pathname === "/"
                      : pathname === link.href ||
                        pathname?.startsWith(link.href + "/");
                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      className="nav-pill nav-pill--primary"
                      aria-current={active ? "page" : undefined}
                    >
                      {link.label}
                    </Link>
                  );
                })}

              </div>

              <button
                type="button"
                className="nav-search-btn"
                onClick={() => openSearch("kerko")}
                aria-label="Kërko"
                title="Kërko  ⌘K"
              >
                <Search size={19} strokeWidth={2.5} aria-hidden="true" />
              </button>

              <RightPills treguActive={treguActive} onAsk={() => openSearch("pyet")} />

              {/* Desktop only: auth pinned right (mobile auth lives in the side panel) */}
              <div className="nav-auth-desktop">
                <NavBalance />
                <UserMenu />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <NavSidePanel open={menuOpen} onClose={() => setMenuOpen(false)} />
      <SearchOverlay
        open={searchOpen}
        initialMode={searchMode}
        onClose={() => {
          setSearchOpen(false);
          // The overlay remounts on every open; a spent question must not be asked again.
          setPyetSeed((prev) => ({ ...prev, question: "" }));
        }}
        seedQuestion={pyetSeed.question}
        seedNonce={pyetSeed.nonce}
      />
      <CoinToast />
    </header>
  );
}
