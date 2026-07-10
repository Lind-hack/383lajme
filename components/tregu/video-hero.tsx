"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";

// Cinematic night-city rotation (Pexels, free license). Two stacked <video>
// layers crossfade between clips so the loop never hard-cuts — each clip
// dissolves into the next, and the playlist wraps around seamlessly.
const VIDEOS = [
  // #36244310 — aerial city skyline at night, 2560×1440 30fps
  "https://videos.pexels.com/video-files/36244310/15370739_2560_1440_30fps.mp4",
  // #30070091 — aerial nighttime cityscape with lights, 2732×1440 24fps
  "https://videos.pexels.com/video-files/30070091/12897525_2732_1440_24fps.mp4",
  // #18125882 — hyperlapse of Houston at night, 1922×1440 30fps
  "https://videos.pexels.com/video-files/18125882/18125882-uhd_1922_1440_30fps.mp4",
];
const CROSSFADE_MS = 1800;

function CinematicBackdrop() {
  const layerA = useRef<HTMLVideoElement>(null);
  const layerB = useRef<HTMLVideoElement>(null);
  // Mutable playback state lives in a ref — timeupdate fires ~4×/s and must
  // never re-render; React state only changes at the crossfade moment.
  const pb = useRef({ front: 0, index: 0, switching: false });
  const [front, setFront] = useState(0);

  useEffect(() => {
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
  }, []);

  const layerClass = "absolute inset-0 h-full w-full object-cover transition-opacity";
  return (
    <>
      <video
        ref={layerA}
        muted
        playsInline
        preload="auto"
        className={layerClass}
        style={{ opacity: front === 0 ? 1 : 0, transitionDuration: `${CROSSFADE_MS}ms` }}
      />
      <video
        ref={layerB}
        muted
        playsInline
        preload="auto"
        className={layerClass}
        style={{ opacity: front === 1 ? 1 : 0, transitionDuration: `${CROSSFADE_MS}ms` }}
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
      {lines.map((line, lineIndex) => (
        <span key={lineIndex} className="block">
          {line.split("").map((ch, charIndex) => (
            <span
              key={charIndex}
              className="inline-block"
              style={{
                opacity: started ? 1 : 0,
                transform: started ? "translateX(0)" : "translateX(-18px)",
                transition: "opacity 500ms ease, transform 500ms ease",
                transitionDelay: `${lineIndex * line.length * charDelay + charIndex * charDelay}ms`,
              }}
            >
              {ch === " " ? " " : ch}
            </span>
          ))}
        </span>
      ))}
    </h1>
  );
}

export default function VideoHero({ loggedIn }: { loggedIn: boolean }) {
  return (
    <section className="relative min-h-[100dvh] overflow-hidden bg-[#111111]">
      <CinematicBackdrop />

      <div className="relative z-10 flex min-h-[100dvh] flex-col px-6 md:px-12 lg:px-16 pt-28">
        <div className="flex flex-1 flex-col justify-end pb-12 lg:pb-16">
          <div className="lg:grid lg:grid-cols-2 lg:items-end">
            <div>
              <AnimatedHeading text={"Parashiko të ardhmen\nme 383 Tregu."} />

              <Reveal delay={800}>
                <p className="text-base md:text-lg text-gray-300 mb-5 max-w-[56ch]">
                  Tregu i parashikimeve i 383 — çdo pyetje lind nga lajmet e ditës. Zgjidh Po ose Jo,
                  vër bast me 383 Coin falas dhe përqindja tregon çka beson Kosova.
                </p>
              </Reveal>

              <div className="flex flex-wrap gap-4">
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
                <Reveal delay={1450}>
                  <a
                    href="#tregjet"
                    className="liquid-glass liquid-glass-btn btn-shimmer border border-white/20 text-white px-8 py-3 rounded-lg font-medium"
                  >
                    <span className="btn-shimmer-text">Shiko Tregjet</span>
                  </a>
                </Reveal>
              </div>
            </div>

            <Reveal delay={1750} className="mt-8 flex items-end justify-start lg:mt-0 lg:justify-end">
              <a href="#tregjet" className="liquid-glass liquid-glass-btn btn-shimmer border border-white/20 px-6 py-3 rounded-xl">
                <span className="btn-shimmer-text text-lg md:text-xl lg:text-2xl font-light text-white">
                  Lexo. Parashiko. Fito.
                </span>
              </a>
            </Reveal>
          </div>
        </div>
      </div>
    </section>
  );
}
