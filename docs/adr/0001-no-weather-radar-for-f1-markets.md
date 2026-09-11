# ADR 0001 — F1 markets use a forecast, not a weather radar

Date: 2026-09-12
Status: Accepted

## Context

The F1 race-winner model applies a small, bounded wet-weather adjustment. It is driven by
`lib/f1-weather.mjs`, which reads the MET Norway compact forecast for the exact circuit
coordinates (taken from the same-date Jolpica calendar) over the race-hour window.

Radar was repeatedly raised as the "real" version of this input. Research already established
the options and is not to be repeated:

- **RainViewer** — current API terms restrict free use to personal / educational /
  small-community use. Commercial use needs clarification, so it cannot simply be assumed.
- **EUMETNET OPERA** — genuinely open under CC BY 4.0.
  Gateway `https://api.meteogate.eu/eu-eumetnet-weather-radar/`, composite `0-20010-0-OPERA`,
  parameters RATE / ACRR / DBZH, formats ODIM HDF5 and cloud-optimised GeoTIFF, 24-hour rolling
  cache, anonymous rate limits, S3 at `https://s3.waw3-1.cloudferro.com/openradar-24h/`.
- **NOAA MRMS** — US regions only, and the service returns processed four-band imagery rather
  than a numeric dBZ point feed. Pixel colours are not physical measurements.

## Decision

Do not implement radar. Keep the MET Norway forecast as the only weather input.

## Why

A radar shows precipitation **now**. These markets close before the race starts
(`closes_at` is the session start), and the model's only weather consumer is
`forecast.rain_expected` over the race-hour window — a forecast question, not a nowcast one.
EUMETNET would mean ODIM HDF5 / GeoTIFF decoding plus circuit-coordinate grid mapping, for a
signal the market can no longer trade on by the time radar becomes more accurate than forecast.

The wet adjustment it feeds is deliberately tiny: sparse wet-history is shrunk toward neutral
and clamped to ±0.08, and applies only when the forecast carries positive precipitation.
Higher-fidelity input into a strongly-shrunk, clamped coefficient buys very little.

## Consequences

- Never describe the existing integration as radar. It is a forecast, with provider attribution
  and source timestamps, and missing precipitation stays missing rather than being inferred.
- `f1.forecast` is null on any market whose opening model predates the weather path; that is
  honest reporting of absent data, not a rendering bug.
- Upgrade path if this is revisited: EUMETNET OPERA is the licensing-safe source. It only
  becomes worthwhile alongside in-race trading, where a nowcast could actually be acted on.
