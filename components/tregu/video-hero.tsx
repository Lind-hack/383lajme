"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";

const VIDEO_URL =
  "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260403_050628_c4e32401-fab4-4a27-b7a8-6e9291cd5959.mp4";

function FadeIn({
  delay,
  duration = 1000,
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
      className={`transition-opacity ${className}`}
      style={{ opacity: visible ? 1 : 0, transitionDuration: `${duration}ms` }}
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
      <video
        src={VIDEO_URL}
        autoPlay
        loop
        muted
        playsInline
        className="absolute inset-0 h-full w-full object-cover"
      />

      <div className="relative z-10 flex min-h-[100dvh] flex-col px-6 md:px-12 lg:px-16 pt-28">
        <div className="flex flex-1 flex-col justify-end pb-12 lg:pb-16">
          <div className="lg:grid lg:grid-cols-2 lg:items-end">
            <div>
              <AnimatedHeading text={"Parashiko të ardhmen\nme 383 Tregu."} />

              <FadeIn delay={800}>
                <p className="text-base md:text-lg text-gray-300 mb-5 max-w-[56ch]">
                  Tregu i parashikimeve i 383 — çdo pyetje lind nga lajmet e ditës. Zgjidh Po ose Jo,
                  vër bast me 383 Coin falas dhe përqindja tregon çka beson Kosova.
                </p>
              </FadeIn>

              <FadeIn delay={1200}>
                <div className="flex flex-wrap gap-4">
                  {!loggedIn && (
                    <Link
                      href="/hyr"
                      className="bg-white text-black px-8 py-3 rounded-lg font-medium transition-colors hover:bg-gray-100"
                    >
                      Merr 100 383 Coin falas
                    </Link>
                  )}
                  <a
                    href="#tregjet"
                    className="liquid-glass border border-white/20 text-white px-8 py-3 rounded-lg font-medium transition-colors hover:bg-white hover:text-black"
                  >
                    Shiko tregjet
                  </a>
                </div>
              </FadeIn>
            </div>

            <FadeIn delay={1400} className="mt-8 flex items-end justify-start lg:mt-0 lg:justify-end">
              <div className="liquid-glass border border-white/20 px-6 py-3 rounded-xl">
                <span className="text-lg md:text-xl lg:text-2xl font-light text-white">
                  Lexo. Parashiko. Fito.
                </span>
              </div>
            </FadeIn>
          </div>
        </div>
      </div>
    </section>
  );
}
