"use client";

import { useEffect, useRef, useState, type MouseEvent, type ReactNode } from "react";
import Link from "next/link";

// Cinematic rotation (Pexels, free license): the cities the platform speaks
// to, then the sports it prices. Two stacked <video> layers crossfade between
// clips so the loop never hard-cuts — each clip dissolves into the next, and
// the playlist wraps around seamlessly.
const VIDEOS = [
  // #36244310 — aerial city skyline at night, 2560×1440 30fps
  "https://videos.pexels.com/video-files/36244310/15370739_2560_1440_30fps.mp4",
  // #30070091 — aerial nighttime cityscape with lights, 2732×1440 24fps
  "https://videos.pexels.com/video-files/30070091/12897525_2732_1440_24fps.mp4",
  // #18125882 — hyperlapse of Houston at night, 1922×1440 30fps
  "https://videos.pexels.com/video-files/18125882/18125882-uhd_1922_1440_30fps.mp4",
  // #10341482 — basketball in a dark arena, 2048×1080 25fps
  "https://videos.pexels.com/video-files/10341482/10341482-hd_2048_1080_25fps.mp4",
  // #35002181 — football under night floodlights, 1920×1080 30fps
  "https://videos.pexels.com/video-files/35002181/14828537_1920_1080_30fps.mp4",
  // #13866489 — motorsport at night, 1920×1080 30fps
  "https://videos.pexels.com/video-files/13866489/13866489-hd_1920_1080_30fps.mp4",
];

/** Hero geometry, mirrored by the fixed chrome that floats over it. */
export const TREGU_HERO = { mobileFrac: 0.82, desktopFrac: 0.9, mobileMin: 520, desktopMin: 600, navH: 64 };

/** True while the hero still sits behind the fixed navbar / account bar. */
export function treguHeroBehindChrome(scrollY: number): boolean {
  if (typeof window === "undefined") return true;
  const mobile = window.innerWidth <= 768;
  const heroH = Math.max(
    mobile ? TREGU_HERO.mobileMin : TREGU_HERO.desktopMin,
    window.innerHeight * (mobile ? TREGU_HERO.mobileFrac : TREGU_HERO.desktopFrac)
  );
  return scrollY < heroH - TREGU_HERO.navH;
}
const CROSSFADE_MS = 1800;

function CinematicBackdrop() {
  const layerA = useRef<HTMLVideoElement>(null);
  const layerB = useRef<HTMLVideoElement>(null);
  // Mutable playback state lives in a ref — timeupdate fires ~4×/s and must
  // never re-render; React state only changes at the crossfade moment.
  const pb = useRef({ front: 0, index: 0, switching: false });
  const [front, setFront] = useState(0);
  // The videos mount client-side only: browser extensions (video-speed
  // controllers etc.) inject sibling DOM next to <video> tags they find in
  // the served HTML before React hydrates, which breaks hydration (#418).
  // SSR gains nothing from empty <video> shells — src is set in an effect.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!mounted) return;
    const layers = [layerA.current, layerB.current];
    const a = layers[0];
    const b = layers[1];
    if (!a || !b) return;

    a.src = VIDEOS[0];
    a.play().catch(() => {});
    // Warm the next clip in the hidden layer so the dissolve starts instantly.
    b.src = VIDEOS[1 % VIDEOS.length];
    b.load();

    const onTime = () => {
      const s = pb.current;
      const frontVideo = layers[s.front];
      const backVideo = layers[1 - s.front];
      if (!frontVideo || !backVideo || s.switching) return;
      if (!frontVideo.duration) return;
      if (frontVideo.duration - frontVideo.currentTime > CROSSFADE_MS / 1000 + 0.2) return;

      s.switching = true;
      backVideo.currentTime = 0;
      backVideo.play().catch(() => {});
      setFront(1 - s.front); // CSS opacity transition performs the dissolve
      window.setTimeout(() => {
        frontVideo.pause();
        s.index = (s.index + 1) % VIDEOS.length;
        s.front = 1 - s.front;
        // Preload the clip after next into the now-hidden layer.
        frontVideo.src = VIDEOS[(s.index + 1) % VIDEOS.length];
        frontVideo.load();
        s.switching = false;
      }, CROSSFADE_MS + 200);
    };

    a.addEventListener("timeupdate", onTime);
    b.addEventListener("timeupdate", onTime);
    return () => {
      a.removeEventListener("timeupdate", onTime);
      b.removeEventListener("timeupdate", onTime);
    };
  }, [mounted]);

  const layerClass = "absolute inset-0 h-full w-full object-cover transition-opacity";
  // Cinematic grade: cooler saturation, lifted contrast, slightly dimmed —
  // the vignette layer above finishes the mood and feeds the headline contrast.
  const layerStyle = { filter: "saturate(0.92) contrast(1.06) brightness(0.9)" };
  if (!mounted) return null;
  return (
    <>
      <video
        ref={layerA}
        muted
        playsInline
        preload="auto"
        className={layerClass}
        style={{ ...layerStyle, opacity: front === 0 ? 1 : 0, transitionDuration: `${CROSSFADE_MS}ms` }}
      />
      <video
        ref={layerB}
        muted
        playsInline
        preload="auto"
        className={layerClass}
        style={{ ...layerStyle, opacity: front === 1 ? 1 : 0, transitionDuration: `${CROSSFADE_MS}ms` }}
      />
      {/* Vignette: radial falloff from the upper third plus a top and bottom
          wash — every clip, bright or dark, lands in the same night world. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(120% 100% at 50% 25%, rgba(0,0,0,0) 38%, rgba(0,0,0,0.5) 100%), linear-gradient(180deg, rgba(0,0,0,0.5) 0%, rgba(0,0,0,0.08) 40%, rgba(0,0,0,0.6) 100%)",
        }}
      />
    </>
  );
}

// Luxe entrance: soft rise + blur dissolve + settle, long tail on a strong
// ease-out — hero-only pacing (marketing surface, seen once per visit).
function Reveal({
  delay,
  duration = 1400,
  className = "",
  children,
}: {
  delay: number;
  duration?: number;
  className?: string;
  children: ReactNode;
}) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), delay);
    return () => clearTimeout(t);
  }, [delay]);
  return (
    <div
      className={className}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0) scale(1)" : "translateY(26px) scale(0.97)",
        filter: visible ? "blur(0px)" : "blur(10px)",
        transition: `opacity ${duration}ms var(--ease-out), transform ${duration}ms var(--ease-out), filter ${duration * 0.75}ms ease`,
        transitionDelay: visible ? "0ms" : undefined,
        willChange: visible ? undefined : "opacity, transform, filter",
      }}
    >
      {children}
    </div>
  );
}

function AnimatedHeading({ text, initialDelay = 200 }: { text: string; initialDelay?: number }) {
  const [started, setStarted] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setStarted(true), initialDelay);
    return () => clearTimeout(t);
  }, [initialDelay]);

  const charDelay = 30;
  const lines = text.split("\n");

  return (
    <h1
      className="text-4xl md:text-5xl lg:text-6xl xl:text-7xl font-normal mb-4 text-white"
      style={{ letterSpacing: "-0.04em" }}
    >
      {lines.map((line, lineIndex) => {
        const lineOffset = lines.slice(0, lineIndex).reduce((n, l) => n + l.length, 0);
        const words = line.split(" ");
        return (
          <span key={lineIndex} className="block">
            {words.map((word, wordIndex) => {
              // Words are atomic inline-blocks so a wrap never lands mid-word;
              // per-letter spans alone let the browser break inside a word.
              const wordOffset = words.slice(0, wordIndex).reduce((n, w) => n + w.length + 1, 0);
              return (
                <span key={wordIndex} className="inline-block whitespace-nowrap">
                  {word.split("").map((ch, charIndex) => (
                    <span
                      key={charIndex}
                      className="inline-block"
                      style={{
                        opacity: started ? 1 : 0,
                        transform: started ? "translateX(0)" : "translateX(-18px)",
                        transition: "opacity 500ms ease, transform 500ms ease",
                        transitionDelay: `${(lineOffset + wordOffset + charIndex) * charDelay}ms`,
                      }}
                    >
                      {ch}
                    </span>
                  ))}
                  {wordIndex < words.length - 1 ? " " : ""}
                </span>
              );
            })}
          </span>
        );
      })}
    </h1>
  );
}

export default function VideoHero({ loggedIn }: { loggedIn: boolean }) {
  const scrollToMarkets = (event: MouseEvent<HTMLAnchorElement>) => {
    const floor = document.getElementById("tregjet");
    if (!floor) return;
    event.preventDefault();
    floor.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
      block: "start",
    });
  };

  return (
    // 72/80dvh instead of full viewport: the hero teases, the floor delivers.
    // min-height floors keep small phones (SE) and short laptop windows honest.
    // 82/90dvh — taller than the first trim so the clips breathe, still short
    // enough that the floor teases in. The chrome mirrors these numbers via
    // treguHeroBehindChrome().
    <section className="relative h-[82dvh] min-h-[520px] overflow-hidden bg-[#111111] md:h-[90dvh] md:min-h-[600px]">
      <CinematicBackdrop />

      <div className="relative z-10 flex h-full flex-col px-6 md:px-12 lg:px-16 pt-24">
        <div className="flex flex-1 flex-col justify-end pb-8 lg:pb-12">
          <div className="lg:grid lg:grid-cols-2 lg:items-end">
            <div>
              <AnimatedHeading text={"Parashiko të ardhmen\nme 383 Tregu."} />

              <Reveal delay={800}>
                <p className="text-base md:text-lg text-gray-300 mb-5 max-w-[56ch]">
                  Tregu i parashikimeve i 383 — çdo pyetje lind nga lajmet e ditës. Zgjidh Po ose Jo,
                  vër bast me 383 Coin falas dhe përqindja tregon çka beson Kosova.
                </p>
              </Reveal>

              {!loggedIn && (
                <Reveal delay={1250}>
                  <Link
                    href="/hyr?tab=regjistrohu&next=/tregu"
                    className="liquid-glass liquid-glass-btn btn-shimmer border border-white/25 text-white px-8 py-3 rounded-lg font-medium"
                  >
                    <span className="btn-shimmer-text">Merr 100 383 Coin falas</span>
                  </Link>
                </Reveal>
              )}
            </div>

            <Reveal delay={1750} className="mt-8 flex items-end justify-start lg:mt-0 lg:justify-end">
              {/* Matte orange with real material depth: a near-invisible
                  vertical shade, an inset top highlight like brushed metal,
                  and a tinted drop shadow — no gloss, no shimmer. */}
              <a
                href="#tregjet"
                className="hero-cta-material inline-flex items-center rounded-full px-7 py-3 text-lg md:text-xl lg:text-2xl font-light text-white min-h-[44px]"
                onClick={scrollToMarkets}
              >
                Lexo. Parashiko. Fito.
              </a>
            </Reveal>
          </div>
        </div>
      </div>
    </section>
  );
}
