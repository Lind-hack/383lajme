// The thin bar under the navbar.
//
// It replaces a 58-second scrolling marquee of ten headlines. A marquee fails
// the reader twice over: moving text cannot be read at a comfortable pace, and
// it cannot be re-read once it has passed. It was also the loudest thing on the
// first screen — a solid orange band in motion — so the eye went there before
// it reached the lead story.
//
// This bar is quiet on purpose: a faint orange tint rather than a colour block,
// the newest headline with its category and age, and arrows to step back
// through the last few. It still says "news is happening"; it no longer shouts
// it. Date and Prishtina's weather sit on the right.

import { Sun, Cloud, CloudRain, CloudSnow, CloudLightning } from "lucide-react";
import type { CityWeather } from "@/lib/weather";
import { weatherKind } from "@/lib/weather";
import LatestStepper, { type LatestItem } from "./latest-stepper";

const ICON = {
  clear: Sun,
  cloud: Cloud,
  rain: CloudRain,
  snow: CloudSnow,
  storm: CloudLightning,
};

/** "12 Janar 2026" — written out, because a news page dates itself in words. */
const MONTHS = [
  "Janar", "Shkurt", "Mars", "Prill", "Maj", "Qershor",
  "Korrik", "Gusht", "Shtator", "Tetor", "Nëntor", "Dhjetor",
];

/** Today in Kosovo, not on the server. Production runs in UTC, which printed
 *  yesterday's date for the first hour or two of every Kosovo morning. */
function kosovoDateLabel(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Belgrade",
    day: "numeric",
    month: "numeric",
    year: "numeric",
  }).formatToParts(now);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return `${get("day")} ${MONTHS[get("month") - 1]} ${get("year")}`;
}

export default function BreakingBar({
  latest = [],
  weather,
}: {
  /** Newest first. The first is shown; the rest are one arrow-press away. */
  latest?: LatestItem[];
  /** Prishtina's reading; the side cards carry the other cities. */
  weather?: CityWeather | null;
}) {
  const Icon = weather ? ICON[weatherKind(weather.code)] ?? Cloud : null;

  return (
    <div className="home-breaking" role="region" aria-label="Lajmet e fundit">
      <div className="home-breaking-inner">
        <LatestStepper items={latest} />

        <span className="home-breaking-right">
          <span className="home-breaking-date">Prishtinë, {kosovoDateLabel()}</span>
          {weather && Icon && (
            <>
              <i className="home-breaking-sep" aria-hidden="true" />
              <span className="home-breaking-temp">
                <Icon size={15} strokeWidth={2.2} aria-hidden="true" />
                {weather.tempC}°
              </span>
            </>
          )}
        </span>
      </div>
    </div>
  );
}
