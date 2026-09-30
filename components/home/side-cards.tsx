// The left rail: weather, recommended stories, and the day's rates.
//
// These are reference, not reading — a reader checks them and goes back to the
// news. That is why they sit in their own narrow column rather than in the flow
// of the page, and why each is a self-contained card with its own header.
//
// The card treatment is deliberate rather than decorative. Each leads with an
// icon chip and an orange eyebrow so the three read as one set at a glance, and
// the ranked list uses two-digit numerals because "01" and "10" are the same
// width — a rank column that jitters as the list changes looks broken. The warm
// gradient and the single corner blob are the only ornament; everything else
// earns its place by being data.
//
// Each card is independent: a failed weather fetch, an empty article pool or a
// dead bank scrape removes its own card and nothing else. No card ever prints a
// number it could not verify.

import Link from "next/link";
import {
  Sun,
  Cloud,
  CloudRain,
  CloudSnow,
  CloudLightning,
  Fuel,
  ArrowLeftRight,
  ArrowUpRight,
  type LucideIcon,
} from "lucide-react";
import type { CityWeather } from "@/lib/weather";
import { weatherKind } from "@/lib/weather";
import type { ExchangeSnapshot, FuelSnapshot } from "@/lib/home-market-data";
import type { Article } from "@/lib/mock-data";
import { getCategoryColor } from "@/lib/category-colors";
import TimeAgo from "@/components/time-ago";

const WEATHER_ICON: Record<string, LucideIcon> = {
  clear: Sun,
  cloud: Cloud,
  rain: CloudRain,
  snow: CloudSnow,
  storm: CloudLightning,
};

/** Cheapest diesel across the brands that actually reported one. */
function cheapestDiesel(fuel: FuelSnapshot | null | undefined) {
  if (!fuel) return null;
  const prices = fuel.brands
    .map((b) => b.diesel)
    .filter((p): p is number => typeof p === "number" && p > 0);
  return prices.length ? Math.min(...prices) : null;
}

export default function SideCards({
  weather = [],
  exchange,
  fuel,
  recommended = [],
}: {
  weather?: CityWeather[];
  exchange?: ExchangeSnapshot | null;
  fuel?: FuelSnapshot | null;
  /** Four headlines. Five made the rail taller than the viewport, and the
   *  rail is what drives the height of the whole first row. */
  recommended?: Article[];
}) {
  const diesel = cheapestDiesel(fuel);
  const hasRates = Boolean(exchange) || diesel !== null;
  if (weather.length === 0 && !hasRates && recommended.length === 0) return null;

  return (
    <aside className="home-rail" aria-label="Referenca e ditës">
      {weather.length > 0 && (
        <section className="rail-card" aria-labelledby="rail-weather-title">
          <header className="rail-head">
            <span className="rail-icon" data-tone="sky" aria-hidden="true">
              <Sun size={19} strokeWidth={2.3} />
            </span>
            <span className="rail-headtext">
              <b>Moti sot</b>
              <h3 id="rail-weather-title">Tri qytete</h3>
            </span>
          </header>

          <ul className="rail-weather">
            {weather.map((city) => {
              const Icon = WEATHER_ICON[weatherKind(city.code)] ?? Cloud;
              return (
                <li key={city.city}>
                  <Icon size={17} strokeWidth={2.2} aria-hidden="true" />
                  <span>{city.city}</span>
                  <em>
                    {city.tempC}
                    <i>°</i>
                  </em>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {recommended.length > 0 && (
        <section className="rail-card" aria-labelledby="rail-read-title">
          <header className="rail-head rail-head--plain">
            <h3 id="rail-read-title">Të rekomanduara</h3>
            <i className="rail-dot" aria-hidden="true" />
          </header>

          <ol className="rail-read">
            {recommended.slice(0, 4).map((article, i) => (
              <li key={article.id}>
                <Link href={`/article/${article.slug}`}>
                  {/* Two digits always: "01" and "10" are the same width, so the
                      rank column cannot jitter as the list changes. */}
                  <span className="rail-rank">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="rail-readbody">
                    <strong>{article.title}</strong>
                    <em>
                      <b style={{ color: getCategoryColor(article.category) }}>
                        {article.category}
                      </b>
                      <i aria-hidden="true">·</i>
                      <TimeAgo iso={article.publishedAt} />
                    </em>
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        </section>
      )}

      {hasRates && (
        <section className="rail-card rail-card--rates" aria-labelledby="rail-rates-title">
          <span className="rail-blob" aria-hidden="true" />

          <header className="rail-head">
            <span className="rail-icon" data-tone="orange" aria-hidden="true">
              <Fuel size={19} strokeWidth={2.3} />
            </span>
            <span className="rail-headtext">
              <b>Sot në treg</b>
              <h3 id="rail-rates-title">Çmimet e ditës</h3>
            </span>
          </header>

          <ul className="rail-rates">
            {diesel !== null && (
              <li>
                <span className="rail-rate-label">
                  <Fuel size={15} strokeWidth={2.2} aria-hidden="true" />
                  Nafta
                </span>
                <span className="rail-rate-value">
                  {diesel.toFixed(2)}
                  <i>€/L</i>
                </span>
              </li>
            )}
            {exchange && (
              <li>
                <span className="rail-rate-label">
                  <ArrowLeftRight size={15} strokeWidth={2.2} aria-hidden="true" />
                  EUR / LEK
                </span>
                <span className="rail-rate-value">
                  {exchange.allPerEur.toFixed(2)}
                  {typeof exchange.change === "number" && exchange.change !== 0 && (
                    <i data-dir={exchange.change > 0 ? "up" : "down"}>
                      {exchange.change > 0 ? "▲" : "▼"}
                      {Math.abs(exchange.change).toFixed(2)}
                    </i>
                  )}
                </span>
              </li>
            )}
          </ul>

          <p className="rail-note">
            Çmimi më i fundit i publikuar. Mund të ndryshojë sipas lokacionit.
          </p>

          <footer className="rail-foot">
            <span>Përditësim ditor</span>
            <Link href="/kategori/ekonomi">
              Ekonomia <ArrowUpRight size={13} strokeWidth={2.6} aria-hidden="true" />
            </Link>
          </footer>
        </section>
      )}
    </aside>
  );
}
